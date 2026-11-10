// Tank Arena: Top-Down-2D-Panzerspiel in einer geschlossenen Arena.
// Pure Funktionen ohne Seiteneffekte. Zufall ausschließlich über Rng aus @core/sdk.
import type { Rng } from '@core/sdk';

export const WIDTH = 480;
export const HEIGHT = 360;
export const ARENA_MARGIN = 12;

export const INITIAL_LIVES = 3;
export const ENEMY_POINTS = 10;
export const ROUND_POINTS = 100;

export const TANK_RADIUS = 13;
export const BARREL_RADIUS = 11;
export const BULLET_RADIUS = 4;
export const EXPLOSION_RADIUS = 68;
export const EXPLOSION_DURATION = 0.35;

export const PLAYER_SPEED = 125;
export const PLAYER_FIRE_COOLDOWN = 0.35;
export const PLAYER_BULLET_SPEED = 260;
export const INVULN_DURATION = 1.0;
export const BRICK_HP = 2;
export const BLOCK_SIZE = 34;

export type GameMode = 'solo' | 'coop' | 'versus';

export interface Level {
  name: 'Leicht' | 'Mittel' | 'Schwer';
  enemySpeed: number;
  enemyFireInterval: number;
  enemyBulletSpeed: number;
  /** Gewichte der Angriffsstrategien [Angriff, Flanke, Abstand] */
  planWeights: readonly [number, number, number];
  /** Wie lange ein Gegner bei einer Strategie bleibt (min, max in Sekunden) */
  planTime: readonly [number, number];
  /** Ab so vielen Zellen Wegersparnis schießt ein Gegner Mauern frei (999 = nie) */
  breachSaving: number;
}

export const LEVELS: readonly Level[] = [
  {
    name: 'Leicht',
    enemySpeed: 46,
    enemyFireInterval: 2.1,
    enemyBulletSpeed: 150,
    planWeights: [0.6, 0.1, 0.3],
    planTime: [7, 11],
    breachSaving: 999,
  },
  {
    name: 'Mittel',
    enemySpeed: 68,
    enemyFireInterval: 1.45,
    enemyBulletSpeed: 190,
    planWeights: [0.35, 0.4, 0.25],
    planTime: [5, 8],
    breachSaving: 14,
  },
  {
    name: 'Schwer',
    enemySpeed: 92,
    enemyFireInterval: 0.95,
    enemyBulletSpeed: 230,
    planWeights: [0.25, 0.55, 0.2],
    planTime: [3.5, 6],
    breachSaving: 6,
  },
];

export const DEFAULT_LEVEL = 1;

// Gegner-KI: bevorzugter Abstand, Reichweite, Reaktionszeit und Zielungenauigkeit (rad)
const ENEMY_NEAR_DIST = 110;
const ENEMY_FAR_DIST = 200;
const ENEMY_FIRE_RANGE = 280;
const ENEMY_REACTION = 0.35;
const ENEMY_AIM_TOLERANCE = 0.12; // erlaubte Abweichung der Ausrichtung beim Schuss (rad)
const ENEMY_AIM_TIME = 0.5; // so kurz vor dem Schuss richtet sich der Gegner aus
const ENEMY_TURN_RATE = 4; // rad/s

export interface Point {
  x: number;
  y: number;
}

export interface Obstacle {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  destructible: boolean;
  hp: number;
  maxHp: number;
}

export interface Barrel {
  id: number;
  x: number;
  y: number;
  radius: number;
}

export interface Explosion {
  id: number;
  x: number;
  y: number;
  radius: number;
  timer: number;
  maxTimer: number;
}

export interface Bullet {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  ownerId: number;
  fromPlayer: boolean;
}

export interface PlayerTank {
  id: 1 | 2;
  x: number;
  y: number;
  angle: number;
  lives: number;
  cooldown: number;
  invuln: number;
}

export interface EnemyTank {
  id: number;
  x: number;
  y: number;
  angle: number;
  cooldown: number;
  /** Restzeit bis zum nächsten Strategiewechsel */
  aiTimer: number;
  /** Seite (+1/-1) für Bögen und Flankenseite */
  strafe: number;
  /** Strategie: 0 Angriff, 1 Flanke, 2 Abstand halten */
  plan: number;
}

export type GameEvent =
  | { type: 'shoot' }
  | { type: 'explosion' }
  | { type: 'enemy-destroyed' }
  | { type: 'player-hit' }
  | { type: 'round-cleared'; round: number };

export interface State {
  mode: GameMode;
  level: Level;
  round: number;
  score: number;
  /** Leben von Spieler 1 (bzw. verbleibende Team-Leben im Einzelspieler) */
  lives: number;
  players: PlayerTank[];
  enemies: EnemyTank[];
  obstacles: Obstacle[];
  barrels: Barrel[];
  bullets: Bullet[];
  explosions: Explosion[];
  nextId: number;
  winner: 1 | 2 | null;
  events: GameEvent[];
}

export interface PlayerInput {
  moveX: number;
  moveY: number;
  fire: boolean;
}

export interface Input extends PlayerInput {
  guest?: PlayerInput;
}

export const IDLE_INPUT: Input = { moveX: 0, moveY: 0, fire: false };

interface ArenaLayout {
  obstacles: Obstacle[];
  barrels: Barrel[];
  enemies: EnemyTank[];
  nextId: number;
}

function playerSpawns(mode: GameMode): Array<{ id: 1 | 2; x: number; y: number; angle: number }> {
  if (mode === 'solo') {
    return [{ id: 1, x: 48, y: HEIGHT / 2, angle: 0 }];
  }
  if (mode === 'coop') {
    return [
      { id: 1, x: 48, y: HEIGHT / 2 - 54, angle: 0 },
      { id: 2, x: 48, y: HEIGHT / 2 + 54, angle: 0 },
    ];
  }
  return [
    { id: 1, x: 48, y: HEIGHT / 2, angle: 0 },
    { id: 2, x: WIDTH - 48, y: HEIGHT / 2, angle: Math.PI },
  ];
}

/** Erzeugt eine zufällige Anordnung von Wänden, Hindernissen, Fässern und 2–3 Gegnern. */
export function generateArena(
  rng: Rng,
  level: Level,
  mode: GameMode,
  startId: number,
): ArenaLayout {
  let nextId = startId;

  // Rasterplätze in der Arenamitte, sodass die Startzonen links/rechts frei bleiben
  const cols = [116, 168, 220, 272, 324];
  const rows = [52, 108, 164, 220, 276];
  const slots: Point[] = [];
  for (const x of cols) {
    for (const y of rows) {
      slots.push({ x, y });
    }
  }
  const shuffled = rng.shuffle(slots);

  const steelCount = rng.int(3, 5);
  const brickCount = rng.int(5, 8);
  const obstacles: Obstacle[] = [];

  for (let i = 0; i < steelCount + brickCount && i < shuffled.length; i++) {
    const slot = shuffled[i] as Point;
    const destructible = i >= steelCount;
    obstacles.push({
      id: nextId++,
      x: slot.x,
      y: slot.y,
      w: BLOCK_SIZE,
      h: BLOCK_SIZE,
      destructible,
      hp: destructible ? BRICK_HP : 999,
      maxHp: destructible ? BRICK_HP : 999,
    });
  }

  // Explosive Fässer: mindestens ein Paar nah beieinander für Kettenreaktionen
  const barrels: Barrel[] = [];
  const remainingSlots = shuffled.slice(steelCount + brickCount);
  const clusterAnchor = remainingSlots[0] ?? { x: WIDTH / 2, y: HEIGHT / 2 };
  const barrelCenter = {
    x: clusterAnchor.x + BLOCK_SIZE / 2,
    y: clusterAnchor.y + BLOCK_SIZE / 2,
  };
  barrels.push({
    id: nextId++,
    x: barrelCenter.x,
    y: barrelCenter.y,
    radius: BARREL_RADIUS,
  });

  // Zweites Fass in Kettenreaktions-Reichweite platzieren, falls frei
  const chainOffsetAngles = [0, Math.PI / 2, Math.PI, -Math.PI / 2, Math.PI / 4];
  for (const ang of chainOffsetAngles) {
    const cx = barrelCenter.x + Math.cos(ang) * 44;
    const cy = barrelCenter.y + Math.sin(ang) * 44;
    if (
      cx > 95 &&
      cx < WIDTH - 95 &&
      cy > 40 &&
      cy < HEIGHT - 40 &&
      !circleHitsAnyObstacle(cx, cy, BARREL_RADIUS + 4, obstacles)
    ) {
      barrels.push({ id: nextId++, x: cx, y: cy, radius: BARREL_RADIUS });
      break;
    }
  }

  const extraBarrels = rng.int(1, 2);
  for (let i = 1; i <= extraBarrels && i < remainingSlots.length; i++) {
    const slot = remainingSlots[i] as Point;
    const bx = slot.x + BLOCK_SIZE / 2;
    const by = slot.y + BLOCK_SIZE / 2;
    if (
      !circleHitsAnyObstacle(bx, by, BARREL_RADIUS + 4, obstacles) &&
      barrels.every((b) => Math.hypot(b.x - bx, b.y - by) > BARREL_RADIUS * 2.5)
    ) {
      barrels.push({ id: nextId++, x: bx, y: by, radius: BARREL_RADIUS });
    }
  }

  // 2–3 Computergegner im Solo- und Koop-Modus
  const enemies: EnemyTank[] = [];
  if (mode !== 'versus') {
    const count = rng.int(2, 3);
    const spawnYs = count === 2 ? [90, HEIGHT - 90] : [68, HEIGHT / 2, HEIGHT - 68];
    for (let i = 0; i < count; i++) {
      const sy = spawnYs[i] ?? HEIGHT / 2;
      enemies.push({
        id: nextId++,
        x: WIDTH - 48,
        y: sy,
        angle: Math.PI,
        cooldown: level.enemyFireInterval * (0.6 + i * 0.25),
        aiTimer: level.planTime[0] * (0.5 + rng.next() * 0.5),
        strafe: i % 2 === 0 ? 1 : -1,
        plan: pickPlan(level, rng, enemies),
      });
    }
  }

  return { obstacles, barrels, enemies, nextId };
}

export function createState(
  rng: Rng,
  level: Level = LEVELS[DEFAULT_LEVEL] as Level,
  mode: GameMode = 'solo',
): State {
  const spawns = playerSpawns(mode);
  const players: PlayerTank[] = spawns.map((s) => ({
    id: s.id,
    x: s.x,
    y: s.y,
    angle: s.angle,
    lives: INITIAL_LIVES,
    cooldown: 0,
    invuln: 0,
  }));
  const arena = generateArena(rng, level, mode, 10);
  return {
    mode,
    level,
    round: 1,
    score: 0,
    lives: INITIAL_LIVES,
    players,
    enemies: arena.enemies,
    obstacles: arena.obstacles,
    barrels: arena.barrels,
    bullets: [],
    explosions: [],
    nextId: arena.nextId,
    winner: null,
    events: [],
  };
}

export function isOver(s: State): boolean {
  if (s.mode === 'versus') {
    return s.winner !== null || s.players.some((p) => p.lives <= 0);
  }
  if (s.mode === 'coop') {
    return s.players.every((p) => p.lives <= 0);
  }
  return s.lives <= 0;
}

// ---------- Geometrie & Kollision ----------

export function circleHitsRect(
  cx: number,
  cy: number,
  r: number,
  rect: { x: number; y: number; w: number; h: number },
): boolean {
  const nearestX = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
  const nearestY = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
  return Math.hypot(cx - nearestX, cy - nearestY) < r;
}

function circleHitsAnyObstacle(
  cx: number,
  cy: number,
  r: number,
  obstacles: readonly Obstacle[],
): boolean {
  return obstacles.some((o) => circleHitsRect(cx, cy, r, o));
}

function clampArena(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

// ---------- Gegner-KI: Strategien und Wegfindung ----------

const PLAN_RUSH = 0;
const PLAN_FLANK = 1;
const PLAN_HOLD = 2;
const FLANK_DIST = 150;
const BREACH_RANGE = 90; // so nah muss eine Mauer sein, damit der Gegner sie freischießt
const FLANK_ARRIVED = 36;
const CELL = 12;
const COLS = Math.ceil(WIDTH / CELL);
const ROWS = Math.ceil(HEIGHT / CELL);

/** Wählt eine Strategie nach Schwierigkeit; von anderen Gegnern gewählte werden seltener genommen. */
function pickPlan(level: Level, rng: Rng, others: readonly EnemyTank[]): number {
  const weights = level.planWeights.map((w, plan) => {
    const used = others.filter((o) => o.plan === plan).length;
    return w / (1 + used * 1.5);
  });
  let roll = rng.next() * weights.reduce((a, b) => a + b, 0);
  for (let plan = 0; plan < weights.length; plan++) {
    roll -= weights[plan] as number;
    if (roll <= 0) return plan;
  }
  return PLAN_RUSH;
}

function buildBlockedGrid(
  obstacles: readonly Obstacle[],
  barrels: readonly Barrel[],
  ignoreBricks = false,
): boolean[] {
  const solid = ignoreBricks ? obstacles.filter((o) => !o.destructible) : obstacles;
  const grid: boolean[] = new Array(COLS * ROWS).fill(false);
  const r = TANK_RADIUS + 2;
  for (let cy = 0; cy < ROWS; cy++) {
    for (let cx = 0; cx < COLS; cx++) {
      const x = cx * CELL + CELL / 2;
      const y = cy * CELL + CELL / 2;
      grid[cy * COLS + cx] =
        x < ARENA_MARGIN + r ||
        x > WIDTH - ARENA_MARGIN - r ||
        y < ARENA_MARGIN + r ||
        y > HEIGHT - ARENA_MARGIN - r ||
        circleHitsAnyObstacle(x, y, r, solid) ||
        barrels.some((b) => Math.hypot(x - b.x, y - b.y) < r + b.radius);
    }
  }
  return grid;
}

const cellOf = (v: number, size: number) => Math.max(0, Math.min(size - 1, Math.floor(v / CELL)));
const NEIGHBOURS: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

/** Entfernungsfeld (BFS) vom Zielpunkt aus; Ziel wird auf die nächste freie Zelle gelegt. */
function distanceField(blocked: readonly boolean[], goal: Point): number[] {
  const dist: number[] = new Array(COLS * ROWS).fill(-1);
  const gx = cellOf(goal.x, COLS);
  const gy = cellOf(goal.y, ROWS);
  let start = -1;
  for (let ring = 0; ring < 8 && start < 0; ring++) {
    for (let dy = -ring; dy <= ring && start < 0; dy++) {
      for (let dx = -ring; dx <= ring; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
        const x = gx + dx;
        const y = gy + dy;
        if (x < 0 || y < 0 || x >= COLS || y >= ROWS || blocked[y * COLS + x]) continue;
        start = y * COLS + x;
        break;
      }
    }
  }
  if (start < 0) return dist;
  dist[start] = 0;
  const queue = [start];
  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head] as number;
    const cx = cur % COLS;
    const cy = Math.floor(cur / COLS);
    for (const [dx, dy] of NEIGHBOURS) {
      const x = cx + dx;
      const y = cy + dy;
      if (x < 0 || y < 0 || x >= COLS || y >= ROWS) continue;
      const idx = y * COLS + x;
      if (dist[idx] !== -1 || blocked[idx]) continue;
      // Diagonal nur, wenn beide Nachbarzellen frei sind (keine Ecken schneiden)
      if (dx !== 0 && dy !== 0 && (blocked[cy * COLS + x] || blocked[y * COLS + cx])) continue;
      dist[idx] = (dist[cur] as number) + 1;
      queue.push(idx);
    }
  }
  return dist;
}

/** Nächster Wegpunkt auf dem kürzesten Weg zum Ziel des Entfernungsfelds (null: kein Weg). */
function nextWaypoint(dist: readonly number[], from: Point): Point | null {
  let cx = cellOf(from.x, COLS);
  let cy = cellOf(from.y, ROWS);
  let cur = dist[cy * COLS + cx] as number;
  if (cur < 0) {
    // Zelle selbst ist blockiert (Panzer streift eine Kante): beste Nachbarzelle nehmen
    let best = -1;
    for (const [dx, dy] of NEIGHBOURS) {
      const x = cx + dx;
      const y = cy + dy;
      const d = x < 0 || y < 0 || x >= COLS || y >= ROWS ? -1 : (dist[y * COLS + x] as number);
      if (d >= 0 && (best < 0 || d < best)) {
        best = d;
        cur = d + 1;
        cx = x;
        cy = y;
      }
    }
    if (best < 0) return null;
  }
  for (let step = 0; step < 3 && cur > 0; step++) {
    let bx = cx;
    let by = cy;
    for (const [dx, dy] of NEIGHBOURS) {
      const x = cx + dx;
      const y = cy + dy;
      if (x < 0 || y < 0 || x >= COLS || y >= ROWS) continue;
      const d = dist[y * COLS + x] as number;
      if (d >= 0 && d < cur) {
        cur = d;
        bx = x;
        by = y;
      }
    }
    if (bx === cx && by === cy) break;
    cx = bx;
    cy = by;
  }
  return { x: cx * CELL + CELL / 2, y: cy * CELL + CELL / 2 };
}

/** Weglänge in Zellen am Punkt (bei blockierter eigener Zelle beste Nachbarzelle), -1 ohne Weg. */
function fieldValue(dist: readonly number[], p: Point): number {
  const cx = cellOf(p.x, COLS);
  const cy = cellOf(p.y, ROWS);
  let best = -1;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const x = cx + dx;
      const y = cy + dy;
      if (x < 0 || y < 0 || x >= COLS || y >= ROWS) continue;
      const d = dist[y * COLS + x] as number;
      if (d >= 0 && (best < 0 || d < best)) best = d;
    }
  }
  return best;
}

/** Erste zerstörbare Mauer, die auf einem Strahl liegt (vor jedem anderen Hindernis), sonst null. */
function brickOnRay(
  from: Point,
  angle: number,
  length: number,
  obstacles: readonly Obstacle[],
): Obstacle | null {
  for (let d = TANK_RADIUS; d <= length; d += 6) {
    const x = from.x + Math.cos(angle) * d;
    const y = from.y + Math.sin(angle) * d;
    const hit = obstacles.find((o) => x >= o.x && x <= o.x + o.w && y >= o.y && y <= o.y + o.h);
    if (hit) return hit.destructible ? hit : null;
  }
  return null;
}

/** Zielpunkt je Strategie: Flanke = seitlich/hinter dem Spieler, sonst der Spieler selbst. */
function planGoal(enemy: EnemyTank, target: PlayerTank): Point {
  if (enemy.plan !== PLAN_FLANK) return target;
  const a = target.angle + Math.PI * 0.6 * enemy.strafe;
  return { x: target.x + Math.cos(a) * FLANK_DIST, y: target.y + Math.sin(a) * FLANK_DIST };
}

function moveTankWithCollisions(
  x: number,
  y: number,
  dx: number,
  dy: number,
  obstacles: readonly Obstacle[],
  barrels: readonly Barrel[],
): Point {
  const minX = ARENA_MARGIN + TANK_RADIUS;
  const maxX = WIDTH - ARENA_MARGIN - TANK_RADIUS;
  const minY = ARENA_MARGIN + TANK_RADIUS;
  const maxY = HEIGHT - ARENA_MARGIN - TANK_RADIUS;

  const blocked = (px: number, py: number) =>
    circleHitsAnyObstacle(px, py, TANK_RADIUS, obstacles) ||
    barrels.some((b) => Math.hypot(px - b.x, py - b.y) < TANK_RADIUS + b.radius);

  let nx = clampArena(x + dx, minX, maxX);
  if (blocked(nx, y)) nx = x;

  let ny = clampArena(y + dy, minY, maxY);
  if (blocked(nx, ny)) ny = y;

  return { x: nx, y: ny };
}

// ---------- Explosionen & Kettenreaktionen ----------

interface ExplosionResolution {
  barrels: Barrel[];
  obstacles: Obstacle[];
  enemies: EnemyTank[];
  players: PlayerTank[];
  explosions: Explosion[];
  events: GameEvent[];
  scoreDelta: number;
  nextId: number;
}

/**
 * Löst eine oder mehrere Explosionen aus und verarbeitet Kettenreaktionen auf
 * nahe Fässer, zerstörbare Wände, Gegner und Spieler.
 */
export function resolveExplosions(
  centers: Point[],
  barrels: readonly Barrel[],
  obstacles: readonly Obstacle[],
  enemies: readonly EnemyTank[],
  players: readonly PlayerTank[],
  existingExplosions: readonly Explosion[],
  startId: number,
): ExplosionResolution {
  const queue: Point[] = [...centers];
  let remBarrels = [...barrels];
  let remObstacles = obstacles.map((o) => ({ ...o }));
  let remEnemies = [...enemies];
  const nextPlayers = players.map((p) => ({ ...p }));
  const explosions = [...existingExplosions];
  const events: GameEvent[] = [];
  let scoreDelta = 0;
  let nextId = startId;

  while (queue.length > 0) {
    const center = queue.shift() as Point;
    explosions.push({
      id: nextId++,
      x: center.x,
      y: center.y,
      radius: EXPLOSION_RADIUS,
      timer: EXPLOSION_DURATION,
      maxTimer: EXPLOSION_DURATION,
    });
    events.push({ type: 'explosion' });

    // Andere Fässer in Reichweite entzünden (Kettenreaktion)
    const survivingBarrels: Barrel[] = [];
    for (const barrel of remBarrels) {
      if (
        Math.hypot(barrel.x - center.x, barrel.y - center.y) <=
        EXPLOSION_RADIUS + barrel.radius
      ) {
        queue.push({ x: barrel.x, y: barrel.y });
      } else {
        survivingBarrels.push(barrel);
      }
    }
    remBarrels = survivingBarrels;

    // Zerstörbare Hindernisse im Explosionsradius beschädigen/zerstören
    remObstacles = remObstacles
      .map((o) => {
        if (!o.destructible) return o;
        if (circleHitsRect(center.x, center.y, EXPLOSION_RADIUS, o)) {
          return { ...o, hp: o.hp - BRICK_HP };
        }
        return o;
      })
      .filter((o) => !o.destructible || o.hp > 0);

    // Gegner im Explosionsradius zerstören (+10 Punkte pro Gegner)
    const survivingEnemies: EnemyTank[] = [];
    for (const enemy of remEnemies) {
      if (Math.hypot(enemy.x - center.x, enemy.y - center.y) <= EXPLOSION_RADIUS + TANK_RADIUS) {
        scoreDelta += ENEMY_POINTS;
        events.push({ type: 'enemy-destroyed' });
      } else {
        survivingEnemies.push(enemy);
      }
    }
    remEnemies = survivingEnemies;

    // Spieler im Explosionsradius verlieren 1 Leben
    for (let i = 0; i < nextPlayers.length; i++) {
      const p = nextPlayers[i] as PlayerTank;
      if (p.lives <= 0 || p.invuln > 0) continue;
      if (Math.hypot(p.x - center.x, p.y - center.y) <= EXPLOSION_RADIUS + TANK_RADIUS) {
        nextPlayers[i] = {
          ...p,
          lives: Math.max(0, p.lives - 1),
          invuln: INVULN_DURATION,
        };
        events.push({ type: 'player-hit' });
      }
    }
  }

  return {
    barrels: remBarrels,
    obstacles: remObstacles,
    enemies: remEnemies,
    players: nextPlayers,
    explosions,
    events,
    scoreDelta,
    nextId,
  };
}

/** Kleinster vorzeichenbehafteter Winkelunterschied von b nach a. */
function angleDiff(a: number, b: number): number {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b));
}

/** Freie Schusslinie: keine Wand und kein Fass zwischen den beiden Punkten. */
function hasLineOfSight(
  from: Point,
  to: Point,
  obstacles: readonly Obstacle[],
  barrels: readonly Barrel[],
): boolean {
  const dist = Math.hypot(to.x - from.x, to.y - from.y);
  const steps = Math.max(1, Math.ceil(dist / 8));
  for (let i = 1; i < steps; i++) {
    const x = from.x + ((to.x - from.x) * i) / steps;
    const y = from.y + ((to.y - from.y) * i) / steps;
    for (const o of obstacles) {
      if (x >= o.x && x <= o.x + o.w && y >= o.y && y <= o.y + o.h) return false;
    }
    for (const b of barrels) {
      if (Math.hypot(x - b.x, y - b.y) <= b.radius) return false;
    }
  }
  return true;
}

// ---------- Haupt-Update ----------

export function update(state: State, input: Input, dt: number, rng: Rng): State {
  if (isOver(state)) return state;

  let nextId = state.nextId;
  let score = state.score;
  let round = state.round;
  const events: GameEvent[] = [];

  let obstacles = state.obstacles.map((o) => ({ ...o }));
  let barrels = [...state.barrels];
  let enemies = state.enemies.map((e) => ({ ...e }));
  const bullets: Bullet[] = [...state.bullets];

  // 1. Spieler bewegen und schießen
  const pInputs: Record<1 | 2, PlayerInput> = {
    1: { moveX: input.moveX, moveY: input.moveY, fire: input.fire },
    2: input.guest ?? { moveX: 0, moveY: 0, fire: false },
  };

  let players: PlayerTank[] = state.players.map((p) => {
    if (p.lives <= 0) return { ...p, cooldown: 0, invuln: 0 };
    const pIn = pInputs[p.id];
    const cooldown = Math.max(0, p.cooldown - dt);
    const invuln = Math.max(0, p.invuln - dt);

    const mag = Math.hypot(pIn.moveX, pIn.moveY);
    const normX = mag > 1 ? pIn.moveX / mag : pIn.moveX;
    const normY = mag > 1 ? pIn.moveY / mag : pIn.moveY;
    const angle = mag > 0.05 ? Math.atan2(normY, normX) : p.angle;

    const pos =
      mag > 0.05
        ? moveTankWithCollisions(
            p.x,
            p.y,
            normX * PLAYER_SPEED * dt,
            normY * PLAYER_SPEED * dt,
            obstacles,
            barrels,
          )
        : { x: p.x, y: p.y };

    let nextCooldown = cooldown;
    if (pIn.fire && cooldown <= 0) {
      const muzzleDist = TANK_RADIUS + BULLET_RADIUS + 2;
      bullets.push({
        id: nextId++,
        x: pos.x + Math.cos(angle) * muzzleDist,
        y: pos.y + Math.sin(angle) * muzzleDist,
        vx: Math.cos(angle) * PLAYER_BULLET_SPEED,
        vy: Math.sin(angle) * PLAYER_BULLET_SPEED,
        ownerId: p.id,
        fromPlayer: true,
      });
      nextCooldown = PLAYER_FIRE_COOLDOWN;
      events.push({ type: 'shoot' });
    }

    return {
      ...p,
      x: pos.x,
      y: pos.y,
      angle,
      cooldown: nextCooldown,
      invuln,
    };
  });

  // 2. Computergegner bewegen sich selbstständig, suchen Spieler und schießen
  const livingPlayers = players.filter((p) => p.lives > 0);
  const blocked = buildBlockedGrid(obstacles, barrels);
  const blockedOpen = buildBlockedGrid(obstacles, barrels, true);
  enemies = enemies.map((enemy) => {
    const target =
      livingPlayers.reduce<PlayerTank | null>((best, cand) => {
        if (!best) return cand;
        const dCand = Math.hypot(cand.x - enemy.x, cand.y - enemy.y);
        const dBest = Math.hypot(best.x - enemy.x, best.y - enemy.y);
        return dCand < dBest ? cand : best;
      }, null) ?? players[0];

    const toPlayerAngle = target ? Math.atan2(target.y - enemy.y, target.x - enemy.x) : enemy.angle;
    const distToTarget = target ? Math.hypot(target.x - enemy.x, target.y - enemy.y) : 0;

    let aiTimer = enemy.aiTimer - dt;
    let strafe = enemy.strafe;
    let plan = enemy.plan;
    if (aiTimer <= 0) {
      // Strategiewechsel, verteilt auf die Gegner
      const others = enemies.filter((o) => o.id !== enemy.id);
      plan = pickPlan(state.level, rng, others);
      strafe = rng.next() < 0.5 ? 1 : -1;
      aiTimer =
        state.level.planTime[0] + rng.next() * (state.level.planTime[1] - state.level.planTime[0]);
    }
    const self: EnemyTank = { ...enemy, plan, strafe };

    // Sichtkontakt, Wegfindung und Zielwinkel
    const sees =
      !!target &&
      target.lives > 0 &&
      distToTarget <= ENEMY_FIRE_RANGE &&
      hasLineOfSight(enemy, target, obstacles, barrels);
    const goal = target ? planGoal(self, target) : enemy;
    const flanking =
      plan === PLAN_FLANK && Math.hypot(goal.x - enemy.x, goal.y - enemy.y) > FLANK_ARRIVED;
    const preferred =
      plan === PLAN_RUSH ? ENEMY_NEAR_DIST : plan === PLAN_HOLD ? ENEMY_FAR_DIST - 20 : 130;
    let pathAngle = toPlayerAngle;
    // Mauer-Durchbruch: Gegner schießen zerstörbare Mauern frei, wenn das den Weg stark
    // verkürzt oder der Spieler direkt dahinter steht (nur ab Stufe Mittel)
    let breach = false;
    if (!(sees && !flanking) && target) {
      const normal = distanceField(blocked, goal);
      let field = normal;
      if (state.level.breachSaving < 999) {
        const open = distanceField(blockedOpen, goal);
        const dNormal = fieldValue(normal, enemy);
        const dOpen = fieldValue(open, enemy);
        if (dOpen >= 0 && (dNormal < 0 || dNormal - dOpen >= state.level.breachSaving)) {
          field = open;
          breach = true;
        }
      }
      const wp = nextWaypoint(field, enemy);
      if (wp) pathAngle = Math.atan2(wp.y - enemy.y, wp.x - enemy.x);
    }
    const hiddenBehindBrick =
      !!target &&
      !sees &&
      state.level.breachSaving < 999 &&
      target.lives > 0 &&
      distToTarget <= ENEMY_FIRE_RANGE &&
      brickOnRay(enemy, toPlayerAngle, distToTarget, obstacles) !== null;
    if (hiddenBehindBrick) {
      breach = true;
      pathAngle = toPlayerAngle;
    }

    let cooldown = enemy.cooldown - dt;

    // Flankierer zielen erst, wenn sie in Position sind oder der Spieler sehr nah ist
    const aiming =
      sees &&
      cooldown <= ENEMY_AIM_TIME &&
      distToTarget >= ENEMY_NEAR_DIST &&
      (!flanking || distToTarget < 150);
    let desired: number;
    if (aiming) {
      desired = toPlayerAngle;
    } else if (distToTarget < ENEMY_NEAR_DIST && sees) {
      desired = toPlayerAngle + Math.PI - 0.6 * strafe;
    } else if (sees && !flanking && distToTarget <= preferred + 40) {
      desired = toPlayerAngle + 0.9 * strafe;
    } else {
      desired = pathAngle;
    }

    const diff = angleDiff(desired, enemy.angle);
    const maxTurn = ENEMY_TURN_RATE * dt;
    const angle = enemy.angle + Math.max(-maxTurn, Math.min(maxTurn, diff));
    const aligned = Math.abs(angleDiff(toPlayerAngle, angle)) <= ENEMY_AIM_TOLERANCE;
    // Steht eine zerstörbare Mauer im Weg, bleibt der Panzer stehen und schießt sie frei
    const wallShot =
      breach &&
      !aiming &&
      Math.abs(angleDiff(desired, angle)) <= ENEMY_AIM_TOLERANCE &&
      brickOnRay(enemy, angle, BREACH_RANGE, obstacles) !== null;
    if (!sees && !wallShot) cooldown = Math.max(cooldown, ENEMY_REACTION); // Reaktionszeit

    // Beim Zielen bleibt der Panzer stehen, sonst fährt er vorwärts (je nach Drehung langsamer)
    const turnLeft = Math.abs(angleDiff(desired, angle));
    const speed =
      (aiming && aligned) || wallShot ? 0 : state.level.enemySpeed * (turnLeft > 1 ? 0.4 : 1);
    let moved = { x: enemy.x, y: enemy.y };
    if (speed > 0) {
      moved = moveTankWithCollisions(
        enemy.x,
        enemy.y,
        Math.cos(angle) * speed * dt,
        Math.sin(angle) * speed * dt,
        obstacles,
        barrels,
      );
    }

    if (((sees && aligned) || wallShot) && cooldown <= 0 && target) {
      const muzzleDist = TANK_RADIUS + BULLET_RADIUS + 2;
      bullets.push({
        id: nextId++,
        x: moved.x + Math.cos(angle) * muzzleDist,
        y: moved.y + Math.sin(angle) * muzzleDist,
        vx: Math.cos(angle) * state.level.enemyBulletSpeed,
        vy: Math.sin(angle) * state.level.enemyBulletSpeed,
        ownerId: enemy.id,
        fromPlayer: false,
      });
      cooldown = state.level.enemyFireInterval * (0.85 + rng.next() * 0.3);
      if (rng.next() < 0.5) strafe = -strafe; // nach dem Schuss die Seite wechseln
      events.push({ type: 'shoot' });
    }

    return {
      ...enemy,
      x: moved.x,
      y: moved.y,
      angle,
      cooldown,
      aiTimer,
      strafe,
      plan,
    };
  });

  // 3. Projektile bewegen und Treffer prüfen
  const activeBullets: Bullet[] = [];
  const detonationCenters: Point[] = [];

  for (const b of bullets) {
    const nx = b.x + b.vx * dt;
    const ny = b.y + b.vy * dt;

    if (
      nx < ARENA_MARGIN ||
      nx > WIDTH - ARENA_MARGIN ||
      ny < ARENA_MARGIN ||
      ny > HEIGHT - ARENA_MARGIN
    ) {
      continue;
    }

    // Treffer auf Wand / Hindernis
    const hitObsIdx = obstacles.findIndex((o) => circleHitsRect(nx, ny, BULLET_RADIUS, o));
    if (hitObsIdx !== -1) {
      const obs = obstacles[hitObsIdx] as Obstacle;
      if (obs.destructible) {
        const nextHp = obs.hp - 1;
        if (nextHp <= 0) {
          obstacles.splice(hitObsIdx, 1);
        } else {
          obstacles[hitObsIdx] = { ...obs, hp: nextHp };
        }
      }
      continue;
    }

    // Treffer auf explosives Fass
    const hitBarrelIdx = barrels.findIndex(
      (bar) => Math.hypot(nx - bar.x, ny - bar.y) <= bar.radius + BULLET_RADIUS,
    );
    if (hitBarrelIdx !== -1) {
      const bar = barrels[hitBarrelIdx] as Barrel;
      barrels.splice(hitBarrelIdx, 1);
      detonationCenters.push({ x: bar.x, y: bar.y });
      continue;
    }

    // Spieler-Projektil trifft Computergegner
    if (b.fromPlayer) {
      const hitEnemyIdx = enemies.findIndex(
        (e) => Math.hypot(nx - e.x, ny - e.y) <= TANK_RADIUS + BULLET_RADIUS,
      );
      if (hitEnemyIdx !== -1) {
        enemies.splice(hitEnemyIdx, 1);
        score += ENEMY_POINTS;
        events.push({ type: 'enemy-destroyed' });
        continue;
      }
    }

    // Treffer auf Spieler (durch Gegner-Projektil oder im Versus-Modus durch Mitspieler)
    const hitPlayerIdx = players.findIndex((p) => {
      if (p.lives <= 0) return false;
      if (b.fromPlayer && (state.mode !== 'versus' || b.ownerId === p.id)) return false;
      return Math.hypot(nx - p.x, ny - p.y) <= TANK_RADIUS + BULLET_RADIUS;
    });
    if (hitPlayerIdx !== -1) {
      const targetPlayer = players[hitPlayerIdx] as PlayerTank;
      if (targetPlayer.invuln <= 0) {
        players[hitPlayerIdx] = {
          ...targetPlayer,
          lives: Math.max(0, targetPlayer.lives - 1),
          invuln: INVULN_DURATION,
        };
        events.push({ type: 'player-hit' });
      }
      continue;
    }

    activeBullets.push({ ...b, x: nx, y: ny });
  }

  // Prüfen, ob bereits laufende Explosionen nahe Fässer entzünden
  for (const exp of state.explosions) {
    const remaining: Barrel[] = [];
    for (const bar of barrels) {
      if (Math.hypot(bar.x - exp.x, bar.y - exp.y) <= exp.radius + bar.radius) {
        detonationCenters.push({ x: bar.x, y: bar.y });
      } else {
        remaining.push(bar);
      }
    }
    barrels = remaining;
  }

  // 4. Laufende Explosionen altern lassen + neue Explosionen (inkl. Kettenreaktionen) auflösen
  let explosions = state.explosions
    .map((e) => ({ ...e, timer: e.timer - dt }))
    .filter((e) => e.timer > 0);

  if (detonationCenters.length > 0) {
    const resolved = resolveExplosions(
      detonationCenters,
      barrels,
      obstacles,
      enemies,
      players,
      explosions,
      nextId,
    );
    barrels = resolved.barrels;
    obstacles = resolved.obstacles;
    enemies = resolved.enemies;
    players = resolved.players;
    explosions = resolved.explosions;
    score += resolved.scoreDelta;
    nextId = resolved.nextId;
    events.push(...resolved.events);
  }

  // 5. Gegnerkontakt kostet ein Leben
  for (const enemy of enemies) {
    for (let i = 0; i < players.length; i++) {
      const p = players[i] as PlayerTank;
      if (p.lives <= 0) continue;
      const dist = Math.hypot(enemy.x - p.x, enemy.y - p.y);
      if (dist < TANK_RADIUS * 2) {
        if (p.invuln <= 0) {
          players[i] = {
            ...p,
            lives: Math.max(0, p.lives - 1),
            invuln: INVULN_DURATION,
          };
          events.push({ type: 'player-hit' });
        }
      }
    }
  }

  const p1Lives = players[0]?.lives ?? 0;

  // 6. Versus-Modus: Sieg prüfen
  let winner: 1 | 2 | null = state.winner;
  if (state.mode === 'versus' && winner === null) {
    const p1 = players[0];
    const p2 = players[1];
    if (p2 && p2.lives <= 0 && p1 && p1.lives > 0) {
      winner = 1;
      score += ROUND_POINTS;
    } else if (p1 && p1.lives <= 0) {
      winner = 2;
    }
  }

  // 7. Solo/Koop: Wenn alle Gegner besiegt sind, +100 Punkte und automatisch nächste Runde starten
  let nextBullets = activeBullets;
  const anyPlayerAlive = state.mode === 'coop' ? players.some((p) => p.lives > 0) : p1Lives > 0;

  if (state.mode !== 'versus' && enemies.length === 0 && anyPlayerAlive) {
    score += ROUND_POINTS;
    round += 1;
    events.push({ type: 'round-cleared', round });

    const arena = generateArena(rng, state.level, state.mode, nextId);
    obstacles = arena.obstacles;
    barrels = arena.barrels;
    enemies = arena.enemies;
    nextId = arena.nextId;
    nextBullets = [];

    const spawns = playerSpawns(state.mode);
    players = players.map((p) => {
      const sp = spawns.find((s) => s.id === p.id) ?? spawns[0];
      return {
        ...p,
        x: sp ? sp.x : p.x,
        y: sp ? sp.y : p.y,
        angle: sp ? sp.angle : p.angle,
        cooldown: 0,
        invuln: Math.max(p.invuln, 0.6),
      };
    });
  }

  return {
    ...state,
    round,
    score,
    lives: players[0]?.lives ?? 0,
    players,
    enemies,
    obstacles,
    barrels,
    bullets: nextBullets,
    explosions,
    nextId,
    winner,
    events,
  };
}

// ---------- Online-Multiplayer (Koop & Versus) ----------

// Kurze Feldnamen: Der Snapshot geht 20-mal pro Sekunde raus. Hindernisse und Fässer (`k`) stehen
// nur drin, wenn sie sich seit dem letzten Snapshot geändert haben (Treffer, Zerstörung).
type PlayerWire = { i: 1 | 2; x: number; y: number; a: number; l: number; c: number; u: number };
type EnemyWire = {
  i: number;
  x: number;
  y: number;
  a: number;
  c: number;
  t: number;
  s: number;
  m: number;
};
type ObstacleWire = {
  i: number;
  x: number;
  y: number;
  w: number;
  h: number;
  d: 0 | 1;
  p: number;
  m: number;
};
type BarrelWire = { i: number; x: number; y: number; r: number };
type BulletWire = { i: number; x: number; y: number; u: number; v: number; o: number; f: 0 | 1 };
type ExplosionWire = { i: number; x: number; y: number; r: number; t: number; m: number };

export interface Snapshot {
  /** Modus: 0 solo, 1 coop, 2 versus */
  m: 0 | 1 | 2;
  /** Index des Levels */
  v: number;
  /** Runde */
  r: number;
  /** Score */
  c: number;
  /** Leben (Team) */
  l: number;
  p: PlayerWire[];
  e: EnemyWire[];
  /** Hindernisse und Fässer, nur bei Änderung */
  k?: [ObstacleWire[], BarrelWire[]];
  b: BulletWire[];
  x: ExplosionWire[];
  /** nextId */
  n: number;
  /** Sieger, 0 = keiner */
  w: 0 | 1 | 2;
  ev: GameEvent[];
}

const MODES: GameMode[] = ['solo', 'coop', 'versus'];
const r1 = (n: number) => Math.round(n * 10) / 10;
const r2 = (n: number) => Math.round(n * 100) / 100;

const obstacleWire = (o: Obstacle): ObstacleWire => ({
  i: o.id,
  x: o.x,
  y: o.y,
  w: o.w,
  h: o.h,
  d: o.destructible ? 1 : 0,
  p: o.hp,
  m: o.maxHp,
});

/** Hindernisse bewegen sich nicht: Id, Ort und Treffer reichen zum Vergleichen (auch bei neuem Feld). */
function sameField(a: State, b: State): boolean {
  return (
    a.obstacles.length === b.obstacles.length &&
    a.barrels.length === b.barrels.length &&
    a.obstacles.every((o, i) => {
      const q = b.obstacles[i];
      return o.id === q?.id && o.x === q.x && o.y === q.y && o.hp === q.hp;
    }) &&
    a.barrels.every((o, i) => {
      const q = b.barrels[i];
      return o.id === q?.id && o.x === q.x && o.y === q.y;
    })
  );
}

/** `sent`: zuletzt geschickter Zustand. Der erste Snapshot (`null`) enthält das Feld immer. */
export function toSnapshot(
  s: State,
  events: GameEvent[] = s.events,
  sent: State | null = null,
): Snapshot {
  const snap: Snapshot = {
    m: MODES.indexOf(s.mode) as 0 | 1 | 2,
    v: LEVELS.indexOf(s.level),
    r: s.round,
    c: s.score,
    l: s.lives,
    p: s.players.map((p) => ({
      i: p.id,
      x: r1(p.x),
      y: r1(p.y),
      a: r2(p.angle),
      l: p.lives,
      c: r2(p.cooldown),
      u: r2(p.invuln),
    })),
    e: s.enemies.map((e) => ({
      i: e.id,
      x: r1(e.x),
      y: r1(e.y),
      a: r2(e.angle),
      c: r2(e.cooldown),
      t: r2(e.aiTimer),
      s: e.strafe,
      m: e.plan,
    })),
    b: s.bullets.map((b) => ({
      i: b.id,
      x: r1(b.x),
      y: r1(b.y),
      u: r1(b.vx),
      v: r1(b.vy),
      o: b.ownerId,
      f: b.fromPlayer ? 1 : 0,
    })),
    x: s.explosions.map((e) => ({
      i: e.id,
      x: r1(e.x),
      y: r1(e.y),
      r: e.radius,
      t: r2(e.timer),
      m: e.maxTimer,
    })),
    n: s.nextId,
    w: s.winner ?? 0,
    ev: events,
  };
  if (!sent || !sameField(sent, s)) {
    snap.k = [
      s.obstacles.map(obstacleWire),
      s.barrels.map((b) => ({ i: b.id, x: b.x, y: b.y, r: b.radius })),
    ];
  }
  return snap;
}

/** `prev`: bisheriger Zustand des Gasts, von dem Level und (ohne `k`) das Feld kommen. */
export function applySnapshot(prev: State, snap: Snapshot): State {
  return {
    mode: MODES[snap.m] ?? prev.mode,
    level: LEVELS[snap.v] ?? prev.level,
    round: snap.r,
    score: snap.c,
    lives: snap.l,
    players: snap.p.map((p) => ({
      id: p.i,
      x: p.x,
      y: p.y,
      angle: p.a,
      lives: p.l,
      cooldown: p.c,
      invuln: p.u,
    })),
    enemies: snap.e.map((e) => ({
      id: e.i,
      x: e.x,
      y: e.y,
      angle: e.a,
      cooldown: e.c,
      aiTimer: e.t,
      strafe: e.s,
      plan: e.m,
    })),
    obstacles: snap.k
      ? snap.k[0].map((o) => ({
          id: o.i,
          x: o.x,
          y: o.y,
          w: o.w,
          h: o.h,
          destructible: o.d === 1,
          hp: o.p,
          maxHp: o.m,
        }))
      : prev.obstacles,
    barrels: snap.k
      ? snap.k[1].map((b) => ({ id: b.i, x: b.x, y: b.y, radius: b.r }))
      : prev.barrels,
    bullets: snap.b.map((b) => ({
      id: b.i,
      x: b.x,
      y: b.y,
      vx: b.u,
      vy: b.v,
      ownerId: b.o,
      fromPlayer: b.f === 1,
    })),
    explosions: snap.x.map((e) => ({
      id: e.i,
      x: e.x,
      y: e.y,
      radius: e.r,
      timer: e.t,
      maxTimer: e.m,
    })),
    nextId: snap.n,
    winner: snap.w === 0 ? null : snap.w,
    events: snap.ev,
  };
}

/** Zwischen zwei Snapshots beim Gast: Projektile und Explosionen flüssig weiterbewegen. */
export function predict(s: State, dt: number): State {
  if (isOver(s)) return s;
  return {
    ...s,
    bullets: s.bullets.map((b) => ({ ...b, x: b.x + b.vx * dt, y: b.y + b.vy * dt })),
    explosions: s.explosions.map((e) => ({ ...e, timer: e.timer - dt })).filter((e) => e.timer > 0),
    events: [],
  };
}
