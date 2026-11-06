// Vite-Plugin: erzeugt die Liste der npm-Bibliotheken für die Credits-Seite aus package.json.
// Manuell gepflegt werden nur Assets, Schriften, Sounds und Icons in credits/.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Plugin } from 'vite';
import type { CreditJson, LibraryCredit } from '../core/credits/types.ts';
import { listDirs, readJson, root } from './lib.ts';

const ID = 'virtual:library-credits';

interface PackageJson {
  name: string;
  license?: string;
  author?: string | { name: string };
  homepage?: string;
  repository?: string | { url: string };
  dependencies?: Record<string, string>;
}

function repoUrl(pkg: PackageJson): string {
  const raw = typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url;
  const url = (pkg.homepage ?? raw ?? `https://www.npmjs.com/package/${pkg.name}`)
    .replace(/^git\+/, '')
    .replace(/^git:\/\//, 'https://')
    .replace(/\.git$/, '')
    .replace(/#readme$/, '');
  if (url.startsWith('github:')) return `https://github.com/${url.slice(7)}`;
  return url.startsWith('https://') ? url : `https://www.npmjs.com/package/${pkg.name}`;
}

export function collectLibraries(): LibraryCredit[] {
  const pkg = readJson<PackageJson>(root('package.json'));
  const covered = new Set(
    listDirs(root('credits'))
      .map((id) => root('credits', id, 'credit.json'))
      .filter(existsSync)
      .flatMap((path) => readJson<CreditJson>(path).packages ?? []),
  );

  return Object.keys(pkg.dependencies ?? {})
    .filter((name) => !covered.has(name))
    .map((name) => {
      const dir = root('node_modules', name);
      const dep = readJson<PackageJson>(join(dir, 'package.json'));
      const licenseFile = readdirSync(dir).find((f) => /^(LICEN[CS]E|COPYING)/i.test(f));
      return {
        name,
        author: (
          (typeof dep.author === 'string' ? dep.author : dep.author?.name) ?? 'Autor siehe Link'
        )
          .replace(/\s*[<(].*?[>)]/g, '')
          .trim(),
        url: repoUrl(dep),
        license: dep.license ?? 'UNKNOWN',
        licenseText: licenseFile ? readFileSync(join(dir, licenseFile), 'utf8') : '',
      };
    });
}

export function libraryCredits(): Plugin {
  return {
    name: 'vibegames-library-credits',
    resolveId: (id) => (id === ID ? `\0${ID}` : undefined),
    load(id) {
      if (id !== `\0${ID}`) return;
      this.addWatchFile(root('package.json'));
      return `export default ${JSON.stringify(collectLibraries())};`;
    },
  };
}
