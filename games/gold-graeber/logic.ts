import type { Rng } from '@core/sdk';

export const WIDTH = 480;
export const HEIGHT = 360;
export const ORIGIN_X = WIDTH / 2;
export const ORIGIN_Y = 50;
export const GROUND_Y = 58;
export const ROUND_TIME = 90;

export const MIN_ROPE = 22;
export const MAX_ROPE = 410;
export const MAX_ANGLE = 1.25;
export const SWING_SPEED = 1.55;
export const SHOOT_SPEED = 270;
export const EMPTY_REEL_SPEED = 290;
export const HOOK_RADIUS = 7;
export const TONIC_DURATION = 15;

export type ItemKind = 'gold_small' | 'gold_large' | 'gem' | 'rock';

export interface ItemSpec {
  kind: ItemKind;
  label: string;
  value: number;
  radius: number;
  weight: number;
  pullSpeed: number;
}

export const ITEM_STATS: Record<ItemKind, ItemSpec> = {
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

export type ShopItemId = 'winch' | 'luck' | 'dynamite' | 'tonic';

export interface ShopItemSpec {
  id: ShopItemId;
  name: string;
  kind: 'upgrade' | 'consumable';
  cost: number;
  description: string;
}

export const SHOP_ITEMS: readonly ShopItemSpec[] = [
  {
    id: 'winch',
    name: 'Starkes Seil',
    kind: 'upgrade',
    cost: 100,
    description: 'Dauerhaft +35 % schnelleres Einziehen',
  },
  {
    id: 'luck',
    name: 'Glücksklee',
    kind: 'upgrade',
    cost: 120,
    description: 'Dauerhaft mehr Edelsteine und großes Gold',
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

export type HookPhase = 'swinging' | 'shooting' | 'reeling';
export type GamePhase = 'playing' | 'shop' | 'gameover';

export interface Upgrades {
  winch: number;
  luck: number;
}

export interface Consumables {
  dynamite: number;
  tonic: number;
}

export interface State {
  phase: GamePhase;
  round: number;
  target: number;
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

/** Steigendes Geldziel pro Runde (Runde 1: 250, Runde 2: 600, Runde 3: 1050, …) */
export function roundTarget(round: number): number {
  const r = Math.max(1, Math.floor(round));
  return 250 * r + 100 * ((r * (r - 1)) / 2);
}

export function hookPosition(s: Pick<State, 'angle' | 'ropeLength'>): { x: number; y: number } {
  return {
    x: ORIGIN_X + Math.sin(s.angle) * s.ropeLength,
    y: ORIGIN_Y + Math.cos(s.angle) * s.ropeLength,
  };
}

export function reelSpeedFor(s: Pick<State, 'grabbed' | 'upgrades' | 'tonicTimer'>): number {
  const base = s.grabbed ? ITEM_STATS[s.grabbed.kind].pullSpeed : EMPTY_REEL_SPEED;
  const winchMul = 1 + s.upgrades.winch * 0.35;
  const tonicMul = s.tonicTimer > 0 ? 1.8 : 1;
  return base * winchMul * tonicMul;
}

export function spawnItems(round: number, luckLevel: number, rng: Rng): FieldItem[] {
  const r = Math.max(1, round);
  const kinds: ItemKind[] = [];

  const smallGoldCount = 5;
  const largeGoldCount = 3 + Math.min(3, Math.floor((r - 1) / 2)) + Math.min(2, luckLevel);
  const gemCount = Math.min(4, Math.floor(r / 2) + 1 + luckLevel);
  const rockCount = Math.min(8, 3 + r);

  for (let i = 0; i < largeGoldCount; i++) kinds.push('gold_large');
  for (let i = 0; i < gemCount; i++) kinds.push('gem');
  for (let i = 0; i < smallGoldCount; i++) kinds.push('gold_small');
  for (let i = 0; i < rockCount; i++) kinds.push('rock');

  const items: FieldItem[] = [];
  let nextId = 1;
  const variantOffset = rng.int(0, NUGGET_SHAPES.length - 1);

  for (const kind of kinds) {
    const spec = ITEM_STATS[kind];
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
          value: spec.value,
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
        value: spec.value,
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
    money: 0,
    score: 0,
    timeLeft: ROUND_TIME,
    angle: 0,
    swingDir: 1,
    ropeLength: MIN_ROPE,
    hookPhase: 'swinging',
    grabbed: null,
    items: spawnItems(1, 0, rng),
    upgrades: { winch: 0, luck: 0 },
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
  if (s.phase !== 'shop') return s;
  if (s.shopPurchased.includes(id)) return s;
  const spec = SHOP_ITEMS.find((item) => item.id === id);
  if (!spec || s.money < spec.cost) return s;

  const upgrades = { ...s.upgrades };
  const consumables = { ...s.consumables };
  if (id === 'winch') upgrades.winch += 1;
  else if (id === 'luck') upgrades.luck += 1;
  else if (id === 'dynamite') consumables.dynamite += 1;
  else if (id === 'tonic') consumables.tonic += 1;

  return {
    ...s,
    money: s.money - spec.cost,
    upgrades,
    consumables,
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
    timeLeft: ROUND_TIME,
    angle: 0,
    swingDir: 1,
    ropeLength: MIN_ROPE,
    hookPhase: 'swinging',
    grabbed: null,
    items: spawnItems(round, s.upgrades.luck, rng),
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
    const speed = reelSpeedFor({ grabbed, upgrades: next.upgrades, tonicTimer });
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
    lastCollected,
  };
}
