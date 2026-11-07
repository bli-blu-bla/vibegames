import type { Rng } from '@core/sdk';

export const WIDTH = 480;
export const HEIGHT = 360;
export const ORIGIN_X = WIDTH / 2;
export const ORIGIN_Y = 50;
export const GROUND_Y = 58;
export const ROUND_TIME = 40;
export const EXTRA_TIME = 15;
export const EFFECT_ROUNDS = 3;
export const WINCH_BONUS = 0.2;
export const PRICE_STEP = 50;
export const MAX_SKILL = 3;

export const MIN_ROPE = 22;
export const MAX_ROPE = 410;
export const MAX_ANGLE = 1.25;
export const SWING_SPEED = 1.55;
export const SHOOT_SPEED = 270;
export const EMPTY_REEL_SPEED = 290;
export const HOOK_RADIUS = 7;
export const TONIC_DURATION = 15;

export type ItemKind = 'gold_tiny' | 'gold_small' | 'gold_large' | 'gem' | 'rock';

export interface ItemSpec {
  kind: ItemKind;
  label: string;
  value: number;
  radius: number;
  weight: number;
  pullSpeed: number;
}

export const ITEM_STATS: Record<ItemKind, ItemSpec> = {
  gold_tiny: {
    kind: 'gold_tiny',
    label: 'Goldkrümel',
    value: 10,
    radius: 8,
    weight: 0.6,
    pullSpeed: 230,
  },
  gold_small: {
    kind: 'gold_small',
    label: 'Goldklumpen',
    value: 50,
    radius: 13,
    weight: 1.5,
    pullSpeed: 135,
  },
  gold_large: {
    kind: 'gold_large',
    label: 'Großes Gold',
    value: 100,
    radius: 22,
    weight: 3.8,
    pullSpeed: 54,
  },
  gem: {
    kind: 'gem',
    label: 'Edelstein',
    value: 200,
    radius: 9,
    weight: 0.9,
    pullSpeed: 190,
  },
  rock: {
    kind: 'rock',
    label: 'Stein',
    value: 10,
    radius: 17,
    weight: 4.5,
    pullSpeed: 45,
  },
};

export interface NuggetShape {
  outer: string;
  crown: string;
  bevel: string;
  ridges: string;
  glint: string;
}

export const NUGGET_SHAPES: readonly NuggetShape[] = [
  {
    outer: 'M -14 -10 L -5 -16 L 8 -15 L 18 -7 L 19 5 L 11 15 L -6 16 L -18 8 L -19 -2 Z',
    crown: 'M -14 -10 L -5 -16 L 8 -15 L 10 -6 L -8 -5 L -19 -2 Z',
    bevel: 'M 10 -6 L 18 -7 L 19 5 L 11 15 L -6 16 L -8 6 L 9 5 Z',
    ridges:
      'M -19 -2 L -8 -5 L 10 -6 L 18 -7 M -5 -16 L -8 -5 L -8 6 L -6 16 M 10 -6 L 9 5 L 11 15 M -8 6 L 9 5',
    glint: 'M -11 -9 L -4 -13 L 2 -12 L -5 -8 Z',
  },
  {
    outer: 'M -17 -6 L -9 -16 L 0 -11 L 10 -16 L 19 -6 L 16 9 L 5 16 L -10 15 L -19 5 Z',
    crown: 'M -17 -6 L -9 -16 L 0 -11 L 10 -16 L 19 -6 L 9 -4 L -9 -4 Z',
    bevel: 'M 9 -4 L 19 -6 L 16 9 L 5 16 L -10 15 L -9 6 L 8 6 Z',
    ridges:
      'M -17 -6 L -9 -4 L 9 -4 L 19 -6 M 0 -11 L 0 -4 M -9 -4 L -9 6 L -10 15 M 9 -4 L 8 6 L 5 16 M -9 6 L 8 6',
    glint: 'M -12 -7 L -8 -13 L -3 -9 L -8 -6 Z',
  },
  {
    outer: 'M -12 -15 L 4 -17 L 17 -10 L 19 3 L 12 14 L -3 17 L -16 11 L -19 -3 Z',
    crown: 'M -12 -15 L 4 -17 L 17 -10 L 8 -4 L -9 -5 L -19 -3 Z',
    bevel: 'M 8 -4 L 17 -10 L 19 3 L 12 14 L -3 17 L -7 6 L 9 5 Z',
    ridges:
      'M -19 -3 L -9 -5 L 8 -4 L 17 -10 M 4 -17 L 8 -4 L 9 5 L 12 14 M -9 -5 L -7 6 L -3 17 M -7 6 L 9 5',
    glint: 'M -9 -12 L 2 -14 L 5 -9 L -6 -8 Z',
  },
  {
    outer: 'M -16 -9 L -6 -15 L 3 -13 L 14 -14 L 19 -3 L 15 11 L 2 16 L -12 14 L -19 3 Z',
    crown: 'M -16 -9 L -6 -15 L 3 -13 L 14 -14 L 10 -5 L -8 -5 L -19 3 Z',
    bevel: 'M 10 -5 L 19 -3 L 15 11 L 2 16 L -12 14 L -8 6 L 8 6 Z',
    ridges:
      'M -19 3 L -8 -5 L 10 -5 L 19 -3 M -6 -15 L -8 -5 L -8 6 L -12 14 M 10 -5 L 8 6 L 2 16 M -8 6 L 8 6',
    glint: 'M -12 -8 L -5 -12 L 1 -10 L -6 -7 Z',
  },
];

export interface FieldItem {
  id: number;
  kind: ItemKind;
  x: number;
  y: number;
  radius: number;
  value: number;
  weight: number;
  variant?: number;
}

export type ShopItemId =
  | 'winch'
  | 'clock'
  | 'gemSkill'
  | 'goldSkill'
  | 'luck'
  | 'mason'
  | 'sculptor'
  | 'dynamite'
  | 'tonic';

/**
 * timed: wirkt EFFECT_ROUNDS Runden, danach wieder kaufbar.
 * skill: bis MAX_SKILL Stufen, dauerhaft.
 * Alles außer consumable wird mit jedem Kauf um PRICE_STEP teurer.
 */
export interface ShopItemSpec {
  id: ShopItemId;
  name: string;
  kind: 'timed' | 'skill' | 'consumable';
  cost: number;
  description: string;
}

export const SHOP_ITEMS: readonly ShopItemSpec[] = [
  {
    id: 'winch',
    name: 'Starkes Seil',
    kind: 'timed',
    cost: 100,
    description: '+20 % schnelleres Einziehen für 3 Runden',
  },
  {
    id: 'clock',
    name: 'Taschenuhr',
    kind: 'timed',
    cost: 100,
    description: '+15 Sek. Rundenzeit für 3 Runden',
  },
  {
    id: 'gemSkill',
    name: 'Edelsteinkunde',
    kind: 'skill',
    cost: 150,
    description: 'Edelsteine sind mehr wert',
  },
  {
    id: 'goldSkill',
    name: 'Goldschmiede',
    kind: 'skill',
    cost: 150,
    description: 'Gold ist mehr wert',
  },
  {
    id: 'luck',
    name: 'Glücksklee',
    kind: 'skill',
    cost: 120,
    description: 'Mehr Edelsteine und großes Gold im Feld',
  },
  {
    id: 'mason',
    name: 'Steinmetz',
    kind: 'skill',
    cost: 80,
    description: 'Steine sind 20 statt 10 Gold wert',
  },
  {
    id: 'sculptor',
    name: 'Bildhauer',
    kind: 'skill',
    cost: 120,
    description: 'Steine sind 30 statt 20 Gold wert (nach Steinmetz)',
  },
  {
    id: 'dynamite',
    name: 'Dynamit',
    kind: 'consumable',
    cost: 60,
    description: 'Sprengt schweren Gegenstand am Haken weg',
  },
  {
    id: 'tonic',
    name: 'Krafttrank',
    kind: 'consumable',
    cost: 80,
    description: '15 Sek. deutlich schnelleres Einziehen',
  },
];

/** Edelsteinwert pro Skill-Stufe 0–3 */
export const GEM_VALUES = [200, 275, 350, 450] as const;
/** Goldfaktor pro Skill-Stufe 0–3 */
/** Steinwert: ohne Skill, Steinmetz, Bildhauer */
export const ROCK_VALUES = [10, 20, 30] as const;
export const GOLD_FACTORS = [1, 1.2, 1.4, 1.7] as const;

export type HookPhase = 'swinging' | 'shooting' | 'reeling';
export type GamePhase = 'playing' | 'shop' | 'gameover';

export interface Upgrades {
  luck: number;
  gemSkill: number;
  /** 0 = nichts, 1 = Steinmetz, 2 = Bildhauer */
  rockSkill: number;
  goldSkill: number;
}

/** Verbleibende Runden der zeitlich begrenzten Ausrüstung (0 = aus) */
export interface Effects {
  winch: number;
  clock: number;
}

export interface Consumables {
  dynamite: number;
  tonic: number;
}

export interface State {
  phase: GamePhase;
  round: number;
  target: number;
  /** In der zuletzt beendeten Runde gezahlte Abgabe */
  paidTax: number;
  money: number;
  score: number;
  timeLeft: number;
  angle: number;
  swingDir: 1 | -1;
  ropeLength: number;
  hookPhase: HookPhase;
  grabbed: FieldItem | null;
  items: FieldItem[];
  upgrades: Upgrades;
  effects: Effects;
  /** Anzahl Käufe pro Item, bestimmt den Preis */
  bought: Partial<Record<ShopItemId, number>>;
  consumables: Consumables;
  tonicTimer: number;
  shopPurchased: ShopItemId[];
  lastCollected: FieldItem | null;
}

export interface Input {
  shoot?: boolean;
  useDynamite?: boolean;
  useTonic?: boolean;
}

/** Guthaben, das am Ende einer Runde mindestens da sein muss */
export function roundTarget(round: number): number {
  const r = Math.max(1, Math.floor(round));
  return 400 + 200 * (r - 1) + 40 * (r - 1) * (r - 1);
}

/** Abgabe am Rundenende: die Hälfte des Ziels */
export function roundTax(round: number): number {
  return Math.floor(roundTarget(round) / 2);
}

export function itemValue(
  kind: ItemKind,
  skills: Pick<Upgrades, 'gemSkill' | 'goldSkill' | 'rockSkill'>,
): number {
  if (kind === 'gem') return GEM_VALUES[Math.min(MAX_SKILL, skills.gemSkill)] ?? 200;
  if (kind === 'rock') return ROCK_VALUES[Math.min(2, skills.rockSkill)] ?? 10;
  const factor = GOLD_FACTORS[Math.min(MAX_SKILL, skills.goldSkill)] ?? 1;
  return Math.round(ITEM_STATS[kind].value * factor);
}

export function shopPrice(s: Pick<State, 'bought'>, id: ShopItemId): number {
  const spec = SHOP_ITEMS.find((item) => item.id === id);
  if (!spec) return Number.POSITIVE_INFINITY;
  if (spec.kind === 'consumable') return spec.cost;
  return spec.cost + PRICE_STEP * (s.bought[id] ?? 0);
}

/** Bildhauer erscheint erst im Shop nach dem, in dem der Steinmetz gekauft wurde */
export function shopItemVisible(
  s: Pick<State, 'upgrades' | 'shopPurchased'>,
  id: ShopItemId,
): boolean {
  if (id !== 'sculptor') return true;
  return s.upgrades.rockSkill >= 1 && !s.shopPurchased.includes('mason');
}

/** Ob das Item gerade grundsätzlich kaufbar ist (ohne Geldprüfung) */
export function canBuy(s: Pick<State, 'effects' | 'upgrades' | 'shopPurchased'>, id: ShopItemId) {
  if (s.shopPurchased.includes(id)) return false;
  if (id === 'winch' || id === 'clock') return s.effects[id] === 0;
  if (id === 'gemSkill' || id === 'goldSkill' || id === 'luck') return s.upgrades[id] < MAX_SKILL;
  if (id === 'mason') return s.upgrades.rockSkill === 0;
  if (id === 'sculptor') return s.upgrades.rockSkill === 1 && shopItemVisible(s, id);
  return true;
}

export function roundTime(effects: Effects): number {
  return ROUND_TIME + (effects.clock > 0 ? EXTRA_TIME : 0);
}

export function hookPosition(s: Pick<State, 'angle' | 'ropeLength'>): { x: number; y: number } {
  return {
    x: ORIGIN_X + Math.sin(s.angle) * s.ropeLength,
    y: ORIGIN_Y + Math.cos(s.angle) * s.ropeLength,
  };
}

export function reelSpeedFor(s: Pick<State, 'grabbed' | 'effects' | 'tonicTimer'>): number {
  const base = s.grabbed ? ITEM_STATS[s.grabbed.kind].pullSpeed : EMPTY_REEL_SPEED;
  const winchMul = s.effects.winch > 0 ? 1 + WINCH_BONUS : 1;
  const tonicMul = s.tonicTimer > 0 ? 1.8 : 1;
  return base * winchMul * tonicMul;
}

const NO_SKILLS = { gemSkill: 0, goldSkill: 0, rockSkill: 0 };

export function spawnItems(
  round: number,
  luckLevel: number,
  rng: Rng,
  skills: Pick<Upgrades, 'gemSkill' | 'goldSkill' | 'rockSkill'> = NO_SKILLS,
): FieldItem[] {
  const r = Math.max(1, round);
  const kinds: ItemKind[] = [];

  const tinyGoldCount = 4;
  const smallGoldCount = 5;
  const largeGoldCount = 3 + Math.min(3, Math.floor((r - 1) / 2)) + Math.min(MAX_SKILL, luckLevel);
  // Später deutlich mehr Edelsteine (Runde 1: 1, Runde 5: 3, Runde 9: 5, max. 8)
  const gemCount = Math.min(8, 1 + Math.floor((r - 1) / 2) + luckLevel);
  const rockCount = Math.min(8, 3 + r);

  for (let i = 0; i < largeGoldCount; i++) kinds.push('gold_large');
  for (let i = 0; i < gemCount; i++) kinds.push('gem');
  for (let i = 0; i < smallGoldCount; i++) kinds.push('gold_small');
  for (let i = 0; i < tinyGoldCount; i++) kinds.push('gold_tiny');
  for (let i = 0; i < rockCount; i++) kinds.push('rock');

  const items: FieldItem[] = [];
  let nextId = 1;
  const variantOffset = rng.int(0, NUGGET_SHAPES.length - 1);

  for (const kind of kinds) {
    const spec = ITEM_STATS[kind];
    const value = itemValue(kind, skills);
    const variant = (nextId - 1 + variantOffset) % NUGGET_SHAPES.length;
    const marginX = spec.radius + 16;
    const minY =
      kind === 'gem'
        ? GROUND_Y + 130
        : kind === 'gold_large'
          ? GROUND_Y + 95
          : GROUND_Y + 36 + spec.radius;
    const maxY = HEIGHT - spec.radius - 16;

    let placed = false;
    for (let attempt = 0; attempt < 40; attempt++) {
      const x = rng.int(marginX, WIDTH - marginX);
      const y = rng.int(Math.min(minY, maxY - 10), maxY);
      const overlaps = items.some((other) => {
        const dx = other.x - x;
        const dy = other.y - y;
        const minDist = other.radius + spec.radius + 10;
        return dx * dx + dy * dy < minDist * minDist;
      });
      if (!overlaps) {
        items.push({
          id: nextId++,
          kind,
          x,
          y,
          radius: spec.radius,
          value,
          weight: spec.weight,
          variant,
        });
        placed = true;
        break;
      }
    }
    if (!placed) {
      items.push({
        id: nextId++,
        kind,
        x: rng.int(marginX, WIDTH - marginX),
        y: rng.int(GROUND_Y + 42, maxY),
        radius: spec.radius,
        value,
        weight: spec.weight,
        variant,
      });
    }
  }

  return items;
}

export function createState(rng: Rng): State {
  return {
    phase: 'playing',
    round: 1,
    target: roundTarget(1),
    paidTax: 0,
    money: 0,
    score: 0,
    timeLeft: ROUND_TIME,
    angle: 0,
    swingDir: 1,
    ropeLength: MIN_ROPE,
    hookPhase: 'swinging',
    grabbed: null,
    items: spawnItems(1, 0, rng),
    upgrades: { luck: 0, gemSkill: 0, goldSkill: 0, rockSkill: 0 },
    effects: { winch: 0, clock: 0 },
    bought: {},
    consumables: { dynamite: 0, tonic: 0 },
    tonicTimer: 0,
    shopPurchased: [],
    lastCollected: null,
  };
}

export const isOver = (s: State): boolean => s.phase === 'gameover';

export function shootHook(s: State): State {
  if (s.phase !== 'playing' || s.hookPhase !== 'swinging') return s;
  return { ...s, hookPhase: 'shooting', lastCollected: null };
}

export function activateConsumable(s: State, kind: 'dynamite' | 'tonic'): State {
  if (s.phase !== 'playing') return s;
  if (kind === 'dynamite') {
    if (s.consumables.dynamite <= 0 || s.hookPhase !== 'reeling' || !s.grabbed) return s;
    return {
      ...s,
      grabbed: null,
      consumables: { ...s.consumables, dynamite: s.consumables.dynamite - 1 },
    };
  }
  if (s.consumables.tonic <= 0 || s.tonicTimer > 0) return s;
  return {
    ...s,
    tonicTimer: TONIC_DURATION,
    consumables: { ...s.consumables, tonic: s.consumables.tonic - 1 },
  };
}

export function buyShopItem(s: State, id: ShopItemId): State {
  if (s.phase !== 'shop' || !canBuy(s, id)) return s;
  const price = shopPrice(s, id);
  if (s.money < price) return s;

  const upgrades = { ...s.upgrades };
  const effects = { ...s.effects };
  const consumables = { ...s.consumables };
  if (id === 'winch' || id === 'clock') effects[id] = EFFECT_ROUNDS;
  else if (id === 'gemSkill' || id === 'goldSkill' || id === 'luck') upgrades[id] += 1;
  else if (id === 'mason' || id === 'sculptor') upgrades.rockSkill += 1;
  else consumables[id] += 1;

  return {
    ...s,
    money: s.money - price,
    upgrades,
    effects,
    consumables,
    bought: { ...s.bought, [id]: (s.bought[id] ?? 0) + 1 },
    shopPurchased: [...s.shopPurchased, id],
  };
}

export function nextRound(s: State, rng: Rng): State {
  if (s.phase !== 'shop') return s;
  const round = s.round + 1;
  return {
    ...s,
    phase: 'playing',
    round,
    target: roundTarget(round),
    timeLeft: roundTime(s.effects),
    angle: 0,
    swingDir: 1,
    ropeLength: MIN_ROPE,
    hookPhase: 'swinging',
    grabbed: null,
    items: spawnItems(round, s.upgrades.luck, rng, s.upgrades),
    tonicTimer: 0,
    shopPurchased: [],
    lastCollected: null,
  };
}

export function update(s: State, input: Input, dt: number): State {
  if (s.phase !== 'playing' || dt <= 0) return s;

  let next: State = { ...s, lastCollected: null };

  if (input.useDynamite) next = activateConsumable(next, 'dynamite');
  if (input.useTonic) next = activateConsumable(next, 'tonic');
  if (input.shoot) next = shootHook(next);

  const timeLeft = Math.max(0, next.timeLeft - dt);
  const tonicTimer = Math.max(0, next.tonicTimer - dt);

  let { angle, swingDir, ropeLength, hookPhase, grabbed, items, money, score, lastCollected } =
    next;
  let { effects, paidTax } = next;

  if (hookPhase === 'swinging') {
    angle += swingDir * SWING_SPEED * dt;
    if (angle >= MAX_ANGLE) {
      angle = MAX_ANGLE;
      swingDir = -1;
    } else if (angle <= -MAX_ANGLE) {
      angle = -MAX_ANGLE;
      swingDir = 1;
    }
  } else if (hookPhase === 'shooting') {
    ropeLength += SHOOT_SPEED * dt;
    const tip = hookPosition({ angle, ropeLength });

    const hitIndex = items.findIndex((item) => {
      const dx = item.x - tip.x;
      const dy = item.y - tip.y;
      const hitDist = item.radius + HOOK_RADIUS;
      return dx * dx + dy * dy <= hitDist * hitDist;
    });

    if (hitIndex !== -1) {
      const hitItem = items[hitIndex] as FieldItem;
      grabbed = hitItem;
      items = items.filter((_, i) => i !== hitIndex);
      hookPhase = 'reeling';
    } else if (
      tip.x <= 12 ||
      tip.x >= WIDTH - 12 ||
      tip.y >= HEIGHT - 12 ||
      ropeLength >= MAX_ROPE
    ) {
      hookPhase = 'reeling';
    }
  } else if (hookPhase === 'reeling') {
    const speed = reelSpeedFor({ grabbed, effects, tonicTimer });
    ropeLength -= speed * dt;
    if (ropeLength <= MIN_ROPE) {
      ropeLength = MIN_ROPE;
      hookPhase = 'swinging';
      if (grabbed) {
        score += grabbed.value;
        money += grabbed.value;
        lastCollected = grabbed;
        grabbed = null;
      }
    }
  }

  const fieldCleared = items.length === 0 && grabbed === null;
  let phase: GamePhase = next.phase;

  if (timeLeft <= 0 || fieldCleared) {
    if (money >= next.target) {
      phase = 'shop';
      paidTax = roundTax(next.round);
      money -= paidTax;
      effects = {
        winch: Math.max(0, effects.winch - 1),
        clock: Math.max(0, effects.clock - 1),
      };
      hookPhase = 'swinging';
      ropeLength = MIN_ROPE;
      grabbed = null;
    } else {
      phase = 'gameover';
    }
  }

  return {
    ...next,
    phase,
    timeLeft,
    tonicTimer,
    angle,
    swingDir,
    ropeLength,
    hookPhase,
    grabbed,
    items,
    money,
    score,
    effects,
    paidTax,
    lastCollected,
  };
}
