/**
 * Drives the gate's own services for the control evaluation.
 *
 * One call replays one work item from scratch: a person writes the contract, the coding
 * agent's submissions go through `submit-evidence` in order, and then, when verdicts are
 * given, the reviewer records them through `record-verdict`. Nothing here decides
 * anything. The checks, the review queue and the gate decision all come from
 * src/services and src/core, on the in-memory store the unit tests use.
 *
 * Reads one JSON request on stdin and writes one JSON answer on stdout:
 *
 *   { task: { key, summary, description, criteria: [{ text, requiredKind }] },
 *     submissions: [ <submit-evidence input, with criterionId "c1".."cN"> ],
 *     verdicts?: [ { evidenceId: "e1", decision, reason } ] }
 *
 * The store makes random ids, so the answer swaps them for stable ones: criteria are
 * c1..cN in contract order, and evidence is e1..eM in submission order.
 */
import { AgentService } from '../../src/services/agent';
import { Caller, ContractService } from '../../src/services/contracts';
import { GraphService } from '../../src/services/graph';
import { ProjectService } from '../../src/services/project';
import { PodError } from '../../src/core/errors';
import type { RequiredKind } from '../../src/core/types';
import { doc, p } from '../../test/helpers/adf';
import { FakeGraph, FakeJira, MemoryStore, issueInfo } from '../../test/helpers/fakes';

interface Request {
  task: { key: string; summary: string; description: string; criteria: Array<{ text: string; requiredKind: RequiredKind }> };
  submissions: Array<Record<string, unknown>>;
  verdicts?: Array<{ evidenceId: string; decision: string; reason: string }>;
}

/** The person who wrote the contract and reads the reviews. */
const OWNER: Caller = { accountId: 'owner', via: 'ui' };
/** The coding agent, acting for a second person. */
const AGENT: Caller = { accountId: 'developer', via: 'agent', agentName: 'coding-agent' };
/** The reviewing agent, asked by the owner. */
const VERIFIER: Caller = { accountId: 'owner', via: 'verifier' };

const NOW = 1_800_000_000_000;

function failure(error: unknown): { ok: false; code: string; error: string } {
  if (error instanceof PodError) return { ok: false, code: error.code, error: error.message };
  return { ok: false, code: 'internal', error: error instanceof Error ? error.message : String(error) };
}

async function main(): Promise<void> {
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  const request = JSON.parse(raw) as Request;

  const store = new MemoryStore();
  const jira = new FakeJira();
  let clock = NOW;
  const now = () => clock++;
  jira.clock = () => clock;
  const contracts = new ContractService(store, jira, now);
  const agent = new AgentService(contracts, new ProjectService(store, jira, now), jira, store, new GraphService(contracts, new FakeGraph(), 50));

  const { task } = request;
  jira.add(
    issueInfo({
      id: '1',
      key: task.key,
      projectKey: task.key.split('-')[0] ?? 'EVAL',
      summary: task.summary,
      description: doc(...task.description.split(/\n{2,}/).map((block) => p(block))),
      assigneeAccountId: AGENT.accountId,
    }),
  );
  jira.dates.set('1', { createdAt: NOW - 86_400_000, statusCategoryChangedAt: null });

  await contracts.createContract(task.key, OWNER, { withSuggestions: false });
  const created = await contracts.addCriteria(
    task.key,
    OWNER,
    task.criteria.map((criterion) => ({ text: criterion.text, requiredKind: criterion.requiredKind })),
  );

  // Stable names for the store's random ids, both ways.
  const alias = new Map<string, string>();
  const real = new Map<string, string>();
  const name = (id: string, as: string) => {
    alias.set(id, as);
    real.set(as, id);
  };
  created.criteria.forEach((criterion, index) => name(criterion.id, `c${index + 1}`));

  const submitResults: unknown[] = [];
  for (const [index, submission] of request.submissions.entries()) {
    const criterionId = String(submission['criterionId'] ?? '').trim();
    try {
      const result = await agent.submit({ ...submission, criterionId: real.get(criterionId) ?? criterionId }, AGENT);
      name(result.evidenceId, `e${index + 1}`);
      submitResults.push({ ok: true, ...result });
    } catch (error) {
      submitResults.push(failure(error));
    }
  }

  const reviewQueue = await agent.reviewQueue(task.key, VERIFIER);

  const verdictResults: unknown[] = [];
  for (const verdict of request.verdicts ?? []) {
    try {
      const result = await agent.verdict(
        { issueKey: task.key, evidenceId: real.get(verdict.evidenceId) ?? verdict.evidenceId, decision: verdict.decision, reason: verdict.reason },
        VERIFIER,
      );
      verdictResults.push({ ok: true, ...result });
    } catch (error) {
      verdictResults.push({ ...failure(error), evidenceId: verdict.evidenceId });
    }
  }

  const contract = await agent.contract(task.key, AGENT);

  let out = JSON.stringify({ contract, submitResults, reviewQueue, verdictResults });
  for (const [id, as] of alias) out = out.split(id).join(as);
  process.stdout.write(out);
}

main().catch((error: unknown) => {
  process.stderr.write(error instanceof Error ? (error.stack ?? error.message) : String(error));
  process.exit(1);
});
