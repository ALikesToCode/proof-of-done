import { readFileSync } from 'node:fs';

/** Reads a file of the repository, by its path from the root. */
export const repoFile = (path: string): string => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

export const manifest = repoFile('manifest.yml');

/** The text under `modules.<name>`, up to the next module. */
export const section = (name: string): string => new RegExp(`^  ${name}:\\n((?:    .*\\n|\\n)+)`, 'm').exec(manifest)?.[1] ?? '';

export interface Entry {
  key: string;
  block: string;
}

/** The entries of a module, one per `- key:`. */
export const entries = (name: string): Entry[] =>
  section(name)
    .split(/^    - key: /m)
    .slice(1)
    .map((block) => ({ key: block.split('\n')[0]!.trim(), block }));

/** The items of a list inside an entry, such as its `tools`. */
export const items = (block: string, name: string): string[] => {
  const match = new RegExp(`^( +)${name}:\\n((?:\\1  - .+\\n)+)`, 'm').exec(block);
  return match ? [...match[2]!.matchAll(/- (.+)/g)].map((m) => m[1]!.trim()) : [];
};
