import { createRng } from '@core/sdk';
import { describe, expect, it } from 'vitest';
import {
  activateConsumable,
  buyShopItem,
  createState,
  type FieldItem,
  ITEM_STATS,
  isOver,
  MAX_ANGLE,
  MIN_ROPE,
  nextRound,
  ORIGIN_X,
  ORIGIN_Y,
  ROUND_TIME,
  reelSpeedFor,
  roundTarget,
  type State,
  shootHook,
  update,
} from './logic.ts';

function makeItem(kind: FieldItem['kind'], x = ORIGIN_X, y = ORIGIN_Y + 80, id = 1): FieldItem {
  const spec = ITEM_STATS[kind];
  return {
    id,
    kind,
    x,
    y,
    radius: spec.radius,
    value: spec.value,
    weight: spec.weight,
  };
}

describe('gold-graeber logic', () => {
  it('startet Runde 1 mit 90 Sekunden, steigendem Ziel und zufälligen Gegenständen', () => {
    const s1 = createState(createRng('seed-a'));
    const s2 = createState(createRng('seed-b'));

    expect(s1.phase).toBe('playing');
    expect(s1.round).toBe(1);
    expect(s1.timeLeft).toBe(ROUND_TIME);
    expect(s1.target).toBe(roundTarget(1));
    expect(roundTarget(2)).toBeGreaterThan(roundTarget(1));
    expect(roundTarget(3)).toBeGreaterThan(roundTarget(2));
    expect(s1.items.length).toBeGreaterThan(0);
    expect(s1.items.map((i) => `${i.x},${i.y}`)).not.toEqual(s2.items.map((i) => `${i.x},${i.y}`));
  });

  it('schwingt automatisch zwischen linkem und rechtem Anschlag hin und her', () => {
    let s = createState(createRng('swing'));
    s = update(s, {}, 0.4);
    expect(s.angle).toBeGreaterThan(0);

    while (s.swingDir === 1) s = update(s, {}, 0.05);
    expect(s.angle).toBe(MAX_ANGLE);
    expect(s.swingDir).toBe(-1);

    while (s.swingDir === -1) s = update(s, {}, 0.05);
    expect(s.angle).toBe(-MAX_ANGLE);
    expect(s.swingDir).toBe(1);
  });

  it('schießt den Haken aus, greift genau einen Gegenstand und schreibt die Punkte gut', () => {
    const cases: Array<[FieldItem['kind'], number]> = [
      ['gold_small', 50],
      ['gold_large', 100],
      ['gem', 200],
      ['rock', 10],
    ];

    for (const [kind, expectedPoints] of cases) {
      let s = {
        ...createState(createRng(`catch-${kind}`)),
        angle: 0,
        items: [
          makeItem(kind, ORIGIN_X, ORIGIN_Y + 60, 1),
          makeItem('gold_small', ORIGIN_X, ORIGIN_Y + 95, 2),
        ],
      };

      s = shootHook(s);
      expect(s.hookPhase).toBe('shooting');

      for (let i = 0; i < 20 && s.hookPhase === 'shooting'; i++) {
        s = update(s, {}, 0.02);
      }

      expect(s.hookPhase).toBe('reeling');
      expect(s.grabbed?.kind).toBe(kind);
      expect(s.items).toHaveLength(1);

      for (let i = 0; i < 120 && s.hookPhase === 'reeling'; i++) {
        s = update(s, {}, 0.05);
      }

      expect(s.hookPhase).toBe('swinging');
      expect(s.ropeLength).toBe(MIN_ROPE);
      expect(s.grabbed).toBeNull();
      expect(s.score).toBe(expectedPoints);
      expect(s.money).toBe(expectedPoints);
    }
  });

  it('zieht schwere Gegenstände und Steine deutlich langsamer ein als kleine Schätze', () => {
    const base = createState(createRng('speed'));
    const emptySpeed = reelSpeedFor({ ...base, grabbed: null });
    const gemSpeed = reelSpeedFor({ ...base, grabbed: makeItem('gem') });
    const smallGoldSpeed = reelSpeedFor({ ...base, grabbed: makeItem('gold_small') });
    const largeGoldSpeed = reelSpeedFor({ ...base, grabbed: makeItem('gold_large') });
    const rockSpeed = reelSpeedFor({ ...base, grabbed: makeItem('rock') });

    expect(emptySpeed).toBeGreaterThan(gemSpeed);
    expect(gemSpeed).toBeGreaterThan(smallGoldSpeed);
    expect(smallGoldSpeed).toBeGreaterThan(largeGoldSpeed);
    expect(largeGoldSpeed).toBeGreaterThan(rockSpeed);
  });

  it('öffnet nach 90 Sekunden den Shop bei erreichtem Ziel oder beendet das Spiel sonst', () => {
    const base = createState(createRng('timer'));
    const wonRound = update(
      { ...base, money: base.target, score: base.target, timeLeft: 0.1 },
      {},
      0.2,
    );
    expect(wonRound.phase).toBe('shop');
    expect(isOver(wonRound)).toBe(false);

    const lostRound = update(
      { ...base, money: base.target - 10, score: base.target - 10, timeLeft: 0.1 },
      {},
      0.2,
    );
    expect(lostRound.phase).toBe('gameover');
    expect(isOver(lostRound)).toBe(true);
  });

  it('ermöglicht Käufe im Shop, übernimmt Restgeld und aktiviert Verbrauchsitems in späteren Runden', () => {
    const rng = createRng('shop');
    let s: State = {
      ...createState(rng),
      phase: 'shop',
      money: 300,
      score: 300,
    };

    const baseSpeed = reelSpeedFor({ ...s, grabbed: makeItem('gold_large') });

    s = buyShopItem(s, 'winch');
    s = buyShopItem(s, 'dynamite');
    s = buyShopItem(s, 'tonic');

    expect(s.upgrades.winch).toBe(1);
    expect(s.consumables.dynamite).toBe(1);
    expect(s.consumables.tonic).toBe(1);
    expect(s.money).toBe(300 - 100 - 60 - 80);
    expect(s.score).toBe(300);

    s = nextRound(s, rng);
    expect(s.phase).toBe('playing');
    expect(s.round).toBe(2);
    expect(s.target).toBe(roundTarget(2));
    expect(s.money).toBe(60);
    expect(s.upgrades.winch).toBe(1);
    expect(reelSpeedFor({ ...s, grabbed: makeItem('gold_large') })).toBeGreaterThan(baseSpeed);

    // Krafttrank aktivieren
    s = activateConsumable(s, 'tonic');
    expect(s.consumables.tonic).toBe(0);
    expect(s.tonicTimer).toBeGreaterThan(0);

    // Dynamit sprengt Stein am Haken weg
    s = {
      ...s,
      hookPhase: 'reeling',
      ropeLength: 140,
      grabbed: makeItem('rock'),
    };
    s = activateConsumable(s, 'dynamite');
    expect(s.consumables.dynamite).toBe(0);
    expect(s.grabbed).toBeNull();
  });
});
