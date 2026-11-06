import {
  createRng,
  type GameProps,
  playSfx,
  useCanvas,
  useColors,
  useGameLoop,
  useJoystick,
  usePressedKeys,
} from '@core/sdk';
import { useMemo, useRef } from 'react';
import {
  BALL_R,
  createState,
  HEIGHT,
  isOver,
  PADDLE_H,
  PADDLE_W,
  PADDLE_Y,
  type State,
  update,
  WIDTH,
} from './logic.ts';

export default function Game({ api, paused }: GameProps) {
  const rng = useMemo(() => createRng(api.seed), [api.seed]);
  // Echtzeit-Zustand im Ref: 60 Updates pro Sekunde brauchen kein React-Rendering
  const state = useRef<State>(createState());
  const touchMove = useRef(0);
  const keys = usePressedKeys();
  const colors = useColors();
  const canvas = useCanvas(WIDTH, HEIGHT);
  const fieldRef = useRef<HTMLDivElement>(null);

  useJoystick(fieldRef, (v) => (touchMove.current = v.x), !paused);

  useGameLoop((dt) => {
    const k = keys.current;
    const keyMove =
      (k.has('ArrowRight') || k.has('d') ? 1 : 0) - (k.has('ArrowLeft') || k.has('a') ? 1 : 0);
    const before = state.current;
    const next = update(before, { move: keyMove || touchMove.current }, dt, rng);
    state.current = next;

    if (next.score > before.score) {
      playSfx('coin');
      api.setScore(next.score);
    }
    if (next.lives < before.lives) playSfx('hit');
    if (isOver(next)) {
      playSfx('lose');
      api.gameOver();
    }
    canvas.draw((ctx) => draw(ctx, next, colors));
  }, !paused);

  return (
    <div ref={fieldRef} style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
      <canvas
        {...canvas.props}
        role="img"
        aria-label="Spielfeld mit Schläger und fallenden Bällen"
      />
    </div>
  );
}

function draw(ctx: CanvasRenderingContext2D, s: State, colors: ReturnType<typeof useColors>) {
  ctx.fillStyle = colors['surface-100'];
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.fillStyle = colors['game-rose'];
  for (const b of s.balls) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, BALL_R, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = colors.accent;
  ctx.beginPath();
  ctx.roundRect(s.paddleX - PADDLE_W / 2, PADDLE_Y, PADDLE_W, PADDLE_H, 4);
  ctx.fill();

  // Leben als kleine Quadrate oben links
  ctx.fillStyle = colors['ink-muted'];
  for (let i = 0; i < s.lives; i++) ctx.fillRect(12 + i * 16, 12, 10, 10);
}
