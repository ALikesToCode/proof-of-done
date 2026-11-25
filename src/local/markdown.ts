import { AdfNode } from '../core/adf';

/**
 * Turns the Markdown of a task file into the document shape the core reads criteria
 * from. It covers what a task description needs: headings, paragraphs, and bullet,
 * numbered and checkbox lists, nested by indentation. Inline marks stay in the text
 * as written, except that emphasis around a whole line is removed, so a line such as
 * "**Acceptance criteria:**" is still read as a label.
 */

const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const ITEM = /^(\s*)(?:([-*+])|(\d{1,9})[.)])\s+(.*)$/;
const TASK = /^\[( |x|X)\]\s+(.*)$/;
const FENCE = /^\s*(```|~~~)/;

const text = (value: string): AdfNode[] => (value ? [{ type: 'text', text: value }] : []);
const paragraph = (value: string): AdfNode => ({ type: 'paragraph', content: text(value) });

/** "**Label:**" and "__Label__" become "Label:" and "Label". */
function plain(line: string): string {
  const match = /^(\*\*|__)(.+?)\1(:?)\s*$/.exec(line.trim());
  return match ? `${match[2]}${match[3]}` : line.trim();
}

interface Item {
  indent: number;
  ordered: boolean;
  text: string;
  children: Item[];
}

function listNode(items: Item[]): AdfNode {
  const ordered = items[0]?.ordered ?? false;
  return {
    type: ordered ? 'orderedList' : 'bulletList',
    content: items.map((item) => {
      const task = TASK.exec(item.text);
      const content: AdfNode[] = [paragraph(task ? `[${task[1]}] ${task[2]}` : item.text)];
      if (item.children.length > 0) content.push(listNode(item.children));
      return { type: 'listItem', content };
    }),
  };
}

export function markdownToAdf(markdown: string): AdfNode {
  const content: AdfNode[] = [];
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  let prose: string[] = [];
  let roots: Item[] = [];
  let stack: Item[] = [];
  let fence: string | null = null;
  let code: string[] = [];

  const flushProse = () => {
    if (prose.length > 0) content.push(paragraph(prose.join('\n')));
    prose = [];
  };
  const flushList = () => {
    if (roots.length > 0) content.push(listNode(roots));
    roots = [];
    stack = [];
  };

  for (const raw of lines) {
    const fenced = FENCE.exec(raw);
    if (fence !== null) {
      if (fenced && fenced[1] === fence) {
        content.push({ type: 'codeBlock', content: text(code.join('\n')) });
        fence = null;
        code = [];
      } else {
        code.push(raw);
      }
      continue;
    }
    if (fenced) {
      flushProse();
      flushList();
      fence = fenced[1] ?? '```';
      continue;
    }
    if (!raw.trim()) {
      flushProse();
      flushList();
      continue;
    }
    const heading = HEADING.exec(raw);
    if (heading) {
      flushProse();
      flushList();
      content.push({ type: 'heading', attrs: { level: heading[1]!.length }, content: text(plain(heading[2] ?? '')) });
      continue;
    }
    const item = ITEM.exec(raw);
    if (item) {
      flushProse();
      const entry: Item = { indent: item[1]!.replace(/\t/g, '    ').length, ordered: item[3] !== undefined, text: item[4]!.trim(), children: [] };
      while (stack.length > 0 && stack[stack.length - 1]!.indent >= entry.indent) stack.pop();
      const parent = stack[stack.length - 1];
      if (parent) parent.children.push(entry);
      else roots.push(entry);
      stack.push(entry);
      continue;
    }
    const last = stack[stack.length - 1];
    if (last && /^\s+\S/.test(raw)) {
      // An indented line under a list item continues that item.
      last.text = `${last.text} ${raw.trim()}`;
      continue;
    }
    flushList();
    prose.push(plain(raw));
  }
  if (fence !== null) content.push({ type: 'codeBlock', content: text(code.join('\n')) });
  flushProse();
  flushList();
  return { type: 'doc', version: 1, content };
}
