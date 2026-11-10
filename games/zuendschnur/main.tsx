import {
  type ColorToken,
  createRng,
  type GameProps,
  keyToDirection,
  playSfx,
  useCanvas,
  useColors,
  useGameLoop,
  useJoystick,
  useKeyDown,
  useNet,
  usePressedKeys,
} from '@core/sdk';
import { Bomb, User, Users } from '@phosphor-icons/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  applySnapshot,
  BOX,
  COLS,
  createState,
  DEFAULT_LEVEL,
  type Dir,
  FUSE,
  type GameEvent,
  type Item,
  itemAt,
  LEVELS,
  type Level,
  NO_INPUT,
  type Player,
  type PlayerInput,
  parseInput,
  posOf,
  predict,
  ROWS,
  removePlayer,
  type Snapshot,
  type State,
  tileAt,
  toSnapshot,
  update,
  WALL,
} from './logic.ts';
import { FLAME } from './palette.ts';
import './style.css';

type Colors = Record<ColorToken, string>;

const TILE = 32;
const WIDTH = COLS * TILE;
const HEIGHT = ROWS * TILE;
/** Am PC darf das Feld größer sein: gezeichnet wird in TILE-Einheiten, die Leinwand ist SCALE-mal so groß */
const SCALE = 1.5;
/** Höchstbreite: SCALE-fache Größe, aber nie höher als das Fenster (minus Leiste und Knöpfe) erlaubt */
const MAX_FIELD_WIDTH = `min(${WIDTH * SCALE}px, max(${WIDTH}px, calc((100dvh - 300px) * ${COLS} / ${ROWS})))`;
const SNAPSHOT_HZ = 20;
const MONO = '"Geist Mono", ui-monospace, monospace';
const PIXEL = '"Pixelify Sans", system-ui, sans-serif';
/** Farbe pro Platz. Dazu trägt jede Figur ihre Nummer, Farbe ist nie allein die Unterscheidung. */
const SEAT_COLORS: readonly ColorToken[] = ['accent', 'game-sky', 'game-rose', 'game-sand'];

/** Tasten pro Spieler. Allein und online gelten beide Sätze für Spieler 1. */
const P1_KEYS: Record<string, Dir> = { w: 'up', a: 'left', s: 'down', d: 'right' };
const P2_KEYS: Record<string, Dir> = {
  ArrowUp: 'up',
  ArrowLeft: 'left',
  ArrowDown: 'down',
  ArrowRight: 'right',
};

type Setup = 'solo' | 'local';

const DELTAS: Record<Dir, [number, number]> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

export default function Zuendschnur({ api, paused }: GameProps) {
  const { net } = api;
  const guest = net?.role === 'guest';
  const mySeat = net?.seat ?? 0;
  const rng = useMemo(() => createRng(api.seed), [api.seed]);

  const [level, setLevel] = useState<number>(() => {
    const saved = api.storage.get('level', DEFAULT_LEVEL);
    return saved >= 0 && saved < LEVELS.length ? saved : DEFAULT_LEVEL;
  });
  const [setup, setSetup] = useState<Setup>(() =>
    api.storage.get<Setup>('setup', 'solo') === 'local' ? 'local' : 'solo',
  );
  const [started, setStarted] = useState(net !== null);
  const startedRef = useRef(started);

  const fresh = (lv: number, su: Setup): State => {
    if (net) return createState(rng, 'versus', net.players);
    if (su === 'local') return createState(rng, 'versus', 2);
    return createState(rng, 'solo', 1, LEVELS[lv] as Level);
  };
  const state = useRef<State>(fresh(level, setup));
  const [hud, setHud] = useState(() => hudText(state.current, mySeat, Boolean(net)));

  const local2 = !net && setup === 'local';
  const keys = usePressedKeys();
  /** Zuletzt gedrückte Richtung pro lokalem Spieler (hat Vorrang vor anderen gehaltenen) */
  const lastDir = useRef<(Dir | null)[]>([null, null]);
  const bombPress = useRef([false, false]);
  const touchDir = useRef<Dir | null>(null);
  const guestInputs = useRef<PlayerInput[]>([]);
  const sentInput = useRef({ dir: null as Dir | null, at: 0 });
  const outbox = useRef<GameEvent[]>([]);
  const sinceSnap = useRef(0);
  const reported = useRef(false);

  const colors = useColors();
  const canvas = useCanvas(WIDTH * SCALE, HEIGHT * SCALE);
  const fieldRef = useRef<HTMLDivElement>(null);

  const markStarted = () => {
    if (startedRef.current) return;
    startedRef.current = true;
    setStarted(true);
  };

  const chooseLevel = (i: number) => {
    setLevel(i);
    api.storage.set('level', i);
    state.current = fresh(i, setup);
    setHud(hudText(state.current, mySeat, false));
  };
  const chooseSetup = (su: Setup) => {
    setSetup(su);
    api.storage.set('setup', su);
    state.current = fresh(level, su);
    setHud(hudText(state.current, mySeat, false));
  };

  // ---------- Eingabe ----------

  useKeyDown((key) => {
    const lower = key.length === 1 ? key.toLowerCase() : key;
    const p1 = P1_KEYS[lower];
    const p2 = P2_KEYS[key];
    if (local2) {
      if (p1) lastDir.current[0] = p1;
      if (p2) lastDir.current[1] = p2;
      if (key === ' ') bombPress.current[0] = true;
      if (key === 'Enter') bombPress.current[1] = true;
    } else {
      const dir = keyToDirection(key);
      if (dir) lastDir.current[0] = dir;
      if (key === ' ' || key === 'Enter') bombPress.current[0] = true;
    }
    if (p1 || p2 || key === ' ' || key === 'Enter') markStarted();
  }, !paused);

  useJoystick(
    fieldRef,
    ({ x, y }) => {
      if (Math.hypot(x, y) < 0.4) touchDir.current = null;
      else if (Math.abs(x) > Math.abs(y)) touchDir.current = x > 0 ? 'right' : 'left';
      else touchDir.current = y > 0 ? 'up' : 'down';
      if (touchDir.current) markStarted();
    },
    !paused,
  );

  const heldDir = (player: number, map: Record<string, Dir>[]): Dir | null => {
    const held = (dir: Dir) =>
      map.some((m) =>
        Object.entries(m).some(
          ([k, d]) => d === dir && (keys.current.has(k) || keys.current.has(k.toUpperCase())),
        ),
      );
    const last = lastDir.current[player];
    if (last && held(last)) return last;
    for (const m of map) {
      for (const [k, d] of Object.entries(m)) {
        if (keys.current.has(k) || keys.current.has(k.toUpperCase())) return d;
      }
    }
    return null;
  };

  /** Eingaben der Spieler an diesem Gerät, Index = Platz im lokalen Spiel */
  const readLocal = (): PlayerInput[] => {
    const take = (i: number) => {
      const b = bombPress.current[i] === true;
      bombPress.current[i] = false;
      return b;
    };
    if (local2) {
      return [
        { dir: heldDir(0, [P1_KEYS]) ?? touchDir.current, bomb: take(0) },
        { dir: heldDir(1, [P2_KEYS]), bomb: take(1) },
      ];
    }
    return [{ dir: heldDir(0, [P1_KEYS, P2_KEYS]) ?? touchDir.current, bomb: take(0) }];
  };

  // ---------- Online ----------

  useNet<unknown>(net, 'input', (data, seat) => {
    if (guest || seat <= 0) return;
    const inp = parseInput(data);
    const prev = guestInputs.current[seat] ?? NO_INPUT;
    // Bombe bleibt gemerkt, bis der nächste Schritt sie gelegt hat
    guestInputs.current[seat] = { dir: inp.dir, bomb: prev.bomb || inp.bomb };
  });

  useNet<number>(net, '$left', (seat) => {
    if (!guest) state.current = removePlayer(state.current, seat);
  });

  useNet<Snapshot>(net, 'snap', (snap) => {
    if (guest) apply(applySnapshot(snap));
  });

  // ---------- Ablauf ----------

  const apply = (next: State) => {
    for (const ev of next.events) {
      if (ev === 'boom') playSfx('hit');
      else if (ev === 'pickup') playSfx('coin');
      else if (ev === 'place') playSfx('click');
      else if (ev === 'mob') playSfx('coin');
      else if (ev === 'clear') playSfx('win');
      else if (ev === 'death') playSfx('lose');
      else if (ev === 'kick') playSfx('jump');
      else if (ev === 'shield') playSfx('hit');
    }
    if (net && !guest) outbox.current.push(...next.events);
    const prev = state.current;
    state.current = { ...next, events: [] };

    const score = scoreOf(next, mySeat, Boolean(net), local2);
    if (score !== scoreOf(prev, mySeat, Boolean(net), local2)) api.setScore(score);
    const text = hudText(next, mySeat, Boolean(net));
    setHud((h) => (h === text ? h : text));

    if (next.over && !reported.current) {
      reported.current = true;
      api.setScore(score);
      api.gameOver(resultOf(next, mySeat, Boolean(net)));
    }
  };

  useGameLoop((dt) => {
    const local = readLocal();
    if (guest) {
      const mine = local[0] ?? NO_INPUT;
      const now = performance.now();
      if (mine.bomb || mine.dir !== sentInput.current.dir || now - sentInput.current.at > 250) {
        net?.send('input', mine);
        sentInput.current = { dir: mine.dir, at: now };
      }
      state.current = predict(state.current, dt);
    } else if (startedRef.current) {
      const inputs = net
        ? [
            local[0] ?? NO_INPUT,
            ...state.current.players.slice(1).map((p) => guestInputs.current[p.seat] ?? NO_INPUT),
          ]
        : local;
      const next = update(state.current, inputs, dt, rng);
      guestInputs.current = guestInputs.current.map((g) => (g ? { ...g, bomb: false } : g));
      apply(next);
      if (net) {
        sinceSnap.current += dt;
        if (sinceSnap.current >= 1 / SNAPSHOT_HZ || next.over) {
          sinceSnap.current = 0;
          net.send('snap', toSnapshot(state.current, outbox.current));
          outbox.current = [];
        }
      }
    }
    canvas.draw((ctx) => {
      ctx.scale(SCALE, SCALE);
      drawField(ctx, state.current, colors, startedRef.current, local2);
    });
  }, !paused);

  // Auch ohne laufende Schleife zeichnen (Start, Pause, Theme-Wechsel)
  // biome-ignore lint/correctness/useExhaustiveDependencies: hud und setup lösen bewusst ein Neuzeichnen aus
  useEffect(() => {
    canvas.draw((ctx) => {
      ctx.scale(SCALE, SCALE);
      drawField(ctx, state.current, colors, startedRef.current, local2);
    });
  }, [colors, canvas, started, hud, setup, local2]);

  const canChoose = !net && !started && !paused;

  return (
    <div className="zs-root">
      {!net && (
        <div className="zs-top" style={{ maxWidth: MAX_FIELD_WIDTH }}>
          <fieldset className="zs-choice" aria-label="Spieler">
            {(['solo', 'local'] as const).map((su) => {
              const label = su === 'solo' ? 'Allein gegen Monster' : 'Zu zweit an einem Gerät';
              return (
                <button
                  key={su}
                  type="button"
                  className={setup === su ? 'btn btn-icon btn-primary' : 'btn btn-icon'}
                  aria-pressed={setup === su}
                  aria-label={label}
                  title={label}
                  disabled={!canChoose}
                  onClick={() => chooseSetup(su)}
                >
                  {su === 'solo' ? <User size={20} /> : <Users size={20} />}
                </button>
              );
            })}
          </fieldset>
          {setup === 'solo' && (
            <fieldset className="zs-choice" aria-label="Schwierigkeit">
              {LEVELS.map((l, i) => (
                <button
                  key={l.name}
                  type="button"
                  className={level === i ? 'btn btn-primary' : 'btn'}
                  aria-pressed={level === i}
                  disabled={!canChoose}
                  onClick={() => chooseLevel(i)}
                >
                  {l.name}
                </button>
              ))}
            </fieldset>
          )}
        </div>
      )}
      <div className="zs-field" ref={fieldRef}>
        <canvas
          {...canvas.props}
          style={{ ...canvas.props.style, maxWidth: MAX_FIELD_WIDTH }}
          role="img"
          aria-label={`Spielfeld: ${hud}`}
        />
      </div>
      <p className="t-mono-small muted zs-hud" aria-live="polite">
        {hud}
      </p>
      <button
        type="button"
        className="btn zs-bomb"
        disabled={paused}
        onPointerDown={(e) => {
          e.preventDefault();
          bombPress.current[0] = true;
          markStarted();
        }}
      >
        <Bomb size={20} weight="bold" /> Bombe
      </button>
      {local2 && (
        <p className="t-small muted">
          Spieler 1: WASD und Leertaste · Spieler 2: Pfeiltasten und Enter
        </p>
      )}
    </div>
  );
}

// ---------- Texte und Ergebnis ----------

function scoreOf(s: State, seat: number, online: boolean, local2: boolean) {
  if (s.mode === 'solo') return s.score;
  if (online) return (s.players[seat]?.kills ?? 0) * 100;
  return local2 ? 0 : s.score;
}

function statsOf(p: State['players'][number] | undefined) {
  const extras = `${p?.kick ? ' · Kick' : ''}${p?.shield ? ' · Schild' : ''}`;
  return `Bomben ${p?.bombs ?? 0} · Reichweite ${p?.range ?? 0}${extras}`;
}

function hudText(s: State, seat: number, online: boolean) {
  if (s.mode === 'solo') {
    return `${s.level.name} · Stufe ${s.stage} · Monster ${s.mobs.length} · ${statsOf(s.players[0])}`;
  }
  const alive = s.players.filter((p) => p.alive).length;
  const head = `Duell · ${alive} von ${s.players.length} übrig`;
  if (online) return `${head} · Du bist Spieler ${seat + 1} · ${statsOf(s.players[seat])}`;
  return `${head} · ${s.players.map((p, i) => `S${i + 1}: ${statsOf(p)}`).join(' | ')}`;
}

function resultOf(s: State, seat: number, online: boolean) {
  if (s.mode === 'solo') {
    return {
      outcome: 'lose' as const,
      message: `Bis Stufe ${s.stage} gekommen (${s.level.name}).`,
    };
  }
  if (s.winner === null)
    return { outcome: 'draw' as const, message: 'Alle hat es gleichzeitig erwischt.' };
  if (!online) return { outcome: 'win' as const, message: `Spieler ${s.winner + 1} gewinnt.` };
  if (s.winner === seat) return { outcome: 'win' as const, message: 'Du bist als Letzter übrig.' };
  return { outcome: 'lose' as const, message: `Spieler ${s.winner + 1} gewinnt.` };
}

// ---------- Zeichnen ----------

function drawField(
  ctx: CanvasRenderingContext2D,
  s: State,
  c: Colors,
  started: boolean,
  local2: boolean,
) {
  // Wände, Kisten, Extras
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const px = x * TILE;
      const py = y * TILE;
      const tile = tileAt(s, x, y);
      if (tile === WALL) {
        ctx.fillStyle = c.line;
        ctx.fillRect(px, py, TILE, TILE);
      } else if (tile === BOX) {
        ctx.fillStyle = c['surface-200'];
        ctx.strokeStyle = c['line-strong'];
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(px + 3, py + 3, TILE - 6, TILE - 6, 4);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(px + 8, py + TILE / 2);
        ctx.lineTo(px + TILE - 8, py + TILE / 2);
        ctx.stroke();
      } else {
        const item = itemAt(s, x, y);
        if (item) drawItem(ctx, item, px, py, c);
      }
    }
  }

  // Flammen
  ctx.fillStyle = FLAME;
  for (const f of s.flames) {
    ctx.globalAlpha = Math.min(1, f.ttl / 0.2);
    ctx.beginPath();
    ctx.roundRect(f.x * TILE + 2, f.y * TILE + 2, TILE - 4, TILE - 4, 4);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Bomben: pulsieren schneller, je kürzer die Zündschnur
  for (const b of s.bombs) {
    const [sx, sy] = b.slide ? DELTAS[b.slide] : [0, 0];
    const cx = (b.x + sx * b.t) * TILE + TILE / 2;
    const cy = (b.y + sy * b.t) * TILE + TILE / 2;
    const pulse = 1 + 0.08 * Math.sin((FUSE - b.fuse) * (8 + (FUSE - b.fuse) * 6));
    // Schnur zuerst und bis tief in den Kreis, damit beim Pulsieren keine Lücke entsteht.
    // Sie brennt ab: bei 0.45 liegt das Ende am Kreisrand, bei 1 ist sie voll.
    const len = 0.45 + 0.55 * Math.max(0, b.fuse / FUSE);
    ctx.strokeStyle = FLAME;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx + 2, cy - 3);
    ctx.lineTo(cx + 2 + 6 * len, cy - 3 - 9 * len);
    ctx.stroke();
    ctx.fillStyle = c.ink;
    ctx.beginPath();
    ctx.arc(cx, cy + 2, 10 * pulse, 0, Math.PI * 2);
    ctx.fill();
  }

  // Monster: eckig mit Augen
  for (const m of s.mobs) {
    const [mx, my] = posOf(m);
    const px = mx * TILE;
    const py = my * TILE;
    ctx.fillStyle = c['game-rose'];
    ctx.beginPath();
    ctx.roundRect(px + 5, py + 6, TILE - 10, TILE - 10, 4);
    ctx.fill();
    ctx.fillStyle = c['surface-100'];
    ctx.fillRect(px + 10, py + 12, 4, 5);
    ctx.fillRect(px + TILE - 14, py + 12, 4, 5);
  }

  // Spieler: kleine Figur mit Nummer auf dem Bauch
  for (const p of s.players) {
    if (p.alive) drawFigure(ctx, p, c);
  }

  // Hinweise im Feld
  if (!started)
    banner(
      ctx,
      c,
      'Taste drücken zum Starten',
      local2 ? 'Leertaste / Enter legt Bomben' : 'Leertaste legt Bomben',
    );
  else if (s.clearIn !== null) banner(ctx, c, `Stufe ${s.stage + 1}`, 'Alle Monster erwischt');
}

/** Kleine Figur: Kopf mit Augen in Blickrichtung, Körper mit Nummer, Arme und Beine im Schritt */
function drawFigure(ctx: CanvasRenderingContext2D, p: Player, c: Colors) {
  // Nach einem abgefangenen Treffer blinkt die Figur
  if (p.guard > 0 && Math.floor(p.guard * 10) % 2 === 0) return;
  const [x, y] = posOf(p);
  const cx = x * TILE + TILE / 2;
  const cy = y * TILE + TILE / 2;
  if (p.shield) {
    ctx.strokeStyle = c[SEAT_COLORS[p.seat] ?? 'accent'];
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy - 1, 15, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Schrittphase aus der Strecke, damit die Beine im Takt der Bewegung laufen
  const swing = p.dir ? Math.sin((x + y) * Math.PI * 2) * 2.5 : 0;
  ctx.fillStyle = c[SEAT_COLORS[p.seat] ?? 'accent'];

  // Beine und Arme
  ctx.fillRect(cx - 5, cy + 6 + swing, 3.5, 7 - swing);
  ctx.fillRect(cx + 1.5, cy + 6 - swing, 3.5, 7 + swing);
  ctx.fillRect(cx - 9, cy - 2 - swing, 2.5, 7);
  ctx.fillRect(cx + 6.5, cy - 2 + swing, 2.5, 7);

  // Körper und Kopf
  ctx.beginPath();
  ctx.roundRect(cx - 6, cy - 4, 12, 11, 3);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy - 9.5, 5.5, 0, Math.PI * 2);
  ctx.fill();

  // Augen: von hinten (oben) keine
  ctx.fillStyle = c['surface-100'];
  if (p.face !== 'up') {
    const shift = p.face === 'left' ? -2 : p.face === 'right' ? 2 : 0;
    ctx.fillRect(cx - 3 + shift, cy - 11, 2, 2.5);
    ctx.fillRect(cx + 1 + shift, cy - 11, 2, 2.5);
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 9px ${MONO}`;
  ctx.fillText(String(p.seat + 1), cx, cy + 1.5);
}

function banner(ctx: CanvasRenderingContext2D, c: Colors, title: string, sub: string) {
  const w = 340;
  const h = 72;
  const x = (WIDTH - w) / 2;
  const y = (HEIGHT - h) / 2;
  ctx.fillStyle = c['surface-200'];
  ctx.strokeStyle = c['line-strong'];
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = c.ink;
  ctx.font = `600 20px ${PIXEL}`;
  ctx.fillText(title, WIDTH / 2, y + 26);
  ctx.fillStyle = c['ink-muted'];
  ctx.font = `500 12px ${MONO}`;
  ctx.fillText(sub, WIDTH / 2, y + 52);
}

function drawItem(ctx: CanvasRenderingContext2D, item: Item, px: number, py: number, c: Colors) {
  ctx.strokeStyle = c['line-strong'];
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(px + 5, py + 5, TILE - 10, TILE - 10, 4);
  ctx.stroke();
  const cx = px + TILE / 2;
  const cy = py + TILE / 2;
  ctx.fillStyle = c.ink;
  ctx.strokeStyle = c.ink;
  ctx.lineWidth = 3;
  ctx.beginPath();
  if (item === 'bomb') {
    // kleine Bombe: +1 Bombe
    ctx.arc(cx, cy + 1, 6, 0, Math.PI * 2);
    ctx.fill();
  } else if (item === 'fire') {
    // Kreuz: größere Reichweite
    ctx.moveTo(cx - 7, cy);
    ctx.lineTo(cx + 7, cy);
    ctx.moveTo(cx, cy - 7);
    ctx.lineTo(cx, cy + 7);
    ctx.stroke();
  } else if (item === 'kick') {
    // Stiefel: Bomben treten
    ctx.moveTo(cx - 3, cy - 8);
    ctx.lineTo(cx - 3, cy + 5);
    ctx.lineTo(cx + 7, cy + 5);
    ctx.stroke();
    ctx.fillRect(cx - 5, cy + 3, 13, 4);
  } else if (item === 'shield') {
    // Schild: fängt einen Treffer ab
    ctx.lineWidth = 2.5;
    ctx.moveTo(cx, cy - 8);
    ctx.lineTo(cx + 7, cy - 5);
    ctx.quadraticCurveTo(cx + 6, cy + 4, cx, cy + 8);
    ctx.quadraticCurveTo(cx - 6, cy + 4, cx - 7, cy - 5);
    ctx.closePath();
    ctx.stroke();
  } else {
    // Doppelpfeil: schneller
    ctx.moveTo(cx - 7, cy - 5);
    ctx.lineTo(cx - 2, cy);
    ctx.lineTo(cx - 7, cy + 5);
    ctx.moveTo(cx, cy - 5);
    ctx.lineTo(cx + 5, cy);
    ctx.lineTo(cx, cy + 5);
    ctx.stroke();
  }
}
