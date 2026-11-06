import { createRng } from '@core/sdk';
import { describe, expect, it } from 'vitest';
import { createState, finalScore, roll, stand, total } from './logic.ts';

describe('logic', () => {
  it('würfelt 1 bis 6', () => {
    const s = roll(createState(), createRng('a'));
    expect(s.rolls).toHaveLength(1);
    expect(total(s)).toBeGreaterThanOrEqual(1);
    expect(total(s)).toBeLessThanOrEqual(6);
  });

  it('über 21 ist verloren und gibt 0 Punkte', () => {
    const s = roll({ rolls: [6, 6, 6, 3], status: 'playing' }, createRng('b'));
    expect(s.status).toBe('bust');
    expect(finalScore(s)).toBe(0);
  });

  it('Stopp beendet mit der Summe', () => {
    const s = stand({ rolls: [6, 5], status: 'playing' });
    expect(s.status).toBe('stood');
    expect(finalScore(s)).toBe(11);
  });
});
