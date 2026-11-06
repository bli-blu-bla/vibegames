import { createRng } from '@core/sdk';
import { describe, expect, it } from 'vitest';
import { createState, POINTS_PER_FOOD, type SnakeState, step, tickMs, turn } from './logic.ts';

const rng = () => createRng('test');

describe('snake', () => {
  it('bewegt sich nach rechts', () => {
    const s = step(createState(rng()), rng());
    expect(s.snake[0]).toEqual({ x: 7, y: 8 });
    expect(s.snake).toHaveLength(3);
  });

  it('kann nicht umdrehen', () => {
    const s = turn(createState(rng()), 'left');
    expect(s.nextDir).toBe('right');
  });

  it('wächst beim Essen und zählt Punkte', () => {
    const start: SnakeState = { ...createState(rng()), food: { x: 7, y: 8 } };
    const s = step(start, rng());
    expect(s.snake).toHaveLength(4);
    expect(s.score).toBe(POINTS_PER_FOOD);
    expect(s.snake.some((p) => p.x === s.food.x && p.y === s.food.y)).toBe(false);
  });

  it('stirbt an der Wand', () => {
    let s = createState(rng(), 8, 8);
    for (let i = 0; i < 10; i++) s = step({ ...s, food: { x: 0, y: 0 } }, rng());
    expect(s.alive).toBe(false);
  });

  it('stirbt an sich selbst', () => {
    const s: SnakeState = {
      ...createState(rng()),
      snake: [
        { x: 5, y: 5 },
        { x: 6, y: 5 },
        { x: 6, y: 6 },
        { x: 5, y: 6 },
        { x: 4, y: 6 },
      ],
      dir: 'left',
      nextDir: 'down',
    };
    expect(step(s, rng()).alive).toBe(false);
  });

  it('wird schneller, aber mit Grenze', () => {
    const s = createState(rng());
    expect(tickMs(s)).toBe(140);
    expect(tickMs({ ...s, score: 1000 })).toBe(70);
  });
});
