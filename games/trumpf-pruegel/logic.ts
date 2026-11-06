// Trumpf & Prügel: Wähle 3 von 5 Karten. Poker-Kombos machen Schaden, Kreuz blockt, Herz heilt.
// Besiege fünf Gegner nacheinander. Punkte = gesamter Schaden.
import type { Rng } from '@core/sdk';

export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';

export interface Card {
  id: string;
  suit: Suit;
  /** 2..14 (14 = Ass) */
  value: number;
}

export interface Enemy {
  name: string;
  hp: number;
  damage: number;
  quip: string;
}

export const ENEMIES: Enemy[] = [
  { name: 'Graf Quakula', hp: 24, damage: 6, quip: '„Quak. Das war eine Drohung.“' },
  { name: 'Baronin von Biss', hp: 30, damage: 8, quip: '„Dein Pokerface ist … niedlich.“' },
  { name: 'Der Keks-Koloss', hp: 38, damage: 10, quip: '„Krümel? Das sind meine Kinder!“' },
  { name: 'DJ Knochenbrecher', hp: 44, damage: 11, quip: '„Ich leg gleich auf. Dich.“' },
  {
    name: 'König Krawallo',
    hp: 52,
    damage: 13,
    quip: '„Der Hofstaat ist übrigens auch bewaffnet.“',
  },
];

export const MAX_HP = 30;
export const HAND_SIZE = 5;
export const PICK = 3;
const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];

export type Phase = 'choose' | 'enemy-down' | 'champion' | 'lost';

export interface State {
  hp: number;
  block: number;
  enemyIndex: number;
  enemyHp: number;
  hand: Card[];
  deck: Card[];
  selected: string[];
  damageDealt: number;
  phase: Phase;
  message: string;
  deckCount: number;
}

export interface Combo {
  name: string;
  damage: number;
  shield: number;
  heal: number;
}

function newDeck(rng: Rng, n: number): Card[] {
  const cards = SUITS.flatMap((suit) =>
    Array.from({ length: 13 }, (_, i) => ({ id: `${n}-${suit}-${i + 2}`, suit, value: i + 2 })),
  );
  return rng.shuffle(cards);
}

/** Zieht auf fünf Karten auf. Ist der Stapel leer, wird ein neuer gemischt. */
function drawUp(s: State, rng: Rng): Pick<State, 'hand' | 'deck' | 'deckCount'> {
  let { deck, deckCount } = s;
  const hand = [...s.hand];
  while (hand.length < HAND_SIZE) {
    if (deck.length === 0) {
      deckCount += 1;
      deck = newDeck(rng, deckCount);
    }
    hand.push(deck[deck.length - 1] as Card);
    deck = deck.slice(0, -1);
  }
  return { hand, deck, deckCount };
}

export function createRun(rng: Rng): State {
  const base: State = {
    hp: MAX_HP,
    block: 0,
    enemyIndex: 0,
    enemyHp: (ENEMIES[0] as Enemy).hp,
    hand: [],
    deck: newDeck(rng, 0),
    deckCount: 0,
    selected: [],
    damageDealt: 0,
    phase: 'choose',
    message: 'Wähle 3 Karten. Kombos machen mehr Schaden.',
  };
  return { ...base, ...drawUp(base, rng) };
}

export const enemyOf = (s: State) => ENEMIES[s.enemyIndex] as Enemy;

export function toggleCard(s: State, id: string): State {
  if (s.phase !== 'choose') return s;
  if (s.selected.includes(id)) return { ...s, selected: s.selected.filter((x) => x !== id) };
  if (s.selected.length >= PICK) return s;
  return { ...s, selected: [...s.selected, id] };
}

export function evaluate(cards: Card[]): Combo {
  const values = cards.map((c) => c.value).sort((a, b) => a - b);
  const counts = [...new Set(values)].map((v) => values.filter((x) => x === v).length);
  const sameSuit = cards.every((c) => c.suit === cards[0]?.suit);
  const straight =
    values.length === 3 && values[1] === (values[0] ?? 0) + 1 && values[2] === (values[1] ?? 0) + 1;

  let [name, multiplier, bonus] = ['Hohe Karte', 1, 0] as [string, number, number];
  if (straight && sameSuit) [name, multiplier, bonus] = ['Straight Flush', 2.3, 9];
  else if (counts.includes(3)) [name, multiplier, bonus] = ['Drilling', 1.9, 7];
  else if (straight) [name, multiplier, bonus] = ['Straße', 1.7, 5];
  else if (sameSuit) [name, multiplier, bonus] = ['Flush', 1.55, 4];
  else if (counts.includes(2)) [name, multiplier, bonus] = ['Paar', 1.35, 3];

  const count = (suit: Suit) => cards.filter((c) => c.suit === suit).length;
  const rankPoints = cards.reduce((sum, c) => sum + Math.max(1, c.value - 1), 0);
  return {
    name,
    damage: Math.round(
      rankPoints * 0.55 * multiplier + bonus + count('spades') * 2 + count('diamonds') * 2,
    ),
    shield: count('clubs') * 3,
    heal: count('hearts') * 2,
  };
}

export const selectedCards = (s: State) =>
  s.selected.map((id) => s.hand.find((c) => c.id === id)).filter((c): c is Card => !!c);

/** Eigener Angriff mit den gewählten Karten, danach schlägt der Gegner zurück. */
export function playHand(s: State, rng: Rng): State {
  if (s.phase !== 'choose' || s.selected.length !== PICK) return s;
  const combo = evaluate(selectedCards(s));
  const enemy = enemyOf(s);
  const dealt = Math.min(s.enemyHp, combo.damage);
  const after: State = {
    ...s,
    hand: s.hand.filter((c) => !s.selected.includes(c.id)),
    selected: [],
    enemyHp: s.enemyHp - dealt,
    damageDealt: s.damageDealt + dealt,
    block: s.block + combo.shield,
    hp: Math.min(MAX_HP, s.hp + combo.heal),
  };
  const extras = [combo.heal && `+${combo.heal} Heilung`, combo.shield && `+${combo.shield} Block`]
    .filter(Boolean)
    .join(', ');
  const attack = `${combo.name}: ${combo.damage} Schaden${extras ? `, ${extras}` : ''}.`;

  if (after.enemyHp <= 0) {
    const last = s.enemyIndex === ENEMIES.length - 1;
    return {
      ...after,
      phase: last ? 'champion' : 'enemy-down',
      message: `${attack} ${enemy.name} ist K.O.!`,
    };
  }

  const blocked = Math.min(after.block, enemy.damage);
  const taken = enemy.damage - blocked;
  const hp = Math.max(0, after.hp - taken);
  const counter = blocked
    ? `${enemy.name} haut zurück: ${blocked} geblockt, ${taken} Schaden.`
    : `${enemy.name} haut zurück: ${taken} Schaden.`;
  if (hp === 0)
    return {
      ...after,
      hp,
      block: after.block - blocked,
      phase: 'lost',
      message: `${attack} ${counter}`,
    };
  const next = { ...after, hp, block: after.block - blocked, message: `${attack} ${counter}` };
  return { ...next, ...drawUp(next, rng) };
}

/** Nach einem K.O.: nächster Gegner, +5 Leben, Block weg, frische Hand. */
export function nextEnemy(s: State, rng: Rng): State {
  if (s.phase !== 'enemy-down') return s;
  const enemyIndex = s.enemyIndex + 1;
  const enemy = ENEMIES[enemyIndex] as Enemy;
  const base: State = {
    ...s,
    enemyIndex,
    enemyHp: enemy.hp,
    hp: Math.min(MAX_HP, s.hp + 5),
    block: 0,
    hand: [],
    deck: [],
    selected: [],
    phase: 'choose',
    message: `+5 Leben. ${enemy.name} betritt die Arena.`,
  };
  return { ...base, ...drawUp(base, rng) };
}
