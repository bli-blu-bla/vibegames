import { createRng } from '@core/sdk';
import { describe, expect, it } from 'vitest';
import { applyMove, legalMoves, newPosition, type Position, sq } from './engine.ts';
import {
  createGame,
  LEVELS,
  moveKey,
  movesFrom,
  pinguinMove,
  play,
  playerMoveCount,
  playKey,
  resultOf,
  undo,
} from './logic.ts';

function perft(pos: Position, depth: number): number {
  if (depth === 0) return 1;
  return legalMoves(pos).reduce((n, m) => n + perft(applyMove(pos, m), depth - 1), 0);
}

/** Zug per Feldnamen, z. B. move(g, 'e2', 'e4') */
const idx = (name: string) => sq(name.charCodeAt(0) - 97, 8 - Number(name[1]));

describe('Engine', () => {
  it('Perft aus der Startstellung stimmt', () => {
    const pos = newPosition();
    expect(perft(pos, 1)).toBe(20);
    expect(perft(pos, 2)).toBe(400);
    expect(perft(pos, 3)).toBe(8902);
  });
});

describe('Spielablauf', () => {
  it('erkennt das Schäfermatt als Niederlage', () => {
    let g = createGame();
    const seq = ['e2e4', 'e7e5', 'f1c4', 'b8c6', 'd1h5', 'g8f6', 'h5f7'];
    // Weiß setzt hier matt: aus Sicht des Spielers ein Sieg
    for (const s of seq) {
      const m = legalMoves(g.pos).find(
        (x) => x.from === idx(s.slice(0, 2)) && x.to === idx(s.slice(2)),
      );
      if (!m) throw new Error(`illegal ${s}`);
      g = play(g, m);
    }
    expect(g.result?.outcome).toBe('win');
    expect(g.history.at(-1)).toBe('Qxf7#');
    expect(playerMoveCount(g)).toBe(4);
  });

  it('liefert nur eigene Züge, wenn Weiß dran ist', () => {
    const g = createGame();
    expect(movesFrom(g, idx('e2'))).toHaveLength(2);
    expect(movesFrom(g, idx('e7'))).toHaveLength(0);
  });

  it('Pinguin antwortet und Zug zurück nimmt beide Züge zurück', () => {
    let g = createGame();
    const first = movesFrom(g, idx('e2'))[0];
    if (!first) throw new Error('kein Zug');
    g = play(g, first);
    const reply = pinguinMove(g, LEVELS[1] as (typeof LEVELS)[number], createRng('t'));
    expect(reply?.color).toBe('b');
    if (reply) g = play(g, reply);
    expect(g.history).toHaveLength(2);
    g = undo(g);
    expect(g.history).toHaveLength(0);
    expect(g.pos.turn).toBe('w');
  });

  it('Pinguin findet ein Matt in einem Zug', () => {
    // Weiß: König h1, Bauern g2 h2; Schwarz: Dame d8 → Qd1# ist Matt
    const pos = newPosition();
    pos.board.fill(null);
    pos.board[idx('h1')] = { t: 'k', c: 'w' };
    pos.board[idx('g2')] = { t: 'p', c: 'w' };
    pos.board[idx('h2')] = { t: 'p', c: 'w' };
    pos.board[idx('a8')] = { t: 'k', c: 'b' };
    pos.board[idx('d8')] = { t: 'q', c: 'b' };
    pos.turn = 'b';
    pos.castle = { wk: false, wq: false, bk: false, bq: false };
    const g = { ...createGame(), pos };
    const m = pinguinMove(g, LEVELS[2] as (typeof LEVELS)[number], createRng('m'));
    expect(m?.to).toBe(idx('d1'));
    if (m) expect(play(g, m).result?.outcome).toBe('lose');
  });

  it('erkennt Patt als Unentschieden', () => {
    const pos = newPosition();
    pos.board.fill(null);
    pos.board[idx('a8')] = { t: 'k', c: 'b' };
    pos.board[idx('b6')] = { t: 'q', c: 'w' };
    pos.board[idx('h1')] = { t: 'k', c: 'w' };
    pos.turn = 'b';
    expect(resultOf(pos, 10)?.outcome).toBe('draw');
  });
});

describe('Online', () => {
  it('Schwarz zieht erst nach Weiß, Züge kommen als Kurzform an', () => {
    const white = createGame('w', true);
    const black = createGame('b', true);
    expect(movesFrom(black, idx('e7'))).toEqual([]);
    const m = movesFrom(white, idx('e2')).find((x) => x.to === idx('e4'));
    expect(m).toBeDefined();
    const move = m as NonNullable<typeof m>;
    const w1 = play(white, move);
    const b1 = playKey(black, moveKey(move));
    expect(b1?.history).toEqual(['e4']);
    expect(b1 && movesFrom(b1, idx('e7')).length).toBe(2);
    expect(playerMoveCount(w1)).toBe(1);
    expect(b1 && playerMoveCount(b1)).toBe(0);
  });

  it('lehnt illegale Züge ab und lässt den Pinguin online nicht ziehen', () => {
    const g = createGame('b', true);
    expect(playKey(g, '52-20')).toBeNull();
    const after = playKey(g, `${idx('e2')}-${idx('e4')}`);
    expect(
      after && pinguinMove(after, LEVELS[0] as (typeof LEVELS)[number], createRng('x')),
    ).toBeNull();
  });

  it('Matt wird aus eigener Sicht gewertet', () => {
    // Narrenmatt: Weiß wird nach 2 Zügen matt gesetzt
    let w = createGame('w', true);
    let b = createGame('b', true);
    for (const [from, to] of [
      ['f2', 'f3'],
      ['e7', 'e5'],
      ['g2', 'g4'],
      ['d8', 'h4'],
    ] as const) {
      const key = `${idx(from)}-${idx(to)}`;
      w = playKey(w, key) ?? w;
      b = playKey(b, key) ?? b;
    }
    expect(w.result?.outcome).toBe('lose');
    expect(b.result?.outcome).toBe('win');
  });
});
