import { createRng } from '@core/sdk';
import { describe, expect, it } from 'vitest';
import {
  type Ack,
  applySnapshot,
  BOX,
  COLS,
  createState,
  dangerMap,
  FLOOR,
  FUSE,
  GUARD_TIME,
  isOver,
  LEVELS,
  type Level,
  mobCount,
  mobSpeed,
  mobWant,
  moveMover,
  NO_INPUT,
  nextStage,
  type PlayerInput,
  POINTS,
  parseInput,
  passable,
  predict,
  predictOwn,
  ROWS,
  reconcile,
  removePlayer,
  SPAWNS,
  type State,
  tileAt,
  toSnapshot,
  update,
  WALL,
} from './logic.ts';

const rng = () => createRng('test');
const MITTEL = LEVELS[1] as Level;

/** Feld ohne Kisten, nur ein stillstehendes Monster in der fernen Ecke (sonst wäre die Stufe geschafft) */
function empty(s: State): State {
  const mobs =
    s.mode === 'solo'
      ? [{ x: COLS - 2, y: ROWS - 2, dir: null, t: 0, face: 'down' as const, speed: 0 }]
      : [];
  return { ...s, tiles: s.tiles.replaceAll(BOX, FLOOR), loot: '.'.repeat(s.loot.length), mobs };
}

function run(s: State, inputs: PlayerInput[], seconds: number, r = rng()): State {
  let st = s;
  for (let t = 0; t < seconds; t += 0.05) st = update(st, inputs, 0.05, r);
  return st;
}

describe('Aufbau', () => {
  it('Solo: ein Spieler oben links, Monster weit weg, Startecke frei', () => {
    const s = createState(rng());
    expect(s.players).toHaveLength(1);
    expect(s.players[0]).toMatchObject({ x: 1, y: 1, alive: true, bombs: 1, range: 2 });
    expect(s.mobs).toHaveLength(mobCount(MITTEL, 1));
    for (const m of s.mobs) expect(Math.abs(m.x - 1) + Math.abs(m.y - 1)).toBeGreaterThanOrEqual(6);
    expect(tileAt(s, 1, 1)).toBe(FLOOR);
    expect(tileAt(s, 2, 1)).toBe(FLOOR);
    expect(tileAt(s, 1, 2)).toBe(FLOOR);
    expect(s.tiles).toHaveLength(COLS * ROWS);
  });

  it('Rand und Säulen sind feste Wände', () => {
    const s = createState(rng());
    expect(tileAt(s, 0, 5)).toBe(WALL);
    expect(tileAt(s, 2, 2)).toBe(WALL);
    expect(tileAt(s, COLS - 1, 0)).toBe(WALL);
  });

  it('Duell: bis zu vier Spieler in den Ecken, keine Monster', () => {
    const s = createState(rng(), 'versus', 4);
    expect(s.players.map((p) => [p.x, p.y])).toEqual(SPAWNS);
    expect(s.mobs).toEqual([]);
    for (const [x, y] of SPAWNS) expect(tileAt(s, x, y)).toBe(FLOOR);
  });

  it('jede Stufe startet gültig, Schwer ist schwerer als Leicht', () => {
    for (const level of LEVELS) {
      const s = createState(rng(), 'solo', 1, level);
      expect(s.mobs.length).toBe(mobCount(level, 1));
      expect(s.players[0]?.alive).toBe(true);
    }
    const [leicht, , schwer] = LEVELS as [Level, Level, Level];
    expect(mobCount(schwer, 1)).toBeGreaterThan(mobCount(leicht, 1));
    expect(mobSpeed(schwer, 1)).toBeGreaterThan(mobSpeed(leicht, 1));
  });
});

describe('Bewegung', () => {
  const open = () => true;

  it('läuft von Feld zu Feld und bleibt ohne Eingabe auf dem Feld stehen', () => {
    const m = { x: 1, y: 1, dir: null, t: 0, face: 'down' as const, speed: 4 };
    const a = moveMover(m, 'right', 0.1, open);
    expect(a).toMatchObject({ x: 1, dir: 'right' });
    expect(a.t).toBeCloseTo(0.4);
    const b = moveMover(a, null, 0.5, open);
    expect(b).toMatchObject({ x: 2, y: 1, dir: null, t: 0 });
  });

  it('kehrt sofort um', () => {
    const m = { x: 1, y: 1, dir: 'right' as const, t: 0.3, face: 'down' as const, speed: 4 };
    const r = moveMover(m, 'left', 0, open);
    expect(r).toMatchObject({ x: 2, dir: 'left' });
    expect(r.t).toBeCloseTo(0.7);
  });

  it('läuft nicht in Wände, Kisten oder Bomben', () => {
    const s = empty(createState(rng()));
    const blocked = {
      ...s,
      bombs: [{ x: 2, y: 1, fuse: 9, range: 1, owner: 0, slide: null, t: 0 }],
    };
    expect(passable(blocked, 2, 1)).toBe(false);
    expect(passable(s, 0, 1)).toBe(false);
    const after = run(blocked, [{ dir: 'right', bomb: false }], 0.5);
    expect(after.players[0]).toMatchObject({ x: 1, y: 1 });
  });
});

describe('Bomben', () => {
  it('Bombe explodiert nach der Zündschnur und sprengt Kisten frei', () => {
    const base = empty(createState(rng()));
    const s = {
      ...base,
      tiles: base.tiles.slice(0, 1 * COLS + 3) + BOX + base.tiles.slice(1 * COLS + 4),
    };
    expect(tileAt(s, 3, 1)).toBe(BOX);
    // Bombe legen, dann nach unten in Deckung
    let st = update(s, [{ dir: null, bomb: true }], 0.01, rng());
    expect(st.bombs).toHaveLength(1);
    st = run(st, [{ dir: 'down', bomb: false }], 0.6);
    expect(st.players[0]?.y).toBeGreaterThanOrEqual(3);
    st = run(st, [NO_INPUT], FUSE);
    expect(st.bombs).toHaveLength(0);
    expect(tileAt(st, 3, 1)).toBe(FLOOR);
    expect(st.score).toBe(POINTS.box * MITTEL.factor);
  });

  it('nicht mehr Bomben als erlaubt', () => {
    const s = empty(createState(rng()));
    let st = update(s, [{ dir: null, bomb: true }], 0.01, rng());
    st = run(st, [{ dir: 'right', bomb: false }], 0.4);
    st = update(st, [{ dir: null, bomb: true }], 0.01, rng());
    expect(st.bombs).toHaveLength(1);
  });

  it('eigene Flamme trifft: Solo ist vorbei', () => {
    const s = empty(createState(rng()));
    const st = run(s, [{ dir: null, bomb: true }], FUSE + 0.2);
    expect(st.players[0]?.alive).toBe(false);
    expect(isOver(st)).toBe(true);
  });

  it('Kettenreaktion: eine Bombe zündet die nächste', () => {
    const s = {
      ...empty(createState(rng())),
      players: [],
      bombs: [
        { x: 1, y: 3, fuse: 0.01, range: 2, owner: 0, slide: null, t: 0 },
        { x: 1, y: 5, fuse: 9, range: 2, owner: 0, slide: null, t: 0 },
      ],
    };
    const st = update(s, [], 0.05, rng());
    expect(st.bombs).toHaveLength(0);
  });
});

describe('Monster und Stufen', () => {
  it('Monster in der Flamme geben Punkte, alle weg = Stufe geschafft', () => {
    const base = empty(createState(rng()));
    const s: State = {
      ...base,
      mobs: [{ x: 5, y: 1, dir: null, t: 0, face: 'down' as const, speed: 0 }],
      bombs: [{ x: 3, y: 1, fuse: 0.01, range: 2, owner: 0, slide: null, t: 0 }],
      players: base.players.map((p) => ({ ...p, x: 1, y: 3 })),
    };
    const st = update(s, [NO_INPUT], 0.05, rng());
    expect(st.mobs).toHaveLength(0);
    expect(st.score).toBe((POINTS.mob + POINTS.stage) * MITTEL.factor);
    expect(st.clearIn).not.toBeNull();
    const next = run(st, [NO_INPUT], 2);
    expect(next.stage).toBe(2);
    expect(next.mobs.length).toBe(mobCount(MITTEL, 2));
  });

  it('Berührung mit einem Monster beendet das Spiel', () => {
    const s: State = {
      ...empty(createState(rng())),
      mobs: [{ x: 1, y: 1, dir: null, t: 0, face: 'down' as const, speed: 0 }],
    };
    const st = update(s, [NO_INPUT], 0.01, rng());
    expect(isOver(st)).toBe(true);
  });

  it('Extras bleiben in der nächsten Stufe', () => {
    const s = createState(rng());
    const strong = { ...s, players: s.players.map((p) => ({ ...p, bombs: 3, range: 4 })) };
    const next = nextStage(strong, rng());
    expect(next.players[0]).toMatchObject({ bombs: 3, range: 4, x: 1, y: 1 });
  });

  it('Extras aufsammeln', () => {
    const base = empty(createState(rng()));
    const loot = base.loot.slice(0, 1 * COLS + 2) + 'f' + base.loot.slice(1 * COLS + 3);
    const st = run({ ...base, loot }, [{ dir: 'right', bomb: false }], 0.2);
    expect(st.players[0]?.range).toBe(3);
  });
});

describe('Duell', () => {
  it('der Letzte gewinnt und bekommt den Abschuss', () => {
    const base = empty(createState(rng(), 'versus', 2));
    const s: State = {
      ...base,
      bombs: [{ x: COLS - 2, y: ROWS - 4, fuse: 0.01, range: 3, owner: 0, slide: null, t: 0 }],
    };
    const st = update(s, [NO_INPUT, NO_INPUT], 0.05, rng());
    expect(st.over).toBe(true);
    expect(st.winner).toBe(0);
    expect(st.players[0]?.kills).toBe(1);
  });

  it('fallen alle zugleich, ist es unentschieden', () => {
    const base = empty(createState(rng(), 'versus', 2));
    const s: State = {
      ...base,
      players: base.players.map((p) => ({ ...p, x: 1, y: 3 })),
      bombs: [{ x: 1, y: 4, fuse: 0.01, range: 1, owner: 0, slide: null, t: 0 }],
    };
    const st = update(s, [NO_INPUT, NO_INPUT], 0.05, rng());
    expect(st.over).toBe(true);
    expect(st.winner).toBeNull();
  });

  it('geht ein Spieler online, scheidet er aus', () => {
    const s = createState(rng(), 'versus', 3);
    const a = removePlayer(s, 2);
    expect(a.over).toBe(false);
    const b = removePlayer(a, 1);
    expect(b).toMatchObject({ over: true, winner: 0 });
  });
});

describe('Extras: Kick und Schild', () => {
  const bomb = (x: number, y: number, fuse = 9) => ({
    x,
    y,
    fuse,
    range: 1,
    owner: 0,
    slide: null,
    t: 0,
  });

  it('sammelt Kick und Schild ein', () => {
    const s = empty(createState(rng()));
    const loot = `${s.loot.slice(0, COLS + 2)}kh${s.loot.slice(COLS + 4)}`;
    const st = run({ ...s, loot }, [{ dir: 'right', bomb: false }], 0.8);
    expect(st.players[0]).toMatchObject({ kick: true, shield: true });
  });

  it('ohne Kick bleibt die Bombe liegen', () => {
    const s = { ...empty(createState(rng())), bombs: [bomb(2, 1)] };
    const st = run(s, [{ dir: 'right', bomb: false }], 1);
    expect(st.bombs[0]).toMatchObject({ x: 2, y: 1, slide: null });
  });

  it('mit Kick rutscht die Bombe bis vor die Wand', () => {
    const base = empty(createState(rng()));
    const s = {
      ...base,
      players: base.players.map((p) => ({ ...p, kick: true })),
      bombs: [bomb(2, 1)],
    };
    const st = run(s, [{ dir: 'right', bomb: false }], 1.5);
    expect(st.bombs[0]).toMatchObject({ x: COLS - 2, y: 1, slide: null });
    expect(st.players[0]?.alive).toBe(true);
  });

  it('eine getretene Bombe hält vor einem Monster', () => {
    const base = empty(createState(rng()));
    const s = {
      ...base,
      players: base.players.map((p) => ({ ...p, kick: true })),
      mobs: [{ x: 6, y: 1, dir: null, t: 0, face: 'down' as const, speed: 0 }],
      bombs: [bomb(2, 1)],
    };
    const st = run(s, [{ dir: 'right', bomb: false }], 1);
    expect(st.bombs[0]).toMatchObject({ x: 5, y: 1, slide: null });
  });

  it('der Schild fängt eine Explosion ab und macht kurz unverwundbar', () => {
    const base = empty(createState(rng()));
    const s = {
      ...base,
      players: base.players.map((p) => ({ ...p, x: 1, y: 3, shield: true })),
      bombs: [bomb(1, 4, 0.01)],
    };
    const hit = update(s, [NO_INPUT], 0.05, rng());
    expect(hit.players[0]).toMatchObject({ alive: true, shield: false, guard: GUARD_TIME });
    expect(hit.events).toContain('shield');
    const later = run(hit, [NO_INPUT], 0.6);
    expect(later.players[0]?.alive).toBe(true);
  });

  it('der Schild hilft einmal gegen ein Monster, danach nicht mehr', () => {
    const base = empty(createState(rng()));
    const s = {
      ...base,
      players: base.players.map((p) => ({ ...p, shield: true })),
      mobs: [{ x: 1, y: 1, dir: null, t: 0, face: 'down' as const, speed: 0 }],
    };
    const hit = update(s, [NO_INPUT], 0.05, rng());
    expect(hit.players[0]).toMatchObject({ alive: true, shield: false });
    expect(run(hit, [NO_INPUT], GUARD_TIME + 0.2).players[0]?.alive).toBe(false);
  });

  it('Kick und Schild bleiben für die nächste Stufe', () => {
    const s = createState(rng());
    const strong = { ...s, players: s.players.map((p) => ({ ...p, kick: true, shield: true })) };
    expect(nextStage(strong, rng()).players[0]).toMatchObject({ kick: true, shield: true });
  });
});

describe('Online', () => {
  it('Snapshot ist JSON und klein, der Gast bekommt denselben Zustand', () => {
    const s = createState(rng(), 'versus', 4);
    const snap = toSnapshot(s, ['boom']);
    const text = JSON.stringify(snap);
    expect(text.length).toBeLessThan(900);
    const back = applySnapshot(JSON.parse(text));
    expect(back.tiles).toBe(s.tiles);
    expect(back.players).toEqual(s.players);
    expect(back.events).toEqual(['boom']);
  });

  it('Snapshot trägt Bomben, Flammen, Monster und Richtungen verlustfrei', () => {
    const solo = createState(rng(), 'solo', 1);
    const s: State = {
      ...solo,
      score: 120,
      clearIn: 1.5,
      players: solo.players.map((p) => ({
        ...p,
        dir: 'left' as const,
        face: 'up' as const,
        t: 0.25,
        kick: true,
        shield: true,
        kills: 2,
      })),
      bombs: [{ x: 3, y: 1, fuse: 1.25, range: 2, owner: 0, slide: 'down', t: 0.5 }],
      flames: [{ x: 1, y: 1, ttl: 0.2, owner: 0 }],
    };
    const back = applySnapshot(JSON.parse(JSON.stringify(toSnapshot(s, []))));
    expect(back).toEqual({ ...s, events: [] });
  });

  it('Snapshot schickt das Feld nur bei Änderung', () => {
    const s = createState(rng(), 'versus', 2);
    const full = toSnapshot(s, [], null);
    const same = toSnapshot(s, [], s);
    expect(full.g).toBeDefined();
    expect(same.g).toBeUndefined();
    expect(JSON.stringify(same).length).toBeLessThan(JSON.stringify(full).length / 2);
    expect(applySnapshot(same, s).tiles).toBe(s.tiles);
    const changed = {
      ...s,
      tiles: `${s.tiles.slice(0, 20)}${s.tiles[20] === 'X' ? 'Y' : 'X'}${s.tiles.slice(21)}`,
    };
    expect(toSnapshot(changed, [], s).g?.[0]).toBe(changed.tiles);
  });

  it('predict bewegt nur weiter, ohne über das Feld hinaus', () => {
    const s = createState(rng(), 'versus', 2);
    const moving = {
      ...s,
      players: s.players.map((p) => ({ ...p, dir: 'right' as const, t: 0.5 })),
    };
    const p = predict(moving, 1);
    expect(p.players[0]?.t).toBeLessThan(1);
    expect(p.players[0]?.x).toBe(1);
  });

  it('Eingaben von Gästen werden geprüft', () => {
    expect(parseInput({ dir: 'up', bomb: true })).toEqual({ dir: 'up', bomb: true });
    expect(parseInput({ dir: 'quer', bomb: 'ja' })).toEqual({ dir: null, bomb: false });
    expect(parseInput(null)).toEqual(NO_INPUT);
  });
});

describe('Monster-Verstand', () => {
  const mob = (x: number, y: number, extra = {}) => ({
    x,
    y,
    dir: null,
    t: 0,
    face: 'right' as const,
    speed: 2,
    ...extra,
  });
  /** Spieler weit weg, damit niemand gejagt wird */
  const field = (): State => {
    const base = createState(rng());
    return {
      ...base,
      tiles: base.tiles.replaceAll(BOX, FLOOR),
      players: base.players.map((p) => ({ ...p, x: 1, y: ROWS - 2 })),
      level: { ...MITTEL, chase: 0 },
    };
  };

  it('Gefahrenkarte: Reichweite, Wände, Kettenreaktion', () => {
    const s: State = {
      ...field(),
      bombs: [
        { x: 3, y: 1, fuse: 0.5, range: 2, owner: 0, slide: null, t: 0 },
        { x: 5, y: 1, fuse: 2, range: 1, owner: 0, slide: null, t: 0 },
      ],
    };
    const d = dangerMap(s);
    const at = (x: number, y: number) => d[y * COLS + x];
    expect(at(1, 1)).toBe(0.5);
    expect(at(3, 3)).toBe(0.5);
    // zweite Bombe geht mit der ersten hoch
    expect(at(6, 1)).toBe(0.5);
    expect(at(7, 1)).toBe(Number.POSITIVE_INFINITY);
    // Säule bei (2, 2) schützt nichts dahinter, weil sie nicht in der Linie liegt
    expect(at(2, 3)).toBe(Number.POSITIVE_INFINITY);
  });

  it('läuft nicht in eine Bombe direkt vor ihm, sondern dreht um', () => {
    const s: State = {
      ...field(),
      bombs: [{ x: 6, y: 1, fuse: 2, range: 1, owner: 0, slide: null, t: 0 }],
    };
    const m = mob(5, 1, { dir: 'right', t: 0.4 });
    expect(mobWant(s, m, rng(), dangerMap(s))).toBe('left');
  });

  it('läuft nicht in Feld, das gleich explodiert', () => {
    const s: State = {
      ...field(),
      bombs: [{ x: 9, y: 1, fuse: 2, range: 3, owner: 0, slide: null, t: 0 }],
    };
    const m = mob(5, 1, { dir: 'right', t: 0.3 });
    expect(mobWant(s, m, rng(), dangerMap(s))).toBe('left');
  });

  it('flieht aus dem Explosionsbereich und überlebt', () => {
    const base = field();
    let s: State = {
      ...base,
      mobs: [mob(3, 1)],
      bombs: [{ x: 1, y: 1, fuse: FUSE, range: 3, owner: 0, slide: null, t: 0 }],
    };
    for (let t = 0; t < FUSE + 0.3; t += 0.05) s = update(s, [NO_INPUT], 0.05, rng());
    expect(s.mobs).toHaveLength(1);
    const d = dangerMap({
      ...s,
      bombs: [{ x: 1, y: 1, fuse: 1, range: 3, owner: 0, slide: null, t: 0 }],
      flames: [],
    });
    const m = s.mobs[0] as (typeof s.mobs)[number];
    expect(d[m.y * COLS + m.x]).toBe(Number.POSITIVE_INFINITY);
  });

  it('jagt den Spieler, wenn es ihn wittert', () => {
    const base = createState(rng());
    const s: State = {
      ...base,
      tiles: base.tiles.replaceAll(BOX, FLOOR),
      players: base.players.map((p) => ({ ...p, x: 1, y: 1 })),
      level: { ...MITTEL, chase: 1 },
    };
    expect(mobWant(s, mob(5, 1), rng(), dangerMap(s))).toBe('left');
    expect(mobWant(s, mob(1, 5), rng(), dangerMap(s))).toBe('up');
  });

  it('Schwer jagt öfter als Leicht', () => {
    const [leicht, , schwer] = LEVELS as [Level, Level, Level];
    expect(schwer.chase).toBeGreaterThan(leicht.chase);
  });
});

describe('Vorhersage der eigenen Figur', () => {
  const duel = () => empty(createState(rng(), 'versus', 2));
  const me = (s: State) => s.players[1] as State['players'][number];
  const frames = (n: number, q: number, dir: 'left' | null = 'left') =>
    Array.from({ length: n }, () => ({ q, dir, dt: 0.05 }));
  /** Position als Zahl: Feld plus Fortschritt in Gehrichtung (hier nur links/rechts) */
  const pos = (p: State['players'][number]) =>
    p.x + (p.dir === 'left' ? -p.t : p.dir === 'right' ? p.t : 0);
  const same = (a: State['players'][number], b: State['players'][number]) => {
    expect(pos(a)).toBeCloseTo(pos(b), 6);
    expect(a.y).toBe(b.y);
  };
  const steps = (s: State, n: number, input: PlayerInput) => {
    let st = s;
    for (let i = 0; i < n; i++) st = update(st, [NO_INPUT, input], 0.05, rng());
    return st;
  };
  const LEFT: PlayerInput = { dir: 'left', bomb: false };

  it('ohne unbestätigte Eingaben bleibt der Host-Zustand', () => {
    const s = duel();
    expect(reconcile(s, 1, [], { q: 0, age: 0 })).toBe(s);
    expect(reconcile(s, 1, frames(5, 1), { q: 2, age: 0 })).toEqual(s);
  });

  it('spielt unbestätigte Eingaben nach wie der Host sie anwenden würde', () => {
    const s = duel();
    const want = steps(s, 10, LEFT);
    const got = reconcile(s, 1, frames(10, 1), { q: 0, age: 0 });
    same(me(got), me(want));
    expect(pos(me(got))).toBeLessThan(pos(me(s)));
  });

  it('bereits angewendete Zeit der bestätigten Eingabe wird nicht doppelt gespielt', () => {
    const s = duel();
    const got = reconcile(s, 1, frames(10, 1), { q: 1, age: 0.5 });
    same(me(got), me(s));
  });

  it('Nach dem Loslassen treffen sich Gast und Host nach der Verzögerung', () => {
    const start = duel();
    // Host: Eingabe 1 kam nach 0,1 s an, der Snapshot entstand bei 0,3 s (0,2 s Eingabe angewendet)
    const host = steps(steps(start, 2, NO_INPUT), 4, LEFT);
    // Gast: hält seit 0,5 s nach links
    const guestNow = reconcile(host, 1, frames(10, 1), { q: 1, age: 0.2 });
    const truth = steps(start, 10, LEFT);
    same(me(guestNow), me(truth));
  });

  it('Extras sammelt nur der Host auf, der Gast lässt sie liegen', () => {
    const base = duel();
    const at = me(base);
    const i = at.y * COLS + (at.x - 1);
    const loot = `${base.loot.slice(0, i)}f${base.loot.slice(i + 1)}`;
    const s = { ...base, loot };
    const guest = reconcile(s, 1, frames(10, 1), { q: 0, age: 0 });
    expect(guest.loot).toBe(loot);
    expect(me(guest).range).toBe(me(s).range);
    expect(pos(me(guest))).toBeLessThan(pos(me(s)));
    // Der Host dagegen nimmt es auf
    expect(me(steps(s, 10, LEFT)).range).toBe(me(s).range + 1);
  });

  it('eine Wand stoppt die nachgespielte Eingabe', () => {
    const s = empty(createState(rng(), 'solo', 1));
    const got = reconcile(s, 0, frames(20, 1, 'left'), { q: 0, age: 0 });
    expect(got.players[0]?.x).toBe(1);
  });

  it('keine Vorhersage bei toter Figur, Spielende oder Pause zwischen Stufen', () => {
    const s = duel();
    const f = frames(10, 1);
    const ack: Ack = { q: 0, age: 0 };
    const dead = { ...s, players: s.players.map((p) => ({ ...p, alive: false })) };
    expect(reconcile(dead, 1, f, ack)).toBe(dead);
    const over = { ...s, over: true };
    expect(reconcile(over, 1, f, ack)).toBe(over);
    const clear = { ...s, clearIn: 1 };
    expect(reconcile(clear, 1, f, ack)).toBe(clear);
  });

  it('predictOwn bewegt die eigene Figur nach der eigenen Eingabe, andere gleiten nur', () => {
    const s = duel();
    const next = predictOwn(s, 1, 'left', 0.1);
    expect(pos(me(next))).toBeLessThan(pos(me(s)));
    expect(next.players[0]).toEqual(predict(s, 0.1).players[0]);
  });

  it('Snapshot trägt die Bestätigung, parseInput prüft die Nummer', () => {
    const s = duel();
    const acks: Ack[] = [];
    acks[1] = { q: 7, age: 0.1234 };
    const snap = JSON.parse(JSON.stringify(toSnapshot(s, [], null, acks)));
    expect(snap.ak[1]).toEqual([7, 0.123]);
    expect(snap.ak[0]).toEqual([0, 0]);
    expect(parseInput({ dir: 'up', bomb: false, q: 3 })).toEqual({ dir: 'up', bomb: false, q: 3 });
    expect(parseInput({ dir: 'up', bomb: false, q: -1 }).q).toBeUndefined();
    expect(parseInput({ dir: 'up', bomb: false, q: 1.5 }).q).toBeUndefined();
    expect(parseInput({ dir: 'up', bomb: false, q: '3' }).q).toBeUndefined();
  });
});
