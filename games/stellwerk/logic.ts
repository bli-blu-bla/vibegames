// Stellwerk: Stelle die Weichen, damit jeder Zug in seinen Bahnhof fährt.
// Pure Funktionen: update(state, dt, rng) liefert den neuen Zustand plus Ereignisse dieses Schritts.
// Online im Koop rechnet nur der Host. Der Gast bekommt Snapshots (ohne Spur) und schickt Eingaben.
import type { Rng } from '@core/sdk';
import {
  EDGES,
  type Edge,
  edgePoint,
  NODES,
  OUT,
  type Point,
  STATION_KEYS,
  STATIONS,
  type StationKey,
  SWITCHES,
  type TrackNode,
} from './network.ts';

export const SHIFT_SECONDS = 180;
export const LIVES = 3;
const TRAIL_MAX = 90;
const CRASH_DISTANCE = 26;
const COW_DISTANCE = 34;
const BRAKE_SECONDS = 3.5;

const TRAIN_TYPES = [
  { prefix: 'ICE', speed: 1.28, wagons: 2 },
  { prefix: 'RB', speed: 0.88, wagons: 2 },
  { prefix: 'IC', speed: 1.05, wagons: 3 },
  { prefix: 'RE', speed: 0.96, wagons: 2 },
  { prefix: 'TGV', speed: 1.35, wagons: 2 },
];
const COW_NAMES = ['Kuh Berta', 'Alpaka Horst', 'Biber mit Bauhelm', 'Schaf Wolle'];

export interface Pose extends Point {
  angle: number;
}

export interface Train extends Pose {
  id: number;
  code: string;
  dest: StationKey;
  edge: number;
  dist: number;
  speed: number;
  wagons: number;
  brake: number;
  blocked: boolean;
  /** Letzte Positionen der Lok, neueste zuerst (für die Wagen) */
  trail: Pose[];
}

export interface Cow extends Point {
  id: number;
  name: string;
  timer: number;
}

export type GameEvent =
  | { type: 'arrived'; correct: boolean; points: number; at: Point; text: string }
  | { type: 'crash'; at: Point; text: string }
  | { type: 'cow'; at: Point; text: string }
  | { type: 'cleared'; points: number; at: Point; text: string };

export interface State {
  /** Aktiver Zweig pro Weiche (0 oder 1) */
  switches: Record<string, number>;
  trains: Train[];
  cows: Cow[];
  score: number;
  combo: number;
  lives: number;
  timeLeft: number;
  spawnIn: number;
  cowIn: number;
  nextId: number;
  delivered: number;
  events: GameEvent[];
}

export function createState(): State {
  return {
    switches: Object.fromEntries(SWITCHES.map((s) => [s.id, 0])),
    trains: [],
    cows: [],
    score: 0,
    combo: 1,
    lives: LIVES,
    timeLeft: SHIFT_SECONDS,
    spawnIn: 1,
    cowIn: 12,
    nextId: 101,
    delivered: 0,
    events: [],
  };
}

export const isOver = (s: State) => s.lives <= 0 || s.timeLeft <= 0;

/** Schwierigkeit steigt über die Schicht: mehr und schnellere Züge. */
export function difficulty(s: State) {
  const t = 1 - s.timeLeft / SHIFT_SECONDS;
  return {
    spawnInterval: 7 - 3 * t,
    maxTrains: 4 + Math.floor(3 * t),
    baseSpeed: 90 + 30 * t,
  };
}

// ---------- Aktionen ----------

export function toggleSwitch(s: State, id: string): State {
  return setSwitch(s, id, (s.switches[id] ?? 0) + 1);
}

/** Weiche auf einen festen Zweig stellen (online eindeutig, auch wenn beide gleichzeitig tippen). */
export function setSwitch(s: State, id: string, branch: number): State {
  if (!(id in s.switches)) return s;
  const branches = OUT[id]?.length ?? 1;
  return { ...s, switches: { ...s.switches, [id]: branch % branches } };
}

export function toggleBrake(s: State, trainId: number): State {
  return {
    ...s,
    trains: s.trains.map((t) =>
      t.id === trainId ? { ...t, brake: t.brake > 0 ? 0 : BRAKE_SECONDS } : t,
    ),
  };
}

export function clearCow(s: State, cowId: number): State {
  const cow = s.cows.find((c) => c.id === cowId);
  if (!cow) return s;
  const points = 50 * s.combo;
  return {
    ...s,
    score: s.score + points,
    cows: s.cows.filter((c) => c.id !== cowId),
    events: [
      ...s.events,
      { type: 'cleared', points, at: cow, text: `${cow.name} umgeleitet +${points}` },
    ],
  };
}

export type Hit =
  | { kind: 'cow'; id: number }
  | { kind: 'switch'; id: string }
  | { kind: 'train'; id: number };

/** Was liegt an Punkt (x, y)? Kühe vor Weichen vor Zügen. */
export function hitTest(s: State, p: Point): Hit | null {
  const near = (q: Point, r: number) => Math.hypot(p.x - q.x, p.y - q.y) < r;
  const cow = s.cows.find((c) => near(c, 40));
  if (cow) return { kind: 'cow', id: cow.id };
  const sw = SWITCHES.filter((n) => near(n, 48)).sort(
    (a, b) => Math.hypot(p.x - a.x, p.y - a.y) - Math.hypot(p.x - b.x, p.y - b.y),
  )[0];
  if (sw) return { kind: 'switch', id: sw.id };
  const train = s.trains.find((t) => near(t, 34));
  return train ? { kind: 'train', id: train.id } : null;
}

// ---------- Simulation ----------

function spawnTrain(s: State, rng: Rng): State {
  const { maxTrains, baseSpeed } = difficulty(s);
  if (s.trains.length >= maxTrains) return s;
  const free = ['SPAWN_N', 'SPAWN_S'].filter((id) => {
    const n = NODES[id] as TrackNode;
    return !s.trains.some((t) => Math.hypot(t.x - n.x, t.y - n.y) < 110);
  });
  if (free.length === 0) return s;
  const spawn = NODES[rng.pick(free)] as TrackNode;
  const type = rng.pick(TRAIN_TYPES);
  const train: Train = {
    id: s.nextId,
    code: `${type.prefix} ${s.nextId}`,
    dest: rng.pick(STATION_KEYS),
    edge: OUT[spawn.id]?.[0] ?? 0,
    dist: 0,
    speed: baseSpeed * type.speed,
    wagons: type.wagons,
    brake: 0,
    blocked: false,
    x: spawn.x,
    y: spawn.y,
    angle: 0,
    trail: initialTrail(spawn),
  };
  return { ...s, trains: [...s.trains, train], nextId: s.nextId + 1 };
}

function initialTrail(p: Point): Pose[] {
  return Array.from({ length: 40 }, (_, i) => ({ x: p.x - i * 2, y: p.y, angle: 0 }));
}

function spawnCow(s: State, rng: Rng): State {
  if (s.cows.length >= 2) return s;
  // Nicht direkt an den Tunneln, damit man reagieren kann
  const candidates = EDGES.map((_, i) => i).filter(
    (i) => !(EDGES[i] as Edge).from.startsWith('SPAWN'),
  );
  const at = edgePoint(rng.pick(candidates), 0.5);
  if (s.cows.some((c) => Math.hypot(c.x - at.x, c.y - at.y) < 80)) return s;
  const cow: Cow = { id: s.nextId, name: rng.pick(COW_NAMES), x: at.x, y: at.y, timer: 18 };
  return {
    ...s,
    cows: [...s.cows, cow],
    nextId: s.nextId + 1,
    events: [...s.events, { type: 'cow', at, text: `${cow.name} steht auf dem Gleis!` }],
  };
}

/** Bewegt einen Zug um `distance` weiter. Liefert den Zug oder den Zielbahnhof, wenn er ankommt. */
function advance(t: Train, distance: number, switches: Record<string, number>): Train | StationKey {
  let { edge, dist } = t;
  dist += distance;
  for (;;) {
    const e = EDGES[edge] as Edge;
    if (dist < e.length) break;
    dist -= e.length;
    const reached = NODES[e.to] as TrackNode;
    if (reached.station) return reached.station;
    const out = OUT[reached.id] ?? [];
    edge = out[reached.type === 'switch' ? (switches[reached.id] ?? 0) : 0] ?? out[0] ?? edge;
  }
  const e = EDGES[edge] as Edge;
  const pose = edgePoint(edge, dist / e.length);
  const moved = Math.hypot(pose.x - t.x, pose.y - t.y) > 0.5;
  return {
    ...t,
    edge,
    dist,
    ...pose,
    trail: moved ? [pose, ...t.trail].slice(0, TRAIL_MAX) : t.trail,
  };
}

export function update(state: State, dt: number, rng: Rng): State {
  if (isOver(state)) return state;
  let s: State = { ...state, events: [], timeLeft: Math.max(0, state.timeLeft - dt) };

  s.spawnIn -= dt;
  if (s.spawnIn <= 0) {
    s = spawnTrain(s, rng);
    s.spawnIn = difficulty(s).spawnInterval * (0.85 + rng.next() * 0.3);
  }
  s.cowIn -= dt;
  if (s.cowIn <= 0) {
    s = spawnCow(s, rng);
    s.cowIn = 14;
  }
  s.cows = s.cows.map((c) => ({ ...c, timer: c.timer - dt })).filter((c) => c.timer > 0);

  const events = [...s.events];
  const trains: Train[] = [];
  let { score, combo, lives, delivered } = s;

  for (const t of s.trains) {
    const cow = s.cows.find((c) => Math.hypot(t.x - c.x, t.y - c.y) < COW_DISTANCE);
    const brake = Math.max(0, t.brake - dt);
    const stopped = brake > 0 || !!cow;
    const moved = advance({ ...t, brake, blocked: !!cow }, stopped ? 0 : t.speed * dt, s.switches);
    if (typeof moved !== 'string') {
      trains.push(moved);
      continue;
    }
    const station = NODES[`ST_${moved}`] as TrackNode;
    if (moved === t.dest) {
      const points = 120 * combo;
      score += points;
      delivered += 1;
      combo = Math.min(8, combo + 1);
      events.push({
        type: 'arrived',
        correct: true,
        points,
        at: station,
        text: `Pünktlich! +${points}`,
      });
    } else {
      lives -= 1;
      combo = 1;
      events.push({
        type: 'arrived',
        correct: false,
        points: 0,
        at: station,
        text: `${t.code} wollte nach ${STATIONS[t.dest].name}!`,
      });
    }
  }

  // Zusammenstöße: beide Züge sind weg, ein Leben weniger
  const crashed = new Set<number>();
  for (let i = 0; i < trains.length; i++) {
    for (let j = i + 1; j < trains.length; j++) {
      const a = trains[i] as Train;
      const b = trains[j] as Train;
      if (crashed.has(a.id) || crashed.has(b.id)) continue;
      if (Math.hypot(a.x - b.x, a.y - b.y) < CRASH_DISTANCE) {
        crashed.add(a.id).add(b.id);
        lives -= 1;
        combo = 1;
        events.push({
          type: 'crash',
          at: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
          text: `${a.code} und ${b.code} kollidiert!`,
        });
      }
    }
  }

  return {
    ...s,
    trains: trains.filter((t) => !crashed.has(t.id)),
    score,
    combo,
    lives: Math.max(0, lives),
    delivered,
    events,
  };
}

/** Position des k-ten Wagens (k ab 1), `gap` Pixel Abstand entlang der Spur der Lok. */
export function wagonPose(t: Train, k: number, gap = 26): Pose {
  let remaining = k * gap;
  let prev: Pose = t;
  for (const p of t.trail) {
    const d = Math.hypot(p.x - prev.x, p.y - prev.y);
    if (d >= remaining) {
      const f = remaining / d;
      return { x: prev.x + (p.x - prev.x) * f, y: prev.y + (p.y - prev.y) * f, angle: p.angle };
    }
    remaining -= d;
    prev = p;
  }
  return prev;
}

// ---------- Online (Koop) ----------

/** Zug ohne Spur: Die Wagen rechnet der Gast selbst nach. */
export type TrainSnap = Omit<Train, 'trail'>;
export interface Snapshot extends Omit<State, 'trains'> {
  trains: TrainSnap[];
}

/** Was der Host verschickt. `events` sind alle Ereignisse seit dem letzten Snapshot. */
export function toSnapshot(s: State, events: GameEvent[]): Snapshot {
  return { ...s, events, trains: s.trains.map(({ trail: _, ...t }) => t) };
}

/** Snapshot beim Gast übernehmen. Die Spuren der Züge laufen lokal weiter. */
export function applySnapshot(prev: State, snap: Snapshot): State {
  const trains = snap.trains.map((t): Train => {
    const old = prev.trains.find((o) => o.id === t.id);
    if (!old) return { ...t, trail: initialTrail(t) };
    const moved = Math.hypot(t.x - old.x, t.y - old.y) > 0.5;
    const pose = { x: t.x, y: t.y, angle: t.angle };
    return { ...t, trail: moved ? [pose, ...old.trail].slice(0, TRAIL_MAX) : old.trail };
  });
  return { ...snap, trains };
}

/**
 * Beim Gast zwischen zwei Snapshots: Züge fahren weiter, sonst passiert nichts
 * (keine Ankunft, kein Zufall). Der nächste Snapshot korrigiert.
 */
export function predict(s: State, dt: number): State {
  if (isOver(s)) return s;
  const trains = s.trains.map((t) => {
    const blocked = t.brake > 0 || t.blocked;
    const moved = advance(t, blocked ? 0 : t.speed * dt, s.switches);
    return typeof moved === 'string' ? t : moved;
  });
  return { ...s, trains, events: [] };
}

/** Eingabe des Gasts, vom Host angewendet. */
export type Action =
  | { kind: 'switch'; id: string; branch: number }
  | { kind: 'cow'; id: number }
  | { kind: 'train'; id: number };

export function applyAction(s: State, a: Action): State {
  if (a.kind === 'switch') return setSwitch(s, a.id, a.branch);
  if (a.kind === 'cow') return clearCow(s, a.id);
  return toggleBrake(s, a.id);
}
