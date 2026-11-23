import { LinkedItem, LinkedWork } from '../../src/core/graph';
import { DEFAULT_SETTINGS, normalizeSettings } from '../../src/core/settings';
import { Criterion, Evidence, ProjectSettings, ProofSummary, Verdict } from '../../src/core/types';
import { GraphGateway } from '../../src/graph/gateway';
import { IssueContext, IssueInfo, IssueRow, JiraGateway, NewIssue, ProjectInfo, ProofProperty, RunAs, TransitionInfo } from '../../src/jira/gateway';
import { ContractBundle, ContractRow, ContractStore, ContractSummaryRow, EventCount, EventRow, SampleMarker } from '../../src/store/types';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** ContractStore kept in arrays. Returns copies, as a database would. */
export class MemoryStore implements ContractStore {
  contracts = new Map<string, ContractRow>();
  criteria: Criterion[] = [];
  evidence: Evidence[] = [];
  verdicts: Verdict[] = [];
  events: EventRow[] = [];
  summaries = new Map<string, ProofSummary>();
  settings = new Map<string, ProjectSettings>();

  async getBundle(issueId: string): Promise<ContractBundle> {
    const contract = this.contracts.get(issueId) ?? null;
    if (!contract) return { contract: null, criteria: [], evidence: [], verdicts: [] };
    return clone({
      contract,
      criteria: this.criteria.filter((c) => c.issueId === issueId).sort((a, b) => a.position - b.position || (a.id < b.id ? -1 : 1)),
      evidence: this.evidence.filter((e) => e.issueId === issueId),
      verdicts: this.verdicts.filter((v) => v.issueId === issueId),
    });
  }

  async createContract(row: ContractRow): Promise<boolean> {
    if (this.contracts.has(row.issueId)) return false;
    this.contracts.set(row.issueId, clone(row));
    return true;
  }

  async insertCriteria(criteria: Criterion[]): Promise<void> {
    this.criteria.push(...clone(criteria));
  }

  async deactivateCriterion(criterionId: string, issueId: string): Promise<void> {
    for (const c of this.criteria) if (c.id === criterionId && c.issueId === issueId) c.active = false;
  }

  async findCriterionIssue(criterionId: string): Promise<string | null> {
    return this.criteria.find((c) => c.id === criterionId)?.issueId ?? null;
  }

  async insertEvidence(evidence: Evidence, _projectId?: string): Promise<void> {
    this.evidence.push(clone(evidence));
  }

  async insertVerdict(verdict: Verdict, _projectId?: string): Promise<void> {
    this.verdicts.push(clone(verdict));
  }

  async insertEvent(event: EventRow): Promise<void> {
    this.events.push(clone(event));
  }

  async listEvents(issueId: string, limit: number): Promise<EventRow[]> {
    return clone(
      this.events
        .filter((e) => e.issueId === issueId)
        .sort((a, b) => b.at - a.at || (a.id < b.id ? 1 : -1))
        .slice(0, limit),
    );
  }

  async saveSummary(issueId: string, summary: ProofSummary, now: number): Promise<void> {
    this.summaries.set(issueId, clone(summary));
    const contract = this.contracts.get(issueId);
    if (contract) contract.updatedAt = now;
  }

  async getSettings(projectId: string): Promise<ProjectSettings> {
    return normalizeSettings(this.settings.get(projectId) ?? DEFAULT_SETTINGS);
  }

  async saveSettings(projectId: string, settings: ProjectSettings): Promise<void> {
    this.settings.set(projectId, clone(settings));
  }

  samples = new Map<string, { projectId: string; slug: string }>();

  async listContracts(projectId: string, limit: number): Promise<ContractSummaryRow[]> {
    return [...this.contracts.values()]
      .filter((c) => c.projectId === projectId)
      .sort((a, b) => b.updatedAt - a.updatedAt || (a.issueId < b.issueId ? -1 : 1))
      .slice(0, limit)
      .map((c) => {
        const s = this.summaries.get(c.issueId);
        return {
          issueId: c.issueId,
          issueKey: c.issueKey,
          proofState: s?.state ?? 'none',
          total: s?.total ?? 0,
          proven: s?.proven ?? 0,
          submitted: s?.submitted ?? 0,
          rejected: s?.rejected ?? 0,
          updatedAt: c.updatedAt,
        };
      });
  }

  async countEvents(projectId: string, since: number): Promise<EventCount[]> {
    const byType = new Map<string, { count: number; issues: Set<string | null> }>();
    for (const event of this.events) {
      if (event.projectId !== projectId || event.at < since) continue;
      const entry = byType.get(event.type) ?? { count: 0, issues: new Set() };
      entry.count++;
      entry.issues.add(event.issueId);
      byType.set(event.type, entry);
    }
    return [...byType].map(([type, entry]) => ({ type, count: entry.count, issues: entry.issues.size }));
  }

  async listSampleIssues(projectId: string): Promise<SampleMarker[]> {
    return [...this.samples].filter(([, s]) => s.projectId === projectId).map(([issueId, s]) => ({ issueId, slug: s.slug }));
  }

  async markSample(issueId: string, projectId: string, slug: string): Promise<void> {
    if (!this.samples.has(issueId)) this.samples.set(issueId, { projectId, slug });
  }

  async purgeIssue(issueId: string): Promise<void> {
    this.contracts.delete(issueId);
    this.summaries.delete(issueId);
    this.samples.delete(issueId);
    this.criteria = this.criteria.filter((c) => c.issueId !== issueId);
    this.evidence = this.evidence.filter((e) => e.issueId !== issueId);
    this.verdicts = this.verdicts.filter((v) => v.issueId !== issueId);
    this.events = this.events.filter((e) => e.issueId !== issueId);
  }

  eventTypes(issueId: string): string[] {
    return this.events.filter((e) => e.issueId === issueId).map((e) => e.type);
  }
}

/** Jira with a handful of work items. `editable` is what the calling user may edit. */
export class FakeJira implements JiraGateway {
  issues = new Map<string, IssueInfo>();
  editable = true;
  properties = new Map<string, ProofProperty>();
  failPropertyWrites = false;

  add(issue: IssueInfo): IssueInfo {
    this.issues.set(issue.id, issue);
    return issue;
  }

  async getIssue(idOrKey: string, _as: RunAs): Promise<IssueInfo | null> {
    for (const issue of this.issues.values()) {
      if (issue.id === idOrKey || issue.key === idOrKey) return clone(issue);
    }
    return null;
  }

  async canEdit(): Promise<boolean> {
    return this.editable;
  }

  async setProofProperty(issueId: string, value: ProofProperty): Promise<void> {
    if (this.failPropertyWrites) throw new Error('Jira is down');
    this.properties.set(issueId, clone(value));
  }

  /** Status id to category key. */
  statuses = new Map<string, string>([
    ['1', 'new'],
    ['3', 'indeterminate'],
    ['5', 'done'],
  ]);
  /** The transitions every work item offers. */
  transitions: TransitionInfo[] = [
    { id: '11', name: 'To Do', toStatusId: '1', toStatusName: 'To Do', toCategory: 'new' },
    { id: '21', name: 'Start', toStatusId: '3', toStatusName: 'In Progress', toCategory: 'indeterminate' },
    { id: '31', name: 'Done', toStatusId: '5', toStatusName: 'Done', toCategory: 'done' },
  ];
  comments: Array<{ issueId: string; paragraphs: string[] }> = [];
  statusLookups = 0;
  /** Set to make Jira refuse the next moves or comments, as a workflow rule or a permission scheme can. */
  failTransition = false;
  failComment = false;

  async getStatusCategory(statusId: string): Promise<string | null> {
    this.statusLookups++;
    return this.statuses.get(statusId) ?? null;
  }

  async listTransitions(): Promise<TransitionInfo[]> {
    return clone(this.transitions);
  }

  async transition(issueId: string, transitionId: string): Promise<void> {
    const transition = this.transitions.find((t) => t.id === transitionId);
    const issue = this.issues.get(issueId);
    if (!transition || !issue) throw new Error('No such transition');
    if (this.failTransition) throw new Error('Jira returned 400 when moving the work item.');
    const before = issue.statusCategory;
    issue.statusName = transition.toStatusName;
    issue.statusCategory = this.statuses.get(transition.toStatusId) ?? 'indeterminate';
    const dates = this.dates.get(issueId);
    if (dates && before !== issue.statusCategory) dates.statusCategoryChangedAt = this.clock();
  }

  async addComment(issueId: string, paragraphs: string[]): Promise<void> {
    if (this.failComment) throw new Error('Jira returned 403 when commenting.');
    this.comments.push({ issueId, paragraphs: [...paragraphs] });
  }

  projects = new Map<string, ProjectInfo>([
    [
      '10000',
      {
        id: '10000',
        key: 'MOBL',
        name: 'Mobile Dev',
        issueTypes: [
          { id: '1', name: 'Bug' },
          { id: '2', name: 'Story' },
          { id: '3', name: 'Task' },
        ],
      },
    ],
  ]);
  admin = true;
  /** The fake's idea of the present, for JQL with relative dates. */
  clock: () => number = () => Date.now();
  /** When each work item was created and when it last changed status category. */
  dates = new Map<string, { createdAt: number; statusCategoryChangedAt: number | null }>();
  labels = new Map<string, string[]>();
  jqlSeen: string[] = [];
  failCreate: string | null = null;
  failDelete = false;
  private nextIssue = 100;

  async getProject(projectId: string, _as: RunAs): Promise<ProjectInfo | null> {
    const project = this.projects.get(projectId) ?? [...this.projects.values()].find((p) => p.key === projectId);
    return project ? clone(project) : null;
  }

  /** What surrounds a work item, by work item id. Work items without an entry have nothing around them. */
  contexts = new Map<string, Partial<IssueContext>>();

  async getIssueContext(idOrKey: string, _as: RunAs): Promise<IssueContext | null> {
    const issue = await this.getIssue(idOrKey, 'user');
    if (!issue) return null;
    return clone({
      priority: null,
      labels: [],
      components: [],
      assignee: null,
      reporter: null,
      dueDate: null,
      subtasks: [],
      links: [],
      comments: [],
      commentTotal: 0,
      ...this.contexts.get(issue.id),
    });
  }

  async canAdminister(): Promise<boolean> {
    return this.admin;
  }

  /** Understands the two shapes of JQL the app writes: created in the last N days, and closed in the last N days. */
  private match(jql: string): IssueInfo[] {
    this.jqlSeen.push(jql);
    const project = /project = (\d+)/.exec(jql)?.[1];
    const createdDays = /created >= -(\d+)d/.exec(jql)?.[1];
    const closedDays = /statusCategoryChangedDate >= -(\d+)d/.exec(jql)?.[1];
    const day = 24 * 60 * 60 * 1000;
    return [...this.issues.values()].filter((issue) => {
      const dates = this.dates.get(issue.id);
      if (project && issue.projectId !== project) return false;
      if (createdDays && !(dates && dates.createdAt >= this.clock() - Number(createdDays) * day)) return false;
      if (/statusCategory = Done/.test(jql) && issue.statusCategory !== 'done') return false;
      if (closedDays && !(dates?.statusCategoryChangedAt && dates.statusCategoryChangedAt >= this.clock() - Number(closedDays) * day)) return false;
      return true;
    });
  }

  async countIssues(jql: string, _as: RunAs): Promise<number> {
    return this.match(jql).length;
  }

  /** Work items the calling user may not see. */
  hidden = new Set<string>();

  async getIssueRows(issueIds: string[], _as: RunAs): Promise<IssueRow[]> {
    return [...this.issues.values()]
      .filter((issue) => issueIds.includes(issue.id) && !this.hidden.has(issue.id))
      .map((issue) => ({
        id: issue.id,
        key: issue.key,
        summary: issue.summary,
        issueType: issue.issueType,
        statusName: issue.statusName,
        statusCategory: issue.statusCategory,
        assigneeAccountId: issue.assigneeAccountId,
        statusCategoryChangedAt: this.dates.get(issue.id)?.statusCategoryChangedAt ?? null,
      }));
  }

  async createIssue(issue: NewIssue): Promise<{ id: string; key: string }> {
    if (this.failCreate) throw new Error(this.failCreate);
    const project = this.projects.get(issue.projectId);
    if (!project) throw new Error('Jira returned 404 when creating a work item.');
    const number = this.nextIssue++;
    const id = String(20000 + number);
    const key = `${project.key}-${number}`;
    this.add(
      issueInfo({
        id,
        key,
        projectId: project.id,
        projectKey: project.key,
        summary: issue.summary,
        description: clone(issue.description),
        issueType: project.issueTypes.find((t) => t.id === issue.issueTypeId)?.name ?? 'Task',
        statusName: 'To Do',
        statusCategory: 'new',
      }),
    );
    this.dates.set(id, { createdAt: this.clock(), statusCategoryChangedAt: null });
    this.labels.set(id, [...issue.labels]);
    return { id, key };
  }

  async deleteIssue(issueId: string): Promise<boolean> {
    if (this.failDelete) return false;
    this.issues.delete(issueId);
    return true;
  }
}

/** The Teamwork Graph with what it links to each work item, by work item id. A work item without an entry has nothing linked. */
export class FakeGraph implements GraphGateway {
  linked = new Map<string, LinkedWork>();
  /** `down` throws, `silent` gives no answer, `slow` never answers. */
  mood: 'up' | 'down' | 'silent' | 'slow' = 'up';
  /** The work items the app asked about, in order. */
  asked: string[] = [];
  private gate: Promise<void> | null = null;

  /** Makes the graph keep its answers back until the returned function is called. */
  hold(): () => void {
    let release!: () => void;
    this.gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    return () => {
      this.gate = null;
      release();
    };
  }

  link(issueId: string, items: Array<Partial<LinkedItem>>, partial: LinkedWork['partial'] = []): void {
    this.linked.set(issueId, { items: items.map(linkedItem), partial });
  }

  async linkedWork(issueId: string): Promise<LinkedWork | null> {
    this.asked.push(issueId);
    if (this.gate) await this.gate;
    if (this.mood === 'down') throw new Error('The graph is down.');
    if (this.mood === 'slow') return new Promise(() => undefined);
    if (this.mood === 'silent') return null;
    return clone(this.linked.get(issueId) ?? { items: [], partial: [] });
  }
}

export function linkedItem(overrides: Partial<LinkedItem> = {}): LinkedItem {
  return {
    kind: 'pull_request',
    name: '#12 Lock accounts after five failed sign-ins',
    url: 'https://github.com/acme/mobile/pull/12',
    state: 'merged',
    environment: null,
    provider: 'GitHub',
    updatedAt: '2026-11-20T10:00:00.000Z',
    ...overrides,
  };
}

export function issueInfo(overrides: Partial<IssueInfo> = {}): IssueInfo {
  return {
    id: '10001',
    key: 'MOBL-1',
    projectId: '10000',
    projectKey: 'MOBL',
    summary: 'Mobile user login',
    description: null,
    issueType: 'Story',
    statusName: 'In Progress',
    statusCategory: 'indeterminate',
    assigneeAccountId: null,
    parentKey: null,
    ...overrides,
  };
}
