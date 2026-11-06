/* ============================================================
   chess.js – Mini-Schachengine (legal moves, check, mate, KI)
   Brett-Indexierung: 0 = a8, 7 = h8, 56 = a1, 63 = h1
   ============================================================ */
(function (global) {
  "use strict";

  const W = "w", B = "b";
  const VALUE = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };

  const FILES = "abcdefgh";

  /* ---------- Brett erstellen ---------- */
  function initialBoard() {
    const b = new Array(64).fill(null);
    const back = ["r", "n", "b", "q", "k", "b", "n", "r"];
    for (let f = 0; f < 8; f++) {
      b[f] = { t: back[f], c: B };                       // Reihe 8
      b[8 + f] = { t: "p", c: B };                      // Reihe 7
      b[48 + f] = { t: "p", c: W };                     // Reihe 2
      b[56 + f] = { t: back[f], c: W };                 // Reihe 1
    }
    return b;
  }

  function cloneState(s) {
    return {
      board: s.board.map(p => (p ? { t: p.t, c: p.c } : null)),
      turn: s.turn,
      castle: { ...s.castle },
      ep: s.ep,
      half: s.half,
      full: s.full,
      last: s.last ? { ...s.last } : null
    };
  }

  function newState() {
    return {
      board: initialBoard(),
      turn: W,
      castle: { wk: true, wq: true, bk: true, bq: true },
      ep: -1,
      half: 0,
      full: 1,
      last: null
    };
  }

  const other = c => (c === W ? B : W);
  const sq = (f, r) => r * 8 + f;
  const fileOf = i => i % 8;
  const rankOf = i => (i / 8) | 0;
  const nameOf = i => FILES[fileOf(i)] + (8 - rankOf(i));

  function findKing(board, color) {
    for (let i = 0; i < 64; i++) if (board[i] && board[i].t === "k" && board[i].c === color) return i;
    return -1;
  }

  /* ---------- Angriffsprüfung ---------- */
  function isAttacked(board, target, byColor) {
    const tf = fileOf(target), tr = rankOf(target);

    // Bauern: ein weißer Bauer steht eine Reihe UNTER dem Ziel (tr+1),
    // ein schwarzer eine Reihe DARÜBER (tr-1).
    const attackerRow = tr + (byColor === W ? 1 : -1);
    for (const df of [-1, 1]) {
      const f = tf + df, r = attackerRow;
      if (f < 0 || f > 7 || r < 0 || r > 7) continue;
      const p = board[sq(f, r)];
      if (p && p.c === byColor && p.t === "p") return true;
    }
    // Springer
    for (const [df, dr] of [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]]) {
      const f = tf + df, r = tr + dr;
      if (f < 0 || f > 7 || r < 0 || r > 7) continue;
      const p = board[sq(f, r)];
      if (p && p.c === byColor && p.t === "n") return true;
    }
    // Läufer / Dame
    for (const [df, dr] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      let f = tf + df, r = tr + dr;
      while (f >= 0 && f <= 7 && r >= 0 && r <= 7) {
        const p = board[sq(f, r)];
        if (p) {
          if (p.c === byColor && (p.t === "b" || p.t === "q")) return true;
          break;
        }
        f += df; r += dr;
      }
    }
    // Turm / Dame
    for (const [df, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      let f = tf + df, r = tr + dr;
      while (f >= 0 && f <= 7 && r >= 0 && r <= 7) {
        const p = board[sq(f, r)];
        if (p) {
          if (p.c === byColor && (p.t === "r" || p.t === "q")) return true;
          break;
        }
        f += df; r += dr;
      }
    }
    // König
    for (let df = -1; df <= 1; df++)
      for (let dr = -1; dr <= 1; dr++) {
        if (!df && !dr) continue;
        const f = tf + df, r = tr + dr;
        if (f < 0 || f > 7 || r < 0 || r > 7) continue;
        const p = board[sq(f, r)];
        if (p && p.c === byColor && p.t === "k") return true;
      }
    return false;
  }

  function inCheck(state, color) {
    const k = findKing(state.board, color);
    if (k < 0) return false;
    return isAttacked(state.board, k, other(color));
  }

  /* ---------- Rochade ---------- */
  function castleAllowed(state, side) {
    const white = side === W;
    const row = white ? 7 : 0;
    const kingFrom = sq(4, row);
    const k = state.board[kingFrom];
    if (!k || k.t !== "k" || k.c !== side) return [];
    const rightK = white ? state.castle.wk : state.castle.bk;
    const rightQ = white ? state.castle.wq : state.castle.bq;
    const enemy = other(side);
    if (isAttacked(state.board, kingFrom, enemy)) return [];
    const out = [];

    if (rightK) {
      if (!state.board[sq(5, row)] && !state.board[sq(6, row)] &&
          !isAttacked(state.board, sq(5, row), enemy) &&
          !isAttacked(state.board, sq(6, row), enemy)) {
        out.push({ from: kingFrom, to: sq(6, row), rook: sq(7, row), rookTo: sq(5, row), k: true });
      }
    }
    if (rightQ) {
      if (!state.board[sq(3, row)] && !state.board[sq(2, row)] && !state.board[sq(1, row)] &&
          !isAttacked(state.board, sq(3, row), enemy) &&
          !isAttacked(state.board, sq(2, row), enemy)) {
        out.push({ from: kingFrom, to: sq(2, row), rook: sq(0, row), rookTo: sq(3, row), k: false });
      }
    }
    return out;
  }

  /* ---------- Zugerzeugung (pseudolegal) ---------- */
  function genMoves(state, color) {
    const b = state.board, moves = [];
    const push = (from, to, extra) => {
      const p = b[from];
      moves.push(Object.assign({
        from, to, piece: p.t, color: p.c,
        captured: b[to] ? { t: b[to].t, c: b[to].c } : null
      }, extra || {}));
    };

    for (let i = 0; i < 64; i++) {
      const p = b[i];
      if (!p || p.c !== color) continue;
      const f = fileOf(i), r = rankOf(i);

      switch (p.t) {
        case "p": {
          const dir = color === W ? -1 : 1;
          const startRow = color === W ? 6 : 1;
          const lastRow = color === W ? 0 : 7;
          const one = r + dir;
          if (one >= 0 && one <= 7 && !b[sq(f, one)]) {
            if (one === lastRow) {
              for (const pr of ["q", "r", "b", "n"]) push(i, sq(f, one), { promo: pr });
            } else {
              push(i, sq(f, one));
              if (r === startRow) {
                const two = r + 2 * dir;
                if (!b[sq(f, two)]) push(i, sq(f, two), { dbl: true });
              }
            }
          }
          for (const df of [-1, 1]) {
            const nf = f + df;
            if (nf < 0 || nf > 7 || one < 0 || one > 7) continue;
            const tgt = b[sq(nf, one)];
            if (tgt && tgt.c !== color) {
              if (one === lastRow) {
                for (const pr of ["q", "r", "b", "n"]) push(i, sq(nf, one), { promo: pr });
              } else push(i, sq(nf, one));
            } else if (!tgt && state.ep === sq(nf, one)) {
              push(i, sq(nf, one), { ep: true, captured: { t: "p", c: other(color) } });
            }
          }
          break;
        }
        case "n": {
          for (const [df, dr] of [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]]) {
            const nf = f + df, nr = r + dr;
            if (nf < 0 || nf > 7 || nr < 0 || nr > 7) continue;
            const t = b[sq(nf, nr)];
            if (!t || t.c !== color) push(i, sq(nf, nr));
          }
          break;
        }
        case "b": case "r": case "q": {
          const dirs = {
            b: [[1, 1], [1, -1], [-1, 1], [-1, -1]],
            r: [[1, 0], [-1, 0], [0, 1], [0, -1]],
            q: [[1, 1], [1, -1], [-1, 1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]]
          }[p.t];
          for (const [df, dr] of dirs) {
            let nf = f + df, nr = r + dr;
            while (nf >= 0 && nf <= 7 && nr >= 0 && nr <= 7) {
              const t = b[sq(nf, nr)];
              if (!t) push(i, sq(nf, nr));
              else { if (t.c !== color) push(i, sq(nf, nr)); break; }
              nf += df; nr += dr;
            }
          }
          break;
        }
        case "k": {
          for (let df = -1; df <= 1; df++)
            for (let dr = -1; dr <= 1; dr++) {
              if (!df && !dr) continue;
              const nf = f + df, nr = r + dr;
              if (nf < 0 || nf > 7 || nr < 0 || nr > 7) continue;
              const t = b[sq(nf, nr)];
              if (!t || t.c !== color) push(i, sq(nf, nr));
            }
          for (const c of castleAllowed(state, color)) {
            moves.push({
              from: c.from, to: c.to, piece: "k", color, captured: null,
              castle: c.k ? "K" : "Q", rook: c.rook, rookTo: c.rookTo
            });
          }
          break;
        }
      }
    }
    return moves;
  }

  /* ---------- Zug ausführen ---------- */
  function makeMove(state, m) {
    const b = state.board;
    const piece = b[m.from];
    b[m.from] = null;

    // Rochade: Turm umsetzen
    if (m.castle) {
      b[m.rookTo] = b[m.rook];
      b[m.rook] = null;
    }
    // En passant: geschlagenes Bauernfeld entfernen
    if (m.ep) b[m.to + (m.color === W ? 8 : -8)] = null;
    // Gefangenes Teil entfernen (Rochade-Ziel zählt nicht)
    if (m.captured && b[m.to]) b[m.to] = null;

    // Beförderung
    let placed = piece;
    if (m.promo) placed = { t: m.promo, c: piece.c };
    b[m.to] = placed;

    // Rochade-Rechte
    if (piece.t === "k") {
      if (m.color === W) { state.castle.wk = false; state.castle.wq = false; }
      else { state.castle.bk = false; state.castle.bq = false; }
    }
    if (m.from === 63 || m.to === 63) state.castle.wk = false;
    if (m.from === 56 || m.to === 56) state.castle.wq = false;
    if (m.from === 7 || m.to === 7) state.castle.bk = false;
    if (m.from === 0 || m.to === 0) state.castle.bq = false;

    // En-passant-Feld
    state.ep = m.dbl ? m.from + (m.color === W ? -8 : 8) : -1;

    state.half = (piece.t === "p" || m.captured) ? 0 : state.half + 1;
    if (m.color === B) state.full++;
    state.turn = other(m.color);
    state.last = { from: m.from, to: m.to };
    return state;
  }

  /* ---------- Legal-filter ---------- */
  function isLegal(state, m) {
    const s = cloneState(state);
    makeMove(s, m);
    const k = findKing(s.board, m.color);
    if (k < 0) return false;
    return !isAttacked(s.board, k, other(m.color));
  }

  function legalMoves(state, color) {
    return genMoves(state, color || state.turn).filter(m => isLegal(state, m));
  }

  /* ---------- Notation ---------- */
  function san(state, m) {
    let s = "";
    if (m.castle) s = m.castle === "K" ? "O-O" : "O-O-O";
    else if (m.piece === "p") {
      if (m.captured) s += FILES[fileOf(m.from)] + "x";
      s += nameOf(m.to);
    } else {
      s += m.piece.toUpperCase();
      // Disambiguierung: welches eigene Teil kann auch auf dieses Feld?
      const rivals = legalMoves(state, m.color).filter(x =>
        x.piece === m.piece && x.to === m.to && x.from !== m.from);
      if (rivals.length) {
        const sameFile = rivals.some(x => fileOf(x.from) === fileOf(m.from));
        const sameRank = rivals.some(x => rankOf(x.from) === rankOf(m.from));
        if (!sameFile) s += FILES[fileOf(m.from)];
        else if (!sameRank) s += String(8 - rankOf(m.from));
        else s += nameOf(m.from);
      }
      if (m.captured) s += "x";
      s += nameOf(m.to);
    }
    if (m.promo) s += "=" + m.promo.toUpperCase();
    // Schach / Matt
    const s2 = cloneState(state);
    makeMove(s2, m);
    if (inCheck(s2, s2.turn)) {
      const replies = legalMoves(s2);
      s += replies.length ? "+" : "#";
    }
    return s;
  }

  /* ---------- Bewertung ---------- */
  const PST = {
    p: [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10,
        5, 5, 10, 25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5,
        5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0],
    n: [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40,
        -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30,
        -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30,
        -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
    b: [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10,
        -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10,
        -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10,
        -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20],
    r: [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5,
        -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5,
        -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5,
        -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0],
    q: [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10,
        -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5,
        0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10,
        -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
    k: [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30,
        -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30,
        -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10,
        20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20]
  };

  function evaluate(state) {
    let score = 0;
    const b = state.board;
    for (let i = 0; i < 64; i++) {
      const p = b[i];
      if (!p) continue;
      let v = VALUE[p.t] + PST[p.t][p.c === W ? i : 63 - i];
      score += p.c === W ? v : -v;
    }
    return score;
  }

  /* ---------- Negamax mit Alpha-Beta ---------- */
  function search(state, depth, alpha, beta) {
    if (depth === 0) return evaluate(state);
    const moves = legalMoves(state);
    if (!moves.length) return state.turn === W ? -100000 : 100000; // Matt
    let best = -Infinity;
    for (const m of moves) {
      const s = cloneState(state);
      makeMove(s, m);
      const val = -search(s, depth - 1, -beta, -alpha);
      if (val > best) best = val;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  }

  function bestMove(state, depth, randomness) {
    const moves = legalMoves(state);
    if (!moves.length) return null;
    let scored = moves.map(m => {
      const s = cloneState(state);
      makeMove(s, m);
      let score = -search(s, depth - 1, -Infinity, Infinity);
      score += (Math.random() - 0.5) * randomness;
      return { m, score };
    });
    scored.sort((a, b) => b.score - a.score);
    // leichtes Zufallsauswahl aus den besten Kandidaten
    const top = scored.filter(x => x.score >= scored[0].score - 12);
    const pick = top[Math.floor(Math.random() * top.length)];
    return pick.m;
  }

  /* ---------- Endlagen ---------- */
  function insufficientMaterial(board) {
    const pieces = [];
    for (let i = 0; i < 64; i++) if (board[i] && board[i].t !== "k") pieces.push(board[i]);
    if (pieces.length === 0) return true;
    if (pieces.length === 1 && (pieces[0].t === "b" || pieces[0].t === "n")) return true;
    if (pieces.length === 2 && pieces.every(p => p.t === "b" && p.c === pieces[0].c)) return true;
    return false;
  }

  global.Chess = {
    W, B, newState, cloneState, makeMove, legalMoves, genMoves, san,
    inCheck, findKing, isAttacked, evaluate, search, bestMove,
    insufficientMaterial, other, fileOf, rankOf, nameOf, sq, VALUE
  };
})(typeof window !== "undefined" ? window : globalThis);
