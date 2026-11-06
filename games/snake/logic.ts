// Spiellogik als pure Funktionen: kein React, kein DOM, kein Zufall ohne Rng.
import type { Direction, Rng } from '@core/sdk';

export interface Point {
  x: number;
  y: number;
}

export interface SnakeState {
  cols: number;
  rows: number;
  /** Kopf zuerst */
  snake: Point[];
  dir: Direction;
  /** Richtung für den nächsten Schritt (Eingabe zwischen zwei Ticks) */
  nextDir: Direction;
  food: Point;
  score: number;
  alive: boolean;
}

export const POINTS_PER_FOOD = 10;

const DELTA: Record<Direction, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const OPPOSITE: Record<Direction, Direction> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};

const same = (a: Point, b: Point) => a.x === b.x && a.y === b.y;

export function createState(rng: Rng, cols = 20, rows = 16): SnakeState {
  const y = Math.floor(rows / 2);
  const snake = [
    { x: 6, y },
    { x: 5, y },
    { x: 4, y },
  ];
  return {
    cols,
    rows,
    snake,
    dir: 'right',
    nextDir: 'right',
    food: placeFood(rng, cols, rows, snake),
    score: 0,
    alive: true,
  };
}

/** Freies Feld für das Futter. */
export function placeFood(rng: Rng, cols: number, rows: number, snake: Point[]): Point {
  const free: Point[] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (!snake.some((s) => s.x === x && s.y === y)) free.push({ x, y });
    }
  }
  return rng.pick(free);
}

/** Richtungswechsel merken. Umdrehen auf der Stelle ist nicht erlaubt. */
export function turn(state: SnakeState, dir: Direction): SnakeState {
  if (!state.alive || dir === OPPOSITE[state.dir]) return state;
  return { ...state, nextDir: dir };
}

/** Ein Schritt: bewegen, essen, Kollision prüfen. */
export function step(state: SnakeState, rng: Rng): SnakeState {
  if (!state.alive) return state;
  const dir = state.nextDir;
  const head = state.snake[0] as Point;
  const next = { x: head.x + DELTA[dir].x, y: head.y + DELTA[dir].y };
  const eats = same(next, state.food);
  // Der Schwanz rückt nach, außer die Schlange wächst
  const body = eats ? state.snake : state.snake.slice(0, -1);

  const hitsWall = next.x < 0 || next.y < 0 || next.x >= state.cols || next.y >= state.rows;
  if (hitsWall || body.some((s) => same(s, next))) {
    return { ...state, dir, alive: false };
  }

  const snake = [next, ...body];
  return {
    ...state,
    dir,
    snake,
    food: eats ? placeFood(rng, state.cols, state.rows, snake) : state.food,
    score: eats ? state.score + POINTS_PER_FOOD : state.score,
  };
}

/** Wird mit jedem Futter schneller, aber nie schneller als 70 ms pro Schritt. */
export function tickMs(state: SnakeState): number {
  return Math.max(70, 140 - (state.score / POINTS_PER_FOOD) * 3);
}
