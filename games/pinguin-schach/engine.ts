// Schachregeln und KI, portiert aus legacy/chess/chess.js (dort per Perft geprüft).
// Brett-Index: 0 = a8, 7 = h8, 56 = a1, 63 = h1.
import type { Rng } from '@core/sdk';

export type Color = 'w' | 'b';
export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';

export interface Piece {
  t: PieceType;
  c: Color;
}

export interface Position {
  board: (Piece | null)[];
  turn: Color;
  castle: { wk: boolean; wq: boolean; bk: boolean; bq: boolean };
  /** En-passant-Zielfeld oder -1 */
  ep: number;
  /** Halbzüge seit Schlagen/Bauernzug (50-Züge-Regel) */
  half: number;
  full: number;
  last: { from: number; to: number } | null;
}

export interface Move {
  from: number;
  to: number;
  piece: PieceType;
  color: Color;
  captured: Piece | null;
  promo?: PieceType;
  dbl?: boolean;
  ep?: boolean;
  castle?: 'K' | 'Q';
  rook?: number;
  rookTo?: number;
}

export const VALUE: Record<PieceType, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
const FILES = 'abcdefgh';

export const other = (c: Color): Color => (c === 'w' ? 'b' : 'w');
export const sq = (f: number, r: number) => r * 8 + f;
export const fileOf = (i: number) => i % 8;
export const rankOf = (i: number) => Math.floor(i / 8);
export const nameOf = (i: number) => `${FILES[fileOf(i)]}${8 - rankOf(i)}`;
const inside = (f: number, r: number) => f >= 0 && f <= 7 && r >= 0 && r <= 7;

const KNIGHT = [
  [1, 2],
  [2, 1],
  [2, -1],
  [1, -2],
  [-1, -2],
  [-2, -1],
  [-2, 1],
  [-1, 2],
] as const;
const DIAG = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
] as const;
const ORTHO = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;
const PROMOS: PieceType[] = ['q', 'r', 'b', 'n'];

export function newPosition(): Position {
  const board: (Piece | null)[] = new Array(64).fill(null);
  const back: PieceType[] = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
  for (let f = 0; f < 8; f++) {
    board[f] = { t: back[f] as PieceType, c: 'b' };
    board[8 + f] = { t: 'p', c: 'b' };
    board[48 + f] = { t: 'p', c: 'w' };
    board[56 + f] = { t: back[f] as PieceType, c: 'w' };
  }
  return {
    board,
    turn: 'w',
    castle: { wk: true, wq: true, bk: true, bq: true },
    ep: -1,
    half: 0,
    full: 1,
    last: null,
  };
}

export function clonePosition(s: Position): Position {
  return {
    board: s.board.map((p) => (p ? { ...p } : null)),
    turn: s.turn,
    castle: { ...s.castle },
    ep: s.ep,
    half: s.half,
    full: s.full,
    last: s.last ? { ...s.last } : null,
  };
}

export function findKing(board: (Piece | null)[], color: Color): number {
  return board.findIndex((p) => p?.t === 'k' && p.c === color);
}

export function isAttacked(board: (Piece | null)[], target: number, by: Color): boolean {
  const tf = fileOf(target);
  const tr = rankOf(target);
  const at = (f: number, r: number) => (inside(f, r) ? board[sq(f, r)] : null);

  const pawnRow = tr + (by === 'w' ? 1 : -1);
  for (const df of [-1, 1]) {
    const p = at(tf + df, pawnRow);
    if (p && p.c === by && p.t === 'p') return true;
  }
  for (const [df, dr] of KNIGHT) {
    const p = at(tf + df, tr + dr);
    if (p && p.c === by && p.t === 'n') return true;
  }
  const slide = (dirs: readonly (readonly [number, number])[], types: PieceType[]) => {
    for (const [df, dr] of dirs) {
      let f = tf + df;
      let r = tr + dr;
      while (inside(f, r)) {
        const p = board[sq(f, r)];
        if (p) {
          if (p.c === by && types.includes(p.t)) return true;
          break;
        }
        f += df;
        r += dr;
      }
    }
    return false;
  };
  if (slide(DIAG, ['b', 'q']) || slide(ORTHO, ['r', 'q'])) return true;
  for (let df = -1; df <= 1; df++) {
    for (let dr = -1; dr <= 1; dr++) {
      if (!df && !dr) continue;
      const p = at(tf + df, tr + dr);
      if (p && p.c === by && p.t === 'k') return true;
    }
  }
  return false;
}

export function inCheck(s: Position, color: Color): boolean {
  const k = findKing(s.board, color);
  return k >= 0 && isAttacked(s.board, k, other(color));
}

function castleMoves(s: Position, side: Color): Move[] {
  const row = side === 'w' ? 7 : 0;
  const from = sq(4, row);
  const k = s.board[from];
  if (k?.t !== 'k' || k.c !== side) return [];
  const enemy = other(side);
  if (isAttacked(s.board, from, enemy)) return [];
  const free = (...files: number[]) => files.every((f) => !s.board[sq(f, row)]);
  const safe = (...files: number[]) => files.every((f) => !isAttacked(s.board, sq(f, row), enemy));
  const out: Move[] = [];
  const base = { from, piece: 'k' as const, color: side, captured: null };
  if ((side === 'w' ? s.castle.wk : s.castle.bk) && free(5, 6) && safe(5, 6)) {
    out.push({ ...base, to: sq(6, row), castle: 'K', rook: sq(7, row), rookTo: sq(5, row) });
  }
  if ((side === 'w' ? s.castle.wq : s.castle.bq) && free(1, 2, 3) && safe(2, 3)) {
    out.push({ ...base, to: sq(2, row), castle: 'Q', rook: sq(0, row), rookTo: sq(3, row) });
  }
  return out;
}

/** Pseudolegale Züge (König darf noch im Schach stehen). */
function genMoves(s: Position, color: Color): Move[] {
  const b = s.board;
  const moves: Move[] = [];
  const push = (from: number, to: number, extra: Partial<Move> = {}) => {
    const p = b[from] as Piece;
    const t = b[to];
    moves.push({ from, to, piece: p.t, color: p.c, captured: t ? { ...t } : null, ...extra });
  };

  for (let i = 0; i < 64; i++) {
    const p = b[i];
    if (!p || p.c !== color) continue;
    const f = fileOf(i);
    const r = rankOf(i);

    if (p.t === 'p') {
      const dir = color === 'w' ? -1 : 1;
      const startRow = color === 'w' ? 6 : 1;
      const lastRow = color === 'w' ? 0 : 7;
      const one = r + dir;
      if (inside(f, one) && !b[sq(f, one)]) {
        if (one === lastRow) for (const pr of PROMOS) push(i, sq(f, one), { promo: pr });
        else {
          push(i, sq(f, one));
          if (r === startRow && !b[sq(f, r + 2 * dir)]) push(i, sq(f, r + 2 * dir), { dbl: true });
        }
      }
      for (const df of [-1, 1]) {
        const nf = f + df;
        if (!inside(nf, one)) continue;
        const target = b[sq(nf, one)];
        if (target && target.c !== color) {
          if (one === lastRow) for (const pr of PROMOS) push(i, sq(nf, one), { promo: pr });
          else push(i, sq(nf, one));
        } else if (!target && s.ep === sq(nf, one)) {
          push(i, sq(nf, one), { ep: true, captured: { t: 'p', c: other(color) } });
        }
      }
    } else if (p.t === 'n' || p.t === 'k') {
      const steps = p.t === 'n' ? KNIGHT : [...DIAG, ...ORTHO];
      for (const [df, dr] of steps) {
        const nf = f + df;
        const nr = r + dr;
        if (!inside(nf, nr)) continue;
        const t = b[sq(nf, nr)];
        if (!t || t.c !== color) push(i, sq(nf, nr));
      }
      if (p.t === 'k') moves.push(...castleMoves(s, color));
    } else {
      const dirs = p.t === 'b' ? DIAG : p.t === 'r' ? ORTHO : [...DIAG, ...ORTHO];
      for (const [df, dr] of dirs) {
        let nf = f + df;
        let nr = r + dr;
        while (inside(nf, nr)) {
          const t = b[sq(nf, nr)];
          if (!t) push(i, sq(nf, nr));
          else {
            if (t.c !== color) push(i, sq(nf, nr));
            break;
          }
          nf += df;
          nr += dr;
        }
      }
    }
  }
  return moves;
}

/** Führt einen Zug auf einer Kopie aus. */
export function applyMove(state: Position, m: Move): Position {
  const s = clonePosition(state);
  const b = s.board;
  const piece = b[m.from] as Piece;
  b[m.from] = null;
  if (m.castle && m.rook !== undefined && m.rookTo !== undefined) {
    b[m.rookTo] = b[m.rook] ?? null;
    b[m.rook] = null;
  }
  if (m.ep) b[m.to + (m.color === 'w' ? 8 : -8)] = null;
  b[m.to] = m.promo ? { t: m.promo, c: piece.c } : piece;

  if (piece.t === 'k') {
    if (m.color === 'w') s.castle.wk = s.castle.wq = false;
    else s.castle.bk = s.castle.bq = false;
  }
  if (m.from === 63 || m.to === 63) s.castle.wk = false;
  if (m.from === 56 || m.to === 56) s.castle.wq = false;
  if (m.from === 7 || m.to === 7) s.castle.bk = false;
  if (m.from === 0 || m.to === 0) s.castle.bq = false;

  s.ep = m.dbl ? m.from + (m.color === 'w' ? -8 : 8) : -1;
  s.half = piece.t === 'p' || m.captured ? 0 : s.half + 1;
  if (m.color === 'b') s.full++;
  s.turn = other(m.color);
  s.last = { from: m.from, to: m.to };
  return s;
}

export function legalMoves(s: Position, color: Color = s.turn): Move[] {
  return genMoves(s, color).filter((m) => {
    const next = applyMove(s, m);
    const k = findKing(next.board, m.color);
    return k >= 0 && !isAttacked(next.board, k, other(m.color));
  });
}

/** Zug in algebraischer Kurznotation (SAN), z. B. Nf3, exd5, O-O, e8=Q+. */
export function san(s: Position, m: Move): string {
  let out = '';
  if (m.castle) out = m.castle === 'K' ? 'O-O' : 'O-O-O';
  else if (m.piece === 'p') {
    if (m.captured) out += `${FILES[fileOf(m.from)]}x`;
    out += nameOf(m.to);
  } else {
    out += m.piece.toUpperCase();
    const rivals = legalMoves(s, m.color).filter(
      (x) => x.piece === m.piece && x.to === m.to && x.from !== m.from,
    );
    if (rivals.length) {
      const sameFile = rivals.some((x) => fileOf(x.from) === fileOf(m.from));
      const sameRank = rivals.some((x) => rankOf(x.from) === rankOf(m.from));
      if (!sameFile) out += FILES[fileOf(m.from)];
      else if (!sameRank) out += String(8 - rankOf(m.from));
      else out += nameOf(m.from);
    }
    if (m.captured) out += 'x';
    out += nameOf(m.to);
  }
  if (m.promo) out += `=${m.promo.toUpperCase()}`;
  const next = applyMove(s, m);
  if (inCheck(next, next.turn)) out += legalMoves(next).length ? '+' : '#';
  return out;
}

export function insufficientMaterial(board: (Piece | null)[]): boolean {
  const pieces = board.filter((p): p is Piece => !!p && p.t !== 'k');
  if (pieces.length === 0) return true;
  if (pieces.length === 1) return pieces[0]?.t === 'b' || pieces[0]?.t === 'n';
  return pieces.length === 2 && pieces.every((p) => p.t === 'b' && p.c === pieces[0]?.c);
}

// ---------- KI: Negamax mit Alpha-Beta und Figurentabellen ----------

const PST: Record<PieceType, number[]> = {
  p: [
    0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5,
    10, 25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20,
    -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0,
  ],
  n: [
    -50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10,
    0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10,
    5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50,
  ],
  b: [
    -20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0,
    -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10,
    -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20,
  ],
  r: [
    0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0,
    0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0,
    5, 5, 0, 0, 0,
  ],
  q: [
    -20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10,
    -5, 0, 5, 5, 5, 5, 0, -5, 0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0,
    0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20,
  ],
  k: [
    -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40,
    -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30,
    -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0,
    10, 30, 20,
  ],
};

const MATE = 100_000;

/** Bewertung aus Sicht der Seite am Zug (für Negamax). */
function evaluate(s: Position): number {
  let score = 0;
  for (let i = 0; i < 64; i++) {
    const p = s.board[i];
    if (!p) continue;
    const v = VALUE[p.t] + (PST[p.t][p.c === 'w' ? i : 63 - i] ?? 0);
    score += p.c === 'w' ? v : -v;
  }
  return s.turn === 'w' ? score : -score;
}

function search(s: Position, depth: number, alpha: number, beta: number, ply: number): number {
  if (depth === 0) return evaluate(s);
  const moves = legalMoves(s);
  // Matt so früh wie möglich bevorzugen (ply), Patt ist 0
  if (!moves.length) return inCheck(s, s.turn) ? -MATE + ply : 0;
  let best = Number.NEGATIVE_INFINITY;
  for (const m of moves) {
    const val = -search(applyMove(s, m), depth - 1, -beta, -alpha, ply + 1);
    if (val > best) best = val;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

/** Bester Zug für die Seite am Zug. `noise` macht die KI schwächer und abwechslungsreicher. */
export function bestMove(s: Position, depth: number, noise: number, rng: Rng): Move | null {
  const moves = legalMoves(s);
  if (!moves.length) return null;
  const scored = moves
    .map((m) => ({
      m,
      score:
        -search(applyMove(s, m), depth - 1, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY, 1) +
        (rng.next() - 0.5) * noise,
    }))
    .sort((a, b) => b.score - a.score);
  const top = scored.filter((x) => x.score >= (scored[0]?.score ?? 0) - 12);
  return rng.pick(top).m;
}
