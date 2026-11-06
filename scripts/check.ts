// Quality Gate: alle Repo-Checks. `npm run check`
import { readFileSync } from 'node:fs';
import { renderTokensCss, TOKENS_CSS } from './build-tokens.ts';
import { checkAssets } from './checks/assets.ts';
import { checkCode } from './checks/code.ts';
import { checkCredits } from './checks/credits.ts';
import { checkGames } from './checks/games.ts';
import { Report, readJson, root } from './lib.ts';
import { checkForms } from './sync-issue-forms.ts';

function checkTokens(): Report {
  const report = new Report('Tokens');
  const css = renderTokensCss(readJson(root('design/tokens.json')));
  if (readFileSync(root(TOKENS_CSS), 'utf8') !== css) {
    report.error(`${TOKENS_CSS} ist veraltet. "npm run tokens" ausführen`);
  }
  return report;
}

const reports = [
  checkGames(),
  checkAssets(),
  checkCredits(),
  checkCode(),
  checkTokens(),
  checkForms(),
];
let failed = 0;
for (const r of reports) {
  console.log(`${r.ok ? '✓' : '✗'} ${r.name}`);
  for (const e of r.errors) console.log(`    ${e}`);
  failed += r.errors.length;
}
if (failed > 0) {
  console.error(`\n${failed} Fehler. Details oben.`);
  process.exit(1);
}
