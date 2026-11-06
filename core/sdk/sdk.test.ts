import { describe, expect, it } from 'vitest';
import { formatScore, isBetter } from './format.ts';
import { createRng, dailySeed } from './rng.ts';
import { createStorage } from './storage.ts';

describe('formatScore', () => {
  it('formatiert alle Formate', () => {
    expect(formatScore(12480, 'points')).toBe('012480');
    expect(formatScore(14, 'moves')).toBe('014');
    expect(formatScore(231, 'ms')).toBe('231 ms');
    expect(formatScore(102, 'seconds')).toBe('01:42');
  });
});

describe('isBetter', () => {
  it('beachtet die Richtung', () => {
    expect(isBetter(5, null, 'higher')).toBe(true);
    expect(isBetter(5, 4, 'higher')).toBe(true);
    expect(isBetter(5, 4, 'lower')).toBe(false);
  });
});

describe('createRng', () => {
  it('ist reproduzierbar', () => {
    const a = createRng('seed');
    const b = createRng('seed');
    expect([a.next(), a.int(1, 6), a.shuffle([1, 2, 3])]).toEqual([
      b.next(),
      b.int(1, 6),
      b.shuffle([1, 2, 3]),
    ]);
  });
  it('bleibt in den Grenzen', () => {
    const rng = createRng('x');
    for (let i = 0; i < 200; i++) {
      const v = rng.int(1, 3);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(3);
    }
  });
  it('dailySeed hängt nur vom Tag ab', () => {
    expect(dailySeed('snake', new Date('2026-11-06T10:00:00Z'))).toBe('snake-2026-11-06');
  });
});

describe('createStorage', () => {
  it('trennt Namespaces', () => {
    const a = createStorage('a');
    const b = createStorage('b');
    a.set('best', 10);
    expect(a.get('best', 0)).toBe(10);
    expect(b.get('best', 0)).toBe(0);
    a.remove('best');
    expect(a.get('best', 0)).toBe(0);
  });
});

describe('COLOR_TOKENS', () => {
  it('entspricht design/tokens.json', async () => {
    const { COLOR_TOKENS } = await import('./tokens.ts');
    const tokens = (await import('../../design/tokens.json')).default;
    expect([...COLOR_TOKENS].sort()).toEqual(tokens.color.tokens.map((t) => t.name).sort());
  });
});
