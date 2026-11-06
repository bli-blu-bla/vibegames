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
}

export const LEVELS: readonly Level[] = [
  { name: 'Leicht', enemySpeed: 46, enemyFireInterval: 2.1, enemyBulletSpeed: 150 },
  { name: 'Mittel', enemySpeed: 68, enemyFireInterval: 1.45, enemyBulletSpeed: 190 },
  { name: 'Schwer', enemySpeed: 92, enemyFireInterval: 0.95, enemyBulletSpeed: 230 },
];

export const DEFAULT_LEVEL = 1;

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
  aiTimer: number;
  strafe: number;
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
        aiTimer: 0.4 + i * 0.3,
        strafe: i % 2 === 0 ? 1 : -1,
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
    if (aiTimer <= 0) {
      aiTimer = 0.8 + rng.next() * 0.9;
      strafe = rng.next() < 0.5 ? 1 : -1;
    }

    // Auf Spieler zufahren; bei geringem Abstand oder Hindernis leicht seitlich versetzen
    const moveAngle =
      distToTarget < 72 ? toPlayerAngle + (Math.PI / 2) * strafe : toPlayerAngle + 0.25 * strafe;
    const stepX = Math.cos(moveAngle) * state.level.enemySpeed * dt;
    const stepY = Math.sin(moveAngle) * state.level.enemySpeed * dt;

    let moved = moveTankWithCollisions(enemy.x, enemy.y, stepX, stepY, obstacles, barrels);
    if (Math.hypot(moved.x - enemy.x, moved.y - enemy.y) < 0.1 * dt * state.level.enemySpeed) {
      // Ausweichbewegung, falls ein Hindernis im Weg steht
      const altAngle = toPlayerAngle + (Math.PI / 2) * strafe;
      moved = moveTankWithCollisions(
        enemy.x,
        enemy.y,
        Math.cos(altAngle) * state.level.enemySpeed * dt,
        Math.sin(altAngle) * state.level.enemySpeed * dt,
        obstacles,
        barrels,
      );
    }

    let cooldown = enemy.cooldown - dt;
    if (cooldown <= 0 && target && target.lives > 0) {
      const muzzleDist = TANK_RADIUS + BULLET_RADIUS + 2;
      bullets.push({
        id: nextId++,
        x: moved.x + Math.cos(toPlayerAngle) * muzzleDist,
        y: moved.y + Math.sin(toPlayerAngle) * muzzleDist,
        vx: Math.cos(toPlayerAngle) * state.level.enemyBulletSpeed,
        vy: Math.sin(toPlayerAngle) * state.level.enemyBulletSpeed,
        ownerId: enemy.id,
        fromPlayer: false,
      });
      cooldown = state.level.enemyFireInterval * (0.85 + rng.next() * 0.3);
      events.push({ type: 'shoot' });
    }

    return {
      ...enemy,
      x: moved.x,
      y: moved.y,
      angle: toPlayerAngle,
      cooldown,
      aiTimer,
      strafe,
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

export type Snapshot = Omit<State, 'level'> & { levelName: Level['name'] };

export function toSnapshot(s: State, events: GameEvent[] = s.events): Snapshot {
  const { level, ...rest } = s;
  return { ...rest, events, levelName: level.name };
}

export function applySnapshot(prev: State, snap: Snapshot): State {
  const level = LEVELS.find((l) => l.name === snap.levelName) ?? prev.level;
  const { levelName: _, ...rest } = snap;
  return { ...rest, level };
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
