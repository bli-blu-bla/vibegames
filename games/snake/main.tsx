import {
  createRng,
  type GameProps,
  keyToDirection,
  playSfx,
  useCanvas,
  useColors,
  useKeyDown,
  useSwipe,
  useTicker,
} from '@core/sdk';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createState, type SnakeState, step, tickMs, turn } from './logic.ts';

const CELL = 24;
const GAP = 4;

export default function Snake({ api, paused }: GameProps) {
  const rng = useMemo(() => createRng(api.seed), [api.seed]);
  const [state, setState] = useState(() => createState(rng));
  const stateRef = useRef(state);
  stateRef.current = state;

  const colors = useColors();
  const canvas = useCanvas(state.cols * CELL, state.rows * CELL);
  const fieldRef = useRef<HTMLDivElement>(null);

  const running = !paused && state.alive;

  useKeyDown((key) => {
    const dir = keyToDirection(key);
    if (dir) setState((s) => turn(s, dir));
  }, running);

  useSwipe(fieldRef, (dir) => setState((s) => turn(s, dir)), running);

  useTicker(
    tickMs(state),
    () => {
      const before = stateRef.current;
      const next = step(before, rng);
      if (next.score > before.score) {
        playSfx('coin');
        api.setScore(next.score);
      }
      if (!next.alive) {
        playSfx('lose');
        api.gameOver();
      }
      setState(next);
    },
    running,
  );

  useEffect(() => {
    canvas.draw((ctx) => draw(ctx, state, colors));
  }, [canvas, state, colors]);

  return (
    <div ref={fieldRef} style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
      <canvas
        {...canvas.props}
        role="img"
        aria-label={`Spielfeld: Schlange mit ${state.snake.length} Segmenten`}
      />
    </div>
  );
}

function draw(
  ctx: CanvasRenderingContext2D,
  state: SnakeState,
  colors: ReturnType<typeof useColors>,
) {
  const w = state.cols * CELL;
  const h = state.rows * CELL;

  ctx.fillStyle = colors['surface-100'];
  ctx.fillRect(0, 0, w, h);

  // Raster in surface-300
  ctx.strokeStyle = colors['surface-300'];
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = CELL; x < w; x += CELL) {
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, h);
  }
  for (let y = CELL; y < h; y += CELL) {
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(w, y + 0.5);
  }
  ctx.stroke();

  const cell = (x: number, y: number) => {
    ctx.beginPath();
    ctx.roundRect(x * CELL + GAP / 2, y * CELL + GAP / 2, CELL - GAP, CELL - GAP, 4);
    ctx.fill();
  };

  ctx.fillStyle = colors['game-rose'];
  cell(state.food.x, state.food.y);

  // Schlange in accent, zum Schwanz hin leicht transparent
  ctx.fillStyle = colors.accent;
  state.snake.forEach((p, i) => {
    ctx.globalAlpha = Math.max(0.5, 1 - i * 0.05);
    cell(p.x, p.y);
  });
  ctx.globalAlpha = 1;
}
