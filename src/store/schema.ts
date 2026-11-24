import { migrationRunner } from '@forge/sql';
import { errorLine } from '../core/errors';
import { isSchemaBehind } from './sql-errors';

/**
 * Schema for Forge SQL (MySQL-compatible, backed by TiDB). Forge SQL has no foreign
 * keys and advises against AUTO_INCREMENT, so ids are generated in the app and rows
 * are joined by convention. Times are epoch milliseconds in BIGINT columns, which
 * sidesteps time zone handling. Column names avoid SQL keywords so no query needs
 * quoting.
 *
 * Only ever add statements here. A statement that has run on a customer site is
 * tracked by its name and never runs again.
 */
const MIGRATIONS: Array<[name: string, ddl: string]> = [
  [
    'v001_contracts',
    `CREATE TABLE IF NOT EXISTS pod_contracts (
      issue_id VARCHAR(32) NOT NULL PRIMARY KEY,
      issue_key VARCHAR(64) NOT NULL,
      project_id VARCHAR(32) NOT NULL,
      created_by VARCHAR(128) NULL,
      created_at BIGINT NOT NULL,
      updated_at BIGINT NOT NULL,
      total_count INT NOT NULL DEFAULT 0,
      proven_count INT NOT NULL DEFAULT 0,
      submitted_count INT NOT NULL DEFAULT 0,
      rejected_count INT NOT NULL DEFAULT 0,
      self_reviewed_count INT NOT NULL DEFAULT 0,
      proof_state VARCHAR(16) NOT NULL DEFAULT 'none',
      INDEX idx_pod_contracts_project (project_id, proof_state)
    )`,
  ],
  [
    'v002_criteria',
    `CREATE TABLE IF NOT EXISTS pod_criteria (
      id VARCHAR(26) NOT NULL PRIMARY KEY,
      issue_id VARCHAR(32) NOT NULL,
      sort_order INT NOT NULL,
      criterion_text VARCHAR(600) NOT NULL,
      origin VARCHAR(24) NOT NULL,
      origin_ref VARCHAR(255) NULL,
      required_kind VARCHAR(24) NOT NULL,
      is_active TINYINT NOT NULL DEFAULT 1,
      created_by VARCHAR(128) NULL,
      created_at BIGINT NOT NULL,
      INDEX idx_pod_criteria_issue (issue_id)
    )`,
  ],
  [
    'v003_evidence',
    `CREATE TABLE IF NOT EXISTS pod_evidence (
      id VARCHAR(26) NOT NULL PRIMARY KEY,
      criterion_id VARCHAR(26) NOT NULL,
      issue_id VARCHAR(32) NOT NULL,
      project_id VARCHAR(32) NOT NULL,
      kind VARCHAR(24) NOT NULL,
      summary VARCHAR(1000) NOT NULL,
      url VARCHAR(2000) NULL,
      details_json TEXT NULL,
      channel VARCHAR(16) NOT NULL,
      actor_account_id VARCHAR(128) NULL,
      agent_name VARCHAR(128) NULL,
      checks_json TEXT NULL,
      checks_passed TINYINT NOT NULL,
      created_at BIGINT NOT NULL,
      INDEX idx_pod_evidence_issue (issue_id)
    )`,
  ],
  [
    'v004_verdicts',
    `CREATE TABLE IF NOT EXISTS pod_verdicts (
      id VARCHAR(26) NOT NULL PRIMARY KEY,
      evidence_id VARCHAR(26) NOT NULL,
      criterion_id VARCHAR(26) NOT NULL,
      issue_id VARCHAR(32) NOT NULL,
      project_id VARCHAR(32) NOT NULL,
      decision VARCHAR(16) NOT NULL,
      reason VARCHAR(2000) NOT NULL,
      channel VARCHAR(16) NOT NULL,
      actor_account_id VARCHAR(128) NULL,
      is_independent TINYINT NOT NULL,
      created_at BIGINT NOT NULL,
      INDEX idx_pod_verdicts_issue (issue_id)
    )`,
  ],
  [
    'v005_events',
    `CREATE TABLE IF NOT EXISTS pod_events (
      id VARCHAR(26) NOT NULL PRIMARY KEY,
      project_id VARCHAR(32) NOT NULL,
      issue_id VARCHAR(32) NULL,
      event_type VARCHAR(40) NOT NULL,
      occurred_at BIGINT NOT NULL,
      actor_account_id VARCHAR(128) NULL,
      channel VARCHAR(16) NULL,
      data_json TEXT NULL,
      INDEX idx_pod_events_project (project_id, occurred_at),
      INDEX idx_pod_events_issue (issue_id, occurred_at)
    )`,
  ],
  [
    'v006_project_settings',
    `CREATE TABLE IF NOT EXISTS pod_project_settings (
      project_id VARCHAR(32) NOT NULL PRIMARY KEY,
      settings_json TEXT NOT NULL,
      updated_by VARCHAR(128) NULL,
      updated_at BIGINT NOT NULL
    )`,
  ],
  [
    'v007_samples',
    `CREATE TABLE IF NOT EXISTS pod_samples (
      issue_id VARCHAR(32) NOT NULL PRIMARY KEY,
      project_id VARCHAR(32) NOT NULL,
      sample_slug VARCHAR(40) NOT NULL,
      created_at BIGINT NOT NULL,
      INDEX idx_pod_samples_project (project_id)
    )`,
  ],
];

for (const [name, ddl] of MIGRATIONS) migrationRunner.enqueue(name, ddl);

let running: Promise<string[]> | null = null;

/**
 * Applies any migration this installation has not run yet and returns their names.
 * Calls that overlap in one runtime share a single run.
 */
export function migrate(): Promise<string[]> {
  if (!running) {
    running = migrationRunner.run().finally(() => {
      running = null;
    });
  }
  return running;
}

/**
 * Runs a storage operation, and creates or updates the schema first if that is why it
 * failed. Migrations normally run on install and once a day, but a first page load can
 * arrive before either. Checking the schema on every call instead would spend the
 * 25-per-minute DDL allowance for nothing.
 */
export async function withSchema<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!isSchemaBehind(error)) throw error;
    console.warn('Proof of Done: the schema is missing or behind, running migrations.');
    try {
      await migrate();
    } catch (migrationError) {
      // Another invocation may be migrating at the same moment. The retry below decides.
      console.warn(`Proof of Done: migration attempt failed, retrying the query once. ${errorLine(migrationError)}`);
    }
    return operation();
  }
}
