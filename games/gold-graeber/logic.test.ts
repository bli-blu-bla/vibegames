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
  NUGGET_SHAPES,
  nextRound,
  ORIGIN_X,
  ORIGIN_Y,
  PRICE_STEP,
  ROUND_TIME,
  reelSpeedFor,
  roundTarget,
  roundTax,
  roundTime,
  type State,
  shootHook,
  shopItemVisible,
  shopPrice,
  spawnItems,
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
  it('startet Runde 1 mit 40 Sekunden, steigendem Ziel und zufälligen Gegenständen', () => {
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
    expect(smallGoldSpeed).toBeGreaterThan(largeGoldSpeed * 2);
    expect(largeGoldSpeed).toBeLessThanOrEqual(55);
    expect(largeGoldSpeed).toBeGreaterThan(rockSpeed);
  });

  it('vergibt abwechslungsreiche SVG-Formvarianten an gespawnte Goldnuggets', () => {
    const s = createState(createRng('nugget-variants'));
    const goldItems = s.items.filter((i) => i.kind === 'gold_small' || i.kind === 'gold_large');
    const variants = new Set(goldItems.map((i) => i.variant));

    expect(NUGGET_SHAPES.length).toBeGreaterThanOrEqual(4);
    expect(variants.size).toBeGreaterThanOrEqual(3);
    for (const item of goldItems) {
      expect(item.variant).toBeDefined();
      expect(item.variant).toBeGreaterThanOrEqual(0);
      expect(item.variant).toBeLessThan(NUGGET_SHAPES.length);
    }
  });

  it('öffnet nach Ablauf der Zeit den Shop bei erreichtem Ziel oder beendet das Spiel sonst', () => {
    const base = createState(createRng('timer'));
    const wonRound = update(
      { ...base, money: base.target, score: base.target, timeLeft: 0.1 },
      {},
      0.2,
    );
    expect(wonRound.phase).toBe('shop');
    expect(isOver(wonRound)).toBe(false);
    expect(wonRound.money).toBe(base.target - roundTax(1));

    const lostRound = update(
      { ...base, money: base.target - 10, score: base.target - 10, timeLeft: 0.1 },
      {},
      0.2,
    );
    expect(lostRound.phase).toBe('gameover');
    expect(isOver(lostRound)).toBe(true);
  });

  it('zieht am Rundenende die halbe Zielsumme als Abgabe ab', () => {
    const base = createState(createRng('abgabe'));
    const s = update(
      { ...base, money: base.target + 120, score: base.target + 120, timeLeft: 0.1 },
      {},
      0.2,
    );
    expect(s.phase).toBe('shop');
    expect(roundTax(1)).toBe(Math.floor(roundTarget(1) / 2));
    expect(s.paidTax).toBe(roundTax(1));
    expect(s.money).toBe(base.target + 120 - roundTax(1));
    expect(s.score).toBe(base.target + 120);
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

    expect(s.effects.winch).toBe(3);
    expect(s.consumables.dynamite).toBe(1);
    expect(s.consumables.tonic).toBe(1);
    expect(s.money).toBe(300 - 100 - 60 - 80);
    expect(s.score).toBe(300);

    s = nextRound(s, rng);
    expect(s.phase).toBe('playing');
    expect(s.round).toBe(2);
    expect(s.target).toBe(roundTarget(2));
    expect(s.money).toBe(60);
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

  it('Seil und Uhr wirken drei Runden und sind erst danach wieder kaufbar', () => {
    const rng = createRng('timed');
    let s: State = { ...createState(rng), phase: 'shop', money: 2000 };
    s = buyShopItem(s, 'winch');
    s = buyShopItem(s, 'clock');
    expect(s.effects).toEqual({ winch: 3, clock: 3 });

    const noWinch = reelSpeedFor({
      grabbed: makeItem('rock'),
      effects: { winch: 0, clock: 0 },
      tonicTimer: 0,
    });
    expect(reelSpeedFor({ ...s, grabbed: makeItem('rock') })).toBeCloseTo(noWinch * 1.2);

    for (let i = 0; i < 3; i++) {
      s = nextRound(s, rng);
      expect(s.timeLeft).toBe(roundTime({ winch: 1, clock: 1 }));
      s = update({ ...s, money: s.target, timeLeft: 0.01 }, {}, 0.02);
      expect(s.phase).toBe('shop');
      if (i < 2) expect(buyShopItem({ ...s, money: 5000 }, 'winch').effects.winch).toBe(2 - i);
    }
    expect(s.effects).toEqual({ winch: 0, clock: 0 });
    s = nextRound(s, rng);
    expect(s.timeLeft).toBe(ROUND_TIME);
  });

  it('macht Mehrrunden-Items mit jedem Kauf 50 Gold teurer, Verbrauchsitems nicht', () => {
    let s: State = { ...createState(createRng('preis')), phase: 'shop', money: 5000 };
    const first = shopPrice(s, 'gemSkill');
    s = buyShopItem(s, 'gemSkill');
    expect(shopPrice(s, 'gemSkill')).toBe(first + PRICE_STEP);
    expect(s.money).toBe(5000 - first);

    const dyn = shopPrice(s, 'dynamite');
    s = buyShopItem(s, 'dynamite');
    expect(shopPrice(s, 'dynamite')).toBe(dyn);
  });

  it('Skills haben drei Stufen und erhöhen den Wert von Edelsteinen und Gold', () => {
    const rng = createRng('skills');
    let s: State = { ...createState(rng), phase: 'shop', money: 10000 };
    for (let i = 0; i < 4; i++) {
      s = buyShopItem({ ...s, shopPurchased: [] }, 'gemSkill');
      s = buyShopItem({ ...s, shopPurchased: [] }, 'goldSkill');
    }
    expect(s.upgrades.gemSkill).toBe(3);
    expect(s.upgrades.goldSkill).toBe(3);

    const plain = spawnItems(5, 0, createRng('feld'));
    const skilled = spawnItems(5, 0, createRng('feld'), s.upgrades);
    for (const kind of ['gem', 'gold_large', 'gold_small'] as const) {
      const a = plain.find((i) => i.kind === kind)?.value ?? 0;
      const b = skilled.find((i) => i.kind === kind)?.value ?? 0;
      expect(b).toBeGreaterThan(a);
    }
  });

  it('legt in späteren Runden mehr Edelsteine ins Feld', () => {
    const gems = (round: number) =>
      spawnItems(round, 0, createRng('gems')).filter((i) => i.kind === 'gem').length;
    expect(gems(9)).toBeGreaterThan(gems(1));
  });

  it('legt kleine Goldkrümel mit 10 Gold ins Feld', () => {
    const tiny = spawnItems(1, 0, createRng('krümel')).filter((i) => i.kind === 'gold_tiny');
    expect(tiny.length).toBeGreaterThan(0);
    expect(tiny.every((i) => i.value === 10)).toBe(true);
  });

  it('Steinmetz und eine Runde später Bildhauer erhöhen den Steinwert auf 20 und 30', () => {
    let s: State = { ...createState(createRng('stein')), phase: 'shop', money: 1000 };
    expect(buyShopItem(s, 'sculptor')).toBe(s);
    expect(shopItemVisible(s, 'sculptor')).toBe(false);

    s = buyShopItem(s, 'mason');
    expect(shopItemVisible(s, 'sculptor')).toBe(false);
    expect(buyShopItem(s, 'sculptor')).toBe(s);
    // erst im nächsten Shop
    s = { ...s, shopPurchased: [] };
    expect(shopItemVisible(s, 'sculptor')).toBe(true);
    const rock = (state: State) =>
      spawnItems(3, 0, createRng('feld'), state.upgrades).find((i) => i.kind === 'rock')?.value;
    expect(rock(s)).toBe(20);
    expect(buyShopItem({ ...s, shopPurchased: [] }, 'mason').upgrades.rockSkill).toBe(1);

    s = buyShopItem(s, 'sculptor');
    expect(rock(s)).toBe(30);
    expect(spawnItems(3, 0, createRng('feld')).find((i) => i.kind === 'rock')?.value).toBe(10);
  });
});
