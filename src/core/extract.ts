import { AdfNode, adfOwnText, adfText, isList } from './adf';
import { RequiredKind } from './types';

/**
 * Reads acceptance criteria out of a work item description. This is rule-based on
 * purpose: the same description always yields the same contract, and a person can see
 * why each line is there. Drafting criteria for a description that has none is left
 * to a Rovo agent, whose suggestions a person has to accept.
 */

export interface ExtractedCriterion {
  text: string;
  /** The heading or label the text was found under, as written in the description. */
  anchor: string;
  requiredKind: RequiredKind;
}

const MAX_CRITERIA = 40;
const MAX_LENGTH = 500;

// A line that introduces criteria. Group 1 is the label, group 2 anything after it.
const ANCHOR =
  /^(acceptance\s+criteri(?:a|on)|acceptance\s+tests?|definition\s+of\s+done|done\s+when|done\s+criteria|success\s+criteria|exit\s+criteria|expected\s+(?:results?|outcomes?|behaviou?rs?)|dod|a\.?c\.?)\s*(?:[:：\-–—]\s*(.*))?$/i;

const EXPECTED = /^expected/i;
const BULLET = /^\s*(?:[-*•◦‣]|\d{1,2}[.)]|\[[ xX]?\])\s+(.*)$/;
const GHERKIN = /^\s*(scenario|given|when|then|and|but)\b[:\s]/i;
const GHERKIN_START = /^\s*(scenario|given)\b/i;

interface Collector {
  out: ExtractedCriterion[];
  seen: Set<string>;
}

export function extractCriteria(doc: AdfNode | null | undefined): ExtractedCriterion[] {
  const collector: Collector = { out: [], seen: new Set() };
  if (doc?.content) walkBlocks(doc.content, collector);
  return collector.out;
}

function walkBlocks(blocks: AdfNode[], c: Collector): void {
  // The label of the section we are inside, or null when the text is ordinary prose.
  let anchor: string | null = null;
  let collectedForAnchor = 0;
  let gherkin: string[] = [];

  const flushGherkin = () => {
    if (gherkin.length && anchor) {
      add(c, gherkin.join(' '), anchor);
      collectedForAnchor++;
    }
    gherkin = [];
  };
  const open = (label: string) => {
    flushGherkin();
    anchor = label;
    collectedForAnchor = 0;
  };
  const close = () => {
    flushGherkin();
    anchor = null;
  };

  const takeLines = (lines: string[]) => {
    for (const raw of lines) {
      const line = raw.trim();
      if (!line || !anchor) continue;
      if (GHERKIN.test(line)) {
        if (GHERKIN_START.test(line) && gherkin.some((g) => /^\s*then\b/i.test(g))) flushGherkin();
        gherkin.push(line);
        continue;
      }
      flushGherkin();
      const bullet = BULLET.exec(line);
      if (bullet?.[1]) {
        add(c, bullet[1], anchor);
        collectedForAnchor++;
      } else if (collectedForAnchor === 0) {
        // Prose directly under the label, before any list: treat it as one criterion.
        add(c, line, anchor);
        collectedForAnchor++;
      } else {
        // Prose after the list has started is commentary, and it ends the section.
        anchor = null;
        return;
      }
    }
  };

  for (const block of blocks) {
    switch (block.type) {
      case 'heading': {
        const match = matchAnchor(adfText(block));
        if (match) {
          open(match.label);
          if (match.rest) takeLines([match.rest]);
        } else {
          close();
        }
        break;
      }
      case 'paragraph': {
        const lines = adfText(block).split('\n');
        const match = matchAnchor(lines[0] ?? '');
        if (match) {
          open(match.label);
          takeLines([match.rest, ...lines.slice(1)]);
        } else if (anchor) {
          takeLines(lines);
        }
        break;
      }
      case 'bulletList':
      case 'orderedList':
      case 'taskList': {
        if (anchor) {
          flushGherkin();
          for (const text of listItemTexts(block)) {
            add(c, text, anchor);
            collectedForAnchor++;
          }
        } else {
          // Not in a section. A list item can still open one, as in seeded bug
          // reports where "Expected Result:" is itself a numbered item with sub-bullets.
          for (const item of block.content ?? []) walkBlocks(item.content ?? [], c);
        }
        break;
      }
      case 'codeBlock': {
        if (anchor) takeLines(adfText(block).split('\n'));
        break;
      }
      case 'panel':
      case 'expand':
      case 'nestedExpand':
      case 'blockquote':
      case 'layoutSection':
      case 'layoutColumn': {
        flushGherkin();
        walkBlocks(block.content ?? [], c);
        break;
      }
      case 'rule': {
        close();
        break;
      }
      default:
        break;
    }
  }
  flushGherkin();
}

function matchAnchor(line: string): { label: string; rest: string } | null {
  // Drop markdown-style emphasis and a leading "#", which survive in pasted text.
  const cleaned = line.replace(/^[#*_\s]+/, '').replace(/[*_\s]+$/, '');
  const match = ANCHOR.exec(cleaned);
  if (!match?.[1]) return null;
  return { label: match[1].replace(/\s+/g, ' '), rest: (match[2] ?? '').trim() };
}

/** Every item of a list, nested items included, in reading order. */
function listItemTexts(list: AdfNode): string[] {
  const texts: string[] = [];
  for (const item of list.content ?? []) {
    const own = adfOwnText(item).trim();
    const nested = (item.content ?? []).filter(isList);
    // A parent line ending in ":" only introduces its children; it is not a criterion.
    if (own && !(nested.length && own.endsWith(':'))) texts.push(own);
    for (const child of nested) texts.push(...listItemTexts(child));
  }
  return texts;
}

function add(c: Collector, raw: string, anchor: string): void {
  if (c.out.length >= MAX_CRITERIA) return;
  let text = raw.replace(/\s+/g, ' ').trim();
  text = text.replace(/^\[[ xX]?\]\s*/, '');
  if (text.length < 3) return;
  if (EXPECTED.test(anchor)) text = `Expected: ${text}`;
  if (text.length > MAX_LENGTH) text = text.slice(0, MAX_LENGTH - 1).trimEnd() + '…';
  const key = text.toLowerCase();
  if (c.seen.has(key)) return;
  c.seen.add(key);
  c.out.push({ text, anchor, requiredKind: suggestKind(text) });
}

const KIND_HINTS: Array<[RequiredKind, RegExp]> = [
  ['attestation', /\b(approv\w*|sign[- ]?off|signed off|confirm(?:ed|s)? by|stakeholder|product owner|legal review)\b/i],
  ['test_run', /\b(tests?|tested|testing|regression|coverage|unit|e2e|end-to-end|qa|verif(?:y|ied) that)\b/i],
  ['pull_request', /\b(pull request|merge request|code review|reviewed|merged)\b/i],
  ['build', /\b(builds?|compiles?|pipeline|ci|deploy(?:ed|s|ment)?|released?)\b/i],
  ['document', /\b(document(?:ed|ation)?|docs|instructions|readme|guide|runbook|release notes|changelog)\b/i],
];

/**
 * A first guess at the kind of evidence a criterion needs, from its wording. It is a
 * default the team can change, so it leans towards `any` when nothing clearly matches.
 */
export function suggestKind(text: string): RequiredKind {
  for (const [kind, pattern] of KIND_HINTS) {
    if (pattern.test(text)) return kind;
  }
  return 'any';
}
