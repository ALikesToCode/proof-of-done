import { describe, expect, it } from 'vitest';
import { isSchemaBehind } from '../src/store/sql-errors';

describe('isSchemaBehind', () => {
  it('recognises the error Forge SQL returns for a missing table', () => {
    // Shape recorded from a development install on 23 Nov 2026.
    const error = {
      code: 'SQL_EXECUTION_ERROR',
      message: 'Unknown SQL execution error',
      context: {
        debug: {
          message: "ERROR 1146 (42S02): Table 'abc_forge_def.pod_contracts' doesn't exist",
          code: 'ER_NO_SUCH_TABLE',
          errno: 1146,
          sql: 'SELECT issue_id FROM pod_contracts LIMIT 1',
          sqlState: '42S02',
        },
        queryType: 'select',
      },
    };
    expect(isSchemaBehind(error)).toBe(true);
  });

  it('recognises a missing column', () => {
    expect(isSchemaBehind({ code: 'SQL_EXECUTION_ERROR', context: { debug: { errno: 1054, code: 'ER_BAD_FIELD_ERROR' } } })).toBe(true);
    expect(isSchemaBehind(new Error("Unknown column 'proof_state' in 'field list'"))).toBe(true);
  });

  it('leaves other failures alone', () => {
    expect(isSchemaBehind({ code: 'SQL_EXECUTION_ERROR', context: { debug: { errno: 1062, code: 'ER_DUP_ENTRY', sqlState: '23000' } } })).toBe(false);
    expect(isSchemaBehind({ code: 'QUERY_TIMED_OUT', message: 'Query timed out after 1146 ms' })).toBe(false);
    expect(isSchemaBehind(new Error('fetch failed'))).toBe(false);
    expect(isSchemaBehind(null)).toBe(false);
    expect(isSchemaBehind('1146')).toBe(false);
  });
});
