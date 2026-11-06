// Erzeugt core/styles/tokens.css aus design/tokens.json.
// `node scripts/build-tokens.ts`         schreibt die Datei
// `node scripts/build-tokens.ts --check` prüft nur, ob sie aktuell ist
import { readFileSync, writeFileSync } from 'node:fs';
import { root } from './lib.ts';

interface TypeStyle {
  name: string;
  fontSize: string;
  lineHeight: string;
  fontWeight: number;
  letterSpacing?: string;
}
interface Tokens {
  color: { tokens: { name: string; value: Record<string, string> }[] };
  type: {
    families: Record<string, string>;
    groups: { family: string; styles: TypeStyle[] }[];
  };
  spacing: { tokens: { name: string; value: string }[] };
  radius: { tokens: { name: string; value: string }[] };
}

export const TOKENS_CSS = 'core/styles/tokens.css';

export function renderTokensCss(tokens: Tokens): string {
  const colors = (theme: string) =>
    tokens.color.tokens.map((t) => `  --${t.name}: ${t.value[theme]};`).join('\n');
  const families = Object.entries(tokens.type.families)
    .map(([name, value]) => `  --font-${name}: ${value};`)
    .join('\n');
  const scale = [...tokens.spacing.tokens, ...tokens.radius.tokens]
    .map((t) => `  --${t.name}: ${t.value};`)
    .join('\n');
  const typeClasses = tokens.type.groups
    .flatMap((group) =>
      group.styles.map((s) =>
        [
          `.t-${s.name} {`,
          `  font-family: var(--font-${group.family});`,
          `  font-size: ${s.fontSize};`,
          `  line-height: ${s.lineHeight};`,
          `  font-weight: ${s.fontWeight};`,
          s.letterSpacing ? `  letter-spacing: ${s.letterSpacing};` : '',
          '}',
        ]
          .filter(Boolean)
          .join('\n'),
      ),
    )
    .join('\n\n');

  return `/* Automatisch erzeugt aus design/tokens.json – nicht von Hand ändern. npm run tokens */
:root,
[data-theme='dark'] {
  color-scheme: dark;
${colors('dark')}
}

[data-theme='light'] {
  color-scheme: light;
${colors('light')}
}

:root {
${families}
${scale}
}

${typeClasses}
`;
}

if (import.meta.main) {
  const tokens = JSON.parse(readFileSync(root('design/tokens.json'), 'utf8')) as Tokens;
  const css = renderTokensCss(tokens);
  if (process.argv.includes('--check')) {
    const current = readFileSync(root(TOKENS_CSS), 'utf8');
    if (current !== css) {
      console.error(`${TOKENS_CSS} ist veraltet. Bitte "npm run tokens" ausführen.`);
      process.exit(1);
    }
  } else {
    writeFileSync(root(TOKENS_CSS), css);
    console.log(`${TOKENS_CSS} geschrieben.`);
  }
}
