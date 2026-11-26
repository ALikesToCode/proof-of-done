import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, rmdirSync, statSync, writeSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { DEFAULT_SETTINGS, normalizeSettings } from '../core/settings';
import { Criterion, Evidence, ProjectSettings, ProofSummary, Verdict } from '../core/types';
import { ContractBundle, ContractRow, ContractStore, ContractSummaryRow, EventCount, EventRow, PipelineKey, SampleMarker } from '../store/types';

/**
 * The store of the local adapter: one JSON file.
 *
 * Several processes can use it at once, for example a tool server per agent and a
 * person at the command line. Every write takes a lock, reads the file again, changes
 * it and replaces it with a rename, so a reader never sees half a write and two
 * writers never lose each other's rows. Evidence, verdicts and events are only ever
 * appended.
 */

export const STATE_VERSION = 1;

export interface LocalComment {
  issueId: string;
  at: number;
  paragraphs: string[];
}

export interface State {
  version: number;
  contracts: ContractRow[];
  criteria: Criterion[];
  evidence: Evidence[];
  verdicts: Verdict[];
  events: EventRow[];
  summaries: Record<string, ProofSummary>;
  settings: Record<string, ProjectSettings>;
  samples: Array<SampleMarker & { projectId: string }>;
  comments: LocalComment[];
  /** Absent in a file written before pipeline keys existed. */
  pipelineKeys?: Record<string, PipelineKey>;
}

const empty = (): State => ({
  version: STATE_VERSION,
  contracts: [],
  criteria: [],
  evidence: [],
  verdicts: [],
  events: [],
  summaries: {},
  settings: {},
  samples: [],
  comments: [],
});

/** A lock older than this was left behind by a process that died. */
const STALE_LOCK_MS = 10_000;
const LOCK_WAIT_MS = 5_000;
const LOCK_STEP_MS = 15;

const pause = (ms: number): void => {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
};

export class StoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StoreError';
  }
}

export class FileStore implements ContractStore {
  private readonly lockDir: string;

  constructor(private readonly file: string) {
    this.lockDir = `${file}.lock`;
  }

  /** The whole state, as one consistent snapshot. */
  read(): State {
    if (!existsSync(this.file)) return empty();
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(this.file, 'utf8'));
    } catch {
      throw new StoreError(`${this.file} is not valid JSON. Restore it from version control or a backup. Proof of Done will not overwrite it.`);
    }
    const state = parsed as Partial<State> | null;
    if (!state || typeof state !== 'object' || typeof state.version !== 'number') {
      throw new StoreError(`${this.file} is not a Proof of Done store.`);
    }
    if (state.version > STATE_VERSION) {
      throw new StoreError(`${this.file} was written by a newer version of Proof of Done (format ${state.version}). Update this copy.`);
    }
    return { ...empty(), ...state, version: STATE_VERSION };
  }

  /** Runs one change under the lock and writes the result. */
  private change<T>(mutate: (state: State) => T): T {
    this.lock();
    try {
      const state = this.read();
      const result = mutate(state);
      this.write(state);
      return result;
    } finally {
      this.unlock();
    }
  }

  private write(state: State): void {
    const temp = `${this.file}.${process.pid}.tmp`;
    const handle = openSync(temp, 'w', 0o600);
    try {
      writeSync(handle, `${JSON.stringify(state, null, 1)}\n`);
      fsyncSync(handle);
    } finally {
      closeSync(handle);
    }
    renameSync(temp, this.file);
  }

  private lock(): void {
    mkdirSync(dirname(this.file), { recursive: true });
    const deadline = Date.now() + LOCK_WAIT_MS;
    for (;;) {
      try {
        mkdirSync(this.lockDir);
        return;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      }
      try {
        if (Date.now() - statSync(this.lockDir).mtimeMs > STALE_LOCK_MS) {
          rmdirSync(this.lockDir);
          continue;
        }
      } catch {
        // The holder released it between the two calls. Try again at once.
        continue;
      }
      if (Date.now() > deadline) {
        throw new StoreError(`Another process holds ${this.lockDir}. If none is running, delete that folder and try again.`);
      }
      pause(LOCK_STEP_MS);
    }
  }

  private unlock(): void {
    try {
      rmdirSync(this.lockDir);
    } catch {
      // Already gone. Nothing depends on it.
    }
  }

  async getBundle(issueId: string): Promise<ContractBundle> {
    const state = this.read();
    const contract = state.contracts.find((c) => c.issueId === issueId) ?? null;
    if (!contract) return { contract: null, criteria: [], evidence: [], verdicts: [] };
    return {
      contract,
      criteria: state.criteria.filter((c) => c.issueId === issueId).sort((a, b) => a.position - b.position || (a.id < b.id ? -1 : 1)),
      evidence: state.evidence.filter((e) => e.issueId === issueId),
      verdicts: state.verdicts.filter((v) => v.issueId === issueId),
    };
  }

  async createContract(row: ContractRow): Promise<boolean> {
    return this.change((state) => {
      if (state.contracts.some((c) => c.issueId === row.issueId)) return false;
      state.contracts.push(row);
      return true;
    });
  }

  async insertCriteria(criteria: Criterion[]): Promise<void> {
    this.change((state) => void state.criteria.push(...criteria));
  }

  async deactivateCriterion(criterionId: string, issueId: string): Promise<void> {
    this.change((state) => {
      for (const c of state.criteria) if (c.id === criterionId && c.issueId === issueId) c.active = false;
    });
  }

  async findCriterionIssue(criterionId: string): Promise<string | null> {
    return this.read().criteria.find((c) => c.id === criterionId)?.issueId ?? null;
  }

  async insertEvidence(evidence: Evidence): Promise<void> {
    this.change((state) => void state.evidence.push(evidence));
  }

  async insertVerdict(verdict: Verdict): Promise<void> {
    this.change((state) => void state.verdicts.push(verdict));
  }

  async insertEvent(event: EventRow): Promise<void> {
    this.change((state) => void state.events.push(event));
  }

  async listEvents(issueId: string, limit: number): Promise<EventRow[]> {
    return this.read()
      .events.filter((e) => e.issueId === issueId)
      .sort((a, b) => b.at - a.at || (a.id < b.id ? 1 : -1))
      .slice(0, limit);
  }

  async saveSummary(issueId: string, summary: ProofSummary, now: number): Promise<void> {
    this.change((state) => {
      state.summaries[issueId] = summary;
      const contract = state.contracts.find((c) => c.issueId === issueId);
      if (contract) contract.updatedAt = now;
    });
  }

  async getSettings(projectId: string): Promise<ProjectSettings> {
    return normalizeSettings(this.read().settings[projectId] ?? DEFAULT_SETTINGS);
  }

  async saveSettings(projectId: string, settings: ProjectSettings): Promise<void> {
    this.change((state) => void (state.settings[projectId] = settings));
  }

  async getPipelineKey(projectId: string): Promise<PipelineKey | null> {
    return this.read().pipelineKeys?.[projectId] ?? null;
  }

  async savePipelineKey(key: PipelineKey): Promise<void> {
    this.change((state) => void ((state.pipelineKeys ??= {})[key.projectId] = key));
  }

  async deletePipelineKey(projectId: string): Promise<void> {
    this.change((state) => void delete state.pipelineKeys?.[projectId]);
  }

  async markPipelineKeyUsed(projectId: string, now: number): Promise<void> {
    this.change((state) => {
      const key = state.pipelineKeys?.[projectId];
      if (key) key.lastUsedAt = now;
    });
  }

  async listContracts(projectId: string, limit: number): Promise<ContractSummaryRow[]> {
    const state = this.read();
    return state.contracts
      .filter((c) => c.projectId === projectId)
      .sort((a, b) => b.updatedAt - a.updatedAt || (a.issueId < b.issueId ? -1 : 1))
      .slice(0, limit)
      .map((c) => {
        const s = state.summaries[c.issueId];
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
    for (const event of this.read().events) {
      if (event.projectId !== projectId || event.at < since) continue;
      const entry = byType.get(event.type) ?? { count: 0, issues: new Set<string | null>() };
      entry.count++;
      entry.issues.add(event.issueId);
      byType.set(event.type, entry);
    }
    return [...byType].map(([type, entry]) => ({ type, count: entry.count, issues: entry.issues.size }));
  }

  async listSampleIssues(projectId: string): Promise<SampleMarker[]> {
    return this.read()
      .samples.filter((s) => s.projectId === projectId)
      .map((s) => ({ issueId: s.issueId, slug: s.slug }));
  }

  async markSample(issueId: string, projectId: string, slug: string): Promise<void> {
    this.change((state) => {
      if (!state.samples.some((s) => s.issueId === issueId)) state.samples.push({ issueId, projectId, slug });
    });
  }

  async purgeIssue(issueId: string): Promise<void> {
    this.change((state) => {
      state.contracts = state.contracts.filter((c) => c.issueId !== issueId);
      delete state.summaries[issueId];
      state.samples = state.samples.filter((s) => s.issueId !== issueId);
      state.criteria = state.criteria.filter((c) => c.issueId !== issueId);
      state.evidence = state.evidence.filter((e) => e.issueId !== issueId);
      state.verdicts = state.verdicts.filter((v) => v.issueId !== issueId);
      state.events = state.events.filter((e) => e.issueId !== issueId);
      state.comments = state.comments.filter((c) => c.issueId !== issueId);
    });
  }

  addComment(comment: LocalComment): void {
    this.change((state) => void state.comments.push(comment));
  }

  comments(issueId: string): LocalComment[] {
    return this.read().comments.filter((c) => c.issueId === issueId);
  }
}

export const storeFile = (root: string): string => join(root, 'state.json');
