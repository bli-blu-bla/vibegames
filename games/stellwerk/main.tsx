import {
  type ColorToken,
  createRng,
  type GameProps,
  playSfx,
  useCanvas,
  useColors,
  useGameLoop,
  useKeyDown,
  useNet,
} from '@core/sdk';
import { type PointerEvent, useMemo, useRef } from 'react';
import {
  type Action,
  applyAction,
  applySnapshot,
  createState,
  type GameEvent,
  hitTest,
  isOver,
  LIVES,
  predict,
  type Snapshot,
  type State,
  type Train,
  toSnapshot,
  update,
  wagonPose,
} from './logic.ts';
import {
  EDGES,
  HEIGHT,
  NODES,
  OUT,
  quadPoint,
  STATIONS,
  type StationKey,
  SWITCHES,
  type TrackNode,
  WIDTH,
} from './network.ts';
import './style.css';

/** Spielfeld-Farben: vier Bahnhöfe, Buchstabe zusätzlich auf Lok und Bahnhof. */
const STATION_COLOR: Record<StationKey, ColorToken> = {
  B: 'game-rose',
  W: 'game-sky',
  C: 'highlight',
  M: 'game-sand',
};

interface Floating {
  x: number;
  y: number;
  text: string;
  life: number;
}

type Colors = ReturnType<typeof useColors>;

/** Snapshots pro Sekunde, die der Host online an den Gast schickt */
const SNAPSHOT_HZ = 20;

export default function Stellwerk({ api, paused }: GameProps) {
  const { net } = api;
  // Online im Koop simuliert nur der Host, der Gast zeigt an und schickt Eingaben
  const guest = net?.role === 'guest';
  const rng = useMemo(() => createRng(api.seed), [api.seed]);
  const state = useRef<State>(createState());
  const floating = useRef<Floating[]>([]);
  const outbox = useRef<GameEvent[]>([]);
  const sinceSnap = useRef(0);
  const colors = useColors();
  const canvas = useCanvas(WIDTH, HEIGHT);

  const apply = (next: State) => {
    if (net && !guest) outbox.current.push(...next.events);
    for (const e of next.events) {
      floating.current.push({ x: e.at.x, y: e.at.y - 30, text: e.text, life: 2.2 });
      if (e.type === 'arrived') playSfx(e.correct ? 'coin' : 'hit');
      if (e.type === 'crash') playSfx('hit');
      if (e.type === 'cow' || e.type === 'cleared') playSfx('jump');
    }
    if (next.score !== state.current.score) api.setScore(next.score);
    state.current = { ...next, events: [] };
    if (isOver(next)) {
      const done = next.lives > 0;
      playSfx(done ? 'win' : 'lose');
      api.gameOver({
        outcome: done ? 'win' : 'lose',
        message: done
          ? `Schicht geschafft! ${next.delivered} Züge pünktlich angekommen.`
          : 'Drei Pannen. Der Vorstand hat keinen Kaffee mehr.',
      });
    }
  };

  // Gast: Snapshot vom Host übernehmen
  useNet<Snapshot>(net, 'snap', (snap) => {
    if (guest) apply(applySnapshot(state.current, snap));
  });
  // Host: Eingaben vom Gast
  useNet<Action>(net, 'act', (a) => {
    if (net && !guest && !isOver(state.current)) apply(applyAction(state.current, a));
  });

  const act = (a: Action) => {
    playSfx('click');
    if (guest) {
      net?.send('act', a);
      // Weichen sofort umlegen, damit es sich direkt anfühlt. Der nächste Snapshot bestätigt.
      if (a.kind === 'switch') state.current = applyAction(state.current, a);
    } else apply(applyAction(state.current, a));
  };

  useGameLoop((dt) => {
    if (guest) state.current = predict(state.current, dt);
    else apply(update(state.current, dt, rng));
    if (net && !guest) {
      sinceSnap.current += dt;
      if (sinceSnap.current >= 1 / SNAPSHOT_HZ || isOver(state.current)) {
        sinceSnap.current = 0;
        net.send('snap', toSnapshot(state.current, outbox.current));
        outbox.current = [];
      }
    }
    floating.current = floating.current
      .map((f) => ({ ...f, y: f.y - 24 * dt, life: f.life - dt }))
      .filter((f) => f.life > 0);
    canvas.draw((ctx) => draw(ctx, state.current, floating.current, colors));
  }, !paused);

  useKeyDown((key) => {
    const sw = SWITCHES.find((n) => String(n.num) === key);
    if (sw) act({ kind: 'switch', id: sw.id, branch: (state.current.switches[sw.id] ?? 0) + 1 });
  }, !paused);

  const onPointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    if (paused) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const p = {
      x: ((e.clientX - rect.left) / rect.width) * WIDTH,
      y: ((e.clientY - rect.top) / rect.height) * HEIGHT,
    };
    const hit = hitTest(state.current, p);
    if (!hit) return;
    if (hit.kind === 'switch') {
      act({ kind: 'switch', id: hit.id, branch: (state.current.switches[hit.id] ?? 0) + 1 });
    } else act(hit);
  };

  return (
    <div className="sw">
      <canvas
        {...canvas.props}
        onPointerDown={onPointerDown}
        role="img"
        aria-label="Gleisnetz mit Weichen 1 bis 9, Zügen und vier Bahnhöfen"
      />
    </div>
  );
}

// ---------- Zeichnen ----------

const MONO = '"Geist Mono", ui-monospace, monospace';

function draw(ctx: CanvasRenderingContext2D, s: State, floating: Floating[], c: Colors) {
  ctx.fillStyle = c['surface-100'];
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.lineCap = 'round';

  // Gleisbett für alle Kanten, aktive Zweige darüber hell
  for (const e of EDGES) curve(ctx, e, c['surface-300'], 12);
  EDGES.forEach((e, i) => {
    const from = NODES[e.from] as TrackNode;
    const active = from.type !== 'switch' || OUT[from.id]?.[s.switches[from.id] ?? 0] === i;
    curve(ctx, e, active ? c['ink-muted'] : c.line, active ? 3 : 2);
  });

  for (const n of Object.values(NODES)) {
    if (n.type === 'spawn') {
      ctx.fillStyle = c['surface-300'];
      roundRect(ctx, n.x - 34, n.y - 22, 44, 44, 4);
      ctx.fillStyle = c['ink-muted'];
      text(ctx, 'Tunnel', n.x - 12, n.y + 44, 16, 'center');
    }
    if (n.station) station(ctx, n, n.station, c);
  }
  for (const sw of SWITCHES) {
    ctx.fillStyle = c['surface-200'];
    ctx.strokeStyle = c.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(sw.x, sw.y, 21, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = c.ink;
    text(ctx, String(sw.num), sw.x, sw.y + 7, 20, 'center');
  }

  for (const cow of s.cows) {
    ctx.fillStyle = c.ink;
    roundRect(ctx, cow.x - 20, cow.y - 13, 40, 26, 4);
    ctx.fillStyle = c['surface-100'];
    ctx.fillRect(cow.x - 8, cow.y - 4, 4, 4);
    ctx.fillRect(cow.x + 4, cow.y - 4, 4, 4);
    ctx.fillStyle = c.ink;
    text(
      ctx,
      `${cow.name} · antippen`,
      Math.min(Math.max(cow.x, 180), WIDTH - 260),
      cow.y - 20,
      16,
      'center',
    );
  }

  for (const t of s.trains) train(ctx, t, c);

  // Kopfzeile: Zeit, Leben, Kombo
  ctx.fillStyle = c.ink;
  const m = Math.floor(s.timeLeft / 60);
  const sec = Math.floor(s.timeLeft % 60);
  text(ctx, `${m}:${String(sec).padStart(2, '0')}`, 24, 38, 26);
  text(ctx, `x${s.combo}`, 130, 38, 26);
  for (let i = 0; i < LIVES; i++) {
    ctx.strokeStyle = c.ink;
    ctx.lineWidth = 2;
    ctx.strokeRect(200 + i * 28, 19, 18, 18);
    if (i < s.lives) ctx.fillRect(200 + i * 28, 19, 18, 18);
  }

  for (const f of floating) {
    ctx.globalAlpha = Math.min(1, f.life);
    ctx.fillStyle = c.ink;
    text(ctx, f.text, Math.min(Math.max(f.x, 220), WIDTH - 220), f.y, 18, 'center');
  }
  ctx.globalAlpha = 1;
}

function curve(
  ctx: CanvasRenderingContext2D,
  e: (typeof EDGES)[number],
  color: string,
  width: number,
) {
  const a = NODES[e.from] as TrackNode;
  const b = NODES[e.to] as TrackNode;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.quadraticCurveTo(e.cp.x, e.cp.y, b.x, b.y);
  ctx.stroke();
  // kleine Pfeilspitze in Fahrtrichtung auf halber Strecke
  if (width === 3) {
    const mid = quadPoint(a, e.cp, b, 0.5);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(mid.x, mid.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function station(ctx: CanvasRenderingContext2D, n: TrackNode, key: StationKey, c: Colors) {
  ctx.fillStyle = c[STATION_COLOR[key]];
  roundRect(ctx, n.x - 10, n.y - 24, 84, 48, 4);
  ctx.fillStyle = c['surface-100'];
  text(ctx, key, n.x + 32, n.y + 10, 28, 'center');
  ctx.fillStyle = c['ink-muted'];
  text(ctx, STATIONS[key].name, n.x + 74, n.y + 46, 16, 'right');
}

function train(ctx: CanvasRenderingContext2D, t: Train, c: Colors) {
  for (let k = t.wagons; k >= 1; k--) {
    const w = wagonPose(t, k, 30);
    box(ctx, w.x, w.y, w.angle, 26, 16, c['ink-muted']);
  }
  box(ctx, t.x, t.y, t.angle, 36, 22, c[STATION_COLOR[t.dest]]);
  ctx.fillStyle = c['surface-100'];
  text(ctx, t.dest, t.x, t.y + 6, 17, 'center');
  if (t.brake > 0 || t.blocked) {
    // Halt-Symbol: zwei Balken über der Lok
    ctx.fillStyle = c.ink;
    ctx.fillRect(t.x - 7, t.y - 30, 5, 12);
    ctx.fillRect(t.x + 2, t.y - 30, 5, 12);
  }
}

function box(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  w: number,
  h: number,
  color: string,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = color;
  roundRect(ctx, -w / 2, -h / 2, w, h, 4);
  ctx.restore();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

function text(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  size: number,
  align: CanvasTextAlign = 'left',
) {
  ctx.font = `500 ${size}px ${MONO}`;
  ctx.textAlign = align;
  ctx.fillText(value, x, y);
}
