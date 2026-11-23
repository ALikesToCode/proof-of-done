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
