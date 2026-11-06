// CI: legt für hochgeladene Anhänge in games/<ordner>/assets/ ein manifest.json an.
// Das Feld "use" bleibt leer: opencode muss es ausfüllen, sonst schlägt das Quality Gate fehl.
import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { root } from '../lib.ts';

const folder = process.argv[2] as string;
const dir = root('games', folder, 'assets');
if (!existsSync(dir)) process.exit(0);

const groupOf = (file: string) =>
  /\.(ogg|mp3|wav)$/i.test(file)
    ? 'sounds'
    : /\.(woff2?|ttf|otf)$/i.test(file)
      ? 'fonts'
      : 'sprites';
const manifest: Record<string, object[]> = { sounds: [], sprites: [], fonts: [] };
for (const file of readdirSync(dir).filter((f) => f !== 'manifest.json')) {
  manifest[groupOf(file)]?.push({
    id: file
      .replace(/\.[^.]+$/, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-'),
    file,
    use: '',
    license: 'LicenseRef-Issue-Upload',
    source: 'self',
  });
}
writeFileSync(
  root('games', folder, 'assets', 'manifest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
);
