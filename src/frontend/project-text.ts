import type { Meter, MeterVerdict } from '../core/meter';
import type { GateMode } from '../core/types';
import type { WorkItemRow } from '../services/project-view';
import type { Badge } from './text';

/** Wording for the project page. No Forge imports, so it can be unit-tested. */

export const METER: Record<MeterVerdict, Badge> = {
  climbing: { label: 'Climbing', tone: 'success' },
  busy: { label: 'Busy, not climbing', tone: 'moved' },
  stalled: { label: 'Stalled', tone: 'default' },
};

export const WINDOW_OPTIONS = [
  { label: 'Last 7 days', value: '7' },
  { label: 'Last 14 days', value: '14' },
  { label: 'Last 30 days', value: '30' },
];

export interface Figure {
  label: string;
  value: number;
  /** Shown under the number when it needs a word of explanation. */
  note?: string;
}

/** The numbers behind the meter, in the order the verdict reads them. */
export function meterFigures(meter: Meter): Figure[] {
  const figures: Figure[] = [
    { label: 'Opened', value: meter.opened },
    { label: 'Reopened', value: meter.reopened },
    { label: 'Closed with proof', value: meter.closedProven },
    { label: 'Closed without proof', value: meter.closedUnproven, note: 'does not count' },
  ];
  if (meter.closedNoContract > 0) figures.push({ label: 'Closed, no contract', value: meter.closedNoContract, note: 'does not count' });
  return figures;
}

export function activityLine(meter: Meter): string {
  const evidence = `${meter.evidence} ${meter.evidence === 1 ? 'piece' : 'pieces'} of evidence`;
  const verdicts = `${meter.verdicts} ${meter.verdicts === 1 ? 'verdict' : 'verdicts'}`;
  return `${evidence} and ${verdicts} in the last ${meter.windowDays} days.`;
}

/** What a work item under contract needs next. */
export function attentionNote(row: Pick<WorkItemRow, 'attention' | 'proven' | 'total' | 'waiting' | 'rejected' | 'proofState'>): string {
  const left = row.total - row.proven;
  switch (row.attention) {
    case 'closed_unproven':
      return `Closed without proof. ${left} of ${row.total} not proven.`;
    case 'rejected':
      return `Evidence turned away on ${row.rejected} ${row.rejected === 1 ? 'criterion' : 'criteria'}.`;
    case 'waiting':
      return `${row.waiting} waiting for a check.`;
    case 'open':
      return `${left} of ${row.total} still to prove.`;
    default:
      return row.proofState === 'proven' ? 'Nothing. Every criterion is proven.' : 'No criteria yet.';
  }
}

export const GATE_MODES: Array<{ value: GateMode; label: string }> = [
  { value: 'warn', label: 'Comment on the work item and say what is missing' },
  { value: 'bounce', label: 'Move the work item back to the status it came from, and say why' },
  { value: 'off', label: 'Do nothing' },
];

export function contractsLine(contracts: { total: number; listed: number }): string {
  if (contracts.total === 0) return 'No work item in this project has a done contract yet.';
  const noun = contracts.total === 1 ? 'work item has' : 'work items have';
  const hidden = contracts.total - contracts.listed;
  const tail = hidden > 0 ? ` ${hidden} ${hidden === 1 ? 'is' : 'are'} not listed, because you cannot see ${hidden === 1 ? 'it' : 'them'} or ${hidden === 1 ? 'it was' : 'they were'} deleted.` : '';
  return `${contracts.total} ${noun} a done contract.${tail}`;
}

/** One line on whether the project's pipeline has a key and whether it has used it. */
export function pipelineStatusLine(
  key: { exists: boolean; createdAt: number | null; lastUsedAt: number | null },
  now: number,
): string {
  if (!key.exists) return 'This project has no pipeline key, so no pipeline can report results to it.';
  const days = (at: number): string => {
    const n = Math.floor((now - at) / (24 * 60 * 60 * 1000));
    return n <= 0 ? 'today' : n === 1 ? 'yesterday' : `${n} days ago`;
  };
  const made = key.createdAt ? `The key was made ${days(key.createdAt)}.` : 'The project has a key.';
  return key.lastUsedAt ? `${made} A pipeline last reported with it ${days(key.lastUsedAt)}.` : `${made} No pipeline has reported with it yet.`;
}

/**
 * A GitHub Actions step that reports the job's result. It builds the JSON with jq from
 * environment variables, so a branch name cannot break out of the request.
 */
export function pipelineSnippet(url: string): string {
  return [
    '- name: Report to Proof of Done',
    '  if: always()',
    '  env:',
    '    POD_KEY: ${{ secrets.PROOF_OF_DONE_KEY }}',
    '    REF: ${{ github.head_ref || github.ref_name }}',
    '    SHA: ${{ github.event.pull_request.head.sha || github.sha }}',
    '    STATUS: ${{ job.status }}',
    '  run: |',
    '    jq -n --arg ref "$REF" --arg commit "$SHA" --arg status "$STATUS" \\',
    '      --arg repository "$GITHUB_REPOSITORY" --arg workflow "$GITHUB_WORKFLOW" --arg run "$GITHUB_RUN_ID.$GITHUB_RUN_ATTEMPT" \\',
    '      --arg url "$GITHUB_SERVER_URL/$GITHUB_REPOSITORY/actions/runs/$GITHUB_RUN_ID" \\',
    "      '{ref: $ref, commit: $commit, status: $status, repository: $repository, workflow: $workflow, run: $run, url: $url}' |",
    `    curl -sS -X POST "${url}" \\`,
    '      -H "Authorization: Bearer $POD_KEY" -H "Content-Type: application/json" -d @-',
    '# For a test run, send "passed" and "failed" (two numbers) in place of "status".',
  ].join('\n');
}
