/**
 * Reads the errors Forge SQL returns. A failed statement arrives as
 * `{ code: 'SQL_EXECUTION_ERROR', context: { debug: { errno, code, sqlState, message } } }`,
 * where `debug` carries the MySQL error.
 */

interface SqlDebug {
  errno?: unknown;
  code?: unknown;
  sqlState?: unknown;
  message?: unknown;
}

const NO_SUCH_TABLE = 1146;
const UNKNOWN_COLUMN = 1054;

/** True when a query failed because a table or column the app expects is not there yet. */
export function isSchemaBehind(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { message?: unknown; context?: { debug?: SqlDebug } };
  const debug = e.context?.debug && typeof e.context.debug === 'object' ? e.context.debug : undefined;
  if (debug) {
    if (debug.errno === NO_SUCH_TABLE || debug.errno === UNKNOWN_COLUMN) return true;
    if (debug.code === 'ER_NO_SUCH_TABLE' || debug.code === 'ER_BAD_FIELD_ERROR') return true;
    if (debug.sqlState === '42S02' || debug.sqlState === '42S22') return true;
  }
  return /table '[^']*' doesn't exist|unknown column/i.test(`${String(e.message ?? '')} ${String(debug?.message ?? '')}`);
}
