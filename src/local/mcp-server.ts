import { createInterface } from 'node:readline';
import { Readable, Writable } from 'node:stream';
import { MCP_TOOLS, ToolName, runTool } from '../actions/tools';
import { errorLine } from '../core/errors';
import { LocalApp } from './app';
import { AGENT_TOOL_DEFS } from './tool-defs';
import { localWording } from './wording';

/**
 * The agent's side of the guard as a Model Context Protocol server over stdio: one
 * JSON-RPC message per line on stdin and stdout. It offers the five tools an agent may
 * use. No message reaches the tools that record a verdict, because they are not here.
 *
 * https://modelcontextprotocol.io/specification
 */

export const PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'] as const;
export const SERVER_NAME = 'proof-of-done';

const INSTRUCTIONS =
  'Proof of Done guards the work you are given. Call get-context-pack before you start a work item. Submit evidence for each criterion with submit-evidence. A person reviews it; you cannot accept your own evidence. Report the work as done only when get-done-contract says proof.state is proven.';

type Json = Record<string, unknown>;
type Id = string | number | null;

const isObject = (value: unknown): value is Json => value !== null && typeof value === 'object' && !Array.isArray(value);

const failure = (id: Id, code: number, message: string): Json => ({ jsonrpc: '2.0', id, error: { code, message } });
const success = (id: Id, result: Json): Json => ({ jsonrpc: '2.0', id, result });

export interface ServerOptions {
  /** Who the agent works for. Evidence is recorded under this name. */
  owner: string;
  version: string;
}

/** Answers one message. Returns null for a notification, which gets no answer. */
export async function handleMessage(app: LocalApp, options: ServerOptions, message: unknown): Promise<Json | null> {
  if (!isObject(message) || message['jsonrpc'] !== '2.0' || typeof message['method'] !== 'string') {
    return failure(null, -32600, 'Not a JSON-RPC 2.0 request.');
  }
  const hasId = typeof message['id'] === 'string' || typeof message['id'] === 'number';
  if (!hasId) return null;
  const id = message['id'] as Id;
  const params = isObject(message['params']) ? message['params'] : {};

  switch (message['method']) {
    case 'initialize': {
      const asked = typeof params['protocolVersion'] === 'string' ? params['protocolVersion'] : '';
      const protocolVersion = (PROTOCOL_VERSIONS as readonly string[]).includes(asked) ? asked : PROTOCOL_VERSIONS[0];
      return success(id, {
        protocolVersion,
        capabilities: { tools: {} },
        serverInfo: { name: SERVER_NAME, version: options.version },
        instructions: INSTRUCTIONS,
      });
    }
    case 'ping':
      return success(id, {});
    case 'tools/list':
      return success(id, { tools: AGENT_TOOL_DEFS });
    case 'tools/call': {
      const name = params['name'];
      if (typeof name !== 'string' || !MCP_TOOLS.includes(name as ToolName)) {
        return failure(id, -32602, `Unknown tool: ${typeof name === 'string' ? name.slice(0, 80) : 'no name given'}.`);
      }
      const result = localWording(await runTool(app.agent, name as ToolName, params['arguments'], { accountId: options.owner }));
      return success(id, { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }], isError: !result.ok });
    }
    default:
      return failure(id, -32601, `Method not found: ${message['method'].slice(0, 80)}.`);
  }
}

/** Serves until the input ends. Everything that is not a protocol message goes to stderr. */
export async function serve(app: LocalApp, options: ServerOptions, input: Readable = process.stdin, output: Writable = process.stdout): Promise<void> {
  // The tools log through console. On stdout that would corrupt the protocol stream.
  console.log = (...parts: unknown[]) => console.error(...parts);
  const send = (message: Json) => output.write(`${JSON.stringify(message)}\n`);
  let queue: Promise<void> = Promise.resolve();
  for await (const line of createInterface({ input, crlfDelay: Infinity })) {
    if (!line.trim()) continue;
    let message: unknown;
    try {
      message = JSON.parse(line);
    } catch {
      send(failure(null, -32700, 'Parse error.'));
      continue;
    }
    // One at a time, in the order they came, so an agent reads its own writes.
    queue = queue.then(async () => {
      try {
        const answer = await handleMessage(app, options, message);
        if (answer) send(answer);
      } catch (error) {
        console.error(`Proof of Done: the tool server failed on a message. ${errorLine(error)}`);
        const id = isObject(message) && (typeof message['id'] === 'string' || typeof message['id'] === 'number') ? (message['id'] as Id) : null;
        send(failure(id, -32603, 'Internal error.'));
      }
    });
  }
  await queue;
}
