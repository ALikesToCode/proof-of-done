import { AdfNode } from '../../src/core/adf';

export const text = (value: string): AdfNode => ({ type: 'text', text: value });
export const p = (...parts: Array<string | AdfNode>): AdfNode => ({
  type: 'paragraph',
  content: parts.map((part) => (typeof part === 'string' ? text(part) : part)),
});
export const br = (): AdfNode => ({ type: 'hardBreak' });
export const h = (level: number, value: string): AdfNode => ({ type: 'heading', attrs: { level }, content: [text(value)] });
export const li = (...content: Array<string | AdfNode>): AdfNode => ({
  type: 'listItem',
  content: content.map((part) => (typeof part === 'string' ? p(part) : part)),
});
export const ul = (...items: Array<string | AdfNode>): AdfNode => ({
  type: 'bulletList',
  content: items.map((item) => (typeof item === 'string' ? li(item) : item)),
});
export const ol = (...items: Array<string | AdfNode>): AdfNode => ({
  type: 'orderedList',
  content: items.map((item) => (typeof item === 'string' ? li(item) : item)),
});
export const tasks = (...items: string[]): AdfNode => ({
  type: 'taskList',
  content: items.map((item) => ({ type: 'taskItem', attrs: { state: 'TODO' }, content: [text(item)] })),
});
export const doc = (...content: AdfNode[]): AdfNode => ({ type: 'doc', version: 1, content });
