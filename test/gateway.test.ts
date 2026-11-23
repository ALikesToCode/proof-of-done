import { describe, expect, it, vi } from 'vitest';
import { toIssueContext } from '../src/jira/forge-gateway';
import { doc, p } from './helpers/adf';

// The mappers are plain functions. The Forge client they sit next to is never called here.
vi.mock('@forge/api', () => ({ default: {}, route: () => '' }));

describe('toIssueContext', () => {
  const blocks = { name: 'Blocks', inward: 'is blocked by', outward: 'blocks' };
  const brief = (key: string, summary: string, status: string) => ({ key, fields: { summary, status: { name: status } } });

  it('reads what surrounds a work item', () => {
    const issue = {
      fields: {
        priority: { name: 'High' },
        labels: ['auth', '', 'mobile'],
        components: [{ name: 'Login' }, {}],
        assignee: { displayName: 'Asha Rao' },
        reporter: null,
        duedate: '2026-12-01',
        subtasks: [brief('MOBL-44', 'Reset the password', 'To Do')],
        issuelinks: [
          { type: blocks, inwardIssue: brief('MOBL-40', 'Session store', 'Done') },
          { type: blocks, outwardIssue: brief('MOBL-47', 'Profile page', 'In Progress') },
          { type: { name: 'Relates' }, outwardIssue: brief('MOBL-48', 'Audit log', 'To Do') },
          { type: blocks },
        ],
      },
    };
    const comments = {
      total: 12,
      comments: [
        { author: { displayName: 'Asha Rao' }, created: '2026-11-23T10:00:00.000+0000', body: doc(p('Use the new session store.')) },
        { created: '2026-11-22T09:00:00.000+0000', body: 'not a document' },
      ],
    };
    expect(toIssueContext(issue, comments)).toEqual({
      priority: 'High',
      labels: ['auth', 'mobile'],
      components: ['Login'],
      assignee: 'Asha Rao',
      reporter: null,
      dueDate: '2026-12-01',
      subtasks: [{ key: 'MOBL-44', summary: 'Reset the password', statusName: 'To Do' }],
      links: [
        { relation: 'is blocked by', key: 'MOBL-40', summary: 'Session store', statusName: 'Done' },
        { relation: 'blocks', key: 'MOBL-47', summary: 'Profile page', statusName: 'In Progress' },
        { relation: 'Relates', key: 'MOBL-48', summary: 'Audit log', statusName: 'To Do' },
      ],
      comments: [
        { author: 'Asha Rao', at: '2026-11-23T10:00:00.000+0000', text: 'Use the new session store.' },
        { author: 'Someone', at: '2026-11-22T09:00:00.000+0000', text: '' },
      ],
      commentTotal: 12,
    });
  });

  it('gives an empty context for a bare work item, or when the comments could not be read', () => {
    const empty = {
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
    };
    expect(toIssueContext({ fields: {} }, null)).toEqual(empty);
    expect(toIssueContext(null, undefined)).toEqual(empty);
  });

  it('counts the comments it shows when Jira gives no total', () => {
    const comments = { comments: [{ author: { displayName: 'Asha Rao' }, created: '2026-11-23T10:00:00.000+0000', body: doc(p('Done.')) }] };
    expect(toIssueContext({ fields: {} }, comments).commentTotal).toBe(1);
  });
});
