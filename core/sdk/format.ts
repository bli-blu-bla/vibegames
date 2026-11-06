import type { GameJson, ScoreFormat } from './types.ts';

export function formatScore(value: number, format: ScoreFormat): string {
  const n = Math.max(0, Math.round(value));
  switch (format) {
    case 'points':
      return String(n).padStart(6, '0');
    case 'moves':
      return String(n).padStart(3, '0');
    case 'ms':
      return `${n} ms`;
    case 'seconds': {
      const m = Math.floor(n / 60);
      return `${String(m).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
    }
  }
}

/** Ist `score` besser als der bisherige Rekord `best`? */
export function isBetter(score: number, best: number | null, better: GameJson['score']['better']) {
  if (best === null) return true;
  return better === 'higher' ? score > best : score < best;
}
