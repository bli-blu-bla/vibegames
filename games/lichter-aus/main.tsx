import { createRng, type GameProps, keyToDirection, playSfx, useKeyDown } from '@core/sdk';
import { useMemo, useState } from 'react';
import { createState, moveSelection, type State, toggle } from './logic.ts';
import './style.css';

const CELL_IDS = Array.from({ length: 25 }, (_, index) => `cell-${index}`);

export default function Game({ api, paused }: GameProps) {
  const rng = useMemo(() => createRng(api.seed), [api.seed]);
  const [state, setState] = useState<State>(() => createState(rng));
  const playing = !paused && state.status === 'playing';

  const applyToggle = (index: number) => {
    if (!playing) return;
    const next = toggle(state, index);
    setState(next);
    api.setScore(next.moves);
    playSfx(next.status === 'won' ? 'win' : 'click');
    if (next.status === 'won') {
      api.gameOver({ outcome: 'win', message: 'Alle Lichter sind aus.' });
    }
  };

  useKeyDown((key) => {
    const direction = keyToDirection(key);
    if (direction) {
      setState((current) => moveSelection(current, direction));
      return;
    }
    if (key === ' ' || key === 'Enter') applyToggle(state.selected);
  }, playing);

  return (
    <div className="loa">
      <div className="loa-grid">
        {state.lights.map((isOn, index) => (
          <button
            key={CELL_IDS[index]}
            type="button"
            className={`loa-cell t-label${isOn ? ' loa-cell-on' : ''}${state.selected === index ? ' loa-cell-selected' : ''}`}
            aria-label={`Feld ${index + 1}: ${isOn ? 'an' : 'aus'}`}
            disabled={!playing}
            onClick={() => applyToggle(index)}
          >
            {isOn ? 'AN' : 'AUS'}
          </button>
        ))}
      </div>
      <p className="loa-moves t-score" aria-live="polite">
        {state.moves} Züge
      </p>
    </div>
  );
}
