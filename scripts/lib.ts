// Gemeinsame Helfer für die Check- und Build-Skripte.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

export const root = (...parts: string[]) => join(ROOT, ...parts);
export const rel = (path: string) => relative(ROOT, path);

export function readJson<T = unknown>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

export function listDirs(path: string): string[] {
  if (!existsSync(path)) return [];
  return readdirSync(path)
    .filter((name) => !name.startsWith('.') && statSync(join(path, name)).isDirectory())
    .sort();
}

/** Alle Dateien unterhalb von `path`, rekursiv, als absolute Pfade. */
export function listFiles(path: string): string[] {
  if (!existsSync(path)) return [];
  return readdirSync(path, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && !entry.name.startsWith('.'))
    .map((entry) => join(entry.parentPath, entry.name))
    .sort();
}

/** Sammelt Fehler eines Checks, statt beim ersten abzubrechen. */
export class Report {
  readonly name: string;
  readonly errors: string[] = [];
  constructor(name: string) {
    this.name = name;
  }
  error(message: string) {
    this.errors.push(message);
  }
  get ok() {
    return this.errors.length === 0;
  }
}

export const FOLDER_PATTERN = /^[a-z0-9-]+$/;
export const LICENSE_FREE = new Set(['CC0-1.0', 'Unlicense', '0BSD', 'LicenseRef-PublicDomain']);
