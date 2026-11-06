// Code-Regeln für Games: nur Tokens statt Hex, Zugriff auf Core und Assets nur über @core/*.
import { readFileSync } from 'node:fs';
import { listDirs, listFiles, Report, readJson, rel, root } from '../lib.ts';

const HEX = /#[0-9a-fA-F]{3,8}\b/g;
const COLOR_FN = /\b(rgba?|hsla?|oklch|lab|lch)\(/;
const IMPORT =
  /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;

export function checkCode(): Report {
  const report = new Report('Code');
  const deps = new Set(
    Object.keys(readJson<{ dependencies?: object }>(root('package.json')).dependencies ?? {}),
  );

  for (const id of listDirs(root('games'))) {
    const files = listFiles(root('games', id)).filter((f) => /\.(tsx?|css)$/.test(f));
    for (const file of files) {
      const name = rel(file);
      // Kommentare entfernen, damit z. B. "Issue #123" oder Kontrast-Notizen nicht anschlagen
      const code = readFileSync(file, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:])\/\/.*$/gm, '$1');
      const isPalette = file.endsWith('/palette.ts');

      const hexes = code.match(HEX) ?? [];
      if (!isPalette && hexes.length > 0) {
        report.error(
          `${name}: Hex-Farben ${hexes.join(', ')}. Tokens nutzen (useColors, var(--token))`,
        );
      }
      if (isPalette && hexes.length > 1) {
        report.error(`${name}: höchstens ein eigener Akzent (eine Hex-Farbe)`);
      }
      if (COLOR_FN.test(code)) report.error(`${name}: keine rgb()/hsl()-Farben, nur Tokens`);
      if (/\b(linear|radial|conic)-gradient|createLinearGradient|createRadialGradient/.test(code)) {
        report.error(`${name}: keine Verläufe`);
      }
      if (/box-shadow|shadowBlur|text-shadow/.test(code)) report.error(`${name}: keine Schatten`);
      if (/dangerouslySetInnerHTML|\beval\(|new Function\(/.test(code)) {
        report.error(`${name}: dangerouslySetInnerHTML, eval und new Function sind verboten`);
      }

      for (const m of code.matchAll(IMPORT)) {
        const spec = (m[1] ?? m[2]) as string;
        if (spec.startsWith('.')) {
          if (spec.startsWith('../')) {
            report.error(
              `${name}: Import "${spec}" verlässt den Spielordner. @core/sdk oder @core/assets nutzen`,
            );
          }
        } else if (spec.startsWith('@core/')) {
          if (spec !== '@core/sdk' && spec !== '@core/assets') {
            report.error(`${name}: nur @core/sdk und @core/assets importieren, nicht "${spec}"`);
          }
        } else if (spec !== 'react' && spec !== 'vitest') {
          const pkg = spec.startsWith('@')
            ? spec.split('/').slice(0, 2).join('/')
            : spec.split('/')[0];
          if (!deps.has(pkg as string)) {
            report.error(`${name}: Paket "${pkg}" ist keine Abhängigkeit in package.json`);
          }
        }
      }
    }
  }
  return report;
}
