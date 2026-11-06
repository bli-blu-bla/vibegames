// Schreibt die Liste der Games in die Dropdowns der Issue Forms (zwischen # games:start/end).
// `node scripts/sync-issue-forms.ts`         aktualisiert die Dateien
// `node scripts/sync-issue-forms.ts --check` prüft nur
import { readFileSync, writeFileSync } from 'node:fs';
import type { GameJson } from '../core/sdk/types.ts';
import { listDirs, Report, readJson, root } from './lib.ts';

export const FORMS = [
  '.github/ISSUE_TEMPLATE/bug_fix.yml',
  '.github/ISSUE_TEMPLATE/feature_request.yml',
];
const BLOCK = /^( *)# games:start\n[\s\S]*?^ *# games:end$/m;

export function gameOptions(): string[] {
  return listDirs(root('games')).map((id) => {
    const { title } = readJson<GameJson>(root('games', id, 'game.json'));
    return `${title} (${id})`;
  });
}

export function syncForm(yaml: string, options: string[]): string {
  return yaml.replace(BLOCK, (_, indent: string) =>
    [
      `${indent}# games:start`,
      ...options.map((o) => `${indent}- ${o}`),
      `${indent}# games:end`,
    ].join('\n'),
  );
}

export function checkForms(): Report {
  const report = new Report('Issue Forms');
  const options = gameOptions();
  for (const form of FORMS) {
    const yaml = readFileSync(root(form), 'utf8');
    if (!BLOCK.test(yaml)) report.error(`${form}: Marker # games:start/# games:end fehlen`);
    else if (syncForm(yaml, options) !== yaml) {
      report.error(`${form}: Game-Liste veraltet. "npm run sync:forms" ausführen`);
    }
  }
  return report;
}

if (import.meta.main) {
  if (process.argv.includes('--check')) {
    const report = checkForms();
    for (const e of report.errors) console.error(e);
    process.exit(report.ok ? 0 : 1);
  }
  const options = gameOptions();
  for (const form of FORMS) {
    writeFileSync(root(form), syncForm(readFileSync(root(form), 'utf8'), options));
  }
  console.log(`Issue Forms aktualisiert: ${options.join(', ')}`);
}
