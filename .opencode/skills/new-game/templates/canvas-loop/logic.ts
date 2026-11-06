// Vorlage Echtzeit-Spiel (Canvas + useGameLoop): Bälle fallen, der Schläger fängt sie.
// Pure Funktionen: Zustand rein, neuer Zustand raus. Zeit kommt als dt (Sekunden).
import type { Rng } from '@core/sdk';

export const WIDTH = 480;
export const HEIGHT = 360;
export const PADDLE_W = 72;
export const PADDLE_H = 12;
export const PADDLE_Y = HEIGHT - 28;
export const BALL_R = 8;
const PADDLE_SPEED = 360; // px pro Sekunde

export interface Ball {
  x: number;
  y: number;
  speed: number;
}

export interface State {
  paddleX: number;
  balls: Ball[];
  spawnIn: number;
  score: number;
  lives: number;
}

export interface Input {
  /** -1 links, 0 stehen, 1 rechts */
  move: number;
}

export function createState(): State {
  return { paddleX: WIDTH / 2, balls: [], spawnIn: 0.5, score: 0, lives: 3 };
}

export const isOver = (s: State) => s.lives <= 0;

export function update(s: State, input: Input, dt: number, rng: Rng): State {
  if (isOver(s)) return s;
  const half = PADDLE_W / 2;
  const paddleX = Math.min(
    WIDTH - half,
    Math.max(half, s.paddleX + input.move * PADDLE_SPEED * dt),
  );

  let { score, lives, spawnIn } = s;
  const balls: Ball[] = [];
  for (const b of s.balls) {
    const y = b.y + b.speed * dt;
    const caught =
      y + BALL_R >= PADDLE_Y && y < PADDLE_Y + PADDLE_H && Math.abs(b.x - paddleX) <= half;
    if (caught) score += 1;
    else if (y - BALL_R > HEIGHT) lives -= 1;
    else balls.push({ ...b, y });
  }

  spawnIn -= dt;
  if (spawnIn <= 0) {
    balls.push({ x: rng.int(BALL_R, WIDTH - BALL_R), y: -BALL_R, speed: 120 + score * 4 });
    spawnIn = Math.max(0.4, 1.2 - score * 0.02);
  }
  return { paddleX, balls, spawnIn, score, lives };
}
