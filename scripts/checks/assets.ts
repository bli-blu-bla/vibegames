import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { AssetEntry, AssetManifest } from '../../core/assets/index.ts';
import { listDirs, listFiles, Report, readJson, rel, root } from '../lib.ts';

const IGNORED = new Set(['manifest.json', 'README.md', '.gitkeep']);
const GROUPS = ['sounds', 'sprites', 'fonts'] as const;
const FIELDS = ['id', 'file', 'use', 'license', 'source'] as const;

/** Prüft ein Asset-Verzeichnis gegen sein manifest.json. */
function checkDir(dir: string, report: Report, shared: boolean) {
  const credits = new Set(listDirs(root('credits')));
  const name = rel(dir);
  const manifestPath = join(dir, 'manifest.json');
  const files = listFiles(dir).filter((f) => !IGNORED.has(f.split('/').pop() as string));

  if (!existsSync(manifestPath)) {
    if (files.length > 0) report.error(`${name}/manifest.json fehlt`);
    return;
  }
  const manifest = readJson<Partial<AssetManifest>>(manifestPath);
  const listed = new Set<string>();
  const ids = new Set<string>();

  for (const group of GROUPS) {
    const entries: AssetEntry[] = manifest[group] ?? [];
    if (shared && !Array.isArray(manifest[group])) report.error(`${name}: "${group}" fehlt`);
    for (const entry of entries) {
      const label = `${name}/manifest.json "${entry.id ?? '?'}"`;
      for (const f of FIELDS) if (!entry[f]) report.error(`${label}: Feld ${f} fehlt`);
      if (ids.has(entry.id)) report.error(`${label}: doppelte id`);
      ids.add(entry.id);
      if (!entry.file) continue;
      listed.add(join(dir, entry.file));
      if (!existsSync(join(dir, entry.file))) report.error(`${label}: Datei ${entry.file} fehlt`);
      if (entry.source !== 'self' && !credits.has(entry.source)) {
        report.error(`${label}: source "${entry.source}" fehlt in credits/ (oder "self")`);
      }
      if (shared && entry.license !== 'CC0-1.0') {
        report.error(`${label}: geteilte Assets nur CC0-1.0`);
      }
    }
  }
  for (const file of files) {
    if (!listed.has(file)) report.error(`${rel(file)} steht nicht in ${name}/manifest.json`);
  }
}

export function checkAssets(): Report {
  const report = new Report('Assets');
  checkDir(root('assets'), report, true);
  for (const id of listDirs(root('games'))) {
    const dir = root('games', id, 'assets');
    if (existsSync(dir)) checkDir(dir, report, false);
  }
  return report;
}
