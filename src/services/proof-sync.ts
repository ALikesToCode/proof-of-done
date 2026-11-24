import { errorLine } from '../core/errors';
import { ProofSummary } from '../core/types';
import { JiraGateway, ProofProperty } from '../jira/gateway';
import { ContractStore } from '../store/types';

export function toProofProperty(summary: ProofSummary, now: number): ProofProperty {
  return {
    state: summary.state,
    proven: summary.proven,
    total: summary.total,
    open: summary.total - summary.proven,
    selfReviewed: summary.selfReviewed,
    updated: new Date(now).toISOString(),
  };
}

/**
 * Stores a contract's summary and copies it to the work item property that JQL reads.
 * The stored rows are the record. The property is a copy for search, so a failed write
 * is logged and the next change writes it again.
 */
export async function saveProof(
  store: ContractStore,
  jira: JiraGateway,
  issue: { id: string; key: string },
  summary: ProofSummary,
  now: number,
): Promise<void> {
  await store.saveSummary(issue.id, summary, now);
  try {
    await jira.setProofProperty(issue.id, toProofProperty(summary, now));
  } catch (error) {
    console.error(`Proof of Done: could not write the proof property of ${issue.key}. ${errorLine(error)}`);
  }
}
