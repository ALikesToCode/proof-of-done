import React from 'react';
import TestRenderer, { ReactTestRenderer, ReactTestRendererJSON, act } from 'react-test-renderer';
import { busy } from './forge-bridge';

/** Mounts a page built on the stand-in for @forge/react and lets a test use it as a person would. */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Node = ReactTestRendererJSON | string;
type Option = { label?: string; value: string };

const PRESSABLE = ['Button', 'LoadingButton', 'SectionMessageAction'];
/** Props that hold text a person reads, next to the text between the tags. */
const TEXT_PROPS = ['title', 'header', 'description', 'label', 'text'];
/** Props a field can be found by. */
const FIELD_PROPS = ['id', 'inputId', 'name', 'label'];

function walk(nodes: Node[], visit: (node: ReactTestRendererJSON) => void): void {
  for (const node of nodes) {
    if (typeof node === 'string') continue;
    visit(node);
    walk(node.children ?? [], visit);
  }
}

function textOf(node: Node): string {
  if (typeof node === 'string') return node;
  return (node.children ?? []).map(textOf).join('');
}

export class Page {
  constructor(
    private readonly renderer: ReactTestRenderer,
    /** Set on a page that `within` narrowed to one element. */
    private readonly scope: (() => Node[]) | null = null,
  ) {}

  private nodes(): Node[] {
    if (this.scope) return this.scope();
    const tree = this.renderer.toJSON();
    if (tree === null) return [];
    return Array.isArray(tree) ? tree : [tree];
  }

  /** The same page, narrowed to the last element of one kind. */
  within(type: string): Page {
    return new Page(this.renderer, () => {
      const last = this.all(type).at(-1);
      if (!last) throw new Error(`No ${type} on the page.`);
      return [last];
    });
  }

  /** The open dialog. While one is open, a person can reach nothing else. */
  get dialog(): Page {
    return this.within('Modal');
  }

  /** Every piece of text on the page, in reading order, one piece to a line. */
  text(): string {
    const out: string[] = [];
    const collect = (nodes: Node[]): void => {
      for (const node of nodes) {
        if (typeof node === 'string') {
          out.push(node);
          continue;
        }
        for (const name of TEXT_PROPS) {
          const value = node.props[name] as unknown;
          if (typeof value === 'string') out.push(value);
        }
        const children = node.children ?? [];
        // React keeps "a {b} c" as three strings. A person reads them as one.
        if (children.length > 1 && children.every((child) => typeof child === 'string')) out.push(children.join(''));
        else collect(children);
      }
    };
    collect(this.nodes());
    return out.join('\n');
  }

  /** The elements of one kind, such as every `Modal`. */
  all(type: string): ReactTestRendererJSON[] {
    const found: ReactTestRendererJSON[] = [];
    walk(this.nodes(), (node) => {
      if (node.type === type) found.push(node);
    });
    return found;
  }

  /** What the elements of one kind say, such as the label of every `Lozenge`. */
  labels(type: string): string[] {
    return this.all(type).map(textOf);
  }

  /** The labels of everything a person can press, in reading order. */
  buttons(): string[] {
    const labels: string[] = [];
    walk(this.nodes(), (node) => {
      if (PRESSABLE.includes(node.type)) labels.push(textOf(node));
    });
    return labels;
  }

  /** Presses the button with this label. `index` picks one when several share it. */
  async press(label: string, index = 0): Promise<void> {
    const matches: ReactTestRendererJSON[] = [];
    walk(this.nodes(), (node) => {
      if (PRESSABLE.includes(node.type) && textOf(node) === label) matches.push(node);
    });
    const button = matches.at(index);
    if (!button) throw new Error(`No button "${label}" here. There is: ${this.buttons().join(' | ')}`);
    if (button.props['isDisabled'] || button.props['isLoading']) throw new Error(`The button "${label}" is disabled.`);
    await this.run(() => (button.props['onClick'] as () => unknown)());
  }

  /** The field with this id, name or label. */
  field(name: string): ReactTestRendererJSON {
    let found: ReactTestRendererJSON | null = null;
    walk(this.nodes(), (node) => {
      if (!found && typeof node.props['onChange'] === 'function' && FIELD_PROPS.some((prop) => node.props[prop] === name)) found = node;
    });
    if (!found) throw new Error(`No field "${name}" here.`);
    return found;
  }

  private async change(name: string, value: unknown): Promise<void> {
    const field = this.field(name);
    if (field.props['isDisabled']) throw new Error(`The field "${name}" is disabled.`);
    await this.run(() => (field.props['onChange'] as (value: unknown) => unknown)(value));
  }

  private option(name: string, value: string): Option {
    const options = (this.field(name).props['options'] ?? []) as Option[];
    const option = options.find((candidate) => candidate.value === value);
    if (!option) throw new Error(`The field "${name}" has no option "${value}". It has: ${options.map((o) => o.value).join(', ')}`);
    return option;
  }

  /** Types into a text field or a text area. */
  type(name: string, text: string): Promise<void> {
    return this.change(name, { target: { value: text } });
  }

  /** Picks one option of a select, several of a multi-select, or clears it with null. */
  pick(name: string, value: string | string[] | null): Promise<void> {
    if (value === null) return this.change(name, null);
    return this.change(name, Array.isArray(value) ? value.map((one) => this.option(name, one)) : this.option(name, value));
  }

  /** Chooses one option of a radio group. */
  choose(name: string, value: string): Promise<void> {
    return this.change(name, { target: { value: this.option(name, value).value } });
  }

  /** Ticks or clears the checkbox with this label. */
  tick(label: string, checked: boolean): Promise<void> {
    return this.change(label, { target: { checked } });
  }

  /** Does something to the page from outside, such as moving the clock, and waits for the page to follow. */
  async run(action: () => unknown): Promise<void> {
    await act(async () => {
      await action();
    });
    await this.settle();
  }

  /** Waits until every call to the backend has answered and the page has drawn what came back. */
  async settle(): Promise<void> {
    let quiet = 0;
    for (let round = 0; quiet < 3; round++) {
      if (round > 2_000) throw new Error('A call to the backend never answered.');
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      quiet = busy() ? 0 : quiet + 1;
    }
  }

  unmount(): void {
    act(() => this.renderer.unmount());
  }
}

export async function mount(element: React.ReactElement): Promise<Page> {
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(element);
  });
  const page = new Page(renderer);
  await page.settle();
  return page;
}
