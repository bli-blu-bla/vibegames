// Summenjagd: Wähle Felder, deren Zahlen zusammen die gesuchte Summe ergeben.
import type { Rng } from '@core/sdk';

export const SIZE = 10;
export const MAX_TARGET = 20;
export const POINTS_PER_CELL = 50;
export const PENALTY_PER_CELL = 100;
export const MISS_PENALTY = 10;
export const START_BONUS = 100;
/** Der Zeitbonus sinkt pro Tick (eine Sekunde): nach 10 s 50, nach 20 s 0. */
export const BONUS_STEP = 5;
export const TICK_MS = 1000;

export type Status = 'playing' | 'cleared' | 'stuck';
export type Event = 'none' | 'select' | 'deselect' | 'miss' | 'hit';

export interface State {
  /** Zahl je Feld, 0 = bereits entfernt */
  cells: number[];
  /** Indizes der gewählten Felder */
  selected: number[];
  target: number;
  /** vergangene Ticks seit die Summe angezeigt wird */
  ticks: number;
  score: number;
  status: Status;
  event: Event;
}

/** Ziffern 1-9 gleich verteilt (11 mal jede, ein Rest zufällig), gemischt. */
export function createCells(rng: Rng): number[] {
  const cells: number[] = [];
  for (let d = 1; d <= 9; d++) for (let i = 0; i < 11; i++) cells.push(d);
  cells.push(rng.int(1, 9));
  return rng.shuffle(cells);
}

export const remaining = (cells: number[]) => cells.filter((c) => c > 0).length;

export const selectedSum = (s: State) => s.selected.reduce((sum, i) => sum + (s.cells[i] ?? 0), 0);

export const timeBonus = (s: State) => Math.max(0, START_BONUS - s.ticks * BONUS_STEP);

/** Gibt es eine Auswahl der übrigen Felder mit genau dieser Summe? */
export function canReach(cells: number[], target: number): boolean {
  const reach = new Array<boolean>(target + 1).fill(false);
  reach[0] = true;
  for (const c of cells) {
    if (c <= 0) continue;
    for (let t = target; t >= c; t--) if (reach[t - c]) reach[t] = true;
  }
  return reach[target] === true;
}

/** Prüft nach jeder neuen Summe, ob das Spiel vorbei ist, und bucht die Minuspunkte. */
function settle(s: State): State {
  const left = remaining(s.cells);
  if (left === 0) return { ...s, status: 'cleared' };
  if (!canReach(s.cells, s.target)) {
    return { ...s, status: 'stuck', score: s.score - left * PENALTY_PER_CELL };
  }
  return s;
}

export function createState(rng: Rng): State {
  return settle({
    cells: createCells(rng),
    selected: [],
    target: rng.int(1, MAX_TARGET),
    ticks: 0,
    score: 0,
    status: 'playing',
    event: 'none',
  });
}

export function tick(s: State): State {
  return s.status === 'playing' ? { ...s, ticks: s.ticks + 1 } : s;
}

export function toggle(s: State, index: number, rng: Rng): State {
  if (s.status !== 'playing' || (s.cells[index] ?? 0) === 0) return s;

  if (s.selected.includes(index)) {
    return { ...s, selected: s.selected.filter((i) => i !== index), event: 'deselect' };
  }

  const selected = [...s.selected, index];
  const sum = selected.reduce((acc, i) => acc + (s.cells[i] ?? 0), 0);

  if (sum > s.target) {
    return { ...s, selected: [], score: s.score - MISS_PENALTY, event: 'miss' };
  }
  if (sum < s.target) return { ...s, selected, event: 'select' };

  const cells = s.cells.map((c, i) => (selected.includes(i) ? 0 : c));
  return settle({
    ...s,
    cells,
    selected: [],
    target: rng.int(1, MAX_TARGET),
    ticks: 0,
    score: s.score + selected.length * POINTS_PER_CELL + timeBonus(s),
    event: 'hit',
  });
}
