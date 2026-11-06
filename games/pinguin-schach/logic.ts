// Spielablauf Pinguin-Schach: Du (Weiß) gegen den Pinguin (Schwarz).
// Online: zwei Menschen, der Host spielt Weiß, der Gast Schwarz.
import type { Rng } from '@core/sdk';
import {
  applyMove,
  bestMove,
  type Color,
  inCheck,
  insufficientMaterial,
  legalMoves,
  type Move,
  newPosition,
  type Position,
  san,
} from './engine.ts';

export interface Level {
  name: string;
  depth: number;
  noise: number;
  /** Anteil zufälliger Züge (nur "Leicht") */
  random: number;
}

export const LEVELS: Level[] = [
  { name: 'Leicht', depth: 1, noise: 140, random: 0.45 },
  { name: 'Normal', depth: 2, noise: 30, random: 0 },
  { name: 'Schwer', depth: 3, noise: 6, random: 0 },
];

export interface Result {
  outcome: 'win' | 'lose' | 'draw';
  message: string;
}

export interface Game {
  /** Eigene Farbe */
  me: Color;
  /** Gegen einen Menschen statt gegen den Pinguin */
  online: boolean;
  pos: Position;
  /** Züge in SAN, abwechselnd Weiß und Schwarz */
  history: string[];
  /** Stellungen vor jedem eigenen Zug, für "Zug zurück" */
  undoStack: { pos: Position; historyLength: number }[];
  result: Result | null;
}

export function createGame(me: Color = 'w', online = false): Game {
  return { me, online, pos: newPosition(), history: [], undoStack: [], result: null };
}

/** Anzahl eigener Züge = Score. Weiß zieht bei geraden, Schwarz bei ungeraden Halbzügen. */
export const playerMoveCount = (g: Game) =>
  g.me === 'w' ? Math.ceil(g.history.length / 2) : Math.floor(g.history.length / 2);

export const myTurn = (g: Game) => !g.result && g.pos.turn === g.me;

/** Legale Züge der eigenen Figur auf `from`. Bei Beförderung nur die Dame (einfacher). */
export function movesFrom(g: Game, from: number): Move[] {
  if (!myTurn(g)) return [];
  return legalMoves(g.pos).filter((m) => m.from === from && (!m.promo || m.promo === 'q'));
}

/** Kurzform eines Zugs für die Leitung, z. B. "52-36" oder "12-4q". */
export const moveKey = (m: Move) => `${m.from}-${m.to}${m.promo ?? ''}`;

/** Zug des Mitspielers anwenden. `null`, wenn er in dieser Stellung nicht legal ist. */
export function playKey(g: Game, key: string): Game | null {
  if (g.result) return null;
  const m = legalMoves(g.pos).find((x) => moveKey(x) === key);
  return m ? play(g, m) : null;
}

export function play(g: Game, m: Move): Game {
  if (g.result) return g;
  const undoStack =
    m.color === g.me
      ? [...g.undoStack, { pos: g.pos, historyLength: g.history.length }]
      : g.undoStack;
  const pos = applyMove(g.pos, m);
  const history = [...g.history, san(g.pos, m)];
  const next = { ...g, pos, history, undoStack };
  return { ...next, result: resultOf(pos, playerMoveCount(next), g.me, g.online) };
}

export function resultOf(
  pos: Position,
  moves: number,
  me: Color = 'w',
  online = false,
): Result | null {
  if (legalMoves(pos).length === 0) {
    if (!inCheck(pos, pos.turn))
      return { outcome: 'draw', message: 'Patt. Der Keks war zu klein für zwei.' };
    if (pos.turn !== me) {
      return {
        outcome: 'win',
        message: online
          ? `Schach matt in ${moves} Zügen. Gut gespielt!`
          : `Schach matt in ${moves} Zügen. Der Pinguin wird zur Möwe.`,
      };
    }
    return {
      outcome: 'lose',
      message: online
        ? 'Schach matt. Revanche mit „Nochmal“?'
        : 'Schach matt. Der Pinguin watschelt triumphierend davon.',
    };
  }
  if (pos.half >= 100)
    return { outcome: 'draw', message: '50 Züge ohne Schlagen. Alle sind hungrig.' };
  if (insufficientMaterial(pos.board)) {
    return { outcome: 'draw', message: 'Zu wenig Material. Remis.' };
  }
  return null;
}

/** Zug des Pinguins oder null, wenn er nicht dran ist. */
export function pinguinMove(g: Game, level: Level, rng: Rng): Move | null {
  if (g.online || g.result || g.pos.turn === g.me) return null;
  const moves = legalMoves(g.pos);
  if (moves.length === 0) return null;
  if (rng.next() < level.random) return rng.pick(moves);
  return bestMove(g.pos, level.depth, level.noise, rng);
}

/** Nimmt den letzten eigenen Zug samt Antwort des Pinguins zurück. */
export function undo(g: Game): Game {
  const last = g.undoStack.at(-1);
  if (!last) return g;
  return {
    ...g,
    pos: last.pos,
    history: g.history.slice(0, last.historyLength),
    undoStack: g.undoStack.slice(0, -1),
    result: null,
  };
}

export const QUIPS = [
  'Der Pinguin rutscht elegant eine Flosse weiter.',
  'Der Pinguin nennt das intern „Taktik“.',
  'Der Pinguin verzieht den Schnabel. Das heißt: Planänderung.',
  'Der Pinguin murmelt etwas in Antarktisch.',
  'Der Pinguin guckt kurz nach links. Das war geplant.',
  'Der Pinguin hüpft. Er nennt es Intuition.',
];

export const CAPTURE_QUIPS = [
  'Der Pinguin kapert dein Teil. Piratenregeln.',
  '„Der Keks war fett, der war gedacht.“',
  'Der Pinguin nennt das Aufräumen.',
];

export const PLAYER_CAPTURE_QUIPS = [
  'Sauber geschlagen. Der Pinguin leidet.',
  '„Danke für die Ablöse.“',
  'Rücksichtslos, aber effektiv.',
];
