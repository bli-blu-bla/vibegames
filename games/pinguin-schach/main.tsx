import { createRng, type GameProps, playSfx, useNet } from '@core/sdk';
import { ArrowUUpLeft } from '@phosphor-icons/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { inCheck, type Move, nameOf, type PieceType } from './engine.ts';
import {
  CAPTURE_QUIPS,
  createGame,
  type Game,
  LEVELS,
  moveKey,
  movesFrom,
  myTurn,
  PLAYER_CAPTURE_QUIPS,
  pinguinMove,
  play,
  playerMoveCount,
  playKey,
  QUIPS,
  undo,
} from './logic.ts';
import './style.css';

// Gefüllte Figuren für beide Seiten, Farbe kommt aus dem CSS. ︎ erzwingt Text statt Emoji.
const GLYPH: Record<PieceType, string> = {
  k: '♚︎',
  q: '♛︎',
  r: '♜︎',
  b: '♝︎',
  n: '♞︎',
  p: '♟︎',
};
const NAME: Record<PieceType, string> = {
  k: 'König',
  q: 'Dame',
  r: 'Turm',
  b: 'Läufer',
  n: 'Springer',
  p: 'Bauer',
};

/** Online: Zug des Mitspielers. `ply` = Anzahl Halbzüge davor, schützt vor doppelten Zügen. */
type MoveMsg = { key: string; ply: number };

export default function PinguinSchach({ api, paused }: GameProps) {
  const { net } = api;
  const rng = useMemo(() => createRng(api.seed), [api.seed]);
  const [game, setGame] = useState<Game>(() =>
    createGame(net?.role === 'guest' ? 'b' : 'w', net !== null),
  );
  const [selected, setSelected] = useState<number | null>(null);
  const [level, setLevel] = useState(() => api.storage.get('level', 1));
  const [quip, setQuip] = useState(
    net ? '' : 'Du spielst Weiß. Tippe eine Figur an, dann das Zielfeld.',
  );
  const reported = useRef(false);

  const targets = selected === null ? [] : movesFrom(game, selected);
  const waiting = !game.result && !myTurn(game);
  const opponent = net ? 'Gegner' : 'Pinguin';

  const commit = (g: Game, m: Move) => {
    const next = play(g, m);
    const mine = m.color === g.me;
    playSfx(m.captured ? 'hit' : 'click');
    if (net) setQuip(m.captured ? (mine ? 'Sauber geschlagen.' : 'Autsch, Figur weg.') : '');
    else if (m.captured) {
      setQuip((mine ? rng.pick(PLAYER_CAPTURE_QUIPS) : rng.pick(CAPTURE_QUIPS)) as string);
    } else if (!mine) setQuip(rng.pick(QUIPS));
    api.setScore(playerMoveCount(next));
    setGame(next);
    if (net && mine) net.send('move', { key: moveKey(m), ply: g.history.length });
  };

  // Online: Zug des Mitspielers übernehmen
  useNet<MoveMsg>(net, 'move', ({ key, ply }) => {
    if (ply !== game.history.length || myTurn(game)) return;
    const next = playKey(game, key);
    const m = next?.pos.last;
    if (!next || !m) return;
    playSfx(game.pos.board[m.to] ? 'hit' : 'click');
    setQuip(game.pos.board[m.to] ? 'Autsch, Figur weg.' : '');
    api.setScore(playerMoveCount(next));
    setGame(next);
  });

  // Pinguin zieht, sobald er dran ist (kurze Pause, damit man den eigenen Zug sieht)
  useEffect(() => {
    if (net || !waiting || paused) return;
    const id = setTimeout(() => {
      const lvl = LEVELS[level] ?? (LEVELS[1] as (typeof LEVELS)[number]);
      const m = pinguinMove(game, lvl, rng);
      if (m) commit(game, m);
    }, 450);
    return () => clearTimeout(id);
  });

  // Ergebnis genau einmal an die Shell melden
  useEffect(() => {
    if (!game.result || reported.current) return;
    reported.current = true;
    playSfx(game.result.outcome === 'win' ? 'win' : 'lose');
    api.gameOver(game.result);
  }, [game.result, api]);

  const onSquare = (i: number) => {
    if (paused || waiting || game.result) return;
    const target = targets.find((m) => m.to === i);
    if (target) {
      setSelected(null);
      commit(game, target);
      return;
    }
    const piece = game.pos.board[i];
    setSelected(piece?.c === game.me && selected !== i ? i : null);
  };

  const chooseLevel = (l: number) => {
    setLevel(l);
    api.storage.set('level', l);
  };

  const checkW = inCheck(game.pos, 'w');
  const checkB = inCheck(game.pos, 'b');
  const checkMe = game.me === 'w' ? checkW : checkB;
  const status = game.result
    ? game.result.message
    : waiting
      ? net
        ? 'Dein Gegner ist am Zug …'
        : 'Der Pinguin überlegt …'
      : checkMe
        ? 'Schach! Rette deinen König.'
        : 'Dein Zug.';
  // Schwarz sieht das Brett von seiner Seite
  const squares = game.pos.board.map((piece, i) => ({ piece, i }));
  if (game.me === 'b') squares.reverse();

  return (
    <div className="pgs">
      <section className="pgs-board" aria-label="Schachbrett">
        {squares.map(({ piece, i }) => {
          const dark = (Math.floor(i / 8) + (i % 8)) % 2 === 1;
          const target = targets.find((m) => m.to === i);
          const isLast = game.pos.last && (game.pos.last.from === i || game.pos.last.to === i);
          const check =
            piece?.t === 'k' && ((piece.c === 'w' && checkW) || (piece.c === 'b' && checkB));
          const cls = [
            'pgs-sq',
            dark ? 'pgs-dark' : 'pgs-light',
            selected === i && 'pgs-sel',
            isLast && 'pgs-last',
            check && 'pgs-check',
          ]
            .filter(Boolean)
            .join(' ');
          const owner = piece?.c === game.me ? 'dein' : opponent;
          const label = `${nameOf(i)}${piece ? `, ${owner} ${NAME[piece.t]}` : ''}${target ? ', Ziel' : ''}`;
          return (
            <button
              key={nameOf(i)}
              type="button"
              className={cls}
              onClick={() => onSquare(i)}
              aria-label={label}
            >
              {piece && (
                <span className={piece.c === 'w' ? 'pgs-piece pgs-w' : 'pgs-piece pgs-b'}>
                  {GLYPH[piece.t]}
                </span>
              )}
              {target && (
                <span className={target.captured ? 'pgs-hint pgs-hint-cap' : 'pgs-hint'} />
              )}
            </button>
          );
        })}
      </section>

      <aside className="pgs-side">
        <p
          className={checkMe && !game.result ? 'pgs-status pgs-status-check' : 'pgs-status'}
          role="status"
        >
          {status}
        </p>
        {net && (
          <p className="t-small muted">
            Online · Du spielst {game.me === 'w' ? 'Weiß' : 'Schwarz'}
          </p>
        )}
        {quip && <p className="t-small muted">{quip}</p>}

        {!net && (
          <fieldset className="pgs-levels">
            <legend className="t-label muted">PINGUIN</legend>
            {LEVELS.map((l, i) => (
              <button
                key={l.name}
                type="button"
                className={level === i ? 'btn btn-primary' : 'btn'}
                aria-pressed={level === i}
                onClick={() => chooseLevel(i)}
              >
                {l.name}
              </button>
            ))}
          </fieldset>
        )}

        <ol className="pgs-moves t-mono-small" aria-label="Züge">
          {movePairs(game.history).map((pair) => (
            <li key={pair.number}>
              <span className="muted">{pair.number}.</span> {pair.white} {pair.black}
            </li>
          ))}
        </ol>

        {!net && (
          <button
            type="button"
            className="btn"
            onClick={() => {
              setSelected(null);
              setGame(undo(game));
            }}
            disabled={paused || waiting || game.undoStack.length === 0 || !!game.result}
          >
            <ArrowUUpLeft size={20} /> Zug zurück
          </button>
        )}
      </aside>
    </div>
  );
}

/** Die letzten acht Zugpaare für die Zugliste. */
function movePairs(history: string[]) {
  const pairs = [];
  for (let i = 0; i < history.length; i += 2) {
    pairs.push({ number: i / 2 + 1, white: history[i], black: history[i + 1] ?? '' });
  }
  return pairs.slice(-8);
}
