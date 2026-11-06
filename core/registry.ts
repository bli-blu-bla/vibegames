import type { ComponentType } from 'react';
import type { GameJson, GameMeta, GameProps } from './sdk/types.ts';

// Jeder Ordner unter games/ mit game.json ist ein Spiel. Kein Eintrag von Hand nötig.
const jsons = import.meta.glob<GameJson>('/games/*/game.json', { eager: true, import: 'default' });
const logos = import.meta.glob<string>('/games/*/logo.svg', {
  eager: true,
  query: '?raw',
  import: 'default',
});
const mains = import.meta.glob<{ default: ComponentType<GameProps> }>('/games/*/main.tsx');

const idOf = (path: string) => path.split('/')[2] as string;

export const games: GameMeta[] = Object.entries(jsons)
  .map(([path, json]) => {
    const id = idOf(path);
    return { ...json, id, logo: logos[`/games/${id}/logo.svg`] ?? '' };
  })
  .sort((a, b) => a.title.localeCompare(b.title, 'de'));

export function findGame(id: string): GameMeta | undefined {
  return games.find((g) => g.id === id);
}

export function loadGame(id: string) {
  const load = mains[`/games/${id}/main.tsx`];
  if (!load) throw new Error(`games/${id}/main.tsx fehlt`);
  return load();
}
