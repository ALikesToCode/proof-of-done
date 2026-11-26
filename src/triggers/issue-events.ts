import { errorLine } from '../core/errors';
import { ForgeJiraGateway } from '../jira/forge-gateway';
import { GateService, REFUSES_BROKEN, StatusChange, ValidatorResult } from '../services/gate';
import { SqlContractStore } from '../store/sql-store';

const store = new SqlContractStore();
const gate = new GateService(store, new ForgeJiraGateway());

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

/** The id of the work item a "deleted" event is about, or null when the event names none. */
export function deletedIssueId(event: unknown): string | null {
  return text(object(object(event)['issue'])['id']) || null;
}

/** Jira tells the app a work item was deleted. Its contract and proof go with it. */
export async function onIssueDeleted(event: unknown): Promise<void> {
  const issueId = deletedIssueId(event);
  if (!issueId) return;
  await store.purgeIssue(issueId);
  console.log(`Proof of Done: work item ${issueId} was deleted, so its contract is gone too.`);
}

/**
 * The workflow validator: Jira asks whether a transition may go ahead. The answer for a
 * check that could not be made is the project's choice, and the gate applies it. What is
 * left for here is a fault nobody planned for, and that refuses too: a validator that
 * says yes when it did not look is worth nothing.
 */
export async function validateDone(request: unknown): Promise<ValidatorResult> {
  const payload = object(request);
  const issue = object(payload['issue']);
  const id = text(issue['id']) || null;
  const ref = text(issue['key']) || id;
  // A work item that is being created has no key yet, and no contract either.
  if (!ref) return { result: true };
  try {
    return await gate.validate(ref, text(object(payload['user'])['accountId']) || null, id);
  } catch (error) {
    console.error(`Proof of Done: the validator failed for ${ref} and refused the transition. ${errorLine(error)}`);
    return { result: false, errorMessage: REFUSES_BROKEN };
  }
}
