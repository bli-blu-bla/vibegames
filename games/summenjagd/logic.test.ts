import { createRng } from '@core/sdk';
import { describe, expect, it } from 'vitest';
import {
  canReach,
  createCells,
  createState,
  MISS_PENALTY,
  PENALTY_PER_CELL,
  type State,
  tick,
  timeBonus,
  toggle,
} from './logic.ts';

const rng = () => createRng('test');
const base = (over: Partial<State>): State => ({
  cells: [3, 4, 5, 9, ...new Array<number>(20).fill(1)],
  selected: [],
  target: 7,
  ticks: 0,
  score: 0,
  status: 'playing',
  event: 'none',
  ...over,
});

describe('logic', () => {
  it('startet mit 100 Feldern, Ziffern 1-9 gleich verteilt', () => {
    const cells = createCells(rng());
    expect(cells).toHaveLength(100);
    for (let d = 1; d <= 9; d++) {
      expect(cells.filter((c) => c === d).length).toBeGreaterThanOrEqual(11);
      expect(cells.filter((c) => c === d).length).toBeLessThanOrEqual(12);
    }
    const s = createState(rng());
    expect(s.target).toBeGreaterThanOrEqual(1);
    expect(s.target).toBeLessThanOrEqual(20);
    expect(s.status).toBe('playing');
  });

  it('erreichte Summe: 50 Punkte je Feld plus Zeitbonus, Felder verschwinden', () => {
    let s = base({});
    s = toggle(s, 0, rng());
    s = toggle(s, 1, rng());
    expect(s.score).toBe(2 * 50 + 100);
    expect(s.cells[0]).toBe(0);
    expect(s.cells[1]).toBe(0);
    expect(s.selected).toEqual([]);
    expect(s.event).toBe('hit');
  });

  it('Zeitbonus: 100, nach 10 s 50, nach 20 s 0', () => {
    let s = base({});
    expect(timeBonus(s)).toBe(100);
    for (let i = 0; i < 10; i++) s = tick(s);
    expect(timeBonus(s)).toBe(50);
    for (let i = 0; i < 10; i++) s = tick(s);
    expect(timeBonus(s)).toBe(0);
    for (let i = 0; i < 5; i++) s = tick(s);
    expect(timeBonus(s)).toBe(0);
  });

  it('zu große Summe leert die Auswahl und zieht 10 Punkte ab', () => {
    let s = base({});
    s = toggle(s, 2, rng());
    s = toggle(s, 3, rng());
    expect(s.selected).toEqual([]);
    expect(s.event).toBe('miss');
    expect(s.score).toBe(-MISS_PENALTY);
  });

  it('erneutes Antippen nimmt die Wahl zurück', () => {
    let s = base({});
    s = toggle(s, 0, rng());
    s = toggle(s, 0, rng());
    expect(s.selected).toEqual([]);
  });

  it('Erreichbarkeit per Teilsummen', () => {
    expect(canReach([3, 4, 9], 7)).toBe(true);
    expect(canReach([3, 4, 9], 5)).toBe(false);
    expect(canReach([0, 0, 2], 2)).toBe(true);
  });

  it('nicht mehr erreichbar: übrige Felder zählen minus 100', () => {
    // Nach 3+4 bleiben nur zwei 9er: jede neue Summe außer 9 und 18 ist unerreichbar
    let stuck: State | undefined;
    for (let seed = 0; seed < 50 && !stuck; seed++) {
      const r = createRng(`s${seed}`);
      let s = toggle(base({ cells: [3, 4, 9, 9], target: 7 }), 0, r);
      s = toggle(s, 1, r);
      if (s.status === 'stuck') stuck = s;
    }
    expect(stuck).toBeDefined();
    expect(stuck?.score).toBe(2 * 50 + 100 - 2 * PENALTY_PER_CELL);
  });

  it('leeres Feld ergibt Status cleared', () => {
    let s = base({ cells: [3, 4], target: 7 });
    s = toggle(s, 0, rng());
    s = toggle(s, 1, rng());
    expect(s.status).toBe('cleared');
  });

  it('ohne Treffer keine Punkte nach Spielende und keine weiteren Züge', () => {
    const s = base({ status: 'stuck' });
    expect(toggle(s, 0, rng())).toBe(s);
    expect(tick(s)).toBe(s);
  });
});
