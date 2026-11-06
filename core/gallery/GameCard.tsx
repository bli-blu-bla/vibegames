import { Play, Users } from '@phosphor-icons/react';
import { formatScore } from '../sdk/format.ts';
import { createStorage } from '../sdk/storage.ts';
import type { GameMeta } from '../sdk/types.ts';

export function GameCard({ game, primary }: { game: GameMeta; primary: boolean }) {
  const best = createStorage(game.id).get<number | null>('best', null);

  return (
    <article className="card game-card">
      <div
        className="game-card-logo"
        role="img"
        aria-label={`Logo ${game.title}`}
        // logo.svg stammt aus dem Repo und wird vom Quality Gate geprüft (kein Script, keine Links)
        // biome-ignore lint/security/noDangerouslySetInnerHtml: geprüftes SVG aus dem Repo
        dangerouslySetInnerHTML={{ __html: game.logo }}
      />
      <div className="game-card-text">
        <h2 className="t-heading">{game.title}</h2>
        {game.multiplayer && (
          <p className="chip game-card-online">
            <Users size={16} aria-hidden /> Online zu zweit
          </p>
        )}
        <p className="muted">{game.description}</p>
      </div>
      <div className="game-card-footer">
        <div className="game-card-stat">
          <span className="t-label muted">{game.score.label}</span>
          <span className="t-score game-card-score score-value">
            {best === null ? '–' : formatScore(best, game.score.format)}
          </span>
        </div>
        <a className={primary ? 'btn btn-primary' : 'btn'} href={`#/play/${game.id}`}>
          <Play size={20} weight="fill" /> Spielen
          <span className="visually-hidden"> {game.title}</span>
        </a>
      </div>
    </article>
  );
}
