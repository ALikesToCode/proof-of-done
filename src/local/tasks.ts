import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

/**
 * Work items of the local adapter: one Markdown file per task.
 *
 *     ---
 *     status: todo
 *     assignee: dana
 *     ---
 *     # Export the audit log as CSV
 *
 *     ## Acceptance criteria
 *     - All unit tests pass
 *
 * The file name is the key, as in `POD-7.md`. People write and change these files in
 * any editor, and they belong in version control.
 */

export const STATUSES = ['todo', 'in-progress', 'done'] as const;
export type TaskStatus = (typeof STATUSES)[number];

export const STATUS_NAME: Record<TaskStatus, string> = { todo: 'To Do', 'in-progress': 'In Progress', done: 'Done' };
/** The category names the services share with Jira. */
export const STATUS_CATEGORY: Record<TaskStatus, string> = { todo: 'new', 'in-progress': 'indeterminate', done: 'done' };

export const TASK_KEY = /^([A-Za-z][A-Za-z0-9_]{0,63})-(\d{1,12})$/;

export interface Task {
  key: string;
  projectKey: string;
  summary: string;
  body: string;
  status: TaskStatus;
  type: string;
  assignee: string | null;
  parent: string | null;
  labels: string[];
  /** Epoch milliseconds. */
  created: number;
  /** When the status last moved between to do, in progress and done. */
  statusChanged: number | null;
}

const FRONT = /^---\n([\s\S]*?)\n---\n?/;

const toStatus = (raw: string | undefined): TaskStatus => {
  const value = (raw ?? '').toLowerCase().replace(/[\s_]+/g, '-');
  if (value === 'done' || value === 'closed') return 'done';
  if (value === 'in-progress' || value === 'doing' || value === 'started') return 'in-progress';
  return 'todo';
};

const toTime = (raw: string | undefined): number | null => {
  if (!raw) return null;
  const time = Date.parse(raw);
  return Number.isNaN(time) ? null : time;
};

export function parseTask(key: string, source: string, fallbackCreated: number): Task {
  const text = source.replace(/\r\n?/g, '\n');
  const fields: Record<string, string> = {};
  const front = FRONT.exec(text);
  for (const line of (front?.[1] ?? '').split('\n')) {
    const field = /^([A-Za-z][A-Za-z-]*):\s*(.*)$/.exec(line);
    if (field) fields[field[1]!.toLowerCase()] = field[2]!.trim();
  }
  const rest = front ? text.slice(front[0].length) : text;
  const title = /^\s*#\s+(.+?)\s*$/m.exec(rest);
  const body = title ? rest.slice(rest.indexOf(title[0]) + title[0].length) : rest;
  return {
    key,
    projectKey: TASK_KEY.exec(key)?.[1] ?? key,
    summary: (title?.[1] ?? key).trim().slice(0, 255),
    body: body.trim(),
    status: toStatus(fields['status']),
    type: fields['type'] || 'Task',
    assignee: fields['assignee'] || null,
    parent: fields['parent'] && TASK_KEY.test(fields['parent']) ? fields['parent'] : null,
    labels: (fields['labels'] ?? '')
      .split(',')
      .map((label) => label.trim())
      .filter(Boolean),
    created: toTime(fields['created']) ?? fallbackCreated,
    statusChanged: toTime(fields['status-changed']),
  };
}

export function formatTask(task: Task): string {
  const front = [
    `status: ${task.status}`,
    `type: ${task.type}`,
    ...(task.assignee ? [`assignee: ${task.assignee}`] : []),
    ...(task.parent ? [`parent: ${task.parent}`] : []),
    ...(task.labels.length > 0 ? [`labels: ${task.labels.join(', ')}`] : []),
    `created: ${new Date(task.created).toISOString()}`,
    ...(task.statusChanged !== null ? [`status-changed: ${new Date(task.statusChanged).toISOString()}`] : []),
  ];
  return `---\n${front.join('\n')}\n---\n# ${task.summary}\n\n${task.body}\n`;
}

/** A number that stands for a project key where the services want a numeric id. Stable across machines. */
export function projectIdOf(projectKey: string): string {
  const digest = createHash('sha256').update(projectKey.toUpperCase()).digest();
  return String(digest.readUIntBE(0, 6));
}

export class TaskFolder {
  constructor(private readonly dir: string) {}

  private path(key: string): string {
    return join(this.dir, `${key}.md`);
  }

  keys(): string[] {
    if (!existsSync(this.dir)) return [];
    return readdirSync(this.dir)
      .filter((name) => name.endsWith('.md') && TASK_KEY.test(name.slice(0, -3)))
      .map((name) => name.slice(0, -3))
      .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
  }

  /** The task with that key, whatever the case of its letters. */
  get(key: string): Task | null {
    if (!TASK_KEY.test(key)) return null;
    const actual = existsSync(this.path(key)) ? key : this.keys().find((k) => k.toLowerCase() === key.toLowerCase());
    if (!actual) return null;
    return parseTask(actual, readFileSync(this.path(actual), 'utf8'), 0);
  }

  all(): Task[] {
    return this.keys()
      .map((key) => this.get(key))
      .filter((task): task is Task => task !== null);
  }

  save(task: Task): void {
    mkdirSync(this.dir, { recursive: true });
    const temp = `${this.path(task.key)}.${process.pid}.tmp`;
    writeFileSync(temp, formatTask(task));
    renameSync(temp, this.path(task.key));
  }

  /** The next free key of a project, as in `POD-8`. */
  nextKey(projectKey: string): string {
    let highest = 0;
    for (const key of this.keys()) {
      const match = TASK_KEY.exec(key);
      if (match && match[1]!.toLowerCase() === projectKey.toLowerCase()) highest = Math.max(highest, Number(match[2]));
    }
    return `${projectKey}-${highest + 1}`;
  }
}
