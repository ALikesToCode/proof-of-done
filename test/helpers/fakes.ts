import { DEFAULT_SETTINGS, normalizeSettings } from '../../src/core/settings';
import { Criterion, Evidence, ProjectSettings, ProofSummary, Verdict } from '../../src/core/types';
import { IssueInfo, JiraGateway, ProofProperty, RunAs } from '../../src/jira/gateway';
import { ContractBundle, ContractRow, ContractStore, EventRow } from '../../src/store/types';

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

  async insertEvidence(evidence: Evidence): Promise<void> {
    this.evidence.push(clone(evidence));
  }

  async insertVerdict(verdict: Verdict): Promise<void> {
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

  async saveSummary(issueId: string, summary: ProofSummary): Promise<void> {
    this.summaries.set(issueId, clone(summary));
  }

  async getSettings(projectId: string): Promise<ProjectSettings> {
    return normalizeSettings(this.settings.get(projectId) ?? DEFAULT_SETTINGS);
  }

  async saveSettings(projectId: string, settings: ProjectSettings): Promise<void> {
    this.settings.set(projectId, clone(settings));
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
