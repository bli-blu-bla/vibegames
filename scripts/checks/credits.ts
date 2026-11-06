import { existsSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import type { CreditJson } from '../../core/credits/types.ts';
import { FOLDER_PATTERN, LICENSE_FREE, listDirs, Report, readJson, root } from '../lib.ts';

const spdx = new Set<string>(createRequire(import.meta.url)('spdx-license-ids'));
const TYPES = ['assets', 'icons', 'fonts', 'sounds', 'libraries'];

export function checkCredits(): Report {
  const report = new Report('Credits');
  const games = new Set(listDirs(root('games')));
  const deps = Object.keys(
    readJson<{ dependencies?: object }>(root('package.json')).dependencies ?? {},
  );

  for (const id of listDirs(root('credits'))) {
    const err = (msg: string) => report.error(`credits/${id}: ${msg}`);
    if (!FOLDER_PATTERN.test(id)) err('Ordnername nur a-z, 0-9 und -');
    const path = root('credits', id, 'credit.json');
    if (!existsSync(path)) {
      err('credit.json fehlt');
      continue;
    }
    let c: CreditJson;
    try {
      c = readJson<CreditJson>(path);
    } catch {
      err('credit.json ist kein gültiges JSON');
      continue;
    }
    for (const f of ['name', 'author', 'url', 'license', 'type'] as const) {
      if (typeof c[f] !== 'string' || !c[f]) err(`Feld ${f} fehlt`);
    }
    if (c.url && !/^https:\/\/\S+$/.test(c.url)) err('url muss mit https:// beginnen');
    if (c.license && !spdx.has(c.license) && !c.license.startsWith('LicenseRef-')) {
      err(`"${c.license}" ist keine gültige SPDX-ID (https://spdx.org/licenses/)`);
    }
    if (c.type && !TYPES.includes(c.type)) err(`type muss eins von ${TYPES.join(', ')} sein`);
    if (!Array.isArray(c.usedIn)) err('usedIn muss ein Array sein');
    else {
      for (const g of c.usedIn) {
        if (g !== 'shared' && !games.has(g)) err(`usedIn "${g}" ist kein Game-Ordner`);
      }
    }
    for (const p of c.packages ?? []) {
      if (!deps.includes(p)) err(`Paket "${p}" fehlt in package.json dependencies`);
    }
    const hasLicense = readdirSync(root('credits', id)).some((f) => /^LICEN[CS]E/i.test(f));
    if (!hasLicense && !LICENSE_FREE.has(c.license)) {
      err(`LICENSE-Datei fehlt (Pflicht außer bei ${[...LICENSE_FREE].join(', ')})`);
    }
  }
  return report;
}
