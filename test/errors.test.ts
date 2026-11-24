import { describe, expect, it } from 'vitest';
import { PodError, errorLine } from '../src/core/errors';

describe('errorLine', () => {
  it('gives the name and the message of an error', () => {
    expect(errorLine(new Error('socket hang up at 10.0.0.7'))).toBe('Error: socket hang up at 10.0.0.7');
    expect(errorLine(new TypeError('issue.fields is undefined'))).toBe('TypeError: issue.fields is undefined');
    expect(errorLine(new Error(''))).toBe('Error');
  });

  it('adds the status, or the code when there is no status', () => {
    const refused = Object.assign(new Error('Authentication Required'), { name: 'NEEDS_AUTHENTICATION_ERR', status: 401 });
    expect(errorLine(refused)).toBe('NEEDS_AUTHENTICATION_ERR (status 401): Authentication Required');
    expect(errorLine(new PodError('invalid', 'Write the criterion to add.'))).toBe('PodError (code invalid): Write the criterion to add.');
    expect(errorLine(Object.assign(new Error('Slow down'), { status: 429, code: 'RATE_LIMITED' }))).toBe('Error (status 429): Slow down');
  });

  it('leaves out everything else an error carries', () => {
    // The shape Forge SQL returns for a failed statement. The debug fields can quote a stored value.
    const failed = {
      code: 'SQL_EXECUTION_ERROR',
      message: 'Unknown SQL execution error',
      context: { debug: { message: "Duplicate entry 'secret plan' for key 'pod_evidence.PRIMARY'", sql: 'INSERT INTO pod_evidence' } },
      stack: 'at secret plan',
    };
    expect(errorLine(failed)).toBe('Error (code SQL_EXECUTION_ERROR): Unknown SQL execution error');
  });

  it('keeps at most the first 200 characters of a message, on one line', () => {
    const head = 'Unexpected error.\r\nResponse was not valid JSON:\n\n\t';
    const message = `${head}${'x'.repeat(200 - head.length)}and the rest of a stored summary`;
    expect(errorLine(new Error(message))).toBe(`Error: Unexpected error. Response was not valid JSON: ${'x'.repeat(200 - head.length)} …`);
    expect(errorLine(new Error('x'.repeat(200)))).toBe(`Error: ${'x'.repeat(200)}`);
    // The cut comes before the line breaks go, so blank space cannot pull later text in.
    expect(errorLine(new Error(`Failed${'\n'.repeat(300)}secret plan`))).toBe('Error: Failed …');
  });

  it('keeps a name, a status and a code short and on one line', () => {
    const odd = Object.assign(new Error('Failed'), { name: `Odd\n${'n'.repeat(100)}`, code: 'c'.repeat(100) });
    expect(errorLine(odd)).toBe(`Odd ${'n'.repeat(56)} (code ${'c'.repeat(60)}): Failed`);
    expect(errorLine({ name: ['a list'], status: { nested: true }, code: null, message: 42 })).toBe('Error');
  });

  it('takes a thrown value that is not an error', () => {
    expect(errorLine('The graph\nis down.')).toBe('Thrown string: The graph is down.');
    expect(errorLine('x'.repeat(300))).toBe(`Thrown string: ${'x'.repeat(200)} …`);
    expect(errorLine(503)).toBe('Thrown number: 503');
    expect(errorLine(undefined)).toBe('Thrown undefined');
    expect(errorLine(null)).toBe('Thrown null');
    expect(errorLine(Symbol('odd'))).toBe('Thrown symbol: Symbol(odd)');
    expect(errorLine({})).toBe('Error');
  });

  it('never throws, whatever it is given', () => {
    const hostile = {
      get message(): string {
        throw new Error('This error cannot be read.');
      },
    };
    expect(errorLine(hostile)).toBe('An error that could not be read');
  });
});
