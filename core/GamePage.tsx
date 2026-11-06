import { type ComponentType, useEffect, useState } from 'react';
import { findGame, loadGame } from './registry.ts';
import { GameShell } from './sdk/GameShell.tsx';
import type { GameProps } from './sdk/types.ts';

interface Props {
  id: string;
  room: string | null;
  localNet: boolean;
}

export function GamePage({ id, room, localNet }: Props) {
  const meta = findGame(id);
  const [game, setGame] = useState<ComponentType<GameProps> | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!meta) return;
    document.title = `${meta.title} · VibeGames`;
    loadGame(meta.id)
      .then((mod) => setGame(() => mod.default))
      .catch(() => setError(true));
  }, [meta]);

  if (!meta || error) {
    return (
      <main className="page">
        <div className="container" style={{ paddingBlock: 'var(--space-7)' }}>
          <h1 className="t-display">Spiel nicht gefunden</h1>
          <p className="muted" style={{ marginBlock: 'var(--space-4)' }}>
            „{id}“ gibt es nicht oder konnte nicht geladen werden.
          </p>
          <a className="btn btn-primary" href="#/">
            Zur Galerie
          </a>
        </div>
      </main>
    );
  }
  return game ? <GameShell meta={meta} game={game} room={room} localNet={localNet} /> : null;
}
