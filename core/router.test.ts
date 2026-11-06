import { describe, expect, it } from 'vitest';
import { parseRoute } from './router.ts';

describe('parseRoute', () => {
  it('erkennt alle Seiten', () => {
    expect(parseRoute('')).toEqual({ page: 'gallery' });
    expect(parseRoute('#/')).toEqual({ page: 'gallery' });
    expect(parseRoute('#/play/snake')).toEqual({
      page: 'game',
      id: 'snake',
      room: null,
      localNet: false,
    });
    expect(parseRoute('#/play/stellwerk?room=abc234&net=local')).toEqual({
      page: 'game',
      id: 'stellwerk',
      room: 'ABC234',
      localNet: true,
    });
    expect(parseRoute('#/play/stellwerk?room=kaputt').page).toBe('game');
    expect(parseRoute('#/credits')).toEqual({ page: 'credits', game: null });
    expect(parseRoute('#/credits?game=snake')).toEqual({ page: 'credits', game: 'snake' });
  });
});
