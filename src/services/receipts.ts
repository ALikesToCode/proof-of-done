import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { checksPassed, runChecks } from '../core/checks';
import { PodError } from '../core/errors';
import { newId } from '../core/ids';
import { sameCommit, summarize } from '../core/proof';
import { Receipt, formatPipelineKey, parseReceipt, projectOfKey } from '../core/receipt';
import { Evidence, ProjectSettings, Verdict } from '../core/types';
import { IssueInfo, JiraGateway } from '../jira/gateway';
import { ContractStore } from '../store/types';
import { requireAdmin } from './project';
import { saveProof } from './proof-sync';

/**
 * What happened to a receipt. A static web trigger can only answer with one of a fixed
 * set of responses, so every outcome a pipeline can act on has a name here.
 */
export type ReceiptOutcome =
  /** Stored, and the result passes. */
  | 'recorded'
  /** Stored, and the result does not pass: failed tests or a failed build. */
  | 'recorded_failing'
  /** The same result for the same commit was already stored. */
  | 'duplicate'
  /** No key, a key for no project, or a key that has been replaced. */
  | 'unauthorized'
  /** Not a receipt. */
  | 'invalid'
  /** None of the named work items is in the key's project, or none has a done contract. */
  | 'no_work_item'
  /** The contract has no criterion that asks for this kind of evidence. */
  | 'no_criterion';

export interface ReceiptResult {
  outcome: ReceiptOutcome;
  /** For the log and the tests. Never sent back to the caller. */
  note: string;
  /** The work items the receipt was stored on. */
  issueKeys: string[];
}

export interface PipelineKeyStatus {
  exists: boolean;
  createdAt: number | null;
  createdBy: string | null;
  lastUsedAt: number | null;
}

const hashOf = (key: string): string => createHash('sha256').update(key, 'utf8').digest('hex');

function sameHash(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Takes results straight from a project's pipeline.
 *
 * Everything else an agent can influence reaches the app as the agent's own words. A
 * receipt does not: it is sent by the pipeline with a key that only the project's
 * admins and its pipeline hold. So a receipt can prove a criterion with no person in
 * between, and a receipt for a newer commit turns the proof of an older one stale.
 */
export class ReceiptService {
  private readonly now: () => number;

  constructor(
    private readonly store: ContractStore,
    private readonly jira: JiraGateway,
    now?: () => number,
  ) {
    this.now = now ?? (() => Date.now());
  }

  /** Makes a new key for the project and returns it. It is shown once: only its hash is stored. */
  async createKey(projectId: string, actorAccountId: string | null): Promise<string> {
    const project = await this.adminProject(projectId, "create the pipeline's key");
    const now = this.now();
    const key = formatPipelineKey(project.id, randomBytes(24).toString('hex'));
    const before = await this.store.getPipelineKey(project.id);
    await this.store.savePipelineKey({ projectId: project.id, hash: hashOf(key), createdBy: actorAccountId, createdAt: now, lastUsedAt: null });
    await this.event(project.id, null, before ? 'pipeline.key_replaced' : 'pipeline.key_created', actorAccountId, 'ui', {});
    return key;
  }

  /** Removes the project's key, so no pipeline can report until a new one is made. */
  async revokeKey(projectId: string, actorAccountId: string | null): Promise<void> {
    const project = await this.adminProject(projectId, "remove the pipeline's key");
    if (!(await this.store.getPipelineKey(project.id))) return;
    await this.store.deletePipelineKey(project.id);
    await this.event(project.id, null, 'pipeline.key_removed', actorAccountId, 'ui', {});
  }

  async keyStatus(projectId: string): Promise<PipelineKeyStatus> {
    const key = await this.store.getPipelineKey(projectId);
    return { exists: key !== null, createdAt: key?.createdAt ?? null, createdBy: key?.createdBy ?? null, lastUsedAt: key?.lastUsedAt ?? null };
  }

  /** A receipt arrived from outside. `key` is what the caller sent as its key, `body` the raw request body. */
  async accept(key: string | null, body: string): Promise<ReceiptResult> {
    const none = (outcome: ReceiptOutcome, note: string): ReceiptResult => ({ outcome, note, issueKeys: [] });
    const projectId = key ? projectOfKey(key) : null;
    if (!key || !projectId) return none('unauthorized', 'No pipeline key in the request.');
    const stored = await this.store.getPipelineKey(projectId);
    // Compared even when the project has no key, so a wrong project and a wrong key take the same path.
    if (!sameHash(hashOf(key.trim()), stored?.hash ?? hashOf('')) || !stored) {
      return none('unauthorized', `The key is not the current key of project ${projectId}.`);
    }
    const receipt = parseReceipt(body);
    if (typeof receipt === 'string') return none('invalid', receipt);

    const settings = await this.store.getSettings(projectId);
    const results: ReceiptOutcome[] = [];
    const storedOn: string[] = [];
    for (const issueKey of receipt.issueKeys) {
      const issue = await this.jira.getIssue(issueKey, 'app');
      // A key speaks for one project. A receipt that names a work item elsewhere is ignored, not an error.
      if (!issue || issue.projectId !== projectId) continue;
      const outcome = await this.storeOn(issue, receipt, settings);
      results.push(outcome);
      if (outcome === 'recorded' || outcome === 'recorded_failing') storedOn.push(issue.key);
    }
    await this.store.markPipelineKeyUsed(projectId, this.now());

    const pick = (outcome: ReceiptOutcome, note: string): ReceiptResult => ({ outcome, note, issueKeys: storedOn });
    if (results.includes('recorded_failing')) return pick('recorded_failing', `Stored a result that does not pass on ${storedOn.join(', ')}.`);
    if (results.includes('recorded')) return pick('recorded', `Stored on ${storedOn.join(', ')}.`);
    if (results.includes('duplicate')) return pick('duplicate', 'This result was already stored.');
    if (results.includes('no_criterion')) return pick('no_criterion', `No criterion asks for ${receipt.kind === 'build' ? 'a build' : 'a test run'}.`);
    return pick('no_work_item', 'None of the named work items is in this project with a done contract.');
  }

  private async storeOn(issue: IssueInfo, receipt: Receipt, settings: ProjectSettings): Promise<ReceiptOutcome> {
    const before = await this.store.getBundle(issue.id);
    if (!before.contract) return 'no_work_item';
    const criteria = before.criteria.filter((c) => c.active && c.requiredKind === receipt.kind);
    if (criteria.length === 0) return 'no_criterion';

    const detailsKey = JSON.stringify(receipt.details);
    let stored = false;
    let passing = true;
    for (const criterion of criteria) {
      const own = before.evidence.filter((e) => e.criterionId === criterion.id);
      // A pipeline that retries a step sends the same receipt again.
      if (own.some((e) => e.channel === 'ci' && e.kind === receipt.kind && JSON.stringify(e.details) === detailsKey)) continue;
      const checks = runChecks({
        requiredKind: criterion.requiredKind,
        kind: receipt.kind,
        summary: receipt.summary,
        url: receipt.url,
        details: receipt.details,
        channel: 'ci',
      });
      const now = this.now();
      const evidence: Evidence = {
        id: newId(now),
        criterionId: criterion.id,
        issueId: issue.id,
        kind: receipt.kind,
        summary: receipt.summary,
        url: receipt.url,
        details: receipt.details,
        channel: 'ci',
        actorAccountId: null,
        agentName: null,
        checks,
        checksPassed: checksPassed(checks),
        createdAt: now,
      };
      await this.store.insertEvidence(evidence, issue.projectId);
      await this.event(issue.projectId, issue.id, 'evidence.submitted', null, 'ci', {
        evidenceId: evidence.id,
        criterionId: criterion.id,
        text: criterion.text,
        kind: receipt.kind,
        checksPassed: evidence.checksPassed,
        commit: receipt.details.commit,
      });
      stored = true;
      if (!evidence.checksPassed) {
        passing = false;
        continue;
      }
      if (!settings.pipelineProves) continue;
      const verdict: Verdict = {
        id: newId(now),
        evidenceId: evidence.id,
        criterionId: criterion.id,
        issueId: issue.id,
        decision: 'accepted',
        reason: `Reported by the project's pipeline for commit ${receipt.details.commit.slice(0, 7)}.`,
        channel: 'ci',
        actorAccountId: null,
        independent: true,
        createdAt: now,
      };
      await this.store.insertVerdict(verdict, issue.projectId);
      await this.event(issue.projectId, issue.id, 'verdict.recorded', null, 'ci', {
        evidenceId: evidence.id,
        criterionId: criterion.id,
        text: criterion.text,
        decision: 'accepted',
        by: 'ci',
        independent: true,
        reason: verdict.reason,
      });
    }
    if (!stored) return 'duplicate';

    const after = await this.store.getBundle(issue.id);
    const was = summarize(before.criteria, before.evidence, before.verdicts, settings.requireIndependent);
    const summary = summarize(after.criteria, after.evidence, after.verdicts, settings.requireIndependent);
    const moved = before.evidence.some((e) => e.details.commit && !sameCommit(e.details.commit, receipt.details.commit));
    if (moved && summary.stale > 0) {
      await this.event(issue.projectId, issue.id, 'proof.stale', null, 'ci', { commit: receipt.details.commit, criteria: summary.stale });
    }
    if (was.state !== 'proven' && summary.state === 'proven') {
      await this.event(issue.projectId, issue.id, 'proof.completed', null, 'ci', { total: summary.total });
    } else if (was.state === 'proven' && summary.state !== 'proven') {
      await this.event(issue.projectId, issue.id, 'proof.reopened', null, 'ci', { proven: summary.proven, total: summary.total });
    }
    await saveProof(this.store, this.jira, issue, summary, this.now());
    return passing ? 'recorded' : 'recorded_failing';
  }

  private async adminProject(projectId: string, what: string) {
    const id = typeof projectId === 'string' ? projectId.trim() : '';
    const project = /^[A-Za-z0-9]{1,32}$/.test(id) ? await this.jira.getProject(id, 'user') : null;
    if (!project) throw new PodError('not_found', 'This project does not exist, or you do not have access to it.');
    await requireAdmin(this.jira, project, what);
    return project;
  }

  private event(
    projectId: string,
    issueId: string | null,
    type: string,
    actorAccountId: string | null,
    channel: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    const at = this.now();
    return this.store.insertEvent({ id: newId(at), projectId, issueId, type, at, actorAccountId, channel, data });
  }
}
