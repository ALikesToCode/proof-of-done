export type PodErrorCode = 'not_found' | 'forbidden' | 'invalid' | 'conflict';

/** An error with a message that is safe and useful to show to a person or an agent. */
export class PodError extends Error {
  constructor(
    readonly code: PodErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'PodError';
  }
}

/** How much of an error's message goes to the log. */
const MESSAGE_LOGGED = 200;
/** How much of its name, its status or its code. Those are short, and this keeps them so. */
const LABEL_LOGGED = 60;

const oneLine = (text: string): string => text.replace(/\s+/g, ' ').trim();

function label(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? oneLine(String(value)).slice(0, LABEL_LOGGED) : '';
}

/**
 * Whatever a catch block received, as one line for the log: the error's name, its
 * status or else its code when it has one, and at most the first 200 characters of
 * its message. An error from Jira, Forge or the database can quote stored text, so
 * nothing else of it goes to the log. This never throws, so a catch block can rely on it.
 */
export function errorLine(error: unknown): string {
  try {
    let head: string;
    let message = '';
    if (error !== null && typeof error === 'object') {
      const e = error as { name?: unknown; status?: unknown; code?: unknown; message?: unknown };
      const status = label(e.status);
      const code = label(e.code);
      head = `${label(e.name) || 'Error'}${status ? ` (status ${status})` : code ? ` (code ${code})` : ''}`;
      if (typeof e.message === 'string') message = e.message;
    } else {
      head = `Thrown ${error === null ? 'null' : typeof error}`;
      if (error !== null && error !== undefined) message = String(error);
    }
    // Cut first and tidy second, so the line never reaches past the first 200 characters.
    const start = oneLine(message.slice(0, MESSAGE_LOGGED));
    if (!start) return head;
    return `${head}: ${start}${message.length > MESSAGE_LOGGED ? ' …' : ''}`;
  } catch {
    return 'An error that could not be read';
  }
}
