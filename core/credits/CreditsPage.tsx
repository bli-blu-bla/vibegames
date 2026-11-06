import libraries from 'virtual:library-credits';
import { ArrowLeft, ArrowSquareOut } from '@phosphor-icons/react';
import { useEffect } from 'react';
import { Brand } from '../Brand.tsx';
import { findGame } from '../registry.ts';
import type { CreditJson, CreditType } from './types.ts';
import './credits.css';

const jsons = import.meta.glob<CreditJson>('/credits/*/credit.json', {
  eager: true,
  import: 'default',
});
const licenses = import.meta.glob<string>('/credits/*/LICENSE*', {
  eager: true,
  query: '?raw',
  import: 'default',
});

interface Entry {
  id: string;
  name: string;
  author: string;
  url: string;
  license: string;
  usedIn: string[];
  licenseText?: string;
}

const idOf = (path: string) => path.split('/')[2] as string;

const curated: (Entry & { type: CreditType })[] = Object.entries(jsons).map(([path, c]) => {
  const id = idOf(path);
  const licenseText = Object.entries(licenses).find(([p]) => idOf(p) === id)?.[1];
  return { ...c, id, licenseText };
});

const GROUPS: { type: CreditType; title: string }[] = [
  { type: 'assets', title: 'Assets' },
  { type: 'sounds', title: 'Sounds' },
  { type: 'icons', title: 'Icons' },
  { type: 'fonts', title: 'Schriften' },
  { type: 'libraries', title: 'Bibliotheken' },
];

function allEntries(type: CreditType): Entry[] {
  const own = curated.filter((c) => c.type === type);
  if (type !== 'libraries') return own;
  const auto = libraries.map((l) => ({ ...l, id: l.name, usedIn: [] }));
  return [...own, ...auto].sort((a, b) => a.name.localeCompare(b.name));
}

export function CreditsPage({ game }: { game: string | null }) {
  const meta = game ? findGame(game) : undefined;

  useEffect(() => {
    document.title = 'Credits · VibeGames';
  }, []);

  return (
    <div className="page">
      <header className="container gallery-header">
        <Brand />
        <a className="btn" href={meta ? `#/play/${meta.id}` : '#/'}>
          <ArrowLeft size={20} /> {meta ? meta.title : 'Galerie'}
        </a>
      </header>
      <main className="container credits-main">
        <section className="gallery-intro">
          <h1 className="t-display">Credits</h1>
          <p className="muted">
            Alles, was nicht selbst gebaut ist: Assets, Schriften, Icons und Bibliotheken mit ihren
            Lizenzen.
          </p>
        </section>
        {GROUPS.map(({ type, title }) => {
          const entries = allEntries(type);
          if (entries.length === 0) return null;
          return (
            <section key={type} className="credits-group" aria-labelledby={`credits-${type}`}>
              <h2 id={`credits-${type}`} className="t-heading">
                {title}
              </h2>
              <div className="credits-grid">
                {entries.map((e) => (
                  <CreditCard key={e.id} entry={e} active={!!meta && meta.credits.includes(e.id)} />
                ))}
              </div>
            </section>
          );
        })}
      </main>
    </div>
  );
}

function CreditCard({ entry, active }: { entry: Entry; active: boolean }) {
  return (
    <article className={active ? 'card credit-card credit-active' : 'card credit-card'}>
      <div className="credit-head">
        <h3 className="t-body-strong">{entry.name}</h3>
        <span className="chip">{entry.license}</span>
      </div>
      <p className="t-small muted">{entry.author}</p>
      {entry.usedIn.length > 0 && (
        <p className="t-small muted">
          Genutzt in: {entry.usedIn.map((g) => (g === 'shared' ? 'allen Games' : g)).join(', ')}
        </p>
      )}
      <a className="t-small credit-link" href={entry.url} target="_blank" rel="noreferrer">
        <ArrowSquareOut size={16} aria-hidden /> {entry.url.replace(/^https:\/\//, '')}
      </a>
      {entry.licenseText && (
        <details className="credit-license">
          <summary className="t-small">Lizenztext</summary>
          <pre className="t-mono-small">{entry.licenseText}</pre>
        </details>
      )}
    </article>
  );
}
