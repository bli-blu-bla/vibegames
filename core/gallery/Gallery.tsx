import { Moon, Plus, Sun } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { Brand } from '../Brand.tsx';
import { issueUrl } from '../config.ts';
import { games } from '../registry.ts';
import { createStorage } from '../sdk/storage.ts';
import { useThemeStore } from '../sdk/theme.ts';
import { CATEGORY_LABELS, type GameCategory } from '../sdk/types.ts';
import { GameCard } from './GameCard.tsx';
import './gallery.css';

type Filter = GameCategory | 'all';

const ZAHLWORT = ['Kein', 'Ein', 'Zwei', 'Drei', 'Vier', 'Fünf', 'Sechs', 'Sieben', 'Acht'];

export function Gallery() {
  const [filter, setFilter] = useState<Filter>('all');
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggle);
  const lastPlayed = createStorage('core').get<string | null>('lastPlayed', null);
  const newGameUrl = issueUrl('game_request.yml');

  useEffect(() => {
    document.title = 'VibeGames';
  }, []);

  const categories = (Object.keys(CATEGORY_LABELS) as GameCategory[]).filter((c) =>
    games.some((g) => g.category === c),
  );
  const visible = games.filter((g) => filter === 'all' || g.category === filter);
  const count = ZAHLWORT[games.length] ?? String(games.length);

  return (
    <div className="page">
      <header className="container gallery-header">
        <Brand />
        <nav className="gallery-nav">
          <button
            type="button"
            className="btn btn-icon"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Helles Theme' : 'Dunkles Theme'}
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          {newGameUrl && (
            <a className="btn" href={newGameUrl} target="_blank" rel="noreferrer">
              <Plus size={20} /> Neues Game
            </a>
          )}
        </nav>
      </header>

      <main className="container gallery-main">
        <section className="gallery-intro">
          <h1 className="t-display">Kleine Spiele für zwischendurch.</h1>
          <p className="muted">
            {count} {games.length === 1 ? 'Spiel' : 'Spiele'}, jedes in unter zwei Minuten
            verstanden. Direkt im Browser, ohne Anmeldung.
          </p>
        </section>

        {categories.length > 1 && (
          <fieldset className="gallery-filter">
            <legend className="visually-hidden">Filter</legend>
            {(['all', ...categories] as Filter[]).map((c) => (
              <button
                key={c}
                type="button"
                className={filter === c ? 'btn btn-primary' : 'btn'}
                aria-pressed={filter === c}
                onClick={() => setFilter(c)}
              >
                {c === 'all' ? 'Alle' : CATEGORY_LABELS[c]}
              </button>
            ))}
          </fieldset>
        )}

        <section aria-label="Spiele" className="gallery-grid">
          {visible.map((game) => (
            <GameCard key={game.id} game={game} primary={game.id === lastPlayed} />
          ))}
        </section>
      </main>

      <footer className="container gallery-footer t-small muted">
        <span>Neues Spiel gewünscht? Lege ein Issue an, ein Modell baut es als Pull Request.</span>
        <a href="#/credits">Credits und Lizenzen</a>
      </footer>
    </div>
  );
}
