import { createRng } from '@core/sdk';
import { describe, expect, it } from 'vitest';
import {
  applySnapshot,
  BARREL_RADIUS,
  BLOCK_SIZE,
  BRICK_HP,
  createState,
  ENEMY_POINTS,
  IDLE_INPUT,
  INITIAL_LIVES,
  isOver,
  LEVELS,
  type Level,
  predict,
  ROUND_POINTS,
  type State,
  TANK_RADIUS,
  toSnapshot,
  update,
} from './logic.ts';

describe('Tank Arena Logik', () => {
  it('startet Runde 1 mit 3 Leben, 0 Punkten, 2–3 Gegnern, Wänden und Fässern', () => {
    const rng = createRng('test-seed-1');
    const s = createState(rng);

    expect(s.round).toBe(1);
    expect(s.lives).toBe(INITIAL_LIVES);
    expect(s.score).toBe(0);
    expect(s.enemies.length).toBeGreaterThanOrEqual(2);
    expect(s.enemies.length).toBeLessThanOrEqual(3);
    expect(s.obstacles.some((o) => o.destructible)).toBe(true);
    expect(s.obstacles.some((o) => !o.destructible)).toBe(true);
    expect(s.barrels.length).toBeGreaterThanOrEqual(2);
    expect(isOver(s)).toBe(false);
  });

  it('unterstützt alle drei Schwierigkeitsstufen und Schwer ist schwerer als Leicht', () => {
    const rng = createRng('levels');
    for (const lvl of LEVELS) {
      const s = createState(rng, lvl);
      expect(s.level.name).toBe(lvl.name);
      expect(s.lives).toBe(3);
    }
    const easy = LEVELS[0] as Level;
    const hard = LEVELS[2] as Level;
    expect(hard.enemySpeed).toBeGreaterThan(easy.enemySpeed);
    expect(hard.enemyFireInterval).toBeLessThan(easy.enemyFireInterval);
    expect(hard.enemyBulletSpeed).toBeGreaterThan(easy.enemyBulletSpeed);
  });

  it('bewegt den Spielerpanzer und feuert Projektile ab', () => {
    const rng = createRng('move-fire');
    const s: State = {
      ...createState(rng),
      obstacles: [],
      barrels: [],
      enemies: [
        { id: 99, x: 400, y: 180, angle: Math.PI, cooldown: 5, aiTimer: 2, strafe: 1, plan: 0 },
      ],
    };

    const next = update(s, { moveX: 1, moveY: 0, fire: true }, 0.1, rng);
    expect(next.players[0]?.x).toBeGreaterThan(s.players[0]?.x ?? 0);
    expect(next.bullets.length).toBe(1);
    expect(next.bullets[0]?.fromPlayer).toBe(true);
  });

  it('Gegner finden den Weg um eine lange Wand herum', () => {
    const rng = createRng('path');
    const wall = {
      id: 60,
      x: 230,
      y: 40,
      w: 20,
      h: 220,
      destructible: false,
      hp: 1,
      maxHp: 1,
    };
    let s: State = {
      ...createState(rng),
      obstacles: [wall],
      barrels: [],
      enemies: [
        { id: 99, x: 400, y: 180, angle: Math.PI, cooldown: 5, aiTimer: 99, strafe: 1, plan: 0 },
      ],
    };
    s = { ...s, players: s.players.map((p) => ({ ...p, x: 60, y: 180, invuln: 99 })) };
    let minDist = Infinity;
    for (let i = 0; i < 1500; i++) {
      s = update(s, { moveX: 0, moveY: 0, fire: false }, 1 / 60, rng);
      const e = s.enemies[0];
      if (e) minDist = Math.min(minDist, Math.hypot(e.x - 60, e.y - 180));
    }
    expect(minDist).toBeLessThan(200);
  });

  it('Gegner (Mittel) schießen eine Mauer frei, die den Weg versperrt', () => {
    const rng = createRng('breach-1');
    const wall = { id: 61, x: 230, y: 20, w: 20, h: 320, destructible: true, hp: 2, maxHp: 2 };
    let s: State = {
      ...createState(rng, LEVELS[1] as Level),
      obstacles: [wall],
      barrels: [],
      enemies: [
        { id: 99, x: 300, y: 180, angle: Math.PI, cooldown: 0, aiTimer: 99, strafe: 1, plan: 0 },
      ],
    };
    s = { ...s, players: s.players.map((p) => ({ ...p, x: 60, y: 180, invuln: 99 })) };
    for (let i = 0; i < 600 && s.obstacles.length > 0; i++) {
      s = update(s, { moveX: 0, moveY: 0, fire: false }, 1 / 60, rng);
    }
    expect(s.obstacles.length).toBe(0);
  });

  it('Gegner (Leicht) schießen keine Mauern frei', () => {
    const rng = createRng('breach-0');
    const wall = { id: 61, x: 230, y: 20, w: 20, h: 320, destructible: true, hp: 2, maxHp: 2 };
    let s: State = {
      ...createState(rng, LEVELS[0] as Level),
      obstacles: [wall],
      barrels: [],
      enemies: [
        { id: 99, x: 300, y: 180, angle: Math.PI, cooldown: 0, aiTimer: 99, strafe: 1, plan: 0 },
      ],
    };
    s = { ...s, players: s.players.map((p) => ({ ...p, x: 60, y: 180, invuln: 99 })) };
    for (let i = 0; i < 600; i++) {
      s = update(s, { moveX: 0, moveY: 0, fire: false }, 1 / 60, rng);
    }
    expect(s.obstacles.length).toBe(1);
  });

  it('zerstört zerstörbare Wände nach ausreichend Treffern, unzerstörbare bleiben bestehen', () => {
    const rng = createRng('walls');
    const base = createState(rng);
    const brick = {
      id: 50,
      x: 150,
      y: 160,
      w: BLOCK_SIZE,
      h: BLOCK_SIZE,
      destructible: true,
      hp: BRICK_HP,
      maxHp: BRICK_HP,
    };
    const steel = {
      id: 51,
      x: 150,
      y: 240,
      w: BLOCK_SIZE,
      h: BLOCK_SIZE,
      destructible: false,
      hp: 999,
      maxHp: 999,
    };

    let s: State = {
      ...base,
      obstacles: [brick, steel],
      barrels: [],
      enemies: [
        { id: 99, x: 420, y: 80, angle: Math.PI, cooldown: 10, aiTimer: 5, strafe: 1, plan: 0 },
      ],
      bullets: [
        { id: 1, x: 148, y: 175, vx: 200, vy: 0, ownerId: 1, fromPlayer: true },
        { id: 2, x: 148, y: 255, vx: 200, vy: 0, ownerId: 1, fromPlayer: true },
      ],
    };

    // Erster Treffer beschädigt Ziegelwand, Stahlwand bleibt unverändert
    s = update(s, IDLE_INPUT, 0.05, rng);
    expect(s.obstacles.find((o) => o.id === 50)?.hp).toBe(BRICK_HP - 1);
    expect(s.obstacles.find((o) => o.id === 51)).toBeDefined();

    // Zweiter Treffer lässt zerstörbare Wand verschwinden
    s = {
      ...s,
      bullets: [{ id: 3, x: 148, y: 175, vx: 200, vy: 0, ownerId: 1, fromPlayer: true }],
    };
    s = update(s, IDLE_INPUT, 0.05, rng);
    expect(s.obstacles.find((o) => o.id === 50)).toBeUndefined();
    expect(s.obstacles.find((o) => o.id === 51)).toBeDefined();
  });

  it('löst bei Beschuss auf ein Fass eine Kettenreaktion und Flächenschaden aus', () => {
    const rng = createRng('chain');
    const base = createState(rng);
    const s: State = {
      ...base,
      obstacles: [
        {
          id: 60,
          x: 245,
          y: 165,
          w: BLOCK_SIZE,
          h: BLOCK_SIZE,
          destructible: true,
          hp: BRICK_HP,
          maxHp: BRICK_HP,
        },
      ],
      barrels: [
        { id: 70, x: 180, y: 180, radius: BARREL_RADIUS },
        { id: 71, x: 225, y: 180, radius: BARREL_RADIUS }, // in Kettenreaktions-Reichweite von Fass 70
      ],
      enemies: [
        { id: 80, x: 250, y: 180, angle: Math.PI, cooldown: 10, aiTimer: 5, strafe: 1, plan: 0 }, // nahe Fass 71
        { id: 81, x: 420, y: 60, angle: Math.PI, cooldown: 10, aiTimer: 5, strafe: 1, plan: 0 }, // weit weg
      ],
      bullets: [{ id: 1, x: 168, y: 180, vx: 250, vy: 0, ownerId: 1, fromPlayer: true }],
    };

    const next = update(s, IDLE_INPUT, 0.05, rng);

    // Beide Fässer sind durch die Kettenreaktion explodiert
    expect(next.barrels).toHaveLength(0);
    expect(next.explosions.length).toBeGreaterThanOrEqual(2);
    // Zerstörbare Wand und naher Gegner wurden durch die Explosion zerstört
    expect(next.obstacles).toHaveLength(0);
    expect(next.enemies).toHaveLength(1);
    expect(next.enemies[0]?.id).toBe(81);
    expect(next.score).toBe(ENEMY_POINTS);
  });

  it('zieht Leben bei Projektil-Treffer, Gegnerkontakt und Explosion ab und beendet nach 3 Treffern', () => {
    const rng = createRng('damage');
    const base = createState(rng);
    const p1 = base.players[0] as (typeof base.players)[number];

    // 1. Gegnerschuss trifft Spieler -> 2 Leben übrig
    let s: State = {
      ...base,
      obstacles: [],
      barrels: [],
      enemies: [
        { id: 90, x: 400, y: 180, angle: Math.PI, cooldown: 10, aiTimer: 5, strafe: 1, plan: 0 },
      ],
      bullets: [{ id: 1, x: p1.x + 8, y: p1.y, vx: -200, vy: 0, ownerId: 90, fromPlayer: false }],
    };
    s = update(s, IDLE_INPUT, 0.05, rng);
    expect(s.lives).toBe(2);

    // 2. Gegnerkontakt kostet ein weiteres Leben -> 1 Leben übrig
    s = {
      ...s,
      players: [{ ...(s.players[0] as (typeof s.players)[number]), invuln: 0 }],
      enemies: [
        {
          id: 90,
          x: p1.x + TANK_RADIUS,
          y: p1.y,
          angle: Math.PI,
          cooldown: 10,
          aiTimer: 5,
          strafe: 1,
          plan: 0,
        },
      ],
    };
    s = update(s, IDLE_INPUT, 0.05, rng);
    expect(s.lives).toBe(1);
    expect(isOver(s)).toBe(false);

    // 3. Explosion in Spielernähe kostet das letzte Leben -> Game Over
    s = {
      ...s,
      players: [{ ...(s.players[0] as (typeof s.players)[number]), invuln: 0 }],
      enemies: [
        { id: 90, x: 400, y: 80, angle: Math.PI, cooldown: 10, aiTimer: 5, strafe: 1, plan: 0 },
      ],
      barrels: [{ id: 75, x: p1.x + 30, y: p1.y, radius: BARREL_RADIUS }],
      bullets: [{ id: 2, x: p1.x + 25, y: p1.y, vx: 200, vy: 0, ownerId: 1, fromPlayer: true }],
    };
    s = update(s, IDLE_INPUT, 0.05, rng);
    expect(s.lives).toBe(0);
    expect(isOver(s)).toBe(true);
  });

  it('vergibt 10 Punkte pro Gegner und 100 Punkte Rundenbonus und startet automatisch die nächste Runde', () => {
    const rng = createRng('round-advance');
    const base = createState(rng);
    const s: State = {
      ...base,
      obstacles: [],
      barrels: [],
      enemies: [
        { id: 95, x: 180, y: 180, angle: Math.PI, cooldown: 10, aiTimer: 5, strafe: 1, plan: 0 },
      ],
      bullets: [{ id: 1, x: 170, y: 180, vx: 250, vy: 0, ownerId: 1, fromPlayer: true }],
    };

    const next = update(s, IDLE_INPUT, 0.05, rng);
    expect(next.round).toBe(2);
    expect(next.score).toBe(ENEMY_POINTS + ROUND_POINTS);
    expect(next.enemies.length).toBeGreaterThanOrEqual(2);
    expect(next.enemies.length).toBeLessThanOrEqual(3);
    expect(next.obstacles.length).toBeGreaterThan(0);
  });

  it('unterstützt Online-Koop und Online-Duell (Versus) samt Snapshot-Synchronisation', () => {
    const rng = createRng('online');
    const coop = createState(rng, LEVELS[1], 'coop');
    expect(coop.players).toHaveLength(2);
    expect(coop.enemies.length).toBeGreaterThanOrEqual(2);

    const snap = toSnapshot(coop);
    const restored = applySnapshot(coop, snap);
    expect(restored.round).toBe(coop.round);
    expect(restored.players).toHaveLength(2);

    expect(restored.obstacles).toEqual(coop.obstacles);
    expect(restored.barrels).toEqual(coop.barrels);
    expect(restored.enemies.map((e) => e.id)).toEqual(coop.enemies.map((e) => e.id));
    expect(restored.enemies[0]?.x).toBeCloseTo(coop.enemies[0]?.x ?? 0, 0);

    // Feld nur bei Änderung
    const again = toSnapshot(coop, [], coop);
    expect(again.k).toBeUndefined();
    expect(applySnapshot(coop, again).obstacles).toEqual(coop.obstacles);
    expect(JSON.stringify(again).length).toBeLessThan(JSON.stringify(snap).length / 2);
    const hit = {
      ...coop,
      obstacles: coop.obstacles.map((o, i) => (i === 0 ? { ...o, hp: o.hp - 1 } : o)),
    };
    expect(toSnapshot(hit, [], coop).k).toBeDefined();

    const predicted = predict(restored, 0.05);
    expect(predicted.players).toHaveLength(2);

    // Versus: Spieler 1 besiegt Spieler 2
    let versus = createState(rng, LEVELS[1], 'versus');
    expect(versus.enemies).toHaveLength(0);
    const p1 = versus.players[0] as (typeof versus.players)[number];
    const p2 = versus.players[1] as (typeof versus.players)[number];
    versus = {
      ...versus,
      obstacles: [],
      barrels: [],
      players: [p1, { ...p2, lives: 1, invuln: 0 }],
      bullets: [{ id: 9, x: p2.x - 8, y: p2.y, vx: 250, vy: 0, ownerId: 1, fromPlayer: true }],
    };
    versus = update(versus, IDLE_INPUT, 0.05, rng);
    expect(versus.winner).toBe(1);
    expect(isOver(versus)).toBe(true);
  });
});
