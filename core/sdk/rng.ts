import seedrandom from 'seedrandom';

export interface Rng {
  /** Zahl in [0, 1) */
  next(): number;
  /** Ganze Zahl in [min, max] (beide inklusive) */
  int(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
  shuffle<T>(items: readonly T[]): T[];
}

/** Reproduzierbarer Zufall: gleicher Seed, gleiche Folge. */
export function createRng(seed: string): Rng {
  const random = seedrandom(seed);
  const int = (min: number, max: number) => min + Math.floor(random() * (max - min + 1));
  return {
    next: () => random(),
    int,
    pick(items) {
      if (items.length === 0) throw new Error('pick() auf leerer Liste');
      return items[int(0, items.length - 1)] as (typeof items)[number];
    },
    shuffle(items) {
      const copy = [...items];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = int(0, i);
        [copy[i], copy[j]] = [copy[j] as (typeof copy)[number], copy[i] as (typeof copy)[number]];
      }
      return copy;
    },
  };
}

export function randomSeed(): string {
  return Math.random().toString(36).slice(2, 10);
}

/** Seed für eine Daily Challenge: für alle gleich, wechselt jeden Tag (UTC). */
export function dailySeed(gameId: string, date = new Date()): string {
  return `${gameId}-${date.toISOString().slice(0, 10)}`;
}
