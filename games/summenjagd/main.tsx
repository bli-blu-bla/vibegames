import { createRng, type GameProps, playSfx, useTicker } from '@core/sdk';
import { useMemo, useState } from 'react';
import {
  createState,
  MISS_PENALTY,
  PENALTY_PER_CELL,
  remaining,
  type State,
  TICK_MS,
  tick,
  timeBonus,
  toggle,
} from './logic.ts';
import './style.css';

export default function Game({ api, paused }: GameProps) {
  const rng = useMemo(() => createRng(api.seed), [api.seed]);
  const [state, setState] = useState<State>(() => createState(rng));
  const playing = state.status === 'playing';

  // Ein Spiel kann schon beim Start enden, falls die erste Summe unerreichbar wäre.
  const report = (prev: State, next: State) => {
    if (next.score !== prev.score) api.setScore(next.score);
    if (next.status !== 'playing' && prev.status === 'playing') {
      if (next.status === 'cleared') {
        playSfx('win');
        api.gameOver({ outcome: 'win', message: 'Alle Felder gelöst!' });
      } else {
        playSfx('lose');
        api.gameOver({
          outcome: 'lose',
          message: `Keine Summe mehr möglich: ${remaining(next.cells)} Felder übrig.`,
        });
      }
    }
  };

  const onCell = (i: number) => {
    const next = toggle(state, i, rng);
    if (next === state) return;
    setState(next);
    if (next.event === 'hit') playSfx('coin');
    else if (next.event === 'miss') playSfx('hit');
    else playSfx('click');
    report(state, next);
  };

  useTicker(TICK_MS, () => setState((s) => tick(s)), playing && !paused);

  const left = remaining(state.cells);

  return (
    <div className="smj">
      <div className="smj-bar">
        <div className="smj-stat">
          <span className="t-label muted">SUMME</span>
          <span className="t-score smj-target" aria-live="polite">
            {playing ? state.target : '–'}
          </span>
        </div>
        <div className="smj-stat">
          <span className="t-label muted">ZEITBONUS</span>
          <span className="t-score smj-bonus">{playing ? timeBonus(state) : 0}</span>
        </div>
        <div className="smj-stat">
          <span className="t-label muted">FELDER</span>
          <span className="t-score">{left}</span>
        </div>
      </div>
      <div className="smj-grid">
        {state.cells.map((c, i) => (
          <button
            // biome-ignore lint/suspicious/noArrayIndexKey: Felder behalten ihre feste Position
            key={i}
            type="button"
            className={c === 0 ? 'smj-cell smj-cell-empty' : 'smj-cell'}
            aria-pressed={c === 0 ? undefined : state.selected.includes(i)}
            aria-label={c === 0 ? 'leer' : String(c)}
            disabled={c === 0 || !playing || paused}
            onClick={() => onCell(i)}
          >
            {c === 0 ? '' : c}
          </button>
        ))}
      </div>
      <p className="t-small muted smj-hint">
        {playing
          ? `Wähle Felder mit Summe ${state.target}. Zu viel: −${MISS_PENALTY}.`
          : `Übrige Felder: −${PENALTY_PER_CELL} Punkte je Feld.`}
      </p>
    </div>
  );
}
