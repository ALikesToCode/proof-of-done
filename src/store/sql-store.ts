import { sql } from '@forge/sql';
import { proofStateOf } from '../core/proof';
import { normalizeSettings } from '../core/settings';
import {
  CheckResult,
  Criterion,
  CriterionSource,
  Decision,
  Evidence,
  EvidenceChannel,
  EvidenceDetails,
  EvidenceKind,
  ProjectSettings,
  ProofSummary,
  RequiredKind,
  Verdict,
  VerdictChannel,
} from '../core/types';
import { withSchema } from './schema';
import { ContractBundle, ContractRow, ContractStore, ContractSummaryRow, EventCount, EventRow, PipelineKey, SampleMarker } from './types';

type Row = Record<string, unknown>;

async function select(query: string, ...params: unknown[]): Promise<Row[]> {
  const result = await withSchema(() => sql.prepare<Row>(query).bindParams(...params).execute());
  return Array.isArray(result.rows) ? result.rows : [];
}

async function write(query: string, ...params: unknown[]): Promise<number> {
  const result = await withSchema(() => sql.prepare<Row>(query).bindParams(...params).execute());
  const outcome = result.rows as unknown as { affectedRows?: number } | undefined;
  return Number(outcome?.affectedRows ?? 0);
}

const str = (value: unknown): string => (value === null || value === undefined ? '' : String(value));
const strOrNull = (value: unknown): string | null => (value === null || value === undefined ? null : String(value));
const num = (value: unknown): number => Number(value ?? 0);
const bool = (value: unknown): boolean => value === true || Number(value ?? 0) === 1;

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string' || !value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

const CONTRACT_COLUMNS = 'issue_id, issue_key, project_id, created_by, created_at, updated_at';
const CRITERION_COLUMNS =
  'id, issue_id, sort_order, criterion_text, origin, origin_ref, required_kind, is_active, created_by, created_at';
const EVIDENCE_COLUMNS =
  'id, criterion_id, issue_id, project_id, kind, summary, url, details_json, channel, actor_account_id, agent_name, checks_json, checks_passed, created_at';
const VERDICT_COLUMNS =
  'id, evidence_id, criterion_id, issue_id, project_id, decision, reason, channel, actor_account_id, is_independent, created_at';
const EVENT_COLUMNS = 'id, project_id, issue_id, event_type, occurred_at, actor_account_id, channel, data_json';

function toContract(row: Row): ContractRow {
  return {
    issueId: str(row['issue_id']),
    issueKey: str(row['issue_key']),
    projectId: str(row['project_id']),
    createdBy: strOrNull(row['created_by']),
    createdAt: num(row['created_at']),
    updatedAt: num(row['updated_at']),
  };
}

function toCriterion(row: Row): Criterion {
  return {
    id: str(row['id']),
    issueId: str(row['issue_id']),
    position: num(row['sort_order']),
    text: str(row['criterion_text']),
    source: str(row['origin']) as CriterionSource,
    sourceRef: strOrNull(row['origin_ref']),
    requiredKind: str(row['required_kind']) as RequiredKind,
    active: bool(row['is_active']),
    createdBy: strOrNull(row['created_by']),
    createdAt: num(row['created_at']),
  };
}

function toEvidence(row: Row): Evidence {
  return {
    id: str(row['id']),
    criterionId: str(row['criterion_id']),
    issueId: str(row['issue_id']),
    kind: str(row['kind']) as EvidenceKind,
    summary: str(row['summary']),
    url: strOrNull(row['url']),
    details: parseJson<EvidenceDetails>(row['details_json'], {}),
    channel: str(row['channel']) as EvidenceChannel,
    actorAccountId: strOrNull(row['actor_account_id']),
    agentName: strOrNull(row['agent_name']),
    checks: parseJson<CheckResult[]>(row['checks_json'], []),
    checksPassed: bool(row['checks_passed']),
    createdAt: num(row['created_at']),
  };
}

function toVerdict(row: Row): Verdict {
  return {
    id: str(row['id']),
    evidenceId: str(row['evidence_id']),
    criterionId: str(row['criterion_id']),
    issueId: str(row['issue_id']),
    decision: str(row['decision']) as Decision,
    reason: str(row['reason']),
    channel: str(row['channel']) as VerdictChannel,
    actorAccountId: strOrNull(row['actor_account_id']),
    independent: bool(row['is_independent']),
    createdAt: num(row['created_at']),
  };
}

function toEvent(row: Row): EventRow {
  return {
    id: str(row['id']),
    projectId: str(row['project_id']),
    issueId: strOrNull(row['issue_id']),
    type: str(row['event_type']),
    at: num(row['occurred_at']),
    actorAccountId: strOrNull(row['actor_account_id']),
    channel: strOrNull(row['channel']),
    data: parseJson<Record<string, unknown>>(row['data_json'], {}),
  };
}

/** Every table that holds rows about a work item, in the order a purge empties them. */
const ISSUE_TABLES = ['pod_verdicts', 'pod_evidence', 'pod_criteria', 'pod_events', 'pod_contracts', 'pod_samples'];

export class SqlContractStore implements ContractStore {
  async getBundle(issueId: string): Promise<ContractBundle> {
    // Most work items on a site have no contract, so look for one before reading the rest.
    const contracts = await select(`SELECT ${CONTRACT_COLUMNS} FROM pod_contracts WHERE issue_id = ?`, issueId);
    const contract = contracts[0];
    if (!contract) return { contract: null, criteria: [], evidence: [], verdicts: [] };
    const [criteria, evidence, verdicts] = await Promise.all([
      select(`SELECT ${CRITERION_COLUMNS} FROM pod_criteria WHERE issue_id = ? ORDER BY sort_order, id`, issueId),
      select(`SELECT ${EVIDENCE_COLUMNS} FROM pod_evidence WHERE issue_id = ? ORDER BY created_at, id`, issueId),
      select(`SELECT ${VERDICT_COLUMNS} FROM pod_verdicts WHERE issue_id = ? ORDER BY created_at, id`, issueId),
    ]);
    return {
      contract: toContract(contract),
      criteria: criteria.map(toCriterion),
      evidence: evidence.map(toEvidence),
      verdicts: verdicts.map(toVerdict),
    };
  }

  async createContract(row: ContractRow): Promise<boolean> {
    const affected = await write(
      `INSERT IGNORE INTO pod_contracts (${CONTRACT_COLUMNS}) VALUES (?, ?, ?, ?, ?, ?)`,
      row.issueId,
      row.issueKey,
      row.projectId,
      row.createdBy,
      row.createdAt,
      row.updatedAt,
    );
    return affected > 0;
  }

  async insertCriteria(criteria: Criterion[]): Promise<void> {
    // One statement per row. Forge SQL takes a single statement per call and a contract
    // has a handful of criteria.
    for (const c of criteria) {
      await write(
        `INSERT INTO pod_criteria (${CRITERION_COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        c.id,
        c.issueId,
        c.position,
        c.text,
        c.source,
        c.sourceRef,
        c.requiredKind,
        c.active ? 1 : 0,
        c.createdBy,
        c.createdAt,
      );
    }
  }

  async deactivateCriterion(criterionId: string, issueId: string): Promise<void> {
    await write('UPDATE pod_criteria SET is_active = 0 WHERE id = ? AND issue_id = ?', criterionId, issueId);
  }

  async findCriterionIssue(criterionId: string): Promise<string | null> {
    const rows = await select('SELECT issue_id FROM pod_criteria WHERE id = ? LIMIT 1', criterionId);
    return rows[0] ? str(rows[0]['issue_id']) || null : null;
  }

  async insertEvidence(e: Evidence, projectId: string): Promise<void> {
    await write(
      `INSERT INTO pod_evidence (${EVIDENCE_COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      e.id,
      e.criterionId,
      e.issueId,
      projectId,
      e.kind,
      e.summary,
      e.url,
      JSON.stringify(e.details),
      e.channel,
      e.actorAccountId,
      e.agentName,
      JSON.stringify(e.checks),
      e.checksPassed ? 1 : 0,
      e.createdAt,
    );
  }

  async insertVerdict(v: Verdict, projectId: string): Promise<void> {
    await write(
      `INSERT INTO pod_verdicts (${VERDICT_COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      v.id,
      v.evidenceId,
      v.criterionId,
      v.issueId,
      projectId,
      v.decision,
      v.reason,
      v.channel,
      v.actorAccountId,
      v.independent ? 1 : 0,
      v.createdAt,
    );
  }

  async insertEvent(event: EventRow): Promise<void> {
    await write(
      `INSERT INTO pod_events (${EVENT_COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      event.id,
      event.projectId,
      event.issueId,
      event.type,
      event.at,
      event.actorAccountId,
      event.channel,
      JSON.stringify(event.data),
    );
  }

  async listEvents(issueId: string, limit: number): Promise<EventRow[]> {
    const capped = Math.max(1, Math.min(200, Math.floor(limit)));
    // LIMIT is inlined because MySQL-compatible engines can reject it as a bound parameter.
    const rows = await select(
      `SELECT ${EVENT_COLUMNS} FROM pod_events WHERE issue_id = ? ORDER BY occurred_at DESC, id DESC LIMIT ${capped}`,
      issueId,
    );
    return rows.map(toEvent);
  }

  async saveSummary(issueId: string, summary: ProofSummary, now: number): Promise<void> {
    await write(
      'UPDATE pod_contracts SET total_count = ?, proven_count = ?, submitted_count = ?, rejected_count = ?, self_reviewed_count = ?, proof_state = ?, updated_at = ? WHERE issue_id = ?',
      summary.total,
      summary.proven,
      summary.submitted,
      summary.rejected,
      summary.selfReviewed,
      summary.state,
      now,
      issueId,
    );
  }

  async getSettings(projectId: string): Promise<ProjectSettings> {
    const rows = await select('SELECT settings_json FROM pod_project_settings WHERE project_id = ?', projectId);
    return normalizeSettings(parseJson<unknown>(rows[0]?.['settings_json'], null));
  }

  async saveSettings(projectId: string, settings: ProjectSettings, actorAccountId: string | null, now: number): Promise<void> {
    await write(
      'INSERT INTO pod_project_settings (project_id, settings_json, updated_by, updated_at) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE settings_json = VALUES(settings_json), updated_by = VALUES(updated_by), updated_at = VALUES(updated_at)',
      projectId,
      JSON.stringify(settings),
      actorAccountId,
      now,
    );
  }

  async getPipelineKey(projectId: string): Promise<PipelineKey | null> {
    const rows = await select('SELECT key_hash, created_by, created_at, last_used_at FROM pod_pipeline_keys WHERE project_id = ?', projectId);
    const row = rows[0];
    if (!row) return null;
    return {
      projectId,
      hash: str(row['key_hash']),
      createdBy: row['created_by'] === null || row['created_by'] === undefined ? null : str(row['created_by']),
      createdAt: num(row['created_at']),
      lastUsedAt: row['last_used_at'] === null || row['last_used_at'] === undefined ? null : num(row['last_used_at']),
    };
  }

  async savePipelineKey(key: PipelineKey): Promise<void> {
    await write(
      'INSERT INTO pod_pipeline_keys (project_id, key_hash, created_by, created_at, last_used_at) VALUES (?, ?, ?, ?, NULL) ON DUPLICATE KEY UPDATE key_hash = VALUES(key_hash), created_by = VALUES(created_by), created_at = VALUES(created_at), last_used_at = NULL',
      key.projectId,
      key.hash,
      key.createdBy,
      key.createdAt,
    );
  }

  async deletePipelineKey(projectId: string): Promise<void> {
    await write('DELETE FROM pod_pipeline_keys WHERE project_id = ?', projectId);
  }

  async markPipelineKeyUsed(projectId: string, now: number): Promise<void> {
    await write('UPDATE pod_pipeline_keys SET last_used_at = ? WHERE project_id = ?', now, projectId);
  }

  async listContracts(projectId: string, limit: number): Promise<ContractSummaryRow[]> {
    const capped = Math.max(1, Math.min(500, Math.floor(limit)));
    const rows = await select(
      `SELECT issue_id, issue_key, total_count, proven_count, submitted_count, rejected_count, updated_at FROM pod_contracts WHERE project_id = ? ORDER BY updated_at DESC, issue_id LIMIT ${capped}`,
      projectId,
    );
    // The state comes from the counts, so a row written under an older rule still reads right.
    return rows.map((row) => ({
      issueId: str(row['issue_id']),
      issueKey: str(row['issue_key']),
      proofState: proofStateOf(num(row['total_count']), num(row['proven_count'])),
      total: num(row['total_count']),
      proven: num(row['proven_count']),
      submitted: num(row['submitted_count']),
      rejected: num(row['rejected_count']),
      updatedAt: num(row['updated_at']),
    }));
  }

  async countEvents(projectId: string, since: number): Promise<EventCount[]> {
    const rows = await select(
      'SELECT event_type, COUNT(*) AS event_count, COUNT(DISTINCT issue_id) AS issue_count FROM pod_events WHERE project_id = ? AND occurred_at >= ? GROUP BY event_type',
      projectId,
      since,
    );
    return rows.map((row) => ({ type: str(row['event_type']), count: num(row['event_count']), issues: num(row['issue_count']) }));
  }

  async listSampleIssues(projectId: string): Promise<SampleMarker[]> {
    const rows = await select(
      'SELECT issue_id, sample_slug FROM pod_samples WHERE project_id = ? ORDER BY created_at, issue_id',
      projectId,
    );
    return rows.map((row) => ({ issueId: str(row['issue_id']), slug: str(row['sample_slug']) }));
  }

  async markSample(issueId: string, projectId: string, slug: string, now: number): Promise<void> {
    await write(
      'INSERT IGNORE INTO pod_samples (issue_id, project_id, sample_slug, created_at) VALUES (?, ?, ?, ?)',
      issueId,
      projectId,
      slug,
      now,
    );
  }

  async purgeIssue(issueId: string): Promise<void> {
    // The sample marker goes last, so a purge that fails half way can be run again.
    for (const table of ISSUE_TABLES) await write(`DELETE FROM ${table} WHERE issue_id = ?`, issueId);
  }
}
