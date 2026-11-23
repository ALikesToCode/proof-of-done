import { ForgeJiraGateway } from '../jira/forge-gateway';
import { GateService, StatusChange, ValidatorResult } from '../services/gate';
import { SqlContractStore } from '../store/sql-store';

const gate = new GateService(new SqlContractStore(), new ForgeJiraGateway());

type Json = Record<string, unknown>;
const object = (value: unknown): Json => (value && typeof value === 'object' && !Array.isArray(value) ? (value as Json) : {});
const text = (value: unknown): string => (typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '');

/** Finds a status with the given id anywhere in the event's list of associated statuses. */
function categoryOf(statusId: string, associated: unknown): string | null {
  const list = Array.isArray(associated) ? associated : Object.values(object(associated)).flatMap((v) => (Array.isArray(v) ? v : []));
  for (const raw of list) {
    const status = object(raw);
    if (text(status['id']) === statusId) return text(object(status['statusCategory'])['key']) || null;
  }
  return null;
}

/** Turns Jira's "issue updated" payload into a status change, or null when the status did not change. */
export function toStatusChange(event: unknown): StatusChange | null {
  const payload = object(event);
  const changelog = object(payload['changelog']);
  const items = changelog['items'];
  if (!Array.isArray(items)) return null;
  const item = items.map(object).find((i) => i['field'] === 'status' || i['fieldId'] === 'status');
  if (!item) return null;
  const issueId = text(object(payload['issue'])['id']);
  if (!issueId) return null;
  const fromStatusId = text(item['from']) || null;
  const occurredAt = Number(payload['timestamp']);
  return {
    issueId,
    fromStatusId,
    fromStatusName: text(item['fromString']) || null,
    fromCategory: fromStatusId ? categoryOf(fromStatusId, payload['associatedStatuses']) : null,
    actorAccountId: text(payload['atlassianId']) || null,
    changeId: text(changelog['id']) || null,
    occurredAt: Number.isFinite(occurredAt) && occurredAt > 0 ? occurredAt : null,
  };
}

/** Jira tells the app a work item changed. Only status changes matter here. */
export async function onIssueUpdated(event: unknown): Promise<void> {
  const change = toStatusChange(event);
  if (!change) return;
  const action = await gate.onStatusChange(change);
  if (action !== 'ignored') console.log(`Proof of Done: status change on work item ${change.issueId}: ${action}.`);
}

/** The workflow validator: Jira asks whether a transition may go ahead. */
export async function validateDone(request: unknown): Promise<ValidatorResult> {
  const payload = object(request);
  const issue = object(payload['issue']);
  const ref = text(issue['key']) || text(issue['id']);
  if (!ref) return { result: true };
  try {
    return await gate.validate(ref, text(object(payload['user'])['accountId']) || null);
  } catch (error) {
    // A fault in this app must not lock a team out of its own workflow.
    console.error(`Proof of Done: the validator failed for ${ref} and let the transition through.`, error);
    return { result: true };
  }
}
