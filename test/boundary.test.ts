import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The core and the services must run without Forge, so that they can serve an adapter
 * other than the Jira app. The services reach Jira, the store and the Teamwork Graph
 * through interfaces. The files that implement those interfaces on Forge, and the files
 * that wire them together, live in the other folders of src.
 */
const FORGE_FREE = ['src/core', 'src/services'];
const FORGE_BACKED = /\/(forge-graph|forge-gateway|sql-store|schema|resolvers|frontend)(\/|$)/;
const IMPORT = /(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g;

function imports(folder: string): { file: string; source: string }[] {
  const found: { file: string; source: string }[] = [];
  for (const name of readdirSync(folder)) {
    const file = join(folder, name);
    for (const match of readFileSync(file, 'utf8').matchAll(IMPORT)) found.push({ file, source: match[1]! });
  }
  return found;
}

describe('the boundary between the core and the Jira adapter', () => {
  it.each(FORGE_FREE)('%s imports nothing from Forge, directly or through a Forge-backed file', (folder) => {
    const all = imports(folder);
    expect(all.length).toBeGreaterThan(0);
    expect(all.filter((entry) => entry.source.startsWith('@forge') || FORGE_BACKED.test(entry.source))).toEqual([]);
  });

  it('src/core imports only its own files and Node built-ins', () => {
    const outside = imports('src/core').filter((entry) => !entry.source.startsWith('./') && !entry.source.startsWith('node:'));
    expect(outside).toEqual([]);
  });
});
