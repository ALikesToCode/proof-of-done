import api, { __getRuntime, getAppContext } from '@forge/api';
import { LinkedItem, LinkedKind, LinkedWork, toLinkedState } from '../core/graph';
import { GraphGateway } from './gateway';

/**
 * Reads the Teamwork Graph API (Preview) through its curated queries. The call runs
 * as the person using the app, so the graph returns only what they may see.
 *
 * The graph wants every operation named in the shape company_operation, and gives at
 * most 25 rows per field. A scope the admin withheld empties a list without an error.
 */

export const LINKED_OPERATION = 'proofofdone_linkedDevelopment';

/** Builds have no query of their own, so they come out of the list of all development artifacts. */
export const LINKED_QUERY = `query ${LINKED_OPERATION}($id: ID!) {
  pullRequests: jiraWorkItemLinkedExternalPullRequests(id: $id, first: 25) {
    edges { node { __typename ... on ExternalPullRequest { title displayId url status lastUpdatedAt provider { name } } } }
    pageInfo { hasNextPage }
  }
  deployments: jiraWorkItemLinkedExternalDeployments(id: $id, first: 25) {
    edges { node { __typename ... on ExternalDeployment { displayName url state environment { displayName type } lastUpdatedAt provider { name } } } }
    pageInfo { hasNextPage }
  }
  artifacts: jiraWorkItemDevelopmentArtifacts(id: $id, first: 25) {
    edges { node { __typename ... on ExternalBuild { displayName buildNumber url state lastUpdatedAt provider { name } } } }
    pageInfo { hasNextPage }
  }
}`;

type Json = Record<string, unknown>;

const NAME_LIMIT = 160;
const object = (value: unknown): Json => (value && typeof value === 'object' && !Array.isArray(value) ? (value as Json) : {});

/** One line of text from a tool outside Jira: no line breaks, and not long. */
function line(value: unknown): string {
  if (typeof value !== 'string' && typeof value !== 'number') return '';
  return String(value).replace(/\s+/g, ' ').trim().slice(0, NAME_LIMIT);
}

function link(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function time(value: unknown): string | null {
  const at = typeof value === 'string' || typeof value === 'number' ? new Date(value).getTime() : NaN;
  return Number.isFinite(at) ? new Date(at).toISOString() : null;
}

const common = (node: Json) => ({
  url: link(node['url']),
  provider: line(object(node['provider'])['name']) || null,
  updatedAt: time(node['lastUpdatedAt']),
});

function pullRequest(node: Json): LinkedItem {
  const name = [line(node['displayId']), line(node['title'])].filter(Boolean).join(' ');
  return { kind: 'pull_request', name: name || 'Pull request', state: toLinkedState(node['status']), environment: null, ...common(node) };
}

function deployment(node: Json): LinkedItem {
  const environment = object(node['environment']);
  const type = line(environment['type']).toLowerCase();
  return {
    kind: 'deployment',
    name: line(node['displayName']) || 'Deployment',
    state: toLinkedState(node['state']),
    environment: line(environment['displayName']) || (type && type !== 'unmapped' ? type : null),
    ...common(node),
  };
}

function build(node: Json): LinkedItem {
  const number = line(node['buildNumber']);
  return {
    kind: 'build',
    name: line(node['displayName']) || (number ? `Build ${number}` : 'Build'),
    state: toLinkedState(node['state']),
    environment: null,
    ...common(node),
  };
}

const PARTS: Array<{ field: string; type: string; kind: LinkedKind; read: (node: Json) => LinkedItem; required: boolean }> = [
  { field: 'pullRequests', type: 'ExternalPullRequest', kind: 'pull_request', read: pullRequest, required: true },
  { field: 'deployments', type: 'ExternalDeployment', kind: 'deployment', read: deployment, required: true },
  { field: 'artifacts', type: 'ExternalBuild', kind: 'build', read: build, required: false },
];

/**
 * Turns the answer to LINKED_QUERY into the app's own shape. Null when the graph did
 * not answer for pull requests or deployments. Builds are an extra: when their part
 * is missing, the rest still counts and builds are marked as not read in full.
 */
export function toLinkedWork(body: unknown): LinkedWork | null {
  const data = object(body)['data'];
  if (!data || typeof data !== 'object') return null;
  const items: LinkedItem[] = [];
  const partial: LinkedKind[] = [];
  for (const part of PARTS) {
    const connection = object(data)[part.field];
    if (!connection || typeof connection !== 'object') {
      if (part.required) return null;
      partial.push(part.kind);
      continue;
    }
    const edges = object(connection)['edges'];
    for (const edge of Array.isArray(edges) ? edges : []) {
      const node = object(object(edge)['node']);
      if (node['__typename'] === part.type) items.push(part.read(node));
    }
    if (object(object(connection)['pageInfo'])['hasNextPage'] === true) partial.push(part.kind);
  }
  return { items, partial };
}

/** The Atlassian resource identifier of a Jira work item, which is how the graph names it. */
export function workItemAri(cloudId: string, issueId: string): string {
  return `ari:cloud:jira:${cloudId}:issue/${issueId}`;
}

const SITE_IN_ARI = /site\/([0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})/i;

/** The id of the site this call runs on. Forge keeps it in the installation's context. */
function siteId(): string | null {
  try {
    const fromInstallation = (getAppContext().installation?.contexts ?? []).map((context) => context.cloudId).find(Boolean);
    if (fromInstallation) return fromInstallation;
  } catch {
    // Fall through to the runtime's own context.
  }
  try {
    return SITE_IN_ARI.exec(__getRuntime().contextAri ?? '')?.[1] ?? null;
  } catch {
    return null;
  }
}

export class ForgeGraphGateway implements GraphGateway {
  async linkedWork(issueId: string): Promise<LinkedWork | null> {
    const cloudId = siteId();
    if (!cloudId || !/^\d{1,18}$/.test(issueId)) return null;
    const response = await api.asUser().requestTeamworkGraph(LINKED_QUERY, { id: workItemAri(cloudId, issueId) }, LINKED_OPERATION);
    if (!response.ok) {
      console.warn(`Proof of Done: the Teamwork Graph answered ${response.status}.`);
      return null;
    }
    const body: unknown = await response.json();
    const errors = object(body)['errors'];
    if (Array.isArray(errors) && errors.length > 0) {
      // One line, and never the answer itself: it can name a team's pull requests.
      console.warn(`Proof of Done: the Teamwork Graph reported ${errors.length} problem(s). ${line(object(errors[0])['message'])}`);
    }
    return toLinkedWork(body);
  }
}
