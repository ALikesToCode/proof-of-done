/**
 * An agent says "done" five times. The rules in src/core answer each time.
 *
 * Run it with `npm run example`. It needs no Jira site and no account: it calls the
 * same functions the Jira app calls, on a contract held in memory.
 */
import { checksPassed, runChecks } from '../src/core/checks';
import { gateDecision, isIndependent, summarize } from '../src/core/proof';
import type { Criterion, Evidence, EvidenceChannel, EvidenceDetails, EvidenceKind, Verdict } from '../src/core/types';

const AGENT_OWNER = 'dana';
const REVIEWER = 'sam';
const POLICY = { gateMode: 'warn', enforceWithoutContract: false } as const;
const REQUIRE_INDEPENDENT = true;

let clock = 0;
const tick = () => ++clock;

const criterion = (id: string, text: string, requiredKind: Criterion['requiredKind']): Criterion => ({
  id,
  issueId: 'DEMO-1',
  position: clock,
  text,
  source: 'manual',
  sourceRef: null,
  requiredKind,
  active: true,
  createdBy: REVIEWER,
  createdAt: tick(),
});

const contract: Criterion[] = [
  criterion('c1', 'All unit tests pass', 'test_run'),
  criterion('c2', 'Release notes are updated', 'any'),
];
const evidence: Evidence[] = [];
const verdicts: Verdict[] = [];

/** Runs the checks and stores the evidence, the way `submit-evidence` does. */
function submit(
  criterionId: string,
  kind: EvidenceKind,
  summary: string,
  details: EvidenceDetails,
  channel: EvidenceChannel,
  url: string | null = null,
): Evidence {
  const requiredKind = contract.find((c) => c.id === criterionId)!.requiredKind;
  const checks = runChecks({ requiredKind, kind, summary, url, details, channel });
  const piece: Evidence = {
    id: `e${evidence.length + 1}`,
    criterionId,
    issueId: 'DEMO-1',
    kind,
    summary,
    url,
    details,
    channel,
    actorAccountId: AGENT_OWNER,
    agentName: channel === 'agent' ? 'coding-agent' : null,
    checks,
    checksPassed: checksPassed(checks),
    createdAt: tick(),
  };
  evidence.push(piece);
  for (const check of checks.filter((c) => !c.ok)) console.log(`   check failed: ${check.note}`);
  if (piece.checksPassed) console.log('   checks passed, so the evidence waits for a review');
  return piece;
}

/** Records an acceptance. The rules decide whether it counts as an independent check. */
function accept(piece: Evidence, accountId: string): void {
  const independent = isIndependent(piece, { channel: 'ui', actorAccountId: accountId });
  verdicts.push({
    id: `v${verdicts.length + 1}`,
    evidenceId: piece.id,
    criterionId: piece.criterionId,
    issueId: piece.issueId,
    decision: 'accepted',
    reason: 'Read and agreed.',
    channel: 'ui',
    actorAccountId: accountId,
    independent,
    createdAt: tick(),
  });
  console.log(`   ${accountId} accepts it: ${independent ? 'an independent check' : 'not independent, they entered it themselves'}`);
}

function sayDone(step: string): void {
  const summary = summarize(contract, evidence, verdicts, REQUIRE_INDEPENDENT);
  const gate = gateDecision(summary, POLICY);
  console.log(`   agent: "done".  gate: ${gate.pass ? 'PASS' : 'NO'}. ${gate.reason}\n`);
  if (step === 'last' && !gate.pass) process.exitCode = 1;
}

console.log('Done contract for DEMO-1');
for (const c of contract) console.log(`   - ${c.text}`);
console.log();

console.log('1. The agent reports done and shows nothing.');
sayDone('1');

console.log('2. It submits a test run with two failures.');
submit('c1', 'test_run', 'Unit test suite on the feature branch', { passed: 41, failed: 2, command: 'npm test' }, 'agent');
sayDone('2');

console.log('3. It fixes the tests and submits a clean run.');
const run = submit('c1', 'test_run', 'Unit test suite on the feature branch', { passed: 43, failed: 0, command: 'npm test' }, 'agent');
sayDone('3');

console.log(`4. ${AGENT_OWNER} types in a note about the release notes and accepts their own note.`);
const note = submit('c2', 'other', 'Release notes list the new export', { text: 'Added: CSV export of the audit log.' }, 'ui');
accept(note, AGENT_OWNER);
sayDone('4');

console.log(`5. ${REVIEWER} reads both pieces and accepts them.`);
accept(run, REVIEWER);
accept(note, REVIEWER);
sayDone('last');
