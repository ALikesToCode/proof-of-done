/**
 * Just enough of the Atlassian Document Format to read a work item's description.
 * https://developer.atlassian.com/cloud/jira/platform/apis/document/structure/
 */
export interface AdfNode {
  type: string;
  /** Present on the root `doc` node only. */
  version?: number;
  text?: string;
  attrs?: Record<string, unknown>;
  content?: AdfNode[];
  marks?: unknown[];
}

const BLOCK_BREAK = new Set(['paragraph', 'heading', 'listItem', 'taskItem', 'codeBlock', 'tableRow']);

/** Plain text of a node. Hard breaks and block boundaries become newlines. */
export function adfText(node: AdfNode | null | undefined): string {
  if (!node) return '';
  if (node.type === 'text') return node.text ?? '';
  if (node.type === 'hardBreak') return '\n';
  if (node.type === 'mention') return String(node.attrs?.['text'] ?? '');
  if (node.type === 'emoji') return String(node.attrs?.['text'] ?? node.attrs?.['shortName'] ?? '');
  if (node.type === 'inlineCard') return String(node.attrs?.['url'] ?? '');
  const parts: string[] = [];
  for (const child of node.content ?? []) {
    const text = adfText(child);
    parts.push(BLOCK_BREAK.has(child.type) ? text + '\n' : text);
  }
  return parts.join('');
}

/** Text of the node's own inline content, without the text of nested lists. */
export function adfOwnText(node: AdfNode): string {
  const parts: string[] = [];
  for (const child of node.content ?? []) {
    if (isList(child)) continue;
    parts.push(adfText(child));
  }
  return parts.join('\n');
}

export function isList(node: AdfNode): boolean {
  return node.type === 'bulletList' || node.type === 'orderedList' || node.type === 'taskList';
}

/** Build a minimal ADF document from plain lines. Used for comments the app posts. */
export function adfParagraphs(lines: string[]): AdfNode {
  return {
    type: 'doc',
    version: 1,
    content: lines.map((line) => ({ type: 'paragraph', content: line ? [{ type: 'text', text: line }] : [] })),
  };
}
