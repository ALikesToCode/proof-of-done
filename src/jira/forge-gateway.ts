import api, { route } from '@forge/api';
import { AdfNode } from '../core/adf';
import { IssueInfo, JiraGateway, PROOF_PROPERTY_KEY, ProofProperty, RunAs } from './gateway';

const ISSUE_FIELDS = 'summary,description,issuetype,status,assignee,parent,project';

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
}
