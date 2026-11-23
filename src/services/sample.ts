import { AdfNode } from '../core/adf';
import { checksPassed, runChecks, sanitizeDetails } from '../core/checks';
import { PodError } from '../core/errors';
import { newId } from '../core/ids';
import { gateDecision, summarize } from '../core/proof';
import { SAMPLE_AGENT, SAMPLE_ITEMS, SAMPLE_LABEL, SampleItem } from '../core/sample';
import { Criterion, Evidence, ProofSummary, Verdict } from '../core/types';
import { JiraGateway, ProjectInfo } from '../jira/gateway';
import { ContractStore, EventRow } from '../store/types';
import { doneWithoutProofComment } from './gate';
import { requireAdmin } from './project';
import { SampleRemoval, SampleStep } from './project-view';
import { saveProof } from './proof-sync';

const PROJECT_ID = /^\d{1,18}$/;
/** Types the sample prefers for its work items, best first. */
const PREFERRED_TYPES = ['story', 'task'];

const paragraph = (text: string): AdfNode => ({ type: 'paragraph', content: [{ type: 'text', text }] });

/** The description of a sample work item: what it is about, its acceptance criteria, and a note that it is a sample. */
export function sampleDescription(item: SampleItem): AdfNode {
  return {
    type: 'doc',
    version: 1,
    content: [
      paragraph(item.intro),
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Acceptance criteria' }] },
      { type: 'bulletList', content: item.criteria.map((c) => ({ type: 'listItem', content: [paragraph(c.text)] })) },
      paragraph("Sample data from Proof of Done. Remove it from the project's Proof of Done page."),
    ],
  };
}

export interface SampleRows {
  criteria: Criterion[];
  evidence: Evidence[];
  verdicts: Verdict[];
  summary: ProofSummary;
}

/**
 * The stored rows of one sample contract. Evidence goes through the real checks, so a
 * sample test run with failures is turned away exactly as a real one would be. Every
 * row is marked as sample data, and no row names a person.
 */
export function buildSampleRows(item: SampleItem, issueId: string, startAt: number): SampleRows {
  let at = startAt;
  const criteria: Criterion[] = item.criteria.map((c, position) => ({
    id: newId(at),
    issueId,
    position,
    text: c.text,
    source: 'sample',
    sourceRef: null,
    requiredKind: c.requiredKind,
    active: true,
    createdBy: null,
    createdAt: at++,
  }));
  const evidence: Evidence[] = [];
  const verdicts: Verdict[] = [];
  item.criteria.forEach((c, index) => {
    const criterion = criteria[index]!;
    for (const e of c.evidence) {
      const byPerson = e.kind === 'attestation';
      const details = sanitizeDetails(e.details ?? {});
      const url = e.url ?? null;
      // Checked as it would have arrived: an attestation from a person, the rest from an agent.
      const checks = runChecks({ requiredKind: c.requiredKind, kind: e.kind, summary: e.summary, url, details, channel: byPerson ? 'ui' : 'agent' });
      const row: Evidence = {
        id: newId(at),
        criterionId: criterion.id,
        issueId,
        kind: e.kind,
        summary: e.summary,
        url,
        details,
        channel: 'sample',
        actorAccountId: null,
        agentName: byPerson ? null : SAMPLE_AGENT,
        checks,
        checksPassed: checksPassed(checks),
        createdAt: at++,
      };
      evidence.push(row);
      if (e.verdict && row.checksPassed) {
        verdicts.push({
          id: newId(at),
          evidenceId: row.id,
          criterionId: criterion.id,
          issueId,
          decision: e.verdict.decision,
          reason: e.verdict.reason,
          channel: 'sample',
          actorAccountId: null,
          independent: true,
          createdAt: at++,
        });
      }
    }
  });
  return { criteria, evidence, verdicts, summary: summarize(criteria, evidence, verdicts, true) };
}

/**
 * Loads and removes the sample data of a project. The sample work items are real Jira
 * work items that the app creates and labels. The app remembers which ones it made,
 * and removal only ever deletes those.
 */
export class SampleService {
  private readonly now: () => number;

  constructor(
    private readonly store: ContractStore,
    private readonly jira: JiraGateway,
    now?: () => number,
  ) {
    this.now = now ?? (() => Date.now());
  }

  /**
   * Creates one sample work item. The page calls this once per item and shows the
   * progress, because creating all of them takes longer than one call may run.
   */
  async loadOne(projectId: string, index: unknown): Promise<SampleStep> {
    const project = await this.project(projectId);
    await requireAdmin(this.jira, project, 'load sample data');
    const position = Number(index);
    const item = Number.isInteger(position) ? SAMPLE_ITEMS[position] : undefined;
    if (!item) throw new PodError('invalid', 'There is no sample work item with that number.');
    const step = { step: position + 1, total: SAMPLE_ITEMS.length, summary: item.summary };

    const existing = (await this.store.listSampleIssues(project.id)).find((s) => s.slug === item.slug);
    if (existing) {
      const issue = await this.jira.getIssue(existing.issueId, 'app');
      if (issue) return { ...step, key: issue.key, existed: true };
      // Someone deleted it in Jira. Forget it and make a new one.
      await this.store.purgeIssue(existing.issueId);
    }

    const type = pickIssueType(project);
    if (!type) throw new PodError('invalid', `${project.name} has no work item type the sample can use.`);
    let created: { id: string; key: string };
    try {
      created = await this.jira.createIssue({
        projectId: project.id,
        issueTypeId: type.id,
        summary: item.summary,
        description: sampleDescription(item),
        labels: [SAMPLE_LABEL],
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : '';
      throw new PodError('invalid', `Jira would not create a sample work item in ${project.name}. ${detail}`.trim());
    }
    // Remembered before anything else, so removal finds it even if a later step fails.
    await this.store.markSample(created.id, project.id, item.slug, this.now());

    // Moved before the contract exists. A workflow that carries this app's validator
    // would otherwise refuse to close the sample that is there to show an unproven close.
    const status = await this.move(created.id, item.status);
    if (item.withContract) await this.seed(item, { ...created, projectId: project.id }, status);
    return { ...step, key: created.key, existed: false };
  }

  /** Deletes the sample work items the app made in this project, with everything stored about them. */
  async remove(projectId: string): Promise<SampleRemoval> {
    const project = await this.project(projectId);
    await requireAdmin(this.jira, project, 'remove sample data');
    const samples = await this.store.listSampleIssues(project.id);
    const kept: string[] = [];
    let removed = 0;
    for (const sample of samples) {
      if (await this.jira.deleteIssue(sample.issueId)) {
        await this.store.purgeIssue(sample.issueId);
        removed++;
      } else {
        const issue = await this.jira.getIssue(sample.issueId, 'app');
        kept.push(issue?.key ?? sample.issueId);
      }
    }
    return { removed, kept };
  }

  private async project(projectId: string): Promise<ProjectInfo> {
    const id = typeof projectId === 'string' ? projectId.trim() : '';
    if (!PROJECT_ID.test(id)) throw new PodError('invalid', 'Proof of Done needs a project for sample data.');
    const project = await this.jira.getProject(id, 'user');
    if (!project) throw new PodError('not_found', 'This project does not exist, or you do not have access to it.');
    return project;
  }

  /** Moves a new sample work item to its status. Returns where it ended up, or null when it could not be moved. */
  private async move(issueId: string, target: SampleItem['status']): Promise<{ name: string; category: string } | null> {
    if (target === 'todo') return null;
    const category = target === 'done' ? 'done' : 'indeterminate';
    try {
      const transition = (await this.jira.listTransitions(issueId)).find((t) => t.toCategory === category);
      if (!transition) return null;
      await this.jira.transition(issueId, transition.id);
      return { name: transition.toStatusName, category };
    } catch (error) {
      // The workflow may need a field or forbid the move. The sample still works, in the status it has.
      console.warn(`Proof of Done: could not move sample work item ${issueId}.`, error);
      return null;
    }
  }

  private async seed(
    item: SampleItem,
    issue: { id: string; key: string; projectId: string },
    status: { name: string; category: string } | null,
  ): Promise<void> {
    const startAt = this.now();
    const rows = buildSampleRows(item, issue.id, startAt);
    let at = startAt + rows.criteria.length + rows.evidence.length + rows.verdicts.length;
    const event = (type: string, data: Record<string, unknown>): EventRow => ({
      id: newId(at),
      projectId: issue.projectId,
      issueId: issue.id,
      type,
      at: at++,
      actorAccountId: null,
      channel: 'sample',
      data,
    });
    const textOf = (criterionId: string): string => rows.criteria.find((c) => c.id === criterionId)?.text ?? '';
    const events: EventRow[] = [event('contract.created', { criteria: rows.criteria.length, sample: true })];
    for (const e of rows.evidence) {
      events.push(
        event('evidence.submitted', {
          evidenceId: e.id,
          criterionId: e.criterionId,
          text: textOf(e.criterionId),
          kind: e.kind,
          checksPassed: e.checksPassed,
          agentName: e.agentName,
        }),
      );
    }
    for (const v of rows.verdicts) {
      events.push(
        event('verdict.recorded', {
          evidenceId: v.evidenceId,
          criterionId: v.criterionId,
          text: textOf(v.criterionId),
          decision: v.decision,
          by: 'sample',
          independent: true,
          reason: v.reason,
        }),
      );
    }
    if (rows.summary.state === 'proven') events.push(event('proof.completed', { total: rows.summary.total }));

    if (status?.category === 'done') {
      const settings = await this.store.getSettings(issue.projectId);
      // The same answer the done gate would give for a real close in this project.
      const decision = gateDecision(rows.summary, settings);
      const closed = { status: status.name, proven: rows.summary.state === 'proven', contract: true, pass: decision.pass, sample: true };
      events.push(event('issue.done', closed));
      if (!decision.pass) {
        let commented = true;
        try {
          await this.jira.addComment(issue.id, doneWithoutProofComment(issue.key, status.name, decision.reason));
        } catch (error) {
          commented = false;
          console.warn(`Proof of Done: could not comment on sample work item ${issue.key}.`, error);
        }
        events.push(event('gate.warned', { status: status.name, reason: decision.reason, commented, sample: true }));
      }
    }

    const createdAt = startAt;
    await this.store.createContract({ issueId: issue.id, issueKey: issue.key, projectId: issue.projectId, createdBy: null, createdAt, updatedAt: createdAt });
    await this.store.insertCriteria(rows.criteria);
    for (const e of rows.evidence) await this.store.insertEvidence(e, issue.projectId);
    for (const v of rows.verdicts) await this.store.insertVerdict(v, issue.projectId);
    for (const e of events) await this.store.insertEvent(e);
    await saveProof(this.store, this.jira, issue, rows.summary, at);
  }
}

/** A story or a task if the project has one, else its first type that is not an epic. */
export function pickIssueType(project: ProjectInfo): { id: string; name: string } | null {
  for (const wanted of PREFERRED_TYPES) {
    const match = project.issueTypes.find((t) => t.name.toLowerCase() === wanted);
    if (match) return match;
  }
  return project.issueTypes.find((t) => t.name.toLowerCase() !== 'epic') ?? project.issueTypes[0] ?? null;
}
