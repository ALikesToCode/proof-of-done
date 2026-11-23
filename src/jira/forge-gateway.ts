import api, { route } from '@forge/api';
import { AdfNode, adfParagraphs, adfText } from '../core/adf';
import {
  IssueBrief,
  IssueContext,
  IssueInfo,
  IssueRow,
  JiraGateway,
  NewIssue,
  PROOF_PROPERTY_KEY,
  ProjectInfo,
  ProofProperty,
  RunAs,
  TransitionInfo,
} from './gateway';

const ISSUE_FIELDS = 'summary,description,issuetype,status,assignee,parent,project';
const ROW_FIELDS = ['summary', 'issuetype', 'status', 'assignee', 'statuscategorychangedate'];
const CONTEXT_FIELDS = 'priority,labels,components,assignee,reporter,duedate,subtasks,issuelinks';
const COMMENTS_SHOWN = 5;
const JSON_HEADERS = { Accept: 'application/json', 'Content-Type': 'application/json' };

type Json = Record<string, unknown>;

const object = (value: unknown): Json => (value && typeof value === 'object' ? (value as Json) : {});
const text = (value: unknown): string => (typeof value === 'string' ? value : value === null || value === undefined ? '' : String(value));

function requester(as: RunAs) {
  return as === 'user' ? api.asUser() : api.asApp();
}

export function toIssueInfo(raw: unknown): IssueInfo {
  const issue = object(raw);
  const fields = object(issue['fields']);
  const project = object(fields['project']);
  const status = object(fields['status']);
  const assignee = fields['assignee'] ? object(fields['assignee']) : null;
  const parent = fields['parent'] ? object(fields['parent']) : null;
  const description = fields['description'];
  return {
    id: text(issue['id']),
    key: text(issue['key']),
    projectId: text(project['id']),
    projectKey: text(project['key']),
    summary: text(fields['summary']),
    description: description && typeof description === 'object' ? (description as AdfNode) : null,
    issueType: text(object(fields['issuetype'])['name']),
    statusName: text(status['name']),
    statusCategory: text(object(status['statusCategory'])['key']),
    assigneeAccountId: assignee ? text(assignee['accountId']) || null : null,
    parentKey: parent ? text(parent['key']) || null : null,
  };
}

export function toIssueRow(raw: unknown): IssueRow {
  const issue = object(raw);
  const fields = object(issue['fields']);
  const status = object(fields['status']);
  const assignee = fields['assignee'] ? object(fields['assignee']) : null;
  const changed = Date.parse(text(fields['statuscategorychangedate']));
  return {
    id: text(issue['id']),
    key: text(issue['key']),
    summary: text(fields['summary']),
    issueType: text(object(fields['issuetype'])['name']),
    statusName: text(status['name']),
    statusCategory: text(object(status['statusCategory'])['key']),
    assigneeAccountId: assignee ? text(assignee['accountId']) || null : null,
    statusCategoryChangedAt: Number.isFinite(changed) ? changed : null,
  };
}

/** Builds the context of a work item from Jira's issue and its page of comments. */
export function toIssueContext(rawIssue: unknown, rawComments: unknown): IssueContext {
  const fields = object(object(rawIssue)['fields']);
  const list = (value: unknown): Json[] => (Array.isArray(value) ? value.map(object) : []);
  const person = (value: unknown): string | null => (value ? text(object(value)['displayName']) || null : null);
  const brief = (raw: unknown): IssueBrief => {
    const issue = object(raw);
    const issueFields = object(issue['fields']);
    return { key: text(issue['key']), summary: text(issueFields['summary']), statusName: text(object(issueFields['status'])['name']) };
  };
  const links = list(fields['issuelinks']).flatMap((link) => {
    const type = object(link['type']);
    if (link['outwardIssue']) return [{ relation: text(type['outward']) || text(type['name']), ...brief(link['outwardIssue']) }];
    if (link['inwardIssue']) return [{ relation: text(type['inward']) || text(type['name']), ...brief(link['inwardIssue']) }];
    return [];
  });
  const page = object(rawComments);
  const comments = list(page['comments']).map((comment) => ({
    author: person(comment['author']) ?? 'Someone',
    at: text(comment['created']),
    text: adfText(comment['body'] && typeof comment['body'] === 'object' ? (comment['body'] as AdfNode) : null).trim(),
  }));
  const total = Number(page['total']);
  return {
    priority: text(object(fields['priority'])['name']) || null,
    labels: Array.isArray(fields['labels']) ? fields['labels'].map(text).filter(Boolean) : [],
    components: list(fields['components'])
      .map((component) => text(component['name']))
      .filter(Boolean),
    assignee: person(fields['assignee']),
    reporter: person(fields['reporter']),
    dueDate: text(fields['duedate']) || null,
    subtasks: list(fields['subtasks']).map(brief),
    links,
    comments,
    commentTotal: Number.isFinite(total) && total > comments.length ? total : comments.length,
  };
}

/** What Jira said went wrong, short enough to show a person. */
async function jiraMessage(response: { json(): Promise<unknown> }): Promise<string> {
  try {
    const body = object(await response.json());
    const messages = Array.isArray(body['errorMessages']) ? body['errorMessages'].map(text) : [];
    const fields = Object.entries(object(body['errors'])).map(([field, message]) => `${field}: ${text(message)}`);
    return [...messages, ...fields].filter(Boolean).join(' ').slice(0, 300);
  } catch {
    return '';
  }
}

export class ForgeJiraGateway implements JiraGateway {
  async getIssue(idOrKey: string, as: RunAs): Promise<IssueInfo | null> {
    const response = await requester(as).requestJira(route`/rest/api/3/issue/${idOrKey}?fields=${ISSUE_FIELDS}`, {
      headers: { Accept: 'application/json' },
    });
    // Jira answers 404 both for a missing work item and for one the caller may not see.
    if (response.status === 404 || response.status === 403 || response.status === 400) return null;
    if (!response.ok) throw new Error(`Jira returned ${response.status} when reading work item ${idOrKey}.`);
    return toIssueInfo(await response.json());
  }

  async canEdit(issueId: string): Promise<boolean> {
    const response = await api
      .asUser()
      .requestJira(route`/rest/api/3/mypermissions?issueId=${issueId}&permissions=EDIT_ISSUES`, {
        headers: { Accept: 'application/json' },
      });
    if (!response.ok) return false;
    const body = object(await response.json());
    return object(object(body['permissions'])['EDIT_ISSUES'])['havePermission'] === true;
  }

  async setProofProperty(issueId: string, value: ProofProperty): Promise<void> {
    const response = await api.asApp().requestJira(route`/rest/api/3/issue/${issueId}/properties/${PROOF_PROPERTY_KEY}`, {
      method: 'PUT',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(value),
    });
    if (!response.ok) throw new Error(`Jira returned ${response.status} when saving the proof state of work item ${issueId}.`);
  }

  async getStatusCategory(statusId: string): Promise<string | null> {
    const response = await api.asApp().requestJira(route`/rest/api/3/status/${statusId}`, { headers: { Accept: 'application/json' } });
    if (!response.ok) return null;
    return text(object(object(await response.json())['statusCategory'])['key']) || null;
  }

  async listTransitions(issueId: string): Promise<TransitionInfo[]> {
    const response = await api.asApp().requestJira(route`/rest/api/3/issue/${issueId}/transitions`, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Jira returned ${response.status} when listing the transitions of work item ${issueId}.`);
    const transitions = object(await response.json())['transitions'];
    if (!Array.isArray(transitions)) return [];
    return transitions.map((raw) => {
      const transition = object(raw);
      const to = object(transition['to']);
      return {
        id: text(transition['id']),
        name: text(transition['name']),
        toStatusId: text(to['id']),
        toStatusName: text(to['name']),
        toCategory: text(object(to['statusCategory'])['key']),
      };
    });
  }

  async transition(issueId: string, transitionId: string): Promise<void> {
    const response = await api.asApp().requestJira(route`/rest/api/3/issue/${issueId}/transitions`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ transition: { id: transitionId } }),
    });
    if (!response.ok) throw new Error(`Jira returned ${response.status} when moving work item ${issueId}.`);
  }

  async addComment(issueId: string, paragraphs: string[]): Promise<void> {
    const response = await api.asApp().requestJira(route`/rest/api/3/issue/${issueId}/comment`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: adfParagraphs(paragraphs) }),
    });
    if (!response.ok) throw new Error(`Jira returned ${response.status} when commenting on work item ${issueId}.`);
  }

  async getProject(projectId: string, as: RunAs): Promise<ProjectInfo | null> {
    const response = await requester(as).requestJira(route`/rest/api/3/project/${projectId}`, { headers: { Accept: 'application/json' } });
    if (response.status === 404 || response.status === 403 || response.status === 400) return null;
    if (!response.ok) throw new Error(`Jira returned ${response.status} when reading project ${projectId}.`);
    const project = object(await response.json());
    const types = Array.isArray(project['issueTypes']) ? project['issueTypes'].map(object) : [];
    return {
      id: text(project['id']),
      key: text(project['key']),
      name: text(project['name']),
      issueTypes: types.filter((t) => t['subtask'] !== true).map((t) => ({ id: text(t['id']), name: text(t['name']) })),
    };
  }

  async canAdminister(projectId: string): Promise<boolean> {
    const response = await api
      .asUser()
      .requestJira(route`/rest/api/3/mypermissions?projectId=${projectId}&permissions=ADMINISTER_PROJECTS,ADMINISTER`, {
        headers: { Accept: 'application/json' },
      });
    if (!response.ok) return false;
    const permissions = object(object(await response.json())['permissions']);
    // A Jira admin can change any project's settings, also one whose Administrators role they are not in.
    return ['ADMINISTER_PROJECTS', 'ADMINISTER'].some((key) => object(permissions[key])['havePermission'] === true);
  }

  async countIssues(jql: string, as: RunAs): Promise<number> {
    const response = await requester(as).requestJira(route`/rest/api/3/search/approximate-count`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ jql }),
    });
    if (!response.ok) throw new Error(`Jira returned ${response.status} when counting work items.`);
    return Number(object(await response.json())['count'] ?? 0) || 0;
  }

  async getIssueRows(issueIds: string[], as: RunAs): Promise<IssueRow[]> {
    if (issueIds.length === 0) return [];
    // Unlike a JQL search, this does not fail when one of the ids is gone or hidden.
    const response = await requester(as).requestJira(route`/rest/api/3/issue/bulkfetch`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ issueIdsOrKeys: issueIds.slice(0, 100), fields: ROW_FIELDS }),
    });
    if (!response.ok) throw new Error(`Jira returned ${response.status} when reading work items.`);
    const issues = object(await response.json())['issues'];
    return Array.isArray(issues) ? issues.map(toIssueRow) : [];
  }

  async getIssueContext(idOrKey: string, as: RunAs): Promise<IssueContext | null> {
    const headers = { Accept: 'application/json' };
    const [issue, comments] = await Promise.all([
      requester(as).requestJira(route`/rest/api/3/issue/${idOrKey}?fields=${CONTEXT_FIELDS}`, { headers }),
      requester(as).requestJira(route`/rest/api/3/issue/${idOrKey}/comment?orderBy=-created&maxResults=${COMMENTS_SHOWN}`, { headers }),
    ]);
    if (issue.status === 404 || issue.status === 403 || issue.status === 400) return null;
    if (!issue.ok) throw new Error(`Jira returned ${issue.status} when reading the context of work item ${idOrKey}.`);
    // Comments are an extra. A work item whose comments cannot be read still gets the rest.
    return toIssueContext(await issue.json(), comments.ok ? await comments.json() : null);
  }

  async createIssue(issue: NewIssue): Promise<{ id: string; key: string }> {
    const fields: Json = {
      project: { id: issue.projectId },
      issuetype: { id: issue.issueTypeId },
      summary: issue.summary,
      description: issue.description,
    };
    const create = (withLabels: boolean) =>
      api.asApp().requestJira(route`/rest/api/3/issue`, {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ fields: withLabels && issue.labels.length > 0 ? { ...fields, labels: issue.labels } : fields }),
      });
    let response = await create(true);
    // Some projects keep labels off the create screen. The label is a convenience, so go without.
    if (response.status === 400 && issue.labels.length > 0) response = await create(false);
    if (!response.ok) {
      const reason = await jiraMessage(response);
      throw new Error(`Jira returned ${response.status} when creating a work item.${reason ? ` ${reason}` : ''}`);
    }
    const created = object(await response.json());
    return { id: text(created['id']), key: text(created['key']) };
  }

  async deleteIssue(issueId: string): Promise<boolean> {
    const response = await api.asApp().requestJira(route`/rest/api/3/issue/${issueId}?deleteSubtasks=true`, { method: 'DELETE' });
    return response.ok || response.status === 404;
  }
}
