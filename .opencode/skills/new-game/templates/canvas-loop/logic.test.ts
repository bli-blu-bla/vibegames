import { createRng } from '@core/sdk';
import { describe, expect, it } from 'vitest';
import { BALL_R, createState, isOver, PADDLE_Y, update, WIDTH } from './logic.ts';

const rng = createRng('test');

describe('logic', () => {
  it('bewegt den Schläger und bleibt im Feld', () => {
    let s = createState();
    for (let i = 0; i < 100; i++) s = update(s, { move: 1 }, 0.1, rng);
    expect(s.paddleX).toBeLessThanOrEqual(WIDTH);
  });

  it('zählt gefangene Bälle', () => {
    const s = { ...createState(), balls: [{ x: WIDTH / 2, y: PADDLE_Y - BALL_R - 1, speed: 100 }] };
    expect(update(s, { move: 0 }, 0.05, rng).score).toBe(1);
  });

  it('verliert ein Leben bei verpassten Bällen', () => {
    const s = { ...createState(), lives: 1, balls: [{ x: 10, y: 1000, speed: 100 }] };
    expect(isOver(update(s, { move: 0 }, 0.05, rng))).toBe(true);
  });
});
