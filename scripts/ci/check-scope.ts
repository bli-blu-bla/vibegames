// CI: Der Agent darf nur Dateien ändern, die zu seiner Aufgabe passen.
// Aufruf: node scripts/ci/check-scope.ts <kind> <folder> < geänderte Pfade (git diff --name-only)
import { readFileSync } from 'node:fs';

const [kind, folder] = process.argv.slice(2);
const changed = readFileSync(0, 'utf8').split('\n').filter(Boolean);

const NEVER = [
  /^\.github\/workflows\//,
  /^scripts\//,
  /^\.opencode\//,
  /^AGENTS\.md$/,
  /^design\//,
  /^biome\.json$/,
];
const allowed: RegExp[] = [
  /^credits\//,
  /^\.github\/ISSUE_TEMPLATE\/(bug_fix|feature_request)\.yml$/,
];
if (folder) allowed.push(new RegExp(`^games/${folder}/`));
if (kind === 'bug' && !folder) allowed.push(/^core\//, /^e2e\//, /^package(-lock)?\.json$/);
if (kind !== 'bug') allowed.push(/^package(-lock)?\.json$/);

const bad = changed.filter((p) => NEVER.some((r) => r.test(p)) || !allowed.some((r) => r.test(p)));
if (bad.length > 0) {
  console.error(
    `Änderungen außerhalb der Aufgabe (${kind} ${folder || 'core'}):\n${bad.join('\n')}`,
  );
  process.exit(1);
}
if (changed.length === 0) {
  console.error('Keine Änderungen.');
  process.exit(1);
}
console.log(`${changed.length} Dateien geändert, alle im erlaubten Bereich.`);
