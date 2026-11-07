import type { Rng } from '@core/sdk';

// ---------- Feld ----------

export const COLS = 13;
export const ROWS = 11;
/** Zeichen in `tiles`: Boden, feste Wand, Kiste (sprengbar) */
export const FLOOR = '.';
export const WALL = '#';
export const BOX = '+';

export type Item = 'bomb' | 'fire' | 'speed';
/** Zeichen in `loot` (unter Kisten versteckt, sichtbar sobald dort Boden ist) */
const ITEM_CHARS: Record<Item, string> = { bomb: 'b', fire: 'f', speed: 's' };
const CHAR_ITEMS: Record<string, Item> = { b: 'bomb', f: 'fire', s: 'speed' };

export type Dir = 'up' | 'down' | 'left' | 'right';
const DELTA: Record<Dir, [number, number]> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};
const DIRS: readonly Dir[] = ['up', 'down', 'left', 'right'];
const OPPOSITE: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' };

// ---------- Regeln ----------

export const MAX_PLAYERS = 4;
/** Startfelder in den Ecken, Platz 0 oben links, dann im Uhrzeigersinn */
export const SPAWNS: readonly [number, number][] = [
  [1, 1],
  [COLS - 2, ROWS - 2],
  [COLS - 2, 1],
  [1, ROWS - 2],
];
export const FUSE = 2.2;
export const FLAME_TIME = 0.5;
export const PLAYER_SPEED = 3.4;
export const SPEED_STEP = 0.6;
export const MAX_SPEED = 5.8;
export const MAX_BOMBS = 6;
export const MAX_RANGE = 7;
export const BOX_CHANCE = 0.62;
export const LOOT_CHANCE = 0.3;
/** So nah (in Feldern) müssen Monster und Spieler sein, damit es den Spieler erwischt */
export const TOUCH = 0.6;
export const CLEAR_PAUSE = 1.6;

export const POINTS = { box: 10, mob: 100, stage: 500, kill: 100 } as const;

export interface Level {
  name: 'Leicht' | 'Mittel' | 'Schwer';
  /** Monster in Stufe 1, danach eins mehr pro Stufe */
  mobs: number;
  mobSpeed: number;
  /** Punkte-Faktor, damit Leicht keine Schwer-Rekorde schlägt */
  factor: number;
  /** Wie oft ein Monster an einer Kreuzung den Spieler jagt statt umherzustreifen (0 bis 1) */
  chase: number;
}
export const LEVELS: readonly Level[] = [
  { name: 'Leicht', mobs: 2, mobSpeed: 1.6, factor: 1, chase: 0.15 },
  { name: 'Mittel', mobs: 3, mobSpeed: 2.2, factor: 2, chase: 0.35 },
  { name: 'Schwer', mobs: 4, mobSpeed: 2.9, factor: 3, chase: 0.6 },
];
export const DEFAULT_LEVEL = 1;
export const MAX_MOBS = 10;

// ---------- Zustand ----------

/** Etwas, das sich von Feld zu Feld bewegt. Position = (x, y) + Richtung * t */
export interface Mover {
  x: number;
  y: number;
  dir: Dir | null;
  t: number;
  speed: number;
  /** Blickrichtung (letzte Bewegung) */
  face: Dir;
}

export interface Player extends Mover {
  seat: number;
  alive: boolean;
  bombs: number;
  range: number;
  kills: number;
}

export type Mob = Mover;

export interface Bomb {
  x: number;
  y: number;
  fuse: number;
  range: number;
  owner: number;
}

export interface Flame {
  x: number;
  y: number;
  ttl: number;
  /** Wer gezündet hat (für Abschüsse im Duell) */
  owner: number;
}

export type GameEvent = 'place' | 'boom' | 'pickup' | 'death' | 'mob' | 'clear';

export type Mode = 'solo' | 'versus';

export interface State {
  mode: Mode;
  level: Level;
  stage: number;
  tiles: string;
  loot: string;
  players: Player[];
  mobs: Mob[];
  bombs: Bomb[];
  flames: Flame[];
  score: number;
  /** Solo: Zeit bis zur nächsten Stufe, nachdem alle Monster weg sind */
  clearIn: number | null;
  over: boolean;
  /** Duell: Platz des Siegers, `null` bei Unentschieden */
  winner: number | null;
  events: GameEvent[];
}

export interface PlayerInput {
  /** Gehaltene Richtung */
  dir: Dir | null;
  /** Bombe legen (ein Druck, nicht gehalten) */
  bomb: boolean;
}
export const NO_INPUT: PlayerInput = { dir: null, bomb: false };

// ---------- Hilfen ----------

const idx = (x: number, y: number) => y * COLS + x;
export const tileAt = (s: Pick<State, 'tiles'>, x: number, y: number) =>
  x < 0 || y < 0 || x >= COLS || y >= ROWS ? WALL : (s.tiles[idx(x, y)] ?? WALL);
const setChar = (str: string, i: number, c: string) => str.slice(0, i) + c + str.slice(i + 1);

export function itemAt(s: Pick<State, 'tiles' | 'loot'>, x: number, y: number): Item | null {
  if (tileAt(s, x, y) !== FLOOR) return null;
  return CHAR_ITEMS[s.loot[idx(x, y)] ?? '.'] ?? null;
}

const isPillar = (x: number, y: number) =>
  x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1 || (x % 2 === 0 && y % 2 === 0);

/** Feld, auf dem ein Mover gerade "steht" (gerundet) */
export function cellOf(m: Mover): [number, number] {
  if (!m.dir || m.t < 0.5) return [m.x, m.y];
  const [dx, dy] = DELTA[m.dir];
  return [m.x + dx, m.y + dy];
}

/** Position in Feldern (mit Nachkommastellen) zum Zeichnen und für Berührungen */
export function posOf(m: Mover): [number, number] {
  if (!m.dir) return [m.x, m.y];
  const [dx, dy] = DELTA[m.dir];
  return [m.x + dx * m.t, m.y + dy * m.t];
}

const hasBomb = (bombs: readonly Bomb[], x: number, y: number) =>
  bombs.some((b) => b.x === x && b.y === y);

export function passable(s: Pick<State, 'tiles' | 'bombs'>, x: number, y: number): boolean {
  return tileAt(s, x, y) === FLOOR && !hasBomb(s.bombs, x, y);
}

// ---------- Aufbau ----------

/** Feld nahe der Startecken frei lassen, damit man sich nicht sofort einsperrt */
function nearSpawn(x: number, y: number, spawns: readonly [number, number][]) {
  return spawns.some(([sx, sy]) => Math.abs(sx - x) + Math.abs(sy - y) <= 1);
}

function buildField(rng: Rng, spawns: readonly [number, number][]) {
  let tiles = '';
  let loot = '';
  const items: Item[] = ['bomb', 'fire', 'speed'];
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (isPillar(x, y)) {
        tiles += WALL;
        loot += '.';
      } else if (!nearSpawn(x, y, spawns) && rng.next() < BOX_CHANCE) {
        tiles += BOX;
        loot += rng.next() < LOOT_CHANCE ? ITEM_CHARS[rng.pick(items)] : '.';
      } else {
        tiles += FLOOR;
        loot += '.';
      }
    }
  }
  return { tiles, loot };
}

function spawnPlayer(seat: number, carry?: Player): Player {
  const [x, y] = SPAWNS[seat] as [number, number];
  return {
    x,
    y,
    dir: null,
    t: 0,
    face: 'down',
    speed: carry?.speed ?? PLAYER_SPEED,
    seat,
    alive: true,
    bombs: carry?.bombs ?? 1,
    range: carry?.range ?? 2,
    kills: carry?.kills ?? 0,
  };
}

export function mobCount(level: Level, stage: number) {
  return Math.min(MAX_MOBS, level.mobs + stage - 1);
}

export function mobSpeed(level: Level, stage: number) {
  return level.mobSpeed + (stage - 1) * 0.15;
}

function spawnMobs(rng: Rng, tiles: string, level: Level, stage: number): Mob[] {
  const [px, py] = SPAWNS[0] as [number, number];
  const free: [number, number][] = [];
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (tiles[idx(x, y)] === FLOOR && Math.abs(x - px) + Math.abs(y - py) >= 6) free.push([x, y]);
    }
  }
  const spots = rng.shuffle(free).slice(0, mobCount(level, stage));
  return spots.map(([x, y]) => ({
    x,
    y,
    dir: null,
    t: 0,
    face: rng.pick(DIRS),
    speed: mobSpeed(level, stage),
  }));
}

/**
 * Neues Spiel. Solo: ein Spieler gegen Monster. Duell (`versus`): 2 bis 4 Spieler, keine Monster,
 * der Letzte gewinnt.
 */
export function createState(
  rng: Rng,
  mode: Mode = 'solo',
  players = 1,
  level: Level = LEVELS[DEFAULT_LEVEL] as Level,
): State {
  const count = mode === 'solo' ? 1 : Math.max(2, Math.min(MAX_PLAYERS, players));
  const spawns = SPAWNS.slice(0, mode === 'solo' ? 1 : count);
  const { tiles, loot } = buildField(rng, spawns);
  return {
    mode,
    level,
    stage: 1,
    tiles,
    loot,
    players: Array.from({ length: count }, (_, i) => spawnPlayer(i)),
    mobs: mode === 'solo' ? spawnMobs(rng, tiles, level, 1) : [],
    bombs: [],
    flames: [],
    score: 0,
    clearIn: null,
    over: false,
    winner: null,
    events: [],
  };
}

/** Solo: nächste Stufe mit neuem Feld, Extras bleiben */
export function nextStage(s: State, rng: Rng): State {
  const stage = s.stage + 1;
  const { tiles, loot } = buildField(rng, SPAWNS.slice(0, 1));
  return {
    ...s,
    stage,
    tiles,
    loot,
    players: s.players.map((p) => spawnPlayer(p.seat, p)),
    mobs: spawnMobs(rng, tiles, s.level, stage),
    bombs: [],
    flames: [],
    clearIn: null,
    events: [],
  };
}

// ---------- Bewegung ----------

/**
 * Bewegt einen Mover um `dt`. `want` ist die gewünschte Richtung (null = stehen bleiben).
 * Umkehren geht sofort, Abbiegen beim nächsten Feld. Mit `stopAtTile` bleibt er auf jedem
 * erreichten Feld stehen, damit neu entschieden werden kann (Monster).
 */
export function moveMover<M extends Mover>(
  m: M,
  want: Dir | null,
  dt: number,
  canEnter: (x: number, y: number) => boolean,
  stopAtTile = false,
): M {
  let { x, y, dir, t } = m;
  if (dir && want === OPPOSITE[dir]) {
    const [dx, dy] = DELTA[dir];
    x += dx;
    y += dy;
    t = 1 - t;
    dir = want;
  }
  if (!dir) {
    if (!want) return m;
    const [dx, dy] = DELTA[want];
    if (!canEnter(x + dx, y + dy)) {
      return m.dir === null && m.t === 0 && m.face === want
        ? m
        : { ...m, dir: null, t: 0, face: want };
    }
    dir = want;
    t = 0;
  }
  const face = dir;
  t += m.speed * dt;
  while (t >= 1 && dir) {
    const [dx, dy] = DELTA[dir];
    x += dx;
    y += dy;
    t -= 1;
    const next: Dir | null = stopAtTile ? null : want;
    if (next) {
      const [nx, ny] = DELTA[next];
      if (canEnter(x + nx, y + ny)) {
        dir = next;
        continue;
      }
    }
    dir = null;
    t = 0;
  }
  return { ...m, x, y, dir, t, face: dir ?? face };
}

// ---------- Gefahr (für die Monster) ----------

/** Für jedes Feld: Sekunden bis dort eine Flamme ist (0 = brennt schon, Infinity = sicher). */
export function dangerMap(s: Pick<State, 'tiles' | 'bombs' | 'flames'>): number[] {
  const danger = new Array<number>(COLS * ROWS).fill(Number.POSITIVE_INFINITY);
  const blast = (b: Bomb) => {
    const cells: [number, number][] = [[b.x, b.y]];
    for (const d of DIRS) {
      const [dx, dy] = DELTA[d];
      for (let r = 1; r <= b.range; r++) {
        const x = b.x + dx * r;
        const y = b.y + dy * r;
        const tile = tileAt(s, x, y);
        if (tile === WALL) break;
        cells.push([x, y]);
        if (tile === BOX || hasBomb(s.bombs, x, y)) break;
      }
    }
    return cells;
  };
  // Kettenreaktion: eine Bombe im Feuer einer früheren geht mit ihr hoch
  const times = s.bombs.map((b) => b.fuse);
  const blasts = s.bombs.map(blast);
  for (let changed = true; changed; ) {
    changed = false;
    s.bombs.forEach((_, i) => {
      for (const [x, y] of blasts[i] ?? []) {
        const j = s.bombs.findIndex((o) => o.x === x && o.y === y);
        if (j >= 0 && (times[j] as number) > (times[i] as number)) {
          times[j] = times[i] as number;
          changed = true;
        }
      }
    });
  }
  s.bombs.forEach((_, i) => {
    for (const [x, y] of blasts[i] ?? []) {
      danger[idx(x, y)] = Math.min(danger[idx(x, y)] as number, times[i] as number);
    }
  });
  for (const f of s.flames) danger[idx(f.x, f.y)] = 0;
  return danger;
}

/** Monster dürfen auf Boden ohne Bombe und ohne Flamme */
const mobCanEnter = (s: State, danger: readonly number[], x: number, y: number) =>
  passable(s, x, y) && (danger[idx(x, y)] ?? 0) > 0;

/**
 * Breitensuche vom Feld (x, y) aus. Liefert die erste Richtung zum nächsten Feld, für das `goal`
 * gilt, oder null. `step` entscheidet, welche Felder betreten werden dürfen.
 */
function firstStep(
  x: number,
  y: number,
  goal: (x: number, y: number) => boolean,
  step: (x: number, y: number) => boolean,
  maxDepth: number,
): Dir | null {
  const seen = new Set<number>([idx(x, y)]);
  let frontier: [number, number, Dir][] = [];
  for (const d of DIRS) {
    const [dx, dy] = DELTA[d];
    const nx = x + dx;
    const ny = y + dy;
    if (step(nx, ny)) {
      seen.add(idx(nx, ny));
      frontier.push([nx, ny, d]);
    }
  }
  for (let depth = 1; depth <= maxDepth && frontier.length > 0; depth++) {
    const next: [number, number, Dir][] = [];
    for (const [fx, fy, first] of frontier) {
      if (goal(fx, fy)) return first;
      for (const d of DIRS) {
        const [dx, dy] = DELTA[d];
        const nx = fx + dx;
        const ny = fy + dy;
        if (!seen.has(idx(nx, ny)) && step(nx, ny)) {
          seen.add(idx(nx, ny));
          next.push([nx, ny, first]);
        }
      }
    }
    frontier = next;
  }
  return null;
}

/** Wie weit Monster einen Spieler wittern (Schritte im Labyrinth) */
export const SCENT = 10;
/** Weiter als so viele Felder sucht ein Monster keinen sicheren Platz */
const FLEE_DEPTH = 12;

/**
 * Was ein Monster will:
 * - Läuft es gerade auf eine Bombe oder in die Gefahr zu, dreht es um.
 * - Steht es in der Gefahr, flieht es zum nächsten sicheren Feld.
 * - Sonst jagt es mit `level.chase` den nächsten Spieler, oder es streift umher (meist geradeaus).
 *   Felder in der Gefahr betritt es dabei nicht.
 */
export function mobWant(s: State, m: Mob, rng: Rng, danger: readonly number[]): Dir | null {
  const dangerAt = (x: number, y: number) => danger[idx(x, y)] ?? 0;
  const safe = (x: number, y: number) => dangerAt(x, y) === Number.POSITIVE_INFINITY;

  if (m.dir) {
    const [dx, dy] = DELTA[m.dir];
    const tx = m.x + dx;
    const ty = m.y + dy;
    const blocked = hasBomb(s.bombs, tx, ty) || dangerAt(tx, ty) === 0;
    const worse = !safe(tx, ty) && dangerAt(m.x, m.y) > dangerAt(tx, ty);
    return blocked || worse ? OPPOSITE[m.dir] : m.dir;
  }

  const canEnter = (x: number, y: number) => mobCanEnter(s, danger, x, y);
  if (!safe(m.x, m.y)) {
    return firstStep(m.x, m.y, safe, canEnter, FLEE_DEPTH);
  }

  const options = DIRS.filter((d) => {
    const [dx, dy] = DELTA[d];
    return canEnter(m.x + dx, m.y + dy) && safe(m.x + dx, m.y + dy);
  });
  if (options.length === 0) return null;

  if (rng.next() < s.level.chase) {
    const targets = s.players.filter((p) => p.alive).map(cellOf);
    const isTarget = (x: number, y: number) => targets.some(([px, py]) => px === x && py === y);
    const hunt = firstStep(m.x, m.y, isTarget, (x, y) => canEnter(x, y) && safe(x, y), SCENT);
    if (hunt) return hunt;
  }

  if (options.includes(m.face) && rng.next() < 0.75) return m.face;
  const notBack = options.filter((d) => d !== OPPOSITE[m.face]);
  return rng.pick(notBack.length > 0 ? notBack : options);
}

// ---------- Explosionen ----------

function explode(s: State, first: Bomb): State {
  let { tiles, bombs, score } = s;
  const flames: Flame[] = [...s.flames];
  const queue: Bomb[] = [first];
  bombs = bombs.filter((b) => b !== first);
  let boxes = 0;
  while (queue.length > 0) {
    const b = queue.shift() as Bomb;
    flames.push({ x: b.x, y: b.y, ttl: FLAME_TIME, owner: b.owner });
    for (const d of DIRS) {
      const [dx, dy] = DELTA[d];
      for (let r = 1; r <= b.range; r++) {
        const x = b.x + dx * r;
        const y = b.y + dy * r;
        const tile = tileAt({ tiles }, x, y);
        if (tile === WALL) break;
        flames.push({ x, y, ttl: FLAME_TIME, owner: b.owner });
        if (tile === BOX) {
          tiles = setChar(tiles, idx(x, y), FLOOR);
          boxes++;
          break;
        }
        const hit = bombs.find((o) => o.x === x && o.y === y);
        if (hit) {
          bombs = bombs.filter((o) => o !== hit);
          queue.push(hit);
          break;
        }
      }
    }
  }
  if (s.mode === 'solo') score += boxes * POINTS.box * s.level.factor;
  return { ...s, tiles, bombs, flames, score, events: [...s.events, 'boom'] };
}

const onFlame = (flames: readonly Flame[], x: number, y: number) =>
  flames.find((f) => f.x === x && f.y === y);

// ---------- Update ----------

/**
 * Ein Schritt der Simulation. `inputs[seat]` ist die Eingabe des Spielers auf diesem Platz.
 */
export function update(s: State, inputs: readonly PlayerInput[], dt: number, rng: Rng): State {
  if (s.over) return s;
  let st: State = { ...s, events: [] };

  if (st.clearIn !== null) {
    const clearIn = st.clearIn - dt;
    if (clearIn > 0) return { ...st, clearIn, flames: [] };
    return nextStage(st, rng);
  }

  // Spieler bewegen, Extras aufsammeln, Bomben legen
  const players: Player[] = [];
  let { loot, bombs } = st;
  const events: GameEvent[] = [];
  for (const p of st.players) {
    if (!p.alive) {
      players.push(p);
      continue;
    }
    const inp = inputs[p.seat] ?? NO_INPUT;
    let np = moveMover(p, inp.dir, dt, (x, y) => passable({ tiles: st.tiles, bombs }, x, y));
    const [cx, cy] = cellOf(np);
    const item = itemAt({ tiles: st.tiles, loot }, cx, cy);
    if (item) {
      loot = setChar(loot, idx(cx, cy), '.');
      events.push('pickup');
      if (item === 'bomb') np = { ...np, bombs: Math.min(MAX_BOMBS, np.bombs + 1) };
      if (item === 'fire') np = { ...np, range: Math.min(MAX_RANGE, np.range + 1) };
      if (item === 'speed') np = { ...np, speed: Math.min(MAX_SPEED, np.speed + SPEED_STEP) };
    }
    const own = bombs.filter((b) => b.owner === p.seat).length;
    if (inp.bomb && own < np.bombs && !hasBomb(bombs, cx, cy)) {
      bombs = [...bombs, { x: cx, y: cy, fuse: FUSE, range: np.range, owner: p.seat }];
      events.push('place');
    }
    players.push(np);
  }
  st = { ...st, players, loot, bombs, events };

  // Monster bewegen (sie kennen die gerade gelegten Bomben schon)
  const danger = dangerMap(st);
  st = {
    ...st,
    mobs: st.mobs.map((m) =>
      moveMover(m, mobWant(st, m, rng, danger), dt, (x, y) => mobCanEnter(st, danger, x, y), true),
    ),
  };

  // Zündschnüre und Flammen
  st = {
    ...st,
    bombs: st.bombs.map((b) => ({ ...b, fuse: b.fuse - dt })),
    flames: st.flames.map((f) => ({ ...f, ttl: f.ttl - dt })).filter((f) => f.ttl > 0),
  };
  for (let due = st.bombs.find((b) => b.fuse <= 0); due; due = st.bombs.find((b) => b.fuse <= 0)) {
    st = explode(st, due);
  }

  // Treffer: Flammen
  let score = st.score;
  const killers: number[] = [];
  const hitPlayers = st.players.map((p) => {
    if (!p.alive) return p;
    const [x, y] = cellOf(p);
    const f = onFlame(st.flames, x, y);
    if (!f) return p;
    if (f.owner !== p.seat) killers.push(f.owner);
    return { ...p, alive: false };
  });
  const mobsLeft = st.mobs.filter((m) => {
    const [x, y] = cellOf(m);
    return !onFlame(st.flames, x, y);
  });
  const mobsKilled = st.mobs.length - mobsLeft.length;
  if (mobsKilled > 0) {
    score += mobsKilled * POINTS.mob * st.level.factor;
    st = { ...st, events: [...st.events, 'mob'] };
  }

  // Treffer: Monster berühren Spieler
  let alivePlayers = hitPlayers.map((p) => {
    if (!p.alive) return p;
    const [px, py] = posOf(p);
    const touched = mobsLeft.some((m) => {
      const [mx, my] = posOf(m);
      return Math.abs(mx - px) + Math.abs(my - py) < TOUCH;
    });
    return touched ? { ...p, alive: false } : p;
  });
  if (st.mode === 'versus') {
    alivePlayers = alivePlayers.map((p) => ({
      ...p,
      kills: p.kills + killers.filter((k) => k === p.seat).length,
    }));
  }
  if (alivePlayers.some((p, i) => !p.alive && st.players[i]?.alive)) {
    st = { ...st, events: [...st.events, 'death'] };
  }
  st = { ...st, players: alivePlayers, mobs: mobsLeft, score };

  // Ende oder nächste Stufe
  const alive = st.players.filter((p) => p.alive);
  if (st.mode === 'solo') {
    if (alive.length === 0) return { ...st, over: true };
    if (st.mobs.length === 0) {
      return {
        ...st,
        score: st.score + POINTS.stage * st.level.factor,
        clearIn: CLEAR_PAUSE,
        events: [...st.events, 'clear'],
      };
    }
  } else if (alive.length <= 1) {
    return { ...st, over: true, winner: alive[0]?.seat ?? null };
  }
  return st;
}

/** Ein Spieler geht online mitten in der Runde: seine Figur scheidet aus. */
export function removePlayer(s: State, seat: number): State {
  const players = s.players.map((p) => (p.seat === seat ? { ...p, alive: false } : p));
  const alive = players.filter((p) => p.alive);
  if (s.mode === 'versus' && alive.length <= 1 && !s.over) {
    return { ...s, players, over: true, winner: alive[0]?.seat ?? null };
  }
  return { ...s, players };
}

export const isOver = (s: State) => s.over;

// ---------- Online ----------

/** Was der Host 20-mal pro Sekunde schickt: der ganze Zustand, er ist klein (Felder als Text). */
export type Snapshot = Omit<State, 'level'> & { levelIndex: number };

export function toSnapshot(s: State, events: GameEvent[]): Snapshot {
  const { level, ...rest } = s;
  return { ...rest, levelIndex: LEVELS.indexOf(level), events };
}

export function applySnapshot(snap: Snapshot): State {
  const { levelIndex, ...rest } = snap;
  return { ...rest, level: LEVELS[levelIndex] ?? (LEVELS[DEFAULT_LEVEL] as Level) };
}

/** Gast zwischen zwei Snapshots: nur weiterbewegen und Zeit laufen lassen, ohne Zufall und Punkte. */
export function predict(s: State, dt: number): State {
  if (s.over) return s;
  const glide = <M extends Mover>(m: M): M => {
    if (!m.dir) return m;
    return { ...m, t: Math.min(0.99, m.t + m.speed * dt) };
  };
  return {
    ...s,
    players: s.players.map((p) => (p.alive ? glide(p) : p)),
    mobs: s.mobs.map(glide),
    bombs: s.bombs.map((b) => ({ ...b, fuse: Math.max(0, b.fuse - dt) })),
    flames: s.flames.map((f) => ({ ...f, ttl: f.ttl - dt })).filter((f) => f.ttl > 0),
    events: [],
  };
}

/** Eingabe eines Gasts prüfen (kommt als JSON übers Netz) */
export function parseInput(data: unknown): PlayerInput {
  if (!data || typeof data !== 'object') return NO_INPUT;
  const d = data as Record<string, unknown>;
  const dir =
    typeof d.dir === 'string' && (DIRS as readonly string[]).includes(d.dir)
      ? (d.dir as Dir)
      : null;
  return { dir, bomb: d.bomb === true };
}
