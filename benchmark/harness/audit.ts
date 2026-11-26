/**
 * Two checks on the raw records of a set, run after the agents have finished.
 *
 *   npx tsx benchmark/harness/audit.ts --set full
 *
 * 1. Leak check. Every transcript is searched for signs that an agent reached for the
 *    hidden tests or the benchmark folder. The findings are written to audit.json.
 * 2. Scrub. Home-directory paths and the account name are replaced in transcripts and
 *    records, and the start-up event of the `claude` tool is cut down to the fields that
 *    describe the run, because it lists what is installed on the machine.
 *
 * Both steps can be repeated: a scrubbed file is left as it is.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir, userInfo } from 'node:os';
import { join } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import { RECORDS_DIR, parseArgs, writeJson } from './lib';

/** What an agent would have to name to reach the hidden tests. */
const LEAK = /test_hidden|\/hidden\/|proof-of-done-benchmark|benchmark\/tasks|benchmark\/\.eval|benchmark\/records/g;
const SECRET = /sk-[A-Za-z0-9_-]{20,}|mllm_[A-Za-z0-9]{8,}|Bearer [A-Za-z0-9._-]{20,}|gh[pous]_[A-Za-z0-9]{20,}|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/g;
const KEEP_INIT = ['type', 'subtype', 'cwd', 'model', 'permissionMode', 'tools', 'mcp_servers', 'claude_code_version', 'apiKeySource'];

function scrub(text: string): string {
  const user = userInfo().username;
  let out = text.split(homedir()).join('/home/user');
  out = out.replace(/\/run\/user\/\d+\/[^\s"']*/g, '/run/user/0/removed');
  if (user.length >= 4) out = out.split(user).join('user');
  return out;
}

function scrubTranscript(text: string): string {
  const lines = text.split('\n').map((line) => {
    if (!line.startsWith('{"type":"system","subtype":"init"')) return line;
    try {
      const event = JSON.parse(line) as Record<string, unknown>;
      return JSON.stringify(Object.fromEntries(KEEP_INIT.filter((key) => key in event).map((key) => [key, event[key]])));
    } catch {
      return line;
    }
  });
  return scrub(lines.join('\n'));
}

function main(): void {
  const set = parseArgs(process.argv.slice(2))['set'] ?? 'full';
  const findings: Array<{ file: string; pattern: string; count: number }> = [];
  const secrets: string[] = [];
  let transcripts = 0;
  const transcriptDir = join(RECORDS_DIR, set, 'transcripts');
  if (existsSync(transcriptDir)) {
    for (const name of readdirSync(transcriptDir).sort()) {
      if (!name.endsWith('.gz')) continue;
      const path = join(transcriptDir, name);
      const text = gunzipSync(readFileSync(path)).toString('utf8');
      transcripts++;
      const counts = new Map<string, number>();
      for (const match of text.matchAll(LEAK)) counts.set(match[0], (counts.get(match[0]) ?? 0) + 1);
      for (const [pattern, count] of counts) findings.push({ file: name, pattern, count });
      if (SECRET.test(text)) secrets.push(name);
      SECRET.lastIndex = 0;
      const cleaned = scrubTranscript(text);
      if (cleaned !== text) writeFileSync(path, gzipSync(cleaned));
    }
  }
  let records = 0;
  for (const folder of ['runs', 'reviews']) {
    const dir = join(RECORDS_DIR, set, folder);
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      if (!name.endsWith('.json')) continue;
      const path = join(dir, name);
      const text = readFileSync(path, 'utf8');
      records++;
      if (SECRET.test(text)) secrets.push(`${folder}/${name}`);
      SECRET.lastIndex = 0;
      const cleaned = scrub(text);
      if (cleaned !== text) writeFileSync(path, cleaned);
    }
  }
  writeJson(join(RECORDS_DIR, set, 'audit.json'), {
    set,
    at: new Date().toISOString(),
    transcripts,
    records,
    leakPatterns: LEAK.source,
    transcriptsWithLeakPattern: [...new Set(findings.map((finding) => finding.file))].length,
    findings,
    filesWithSecretPattern: secrets,
  });
  console.log(`${set}: ${transcripts} transcripts, ${records} records; ${findings.length} leak-pattern findings in ${new Set(findings.map((f) => f.file)).size} transcripts; ${secrets.length} files with a secret pattern`);
  for (const finding of findings.slice(0, 20)) console.log(`  ${finding.file}: ${finding.pattern} x${finding.count}`);
}

main();
