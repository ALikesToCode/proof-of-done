import { describe, expect, it } from 'vitest';
import { deletedIssueId } from '../src/triggers/issue-events';

describe('deletedIssueId', () => {
  it('reads the work item id from a deleted event', () => {
    expect(deletedIssueId({ eventType: 'avi:jira:deleted:issue', issue: { id: '59151', key: 'MOBL-43' } })).toBe('59151');
    expect(deletedIssueId({ issue: { id: 59151 } })).toBe('59151');
  });

  it('names no work item when the event has none', () => {
    expect(deletedIssueId({ issue: {} })).toBeNull();
    expect(deletedIssueId({ issue: { id: '' } })).toBeNull();
    expect(deletedIssueId({})).toBeNull();
    expect(deletedIssueId(null)).toBeNull();
  });
});
