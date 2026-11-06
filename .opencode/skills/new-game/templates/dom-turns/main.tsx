import { createRng, type GameProps, playSfx, useKeyDown } from '@core/sdk';
import { useMemo, useState } from 'react';
import { createState, finalScore, roll, type State, stand, TARGET, total } from './logic.ts';
import './style.css';

export default function Game({ api, paused }: GameProps) {
  const rng = useMemo(() => createRng(api.seed), [api.seed]);
  const [state, setState] = useState<State>(createState);
  const playing = state.status === 'playing';

  // Jede Aktion: neuer Zustand aus der Logik, dann Score melden, ggf. Spiel beenden
  const apply = (next: State) => {
    setState(next);
    api.setScore(finalScore(next));
    if (next.status === 'bust') playSfx('lose');
    if (next.status === 'stood') playSfx('win');
    if (next.status !== 'playing') api.gameOver();
  };

  const onRoll = () => {
    playSfx('click');
    apply(roll(state, rng));
  };
  const onStand = () => apply(stand(state));

  useKeyDown((key) => {
    if (key === ' ' || key === 'Enter') onRoll();
    if (key === 's') onStand();
  }, playing && !paused);

  return (
    <div className="w21">
      <p className="t-label muted">SUMME</p>
      <p className="t-score w21-total" aria-live="polite">
        {total(state)} / {TARGET}
      </p>
      <ul className="w21-dice" aria-label="Gewürfelte Augen">
        {state.rolls.map((r, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: Würfe ändern ihre Reihenfolge nie
          <li key={i} className="w21-die t-score">
            {r}
          </li>
        ))}
      </ul>
      <div className="w21-actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={onRoll}
          disabled={!playing || paused}
        >
          Würfeln
        </button>
        <button
          type="button"
          className="btn"
          onClick={onStand}
          disabled={!playing || paused || state.rolls.length === 0}
        >
          Stopp
        </button>
      </div>
    </div>
  );
}
