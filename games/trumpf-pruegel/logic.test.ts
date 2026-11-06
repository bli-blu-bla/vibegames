import { createRng } from '@core/sdk';
import { describe, expect, it } from 'vitest';
import {
  type Card,
  createRun,
  ENEMIES,
  evaluate,
  MAX_HP,
  nextEnemy,
  playHand,
  type State,
  toggleCard,
} from './logic.ts';

const card = (suit: Card['suit'], value: number): Card => ({ id: `${suit}${value}`, suit, value });

describe('evaluate', () => {
  it('erkennt Kombos', () => {
    expect(evaluate([card('spades', 5), card('spades', 6), card('spades', 7)]).name).toBe(
      'Straight Flush',
    );
    expect(evaluate([card('spades', 9), card('hearts', 9), card('clubs', 9)]).name).toBe(
      'Drilling',
    );
    expect(evaluate([card('spades', 5), card('hearts', 6), card('clubs', 7)]).name).toBe('Straße');
    expect(evaluate([card('clubs', 2), card('clubs', 9), card('clubs', 12)]).name).toBe('Flush');
    expect(evaluate([card('spades', 4), card('hearts', 4), card('clubs', 12)]).name).toBe('Paar');
    expect(evaluate([card('spades', 2), card('hearts', 7), card('clubs', 12)]).name).toBe(
      'Hohe Karte',
    );
  });
  it('Kreuz blockt, Herz heilt', () => {
    const c = evaluate([card('clubs', 2), card('hearts', 7), card('hearts', 12)]);
    expect(c.shield).toBe(3);
    expect(c.heal).toBe(4);
  });
});

describe('Run', () => {
  const rng = createRng('run');

  it('startet mit fünf Karten und vollem Leben', () => {
    const s = createRun(rng);
    expect(s.hand).toHaveLength(5);
    expect(s.hp).toBe(MAX_HP);
  });

  it('wählt höchstens drei Karten', () => {
    let s = createRun(rng);
    for (const c of s.hand) s = toggleCard(s, c.id);
    expect(s.selected).toHaveLength(3);
    s = toggleCard(s, s.selected[0] as string);
    expect(s.selected).toHaveLength(2);
  });

  it('Angriff macht Schaden, Gegner schlägt zurück, Hand wird aufgefüllt', () => {
    let s = createRun(rng);
    for (const c of s.hand.slice(0, 3)) s = toggleCard(s, c.id);
    const after = playHand(s, rng);
    expect(after.damageDealt).toBeGreaterThan(0);
    expect(after.enemyHp).toBeLessThan(s.enemyHp);
    expect(after.hand).toHaveLength(5);
  });

  it('K.O. führt zum nächsten Gegner, der letzte macht dich zum Champion', () => {
    const base = createRun(rng);
    const s: State = { ...base, enemyHp: 1, selected: base.hand.slice(0, 3).map((c) => c.id) };
    const down = playHand(s, rng);
    expect(down.phase).toBe('enemy-down');
    const next = nextEnemy(down, rng);
    expect(next.enemyIndex).toBe(1);
    expect(next.hp).toBe(Math.min(MAX_HP, down.hp + 5));
    const final = playHand(
      {
        ...next,
        enemyIndex: ENEMIES.length - 1,
        enemyHp: 1,
        selected: next.hand.slice(0, 3).map((c) => c.id),
      },
      rng,
    );
    expect(final.phase).toBe('champion');
  });

  it('bei 0 Leben ist der Run vorbei', () => {
    const base = createRun(rng);
    // Pik heilt und blockt nicht, der Ausgang ist also sicher
    const hand = [card('spades', 2), card('spades', 5), card('spades', 9)];
    const s: State = {
      ...base,
      hp: 1,
      block: 0,
      enemyHp: 999,
      hand,
      selected: hand.map((c) => c.id),
    };
    expect(playHand(s, rng).phase).toBe('lost');
  });
});
