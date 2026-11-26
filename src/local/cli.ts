#!/usr/bin/env node
import { mkdirSync } from 'node:fs';
import { userInfo } from 'node:os';
import { join, resolve } from 'node:path';
import { PodError, errorLine } from '../core/errors';
import { REQUIRED_KINDS } from '../core/types';
import { Caller } from '../services/contracts';
import { ContractView, CriterionView, EvidenceView } from '../services/view';
import { HOME, LocalApp, findRoot, openLocal } from './app';
import { StoreError } from './file-store';
import { serve } from './mcp-server';
import { STATUSES, STATUS_NAME, TASK_KEY, TaskStatus } from './tasks';
import { localText } from './wording';

/**
 * The command line of the local adapter. A person uses it to write contracts, review
 * evidence and close work. A harness or a pipeline uses `gate`, which exits with 0
 * only when the work is proven. An agent uses `mcp`, the tool server.
 */

export const VERSION = '0.1.0';

/** Exit codes of `gate`. A pipeline tells "not proven" from "could not tell". */
export const EXIT = { ok: 0, notProven: 1, error: 2 } as const;

export interface Io {
  out: (line: string) => void;
  err: (line: string) => void;
  cwd: string;
  env: Record<string, string | undefined>;
  /** Whether a person is at the keyboard. */
  interactive: boolean;
  now?: () => number;
}

const USAGE = `Proof of Done ${VERSION}: a guard for work handed to AI agents.

Usage: proof-of-done <command> [options]

Set up and write work
  init                              Create the .proof-of-done folder here
  new "<summary>" [-c "<criterion>"]...  [--project KEY] [--assignee NAME]
                                    Create a task file with its acceptance criteria
  list                              Every task and where its proof stands
  show KEY                          The contract of a task, with evidence and ids

Hold the contract (a person)
  start KEY                         Create the contract from the task's criteria
  criterion KEY "<text>" [--needs KIND]   Add a criterion
  attest KEY CRITERION_ID "<statement>"   Give your word for a criterion
  settings PROJECT [--gate off|warn|bounce] [--independent on|off] [--require-contract on|off]

Review evidence (a person)
  review [KEY]                      Evidence that waits for a verdict
  accept EVIDENCE_ID [--reason "<why>"]
  reject EVIDENCE_ID --reason "<why>"

Hold the gate
  move KEY todo|in-progress|done    Change the status. Done is refused without proof
  gate KEY... | --all | --closed | --in-progress
                                    Exit 0 when proven, 1 when not, 2 on an error
  gate ... --hook                   For a harness hook that runs when the agent wants to
                                    stop: exit 2 with the open criteria on stderr while
                                    the agent can still add evidence, else exit 0
  meter PROJECT [--days 7|14|30]    Is the project climbing, busy or stalled

For the agent
  mcp                               Serve the agent's five tools over stdio

Options for every command
  --dir PATH    The .proof-of-done folder. Default: the nearest one at or above here
  --as NAME     Who you are. Default: $POD_USER, then your login name
  --json        Print JSON where the command has a JSON form
`;

class UsageError extends Error {}

interface Args {
  positional: string[];
  flags: Map<string, string[]>;
}

const BOOLEAN_FLAGS = new Set(['json', 'all', 'closed', 'in-progress', 'hook', 'help', 'version']);
const VALUE_FLAGS = new Set(['dir', 'as', 'project', 'assignee', 'criterion', 'needs', 'reason', 'gate', 'independent', 'require-contract', 'days']);
const SHORT: Record<string, string> = { c: 'criterion', h: 'help', v: 'version' };

function parse(argv: string[]): Args {
  const positional: string[] = [];
  const flags = new Map<string, string[]>();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    const long = /^--([a-z][a-z-]*)(?:=(.*))?$/.exec(arg);
    const short = /^-([a-z])$/.exec(arg);
    const name = long?.[1] ?? (short ? SHORT[short[1]!] : undefined);
    if (name && !BOOLEAN_FLAGS.has(name) && !VALUE_FLAGS.has(name)) throw new UsageError(`Unknown option ${arg}.`);
    if (!name) {
      if (/^-[^-]|^--./.test(arg) && !/^-?\d/.test(arg)) throw new UsageError(`Unknown option ${arg}.`);
      positional.push(arg);
      continue;
    }
    let value = long?.[2];
    if (value === undefined && !BOOLEAN_FLAGS.has(name)) {
      value = argv[++i];
      if (value === undefined) throw new UsageError(`--${name} needs a value.`);
    }
    flags.set(name, [...(flags.get(name) ?? []), value ?? 'true']);
  }
  return { positional, flags };
}

const flag = (args: Args, name: string): string | undefined => args.flags.get(name)?.at(-1);
const has = (args: Args, name: string): boolean => args.flags.has(name);

function need(args: Args, index: number, what: string): string {
  const value = args.positional[index];
  if (!value) throw new UsageError(`Give ${what}.`);
  return value;
}

function onOff(value: string | undefined, name: string): boolean | undefined {
  if (value === undefined) return undefined;
  if (value === 'on') return true;
  if (value === 'off') return false;
  throw new UsageError(`--${name} takes on or off.`);
}

const STANDING: Record<EvidenceView['standing'], string> = {
  failed_checks: 'failed its checks',
  pending: 'waits for a review',
  accepted: 'accepted',
  self_accepted: 'accepted by its submitter',
  rejected: 'rejected',
};

const STATE: Record<CriterionView['state'], string> = {
  unproven: 'no evidence',
  submitted: 'waits for a review',
  proven: 'PROVEN',
  rejected: 'evidence turned away',
};

function evidenceLines(evidence: EvidenceView): string[] {
  const who = evidence.channel === 'agent' ? `agent ${evidence.agentName ?? 'unnamed'} for ${evidence.actorAccountId ?? 'nobody'}` : (evidence.actorAccountId ?? 'a person');
  const details = evidence.details;
  const lines = [`    ${evidence.id}  ${evidence.kind}, ${STANDING[evidence.standing]}, from ${who}`, `      ${evidence.summary}`];
  if (details.passed !== undefined || details.failed !== undefined) lines.push(`      ${details.passed ?? '?'} passed, ${details.failed ?? '?'} failed`);
  if (details.status) lines.push(`      status: ${details.status}`);
  if (details.command) lines.push(`      command: ${details.command}`);
  if (details.commit) lines.push(`      commit: ${details.commit}`);
  if (evidence.url) lines.push(`      ${evidence.url}`);
  if (details.text) lines.push(...details.text.split('\n').map((line) => `      | ${line}`));
  for (const check of evidence.checks.filter((c) => !c.ok)) lines.push(`      check failed: ${check.note}`);
  if (evidence.verdict) lines.push(`      ${evidence.verdict.decision} by ${evidence.verdict.actorAccountId ?? evidence.verdict.channel}: ${evidence.verdict.reason}`);
  return lines;
}

function contractLines(view: ContractView): string[] {
  const lines = [`${view.issue.key}  ${view.issue.summary}  [${view.issue.statusName}]`];
  if (!view.exists) {
    lines.push('  No done contract yet.');
    for (const s of view.suggestions) lines.push(`  would add: ${s.text}`);
    if (view.suggestions.length > 0) lines.push(`  Run: proof-of-done start ${view.issue.key}`);
    return lines;
  }
  lines.push(`  ${view.summary.proven} of ${view.summary.total} criteria proven. Gate: ${view.gate.pass ? 'PASS' : 'NO'}. ${view.gate.reason}`);
  for (const criterion of view.criteria) {
    const needs = criterion.requiredKind === 'any' ? '' : `  (needs ${criterion.requiredKind})`;
    lines.push(`  ${criterion.id}  ${STATE[criterion.state]}: ${criterion.text}${needs}`);
    for (const evidence of criterion.evidence) lines.push(...evidenceLines(evidence));
  }
  return lines;
}

interface Context {
  app: LocalApp;
  args: Args;
  io: Io;
  person: Caller;
  json: boolean;
}

/** Commands that decide something. They are for a person, so they want one at the keyboard. */
function personOnly(ctx: Context, what: string): void {
  if (ctx.io.interactive || ctx.io.env['POD_ALLOW_NONINTERACTIVE'] === '1') return;
  throw new PodError(
    'forbidden',
    `Only a person may ${what}, and this command is not running in a terminal. Run it yourself. A pipeline that acts for a reviewer sets POD_ALLOW_NONINTERACTIVE=1.`,
  );
}

function print(ctx: Context, value: unknown, lines: string[]): void {
  if (ctx.json) ctx.io.out(JSON.stringify(value, null, 2));
  else for (const line of lines) ctx.io.out(line);
}

async function findEvidence(ctx: Context, evidenceId: string): Promise<string> {
  const row = ctx.app.store.read().evidence.find((e) => e.id === evidenceId);
  if (!row) throw new PodError('not_found', `No evidence has the id ${evidenceId}. Run "proof-of-done review" for the ids.`);
  return row.issueId;
}

const COMMANDS: Record<string, (ctx: Context) => Promise<number>> = {
  async new(ctx) {
    const summary = need(ctx.args, 1, 'the summary of the task in quotes').trim();
    const project = (flag(ctx.args, 'project') ?? ctx.app.tasks.keys().at(-1)?.replace(/-\d+$/, '') ?? 'POD').toUpperCase();
    if (!/^[A-Z][A-Z0-9_]{0,63}$/.test(project)) throw new UsageError('A project key starts with a letter and has letters, digits and underscores.');
    const criteria = ctx.args.flags.get('criterion') ?? [];
    const body = criteria.length > 0 ? `## Acceptance criteria\n\n${criteria.map((c) => `- ${c.trim()}`).join('\n')}` : '## Acceptance criteria\n\n- ';
    const { key } = ctx.app.tasks.create(project, {
      summary,
      body,
      status: 'todo',
      type: 'Task',
      assignee: flag(ctx.args, 'assignee') ?? null,
      parent: null,
      labels: [],
      created: (ctx.io.now ?? Date.now)(),
      statusChanged: null,
    });
    print(ctx, { key, file: join(ctx.app.root, 'tasks', `${key}.md`) }, [`Created ${key} in ${join(ctx.app.root, 'tasks', `${key}.md`)}`]);
    return EXIT.ok;
  },

  async list(ctx) {
    const rows = [];
    for (const task of ctx.app.tasks.all()) {
      const view = await ctx.app.contracts.view(task.key, ctx.person);
      rows.push({
        key: task.key,
        status: task.status,
        contract: view.exists,
        proven: view.summary.proven,
        total: view.summary.total,
        gate: view.gate.pass,
        summary: task.summary,
      });
    }
    const lines = rows.map(
      (r) => `${r.key.padEnd(10)} ${STATUS_NAME[r.status].padEnd(12)} ${(r.contract ? `${r.proven}/${r.total} proven` : 'no contract').padEnd(14)} ${r.summary}`,
    );
    print(ctx, rows, lines.length > 0 ? lines : ['No tasks yet. Create one with: proof-of-done new "<summary>" -c "<criterion>"']);
    return EXIT.ok;
  },

  async show(ctx) {
    const view = await ctx.app.contracts.view(need(ctx.args, 1, 'the key of the task'), ctx.person);
    print(ctx, view, contractLines(view));
    return EXIT.ok;
  },

  async start(ctx) {
    personOnly(ctx, 'start a contract here');
    const view = await ctx.app.contracts.createContract(need(ctx.args, 1, 'the key of the task'), ctx.person, { withSuggestions: true });
    print(ctx, view, contractLines(view));
    return EXIT.ok;
  },

  async criterion(ctx) {
    personOnly(ctx, 'add a criterion');
    const key = need(ctx.args, 1, 'the key of the task');
    const text = need(ctx.args, 2, 'the criterion in quotes');
    const needs = flag(ctx.args, 'needs');
    if (needs && !(REQUIRED_KINDS as readonly string[]).includes(needs)) throw new UsageError(`--needs takes one of: ${REQUIRED_KINDS.join(', ')}.`);
    const current = await ctx.app.contracts.view(key, ctx.person);
    if (!current.exists) await ctx.app.contracts.createContract(key, ctx.person, { withSuggestions: false });
    const view = await ctx.app.contracts.addCriteria(key, ctx.person, [{ text, requiredKind: needs ?? null }]);
    print(ctx, view, contractLines(view));
    return EXIT.ok;
  },

  async attest(ctx) {
    personOnly(ctx, 'attest');
    const key = need(ctx.args, 1, 'the key of the task');
    const criterionId = need(ctx.args, 2, 'the id of the criterion');
    const statement = need(ctx.args, 3, 'your statement in quotes');
    const view = await ctx.app.contracts.submitEvidence(key, ctx.person, { criterionId, kind: 'attestation', summary: statement, details: { text: statement } });
    print(ctx, view, contractLines(view));
    return EXIT.ok;
  },

  async settings(ctx) {
    const ref = need(ctx.args, 1, 'the project key');
    const project = await ctx.app.work.getProject(ref);
    if (!project) throw new PodError('not_found', `No task belongs to a project ${ref}.`);
    const current = await ctx.app.store.getSettings(project.id);
    const gateMode = flag(ctx.args, 'gate');
    if (gateMode !== undefined && !['off', 'warn', 'bounce'].includes(gateMode)) throw new UsageError('--gate takes off, warn or bounce.');
    const requireIndependent = onOff(flag(ctx.args, 'independent'), 'independent');
    const enforceWithoutContract = onOff(flag(ctx.args, 'require-contract'), 'require-contract');
    let settings = current;
    if (gateMode !== undefined || requireIndependent !== undefined || enforceWithoutContract !== undefined) {
      personOnly(ctx, 'change the settings');
      settings = await ctx.app.projects.saveSettings(project.id, ctx.person.accountId, {
        ...current,
        ...(gateMode !== undefined ? { gateMode } : {}),
        ...(requireIndependent !== undefined ? { requireIndependent } : {}),
        ...(enforceWithoutContract !== undefined ? { enforceWithoutContract } : {}),
      });
    }
    print(ctx, settings, [
      `Project ${project.key}`,
      `  gate: ${settings.gateMode}`,
      `  evidence needs someone other than its submitter: ${settings.requireIndependent ? 'on' : 'off'}`,
      `  a task with no contract fails the gate: ${settings.enforceWithoutContract ? 'on' : 'off'}`,
    ]);
    return EXIT.ok;
  },

  async review(ctx) {
    const keys = ctx.args.positional[1] ? [ctx.args.positional[1]] : ctx.app.tasks.keys();
    const waiting = [];
    const lines: string[] = [];
    for (const key of keys) {
      const view = await ctx.app.contracts.view(key, ctx.person);
      for (const criterion of view.criteria) {
        for (const evidence of criterion.evidence) {
          if (evidence.standing !== 'pending' && !(evidence.standing === 'self_accepted' && view.policy.requireIndependent)) continue;
          waiting.push({ key: view.issue.key, criterion: criterion.text, evidence });
          lines.push(`${view.issue.key}  ${criterion.text}`, ...evidenceLines(evidence), '');
        }
      }
    }
    if (waiting.length > 0) lines.push('Decide with: proof-of-done accept EVIDENCE_ID   or   proof-of-done reject EVIDENCE_ID --reason "<why>"');
    print(ctx, waiting, waiting.length > 0 ? lines : ['No evidence waits for a review.']);
    return EXIT.ok;
  },

  async accept(ctx) {
    return verdict(ctx, 'accepted');
  },

  async reject(ctx) {
    return verdict(ctx, 'rejected');
  },

  async move(ctx) {
    const key = need(ctx.args, 1, 'the key of the task');
    const status = need(ctx.args, 2, `the status: ${STATUSES.join(', ')}`) as TaskStatus;
    if (!STATUSES.includes(status)) throw new UsageError(`The status is one of: ${STATUSES.join(', ')}.`);
    const task = ctx.app.tasks.get(key);
    if (!task) throw new PodError('not_found', `There is no task ${key}.`);
    if (status === 'done' && task.status !== 'done') {
      const answer = await ctx.app.gate.validate(task.key, ctx.person.accountId);
      if (!answer.result) {
        ctx.io.err(localText(answer.errorMessage ?? 'Proof of Done: this task is not proven.'));
        return EXIT.notProven;
      }
    }
    const before = ctx.app.work.setStatus(task, status);
    if (before !== status) {
      await ctx.app.gate.onStatusChange({
        issueId: task.key,
        changeId: null,
        occurredAt: (ctx.io.now ?? Date.now)(),
        fromStatusId: before,
        fromStatusName: STATUS_NAME[before],
        fromCategory: null,
        actorAccountId: ctx.person.accountId,
      });
    }
    print(ctx, { key: task.key, status }, [`${task.key} is now ${STATUS_NAME[status]}.`]);
    return EXIT.ok;
  },

  async gate(ctx) {
    let keys = ctx.args.positional.slice(1);
    const byStatus = (status: TaskStatus) => ctx.app.tasks.all().filter((task) => task.status === status).map((task) => task.key);
    if (has(ctx.args, 'all')) keys = ctx.app.tasks.keys();
    else if (has(ctx.args, 'closed')) keys = byStatus('done');
    else if (has(ctx.args, 'in-progress')) keys = byStatus('in-progress');
    else if (keys.length === 0) throw new UsageError('Give one or more task keys, or --all, --closed or --in-progress.');
    const results = [];
    for (const key of keys) {
      if (!ctx.app.tasks.get(key)) throw new PodError('not_found', `There is no task ${key}.`);
      const view = await ctx.app.contracts.view(key, ctx.person);
      results.push({
        key: view.issue.key,
        pass: view.gate.pass,
        reason: view.gate.reason,
        proven: view.summary.proven,
        total: view.summary.total,
        // What the agent can still act on: criteria with no evidence, or only evidence that was turned away.
        // A criterion that needs an attestation is a person's to prove, so it is not among them.
        needsEvidence: open(view).filter((c) => c.requiredKind !== 'attestation').map((c) => c.text),
        needsAttestation: open(view).filter((c) => c.requiredKind === 'attestation').length,
        waitsForReview: view.summary.submitted,
      });
    }
    const failed = results.filter((r) => !r.pass);
    if (has(ctx.args, 'hook')) return hookAnswer(ctx, failed);
    print(ctx, { pass: failed.length === 0, results }, [
      ...results.map((r) => `${r.pass ? 'PASS' : 'NO  '}  ${r.key}  ${r.reason}`),
      failed.length === 0 ? `Gate: PASS (${results.length} checked).` : `Gate: NO. ${failed.length} of ${results.length} not proven.`,
    ]);
    return failed.length === 0 ? EXIT.ok : EXIT.notProven;
  },

  async meter(ctx) {
    const project = await ctx.app.work.getProject(need(ctx.args, 1, 'the project key'));
    if (!project) throw new PodError('not_found', `No task belongs to a project ${ctx.args.positional[1]}.`);
    const view = await ctx.app.projects.overview(project.id, flag(ctx.args, 'days'));
    const m = view.meter;
    print(ctx, view.meter, [
      `${project.key}, last ${m.windowDays} days: ${m.verdict.toUpperCase()}. ${m.reason}`,
      `  opened ${m.opened}, reopened ${m.reopened}, closed with proof ${m.closedProven}, closed without proof ${m.closedUnproven}, closed with no contract ${m.closedNoContract}`,
      `  evidence submitted ${m.evidence}, verdicts ${m.verdicts}`,
    ]);
    return EXIT.ok;
  },

  async mcp(ctx) {
    await serve(ctx.app, { owner: ctx.person.accountId ?? 'unknown', version: VERSION });
    return EXIT.ok;
  },
};

/** The criteria of a contract that have no evidence, or only evidence that was turned away. */
const open = (view: ContractView): CriterionView[] => view.criteria.filter((c) => c.state === 'unproven' || c.state === 'rejected');

/** Exit code a harness reads as "do not stop yet". Claude Code's Stop hook uses 2 and passes stderr to the agent. */
export const HOOK_BLOCK = 2;

/**
 * The answer for a hook that runs when the agent is about to stop. It holds the agent
 * only while the agent can do something about it. Evidence that waits for a person's
 * review is not the agent's to settle, so that lets it stop, with a note.
 */
function hookAnswer(ctx: Context, failed: Array<{ key: string; needsEvidence: string[]; needsAttestation: number; waitsForReview: number }>): number {
  const open = failed.filter((r) => r.needsEvidence.length > 0);
  if (open.length > 0) {
    ctx.io.err('Proof of Done: this work is not proven, so do not report it as done.');
    for (const r of open) for (const text of r.needsEvidence) ctx.io.err(`  ${r.key} needs evidence: ${text}`);
    ctx.io.err('Submit evidence for each with the submit-evidence tool. If a criterion cannot be met, say so to the person instead of claiming it.');
    return HOOK_BLOCK;
  }
  const waiting = failed.filter((r) => r.waitsForReview > 0);
  if (waiting.length > 0) ctx.io.out(`Proof of Done: ${waiting.map((r) => r.key).join(', ')} wait${waiting.length === 1 ? 's' : ''} for a person's review. Not done yet.`);
  const attest = failed.filter((r) => r.needsAttestation > 0);
  if (attest.length > 0) ctx.io.out(`Proof of Done: ${attest.map((r) => r.key).join(', ')} need${attest.length === 1 ? 's' : ''} a person's attestation. Not done yet.`);
  return EXIT.ok;
}

async function verdict(ctx: Context, decision: 'accepted' | 'rejected'): Promise<number> {
  personOnly(ctx, decision === 'accepted' ? 'accept evidence' : 'reject evidence');
  const evidenceId = need(ctx.args, 1, 'the id of the evidence');
  const issueId = await findEvidence(ctx, evidenceId);
  const view = await ctx.app.contracts.recordVerdict(issueId, ctx.person, { evidenceId, decision, reason: flag(ctx.args, 'reason') ?? null });
  print(ctx, view, [`${decision === 'accepted' ? 'Accepted' : 'Rejected'} ${evidenceId} as ${ctx.person.accountId}.`, ...contractLines(view)]);
  return EXIT.ok;
}

export async function run(argv: string[], io: Io): Promise<number> {
  let args: Args;
  try {
    args = parse(argv);
  } catch (error) {
    io.err((error as Error).message);
    return EXIT.error;
  }
  const command = args.positional[0];
  if (has(args, 'version')) {
    io.out(VERSION);
    return EXIT.ok;
  }
  if (!command || has(args, 'help') || command === 'help') {
    io.out(USAGE);
    return command || has(args, 'help') ? EXIT.ok : EXIT.error;
  }
  try {
    if (command === 'init') {
      const root = resolve(io.cwd, flag(args, 'dir') ?? HOME);
      mkdirSync(join(root, 'tasks'), { recursive: true });
      io.out(`Ready: ${root}`);
      io.out('Next: proof-of-done new "<summary>" -c "<criterion>" -c "<criterion>"');
      return EXIT.ok;
    }
    const handler = Object.hasOwn(COMMANDS, command) ? COMMANDS[command] : undefined;
    if (!handler) throw new UsageError(`Unknown command ${command}. Run "proof-of-done help".`);
    const given = flag(args, 'dir');
    const root = given ? resolve(io.cwd, given) : findRoot(io.cwd);
    if (!root) throw new UsageError(`No ${HOME} folder here or above. Run "proof-of-done init" first.`);
    const who = (flag(args, 'as') ?? io.env['POD_USER'] ?? userInfo().username).trim();
    if (!who) throw new UsageError('Say who you are with --as NAME or POD_USER.');
    for (const key of args.positional.slice(1)) {
      if (/^[A-Za-z][A-Za-z0-9_]*-\d+$/.test(key) && !TASK_KEY.test(key)) throw new UsageError(`${key} is not a task key.`);
    }
    const app = openLocal(root, io.now);
    return await handler({ app, args, io, person: { accountId: who, via: 'ui' }, json: has(args, 'json') });
  } catch (error) {
    if (error instanceof UsageError) {
      io.err(error.message);
    } else if (error instanceof PodError || error instanceof StoreError) {
      io.err(`Proof of Done: ${localText(error.message)}`);
    } else {
      io.err(`Proof of Done: the command failed. ${errorLine(error)}`);
    }
    return EXIT.error;
  }
}

if (require.main === module) {
  // A reader that stops early, such as `| head`, is not an error.
  process.stdout.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EPIPE') process.exit(0);
    throw error;
  });
  run(process.argv.slice(2), {
    out: (line) => process.stdout.write(`${line}\n`),
    err: (line) => process.stderr.write(`${line}\n`),
    cwd: process.cwd(),
    env: process.env,
    interactive: Boolean(process.stdin.isTTY && process.stdout.isTTY),
  }).then(
    (code) => {
      process.exitCode = code;
    },
    (error) => {
      process.stderr.write(`Proof of Done: ${errorLine(error)}\n`);
      process.exitCode = EXIT.error;
    },
  );
}
