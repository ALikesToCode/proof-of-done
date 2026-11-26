import { PodError, errorLine } from '../core/errors';
import { AgentService } from '../services/agent';
import { Caller } from '../services/contracts';

/**
 * The agent tools: Forge actions that a Rovo agent or an outside coding agent calls.
 * Nothing here imports Forge, so the tests run it as it is.
 *
 * Inputs are written by a language model, so each one is read defensively. Who is
 * calling comes from the invocation context, never from an input.
 */

export const TOOLS = [
  'get-context-pack',
  'get-done-contract',
  'start-done-contract',
  'submit-evidence',
  'list-unproven-work',
  'list-evidence-to-review',
  'record-verdict',
  'list-proof-blockers',
  'write-repair-brief',
] as const;
export type ToolName = (typeof TOOLS)[number];

/** The tools an outside agent reaches through MCP. Judging evidence is not among them, on purpose. */
export const MCP_TOOLS: readonly ToolName[] = ['get-context-pack', 'get-done-contract', 'start-done-contract', 'submit-evidence', 'list-unproven-work'];

/** The two tools that judge evidence. */
export const VERDICT_TOOLS: readonly ToolName[] = ['list-evidence-to-review', 'record-verdict'];

/** The tools only the Proof Verifier has. A call to one of them is a review, never a submission. */
export const VERIFIER_TOOLS: readonly ToolName[] = [...VERDICT_TOOLS, 'list-proof-blockers', 'write-repair-brief'];

export type ToolResult = ({ ok: true } & Record<string, unknown>) | { ok: false; code: string; error: string };

type Json = Record<string, unknown>;
const object = (value: unknown): Json => (value && typeof value === 'object' && !Array.isArray(value) ? (value as Json) : {});
const asText = (value: unknown): string => (typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '');

const ISSUE_KEY = /[A-Za-z][A-Za-z0-9_]*-\d+/;
const NEEDS_ACCESS =
  'Proof of Done cannot act as you yet. Open the Proof of Done panel on any work item in Jira, choose Allow access, and then call this tool again.';

/** The Atlassian account the call runs as. Forge sets it; a tool input cannot. */
export function accountOf(context: unknown): string | null {
  const invocation = object(context);
  return asText(object(invocation['principal'])['accountId']) || asText(invocation['accountId']) || null;
}

/**
 * The work item a call is about. A model may pass a link or a sentence instead of the
 * bare key, and Rovo adds the work item on screen to the payload, so try both.
 */
export function issueOf(input: Json): string {
  const given = asText(input['issueKey']).trim();
  const key = ISSUE_KEY.exec(given)?.[0];
  if (key) return key;
  if (/^\d+$/.test(given)) return given;
  const onScreen = object(object(input['context'])['jira']);
  const screenKey = ISSUE_KEY.exec(asText(onScreen['issueKey']))?.[0];
  if (screenKey) return screenKey;
  const screenId = asText(onScreen['issueId']).trim();
  return /^\d+$/.test(screenId) ? screenId : given;
}

export function projectOf(input: Json): string {
  const given = asText(input['projectKey']).trim();
  // "ABC-12" names a work item. Its project is what the model meant.
  const fromIssue = /^([A-Za-z][A-Za-z0-9_]*)-\d+$/.exec(given)?.[1];
  if (fromIssue) return fromIssue;
  if (given) return given;
  return asText(object(object(input['context'])['jira'])['projectKey']).trim();
}

function needsAccess(error: unknown): boolean {
  const e = object(error);
  return e['name'] === 'NEEDS_AUTHENTICATION_ERR' || e['status'] === 401 || /authentication required|returned 401/i.test(asText(e['message']));
}

function dispatch(agent: AgentService, name: ToolName, input: Json, caller: Caller): Promise<object> {
  switch (name) {
    case 'get-context-pack':
      return agent.contextPack(issueOf(input), caller);
    case 'get-done-contract':
      return agent.contract(issueOf(input), caller);
    case 'start-done-contract':
      return agent.start(issueOf(input), caller);
    case 'submit-evidence':
      return agent.submit(input, caller);
    case 'list-unproven-work':
      return agent.unproven(projectOf(input), input['windowDays']);
    case 'list-evidence-to-review':
      return agent.reviewQueue(issueOf(input), caller);
    case 'record-verdict':
      return agent.verdict({ ...input, issueKey: issueOf(input) }, caller);
    case 'list-proof-blockers':
      return agent.blockers(issueOf(input), caller);
    case 'write-repair-brief':
      return agent.writeBrief({ ...input, issueKey: issueOf(input) }, caller);
  }
}

export async function runTool(agent: AgentService, name: ToolName, payload: unknown, context: unknown): Promise<ToolResult> {
  const started = Date.now();
  let result: ToolResult;
  try {
    const input = object(payload);
    const accountId = accountOf(context);
    if (!accountId) {
      throw new PodError('forbidden', 'This call does not say which Atlassian account it runs as, so Proof of Done cannot tell what it may see.');
    }
    const caller: Caller = VERIFIER_TOOLS.includes(name)
      ? { accountId, via: 'verifier' }
      : { accountId, via: 'agent', agentName: asText(input['agentName']).trim().slice(0, 128) || null };
    result = { ok: true, ...(await dispatch(agent, name, input, caller)) };
  } catch (error) {
    if (error instanceof PodError) {
      result = { ok: false, code: error.code, error: error.message };
    } else if (needsAccess(error)) {
      result = { ok: false, code: 'needs_access', error: NEEDS_ACCESS };
    } else {
      // One line, and never the payload: it can hold a ticket's text.
      console.error(`Proof of Done: tool ${name} failed. ${errorLine(error)}`);
      result = { ok: false, code: 'internal', error: 'Proof of Done could not finish this call. Try it again.' };
    }
  }
  console.log(`Proof of Done: tool ${name} ${result.ok ? 'ok' : result.code} in ${Date.now() - started} ms.`);
  return result;
}
