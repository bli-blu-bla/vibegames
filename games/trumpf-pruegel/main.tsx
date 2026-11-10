import { createRng, type GameProps, playSfx, useKeyDown } from '@core/sdk';
import { Bird, Cookie, Crown, Ghost, type Icon, Shield, Skull, Sword } from '@phosphor-icons/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  type Card,
  createRun,
  ENEMIES,
  enemyOf,
  evaluate,
  MAX_HP,
  nextEnemy,
  PICK,
  playHand,
  type State,
  type Suit,
  selectedCards,
  toggleCard,
} from './logic.ts';
import './style.css';

const ENEMY_ICONS: Icon[] = [Bird, Ghost, Cookie, Skull, Crown];
const SUIT: Record<Suit, { symbol: string; name: string; red: boolean }> = {
  hearts: { symbol: '♥︎', name: 'Herz', red: true },
  diamonds: { symbol: '♦︎', name: 'Karo', red: true },
  clubs: { symbol: '♣︎', name: 'Kreuz', red: false },
  spades: { symbol: '♠︎', name: 'Pik', red: false },
};
const LABEL: Record<number, string> = { 11: 'B', 12: 'D', 13: 'K', 14: 'A' };
const label = (c: Card) => LABEL[c.value] ?? String(c.value);

export default function TrumpfPruegel({ api, paused }: GameProps) {
  const rng = useMemo(() => createRng(api.seed), [api.seed]);
  const [state, setState] = useState<State>(() => createRun(rng));
  const reported = useRef(false);
  const enemy = enemyOf(state);
  const EnemyIcon = ENEMY_ICONS[state.enemyIndex] ?? Skull;
  const preview = state.selected.length === PICK ? evaluate(selectedCards(state)) : null;
  const choosing = state.phase === 'choose' && !paused;

  const attack = () => {
    if (!choosing || !preview) return;
    const next = playHand(state, rng);
    playSfx(next.phase === 'enemy-down' || next.phase === 'champion' ? 'win' : 'hit');
    api.setScore(next.damageDealt);
    setState(next);
  };

  useKeyDown((key) => {
    if (key === 'Enter') attack();
    const n = Number(key);
    if (n >= 1 && n <= state.hand.length) setState((s) => toggleCard(s, s.hand[n - 1]?.id ?? ''));
  }, choosing);

  useEffect(() => {
    if (reported.current) return;
    if (state.phase === 'lost') {
      reported.current = true;
      api.gameOver({
        outcome: 'lose',
        message: 'Die Karten waren gegen dich. Technisch hattest du sie in der Hand.',
      });
    }
    if (state.phase === 'champion') {
      reported.current = true;
      api.gameOver({
        outcome: 'win',
        message: 'Alle fünf Gegner besiegt. Du bist Arena-Champion!',
      });
    }
  }, [state.phase, api]);

  return (
    <div className="tp">
      <section className="tp-panel" aria-label="Gegner">
        <div className="tp-enemy">
          <EnemyIcon size={48} weight="fill" className="tp-enemy-icon" aria-hidden />
          <div className="tp-grow">
            <p className="t-label muted">
              GEGNER {state.enemyIndex + 1} / {ENEMIES.length}
            </p>
            <h2 className="t-heading">{enemy.name}</h2>
            <p className="t-small muted">{enemy.quip}</p>
          </div>
          <p className="tp-intent t-mono-small">
            <Sword size={16} aria-hidden /> {enemy.damage}
          </p>
        </div>
        <Bar value={state.enemyHp} max={enemy.hp} kind="enemy" label="Leben Gegner" />
      </section>

      <p className="tp-message" role="status">
        {state.message}
      </p>

      <section className="tp-panel" aria-label="Du">
        <div className="tp-player">
          <p className="t-label muted">DEIN LEBEN</p>
          <p className="tp-block t-mono-small">
            <Shield size={16} weight="fill" aria-hidden /> {state.block} Block
          </p>
        </div>
        <Bar value={state.hp} max={MAX_HP} kind="player" label="Dein Leben" />
      </section>

      <ul className="tp-hand" aria-label="Deine Karten">
        {state.hand.map((c, i) => {
          const suit = SUIT[c.suit];
          const selected = state.selected.includes(c.id);
          return (
            <li key={c.id}>
              <button
                type="button"
                className={`tp-card${selected ? ' tp-selected' : ''}${suit.red ? ' tp-red' : ''}`}
                aria-pressed={selected}
                aria-label={`${label(c)} ${suit.name}, Taste ${i + 1}`}
                disabled={!choosing}
                onClick={() => {
                  playSfx('click');
                  setState((s) => toggleCard(s, c.id));
                }}
              >
                <span className="tp-rank">{label(c)}</span>
                <span className="tp-suit">{suit.symbol}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="tp-actions">
        {state.phase === 'enemy-down' ? (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setState((s) => nextEnemy(s, rng))}
            disabled={paused}
          >
            Nächster Gegner
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-primary"
            onClick={attack}
            disabled={!choosing || !preview}
          >
            {preview
              ? `${preview.name}: ${preview.damage} Schaden`
              : `${state.selected.length} / ${PICK} Karten`}
          </button>
        )}
      </div>
    </div>
  );
}

function Bar({
  value,
  max,
  kind,
  label,
}: {
  value: number;
  max: number;
  kind: 'enemy' | 'player';
  label: string;
}) {
  return (
    <div className="tp-bar-row">
      <div className="tp-bar" aria-hidden="true">
        <div
          className={`tp-bar-fill tp-bar-${kind}`}
          style={{ width: `${(value / max) * 100}%` }}
        />
      </div>
      <span className="t-mono-small">
        <span className="visually-hidden">{label}: </span>
        {value} / {max}
      </span>
    </div>
  );
}
