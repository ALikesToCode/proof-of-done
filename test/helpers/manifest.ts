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

/** A one-line value of an entry, such as its `name`. */
export const value = (block: string, name: string): string => new RegExp(`^ +${name}: (.+)$`, 'm').exec(block)?.[1]?.trim() ?? '';

/** The items of a list inside an entry, such as its `tools`. */
export const items = (block: string, name: string): string[] => {
  const match = new RegExp(`^( +)${name}:\\n((?:\\1  - .+\\n)+)`, 'm').exec(block);
  return match ? [...match[2]!.matchAll(/- (.+)/g)].map((m) => m[1]!.trim()) : [];
};

/** The folder a resource key points at. */
export const resourcePath = (key: string): string => new RegExp(`^  - key: ${key}\\n    path: (.+)$`, 'm').exec(manifest)?.[1]?.trim() ?? '';

/** The file behind a value such as `resource:icons;proof-of-done.svg`. */
export function resourceFile(reference: string): string {
  const match = /^resource:([^;]+);(.+)$/.exec(reference);
  return match ? repoFile(`${resourcePath(match[1]!)}/${match[2]!}`) : '';
}

/** The frontmatter fields and the body of a SKILL.md. */
export function readSkill(path: string): { fields: Record<string, string>; body: string } {
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(repoFile(path));
  const fields: Record<string, string> = {};
  for (const line of (match?.[1] ?? '').split('\n')) {
    const field = /^([a-z-]+): (.+)$/.exec(line);
    if (field) fields[field[1]!] = field[2]!.trim();
  }
  return { fields, body: match?.[2] ?? '' };
}
