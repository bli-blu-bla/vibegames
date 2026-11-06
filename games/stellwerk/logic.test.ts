import { createRng } from '@core/sdk';
import { describe, expect, it } from 'vitest';
import {
  applyAction,
  applySnapshot,
  clearCow,
  createState,
  hitTest,
  isOver,
  LIVES,
  predict,
  type State,
  type Train,
  toggleBrake,
  toggleSwitch,
  toSnapshot,
  update,
  wagonPose,
} from './logic.ts';
import { EDGES, NODES, OUT } from './network.ts';

const rng = () => createRng('stellwerk');

/** Zug direkt vor Weiche 8, Richtung Buxtehude (Zweig 0) oder Wanne-Eickel (Zweig 1). */
function trainBefore(id: string, dest: Train['dest']): Train {
  const edge = EDGES.findIndex((e) => e.to === id);
  const n = NODES[id] as { x: number; y: number };
  return {
    id: 1,
    code: 'ICE 1',
    dest,
    edge,
    dist: (EDGES[edge]?.length ?? 0) - 1,
    speed: 100,
    wagons: 2,
    brake: 0,
    blocked: false,
    x: n.x,
    y: n.y,
    angle: 0,
    trail: [],
  };
}

/** Lässt die Simulation laufen, ohne neue Züge oder Kühe. */
function run(s: State, seconds: number): State {
  let out = { ...s, spawnIn: 999, cowIn: 999 };
  const events = [];
  for (let t = 0; t < seconds; t += 0.05) {
    out = update({ ...out, spawnIn: 999, cowIn: 999 }, 0.05, rng());
    events.push(...out.events);
  }
  return { ...out, events };
}

describe('Netz', () => {
  it('jede Weiche hat zwei Zweige', () => {
    for (const id of ['SW1', 'SW2', 'SW3', 'SW4', 'SW5', 'SW6', 'SW7', 'SW8', 'SW9']) {
      expect(OUT[id]).toHaveLength(2);
    }
  });
});

describe('Stellwerk', () => {
  it('der erste Zug kommt nach einer Sekunde', () => {
    const s = update(createState(), 1.01, rng());
    expect(s.trains).toHaveLength(1);
  });

  it('richtiger Bahnhof gibt Punkte und erhöht die Kombo', () => {
    const s = run({ ...createState(), trains: [trainBefore('SW8', 'B')] }, 5);
    expect(s.score).toBe(120);
    expect(s.combo).toBe(2);
    expect(s.trains).toHaveLength(0);
  });

  it('Weiche umstellen schickt den Zug woanders hin und kostet ein Leben', () => {
    const start = toggleSwitch({ ...createState(), trains: [trainBefore('SW8', 'B')] }, 'SW8');
    const s = run(start, 5);
    expect(s.lives).toBe(LIVES - 1);
    expect(s.events.some((e) => e.type === 'arrived' && !e.correct)).toBe(true);
  });

  it('gebremster Zug bleibt stehen', () => {
    const train = trainBefore('SW8', 'B');
    const s = run(toggleBrake({ ...createState(), trains: [train] }, train.id), 1);
    expect(s.trains[0]?.dist).toBe(train.dist);
  });

  it('Zusammenstoß entfernt beide Züge', () => {
    const a = trainBefore('SW8', 'B');
    const s = update(
      { ...createState(), spawnIn: 999, cowIn: 999, trains: [a, { ...a, id: 2, code: 'RB 2' }] },
      0.01,
      rng(),
    );
    expect(s.trains).toHaveLength(0);
    expect(s.lives).toBe(LIVES - 1);
  });

  it('Kuh wegklicken gibt Punkte', () => {
    const s: State = {
      ...createState(),
      cows: [{ id: 7, name: 'Kuh Berta', x: 600, y: 300, timer: 10 }],
    };
    expect(hitTest(s, { x: 605, y: 305 })).toEqual({ kind: 'cow', id: 7 });
    const after = clearCow(s, 7);
    expect(after.cows).toHaveLength(0);
    expect(after.score).toBe(50);
  });

  it('Klick auf eine Weiche wird erkannt', () => {
    expect(hitTest(createState(), { x: 275, y: 210 })).toEqual({ kind: 'switch', id: 'SW1' });
  });

  it('Schichtende nach drei Minuten', () => {
    const s = update({ ...createState(), timeLeft: 0.01 }, 0.1, rng());
    expect(isOver(s)).toBe(true);
  });

  it('Wagen folgen der Lok mit Abstand', () => {
    const t = {
      ...trainBefore('SW8', 'B'),
      x: 100,
      y: 0,
      trail: [
        { x: 50, y: 0, angle: 0 },
        { x: 0, y: 0, angle: 0 },
      ],
    };
    expect(wagonPose(t, 1).x).toBeCloseTo(74);
  });
});

describe('Online (Koop)', () => {
  it('Snapshot ohne Spur, der Gast baut die Spur weiter', () => {
    let host = createState();
    const r = rng();
    for (let i = 0; i < 40; i++) host = update(host, 0.05, r);
    expect(host.trains.length).toBeGreaterThan(0);
    const snap = toSnapshot(host, []);
    expect(JSON.stringify(snap)).not.toContain('trail');
    const guest = applySnapshot(createState(), JSON.parse(JSON.stringify(snap)));
    expect(guest.trains[0]?.trail.length).toBeGreaterThan(0);
    host = update(host, 0.05, r);
    const next = applySnapshot(guest, toSnapshot(host, []));
    expect(next.trains[0]?.trail[0]).toMatchObject({ x: host.trains[0]?.x, y: host.trains[0]?.y });
  });

  it('predict bewegt nur die Züge', () => {
    const s = { ...createState(), trains: [trainBefore('SW8', 'B')] };
    const p = predict(s, 0.1);
    expect(p.trains[0]?.dist).not.toBe(s.trains[0]?.dist);
    expect(p.timeLeft).toBe(s.timeLeft);
    expect(p.score).toBe(s.score);
  });

  it('Weiche wird online fest gestellt statt umgeschaltet', () => {
    const s = createState();
    const a = applyAction(s, { kind: 'switch', id: 'SW8', branch: 1 });
    expect(applyAction(a, { kind: 'switch', id: 'SW8', branch: 1 }).switches.SW8).toBe(1);
  });
});
