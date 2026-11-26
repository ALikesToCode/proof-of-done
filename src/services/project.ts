import { PodError } from '../core/errors';
import { newId } from '../core/ids';
import { Meter, readMeter, toWindowDays } from '../core/meter';
import { summarize } from '../core/proof';
import { SAMPLE_ITEMS } from '../core/sample';
import { normalizeSettings } from '../core/settings';
import { ProjectSettings } from '../core/types';
import { IssueRow, JiraGateway, ProjectInfo } from '../jira/gateway';
import { ContractStore, ContractSummaryRow } from '../store/types';
import { saveProof } from './proof-sync';
import { Attention, ProjectView, WorkItemRow } from './project-view';

const DAY = 24 * 60 * 60 * 1000;
/** Contracts shown and counted on the project page, most recently changed first. */
export const CONTRACT_LIMIT = 200;
/** Contracts recounted in the same call when a setting changes what counts as proven. */
export const RECOUNT_LIMIT = 60;
const RECOUNT_AT_ONCE = 6;
const FETCH_SIZE = 100;
const PROJECT_ID = /^\d{1,18}$/;

export const openedJql = (projectId: string, days: number): string => `project = ${projectId} AND created >= -${days}d`;
export const closedJql = (projectId: string, days: number): string =>
  `project = ${projectId} AND statusCategory = Done AND statusCategoryChangedDate >= -${days}d`;

const ATTENTION_ORDER: Attention[] = ['closed_unproven', 'rejected', 'waiting', 'open', 'none'];

export function attentionOf(contract: Pick<ContractSummaryRow, 'proofState' | 'submitted' | 'rejected'>, statusCategory: string): Attention {
  if (contract.proofState === 'proven' || contract.proofState === 'none') return 'none';
  if (statusCategory === 'done') return 'closed_unproven';
  if (contract.rejected > 0) return 'rejected';
  if (contract.submitted > 0) return 'waiting';
  return 'open';
}

/**
 * The project page: the meter, the work under contract, and the project's settings.
 * Reads run as the viewer, so the page never lists a work item they may not see.
 */
export class ProjectService {
  private readonly now: () => number;

  constructor(
    private readonly store: ContractStore,
    private readonly jira: JiraGateway,
    now?: () => number,
  ) {
    this.now = now ?? (() => Date.now());
  }

  async overview(projectId: string, windowDays: unknown): Promise<ProjectView> {
    const project = await this.project(projectId);
    const days = toWindowDays(windowDays);
    const since = this.now() - days * DAY;
    const [canAdmin, settings, contracts, events, samples, opened, closed] = await Promise.all([
      this.jira.canAdminister(project.id),
      this.store.getSettings(project.id),
      this.store.listContracts(project.id, CONTRACT_LIMIT),
      this.store.countEvents(project.id, since),
      this.store.listSampleIssues(project.id),
      this.jira.countIssues(openedJql(project.id, days), 'user'),
      this.jira.countIssues(closedJql(project.id, days), 'user'),
    ]);
    const rows = await this.rows(contracts, new Set(samples.map((s) => s.issueId)));

    const closedInWindow = rows.filter((r) => r.statusCategory === 'done' && (r.closedAt ?? 0) >= since);
    const eventCount = (type: string, field: 'count' | 'issues'): number => events.find((e) => e.type === type)?.[field] ?? 0;
    const meter: Meter = readMeter({
      windowDays: days,
      opened,
      reopened: eventCount('issue.reopened', 'issues'),
      closed,
      closedProven: closedInWindow.filter((r) => r.proofState === 'proven').length,
      closedUnproven: closedInWindow.filter((r) => r.proofState !== 'proven' && r.total > 0).length,
      evidence: eventCount('evidence.submitted', 'count'),
      verdicts: eventCount('verdict.recorded', 'count'),
    });

    return {
      project: { id: project.id, key: project.key, name: project.name },
      canAdmin,
      settings,
      issueTypes: project.issueTypes.map((t) => t.name),
      meter,
      contracts: {
        total: contracts.length,
        listed: rows.length,
        proven: rows.filter((r) => r.proofState === 'proven').length,
        closedUnproven: rows.filter((r) => r.attention === 'closed_unproven').length,
        waiting: rows.filter((r) => r.waiting > 0).length,
      },
      rows: rows.map(({ closedAt: _closedAt, ...row }) => row),
      sample: { loaded: samples.length, size: SAMPLE_ITEMS.length },
    };
  }

  /** Throws unless the caller administers the project. */
  async requireAdmin(projectId: string, what: string): Promise<void> {
    await requireAdmin(this.jira, await this.project(projectId), what);
  }

  /** Saves the project's settings. Only someone who administers the project may. */
  async saveSettings(projectId: string, actorAccountId: string | null, raw: unknown): Promise<ProjectSettings> {
    const project = await this.project(projectId);
    await requireAdmin(this.jira, project, 'change these settings');
    const before = await this.store.getSettings(project.id);
    const settings = normalizeSettings(raw);
    const now = this.now();
    await this.store.saveSettings(project.id, settings, actorAccountId, now);
    await this.store.insertEvent({
      id: newId(now),
      projectId: project.id,
      issueId: null,
      type: 'settings.changed',
      at: now,
      actorAccountId,
      channel: 'ui',
      data: {
        gateMode: settings.gateMode,
        requireIndependent: settings.requireIndependent,
        enforceWithoutContract: settings.enforceWithoutContract,
        strictGate: settings.strictGate,
        pipelineProves: settings.pipelineProves,
        pipelineOnly: settings.pipelineOnly,
        rules: settings.rules.length,
      },
    });
    // Whether a self-review proves a criterion changes the stored counts of every contract.
    if (before.requireIndependent !== settings.requireIndependent) await this.recount(project.id, settings);
    return settings;
  }

  /** Recounts the project's most recent contracts under the given settings. Older ones recount on their next change. */
  private async recount(projectId: string, settings: ProjectSettings): Promise<void> {
    const contracts = await this.store.listContracts(projectId, RECOUNT_LIMIT);
    for (let start = 0; start < contracts.length; start += RECOUNT_AT_ONCE) {
      await Promise.all(
        contracts.slice(start, start + RECOUNT_AT_ONCE).map(async (contract) => {
          const bundle = await this.store.getBundle(contract.issueId);
          if (!bundle.contract) return;
          const summary = summarize(bundle.criteria, bundle.evidence, bundle.verdicts, settings.requireIndependent);
          await saveProof(this.store, this.jira, { id: contract.issueId, key: contract.issueKey }, summary, this.now());
        }),
      );
    }
  }

  private async project(projectId: string): Promise<ProjectInfo> {
    const id = typeof projectId === 'string' ? projectId.trim() : '';
    if (!PROJECT_ID.test(id)) throw new PodError('invalid', 'Proof of Done needs a project to show this page.');
    const project = await this.jira.getProject(id, 'user');
    if (!project) throw new PodError('not_found', 'This project does not exist, or you do not have access to it.');
    return project;
  }

  /** Joins the stored contracts with what Jira says about each work item, as the viewer. */
  private async rows(contracts: ContractSummaryRow[], samples: Set<string>): Promise<Array<WorkItemRow & { closedAt: number | null }>> {
    const found = new Map<string, IssueRow>();
    const chunks: string[][] = [];
    for (let start = 0; start < contracts.length; start += FETCH_SIZE) {
      chunks.push(contracts.slice(start, start + FETCH_SIZE).map((c) => c.issueId));
    }
    for (const issues of await Promise.all(chunks.map((ids) => this.jira.getIssueRows(ids, 'user')))) {
      for (const issue of issues) found.set(issue.id, issue);
    }
    const rows: Array<WorkItemRow & { closedAt: number | null }> = [];
    for (const contract of contracts) {
      // Not found means deleted, or not visible to this viewer. Either way it is not listed.
      const issue = found.get(contract.issueId);
      if (!issue) continue;
      rows.push({
        id: issue.id,
        key: issue.key,
        summary: issue.summary,
        issueType: issue.issueType,
        statusName: issue.statusName,
        statusCategory: issue.statusCategory,
        assigneeAccountId: issue.assigneeAccountId,
        proofState: contract.proofState,
        proven: contract.proven,
        total: contract.total,
        waiting: contract.submitted,
        rejected: contract.rejected,
        attention: attentionOf(contract, issue.statusCategory),
        sample: samples.has(issue.id),
        closedAt: issue.statusCategory === 'done' ? issue.statusCategoryChangedAt : null,
      });
    }
    // The stored order is "most recently changed first", and the sort is stable.
    return rows.sort((a, b) => ATTENTION_ORDER.indexOf(a.attention) - ATTENTION_ORDER.indexOf(b.attention));
  }
}

export async function requireAdmin(jira: JiraGateway, project: ProjectInfo, what: string): Promise<void> {
  if (!(await jira.canAdminister(project.id))) {
    throw new PodError('forbidden', `You need to administer ${project.name} to ${what}.`);
  }
}
