import {
  createRng,
  type GameProps,
  keyToDirection,
  playSfx,
  useKeyDown,
  useTicker,
} from '@core/sdk';
import { Bomb, Flag, Shovel } from '@phosphor-icons/react';
import { type PointerEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type ActionMode,
  activateCell,
  type Cell,
  createState,
  DIFFICULTIES,
  DIFFICULTY_LIST,
  type Difficulty,
  moveSelection,
  remainingMines,
  type State,
  setDifficulty,
  setMode,
  tick,
  toggleFlag,
  toggleMode,
} from './logic.ts';
import './style.css';

const MAX_CELLS = DIFFICULTIES.hard.gridSize * DIFFICULTIES.hard.gridSize;
const CELL_IDS = Array.from({ length: MAX_CELLS }, (_, index) => `mnf-cell-${index}`);
const LONG_PRESS_MS = 450;

function cellAriaLabel(cell: Cell, index: number, gridSize: number): string {
  const row = Math.floor(index / gridSize) + 1;
  const col = (index % gridSize) + 1;
  const pos = `Zeile ${row}, Spalte ${col}`;
  if (!cell.revealed) {
    return cell.flagged ? `${pos}: Flagge` : `${pos}: verdeckt`;
  }
  if (cell.mine) {
    return `${pos}: Mine`;
  }
  return `${pos}: ${cell.adjacentMines} Nachbarminen`;
}

function countClass(count: number): string {
  if (count === 1) return ' mnf-count-1';
  if (count === 2) return ' mnf-count-2';
  if (count >= 3) return ' mnf-count-high';
  return '';
}

export default function Game({ api, paused }: GameProps) {
  const rng = useMemo(() => createRng(api.seed), [api.seed]);
  const [state, setState] = useState<State>(() => {
    const saved = api.storage.get<Difficulty>('difficulty', 'easy');
    const difficulty = saved in DIFFICULTIES ? saved : 'easy';
    return createState(difficulty);
  });
  const stateRef = useRef(state);
  stateRef.current = state;

  const longPressTimerRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);

  const playing = !paused && state.status === 'playing';
  const timerRunning = playing && state.minesPlaced;

  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!playing) {
      clearLongPress();
    }
    return clearLongPress;
  }, [playing, clearLongPress]);

  const applyActivate = (index: number) => {
    if (!playing) return;
    const current = stateRef.current;
    const next = activateCell(current, index, rng);
    if (next === current) return;

    setState(next);
    api.setScore(next.seconds);

    if (next.status === 'won') {
      playSfx('win');
      api.gameOver({ outcome: 'win', message: 'Alle sicheren Felder aufgedeckt!' });
    } else if (next.status === 'lost') {
      playSfx('lose');
      api.gameOver({ outcome: 'lose', message: 'Auf eine Mine getreten!' });
    } else {
      playSfx('click');
    }
  };

  const applyFlag = (index: number) => {
    if (!playing) return;
    const current = stateRef.current;
    const next = toggleFlag(current, index);
    if (next === current) return;

    setState(next);
    playSfx('click');
  };

  const applySetMode = (mode: ActionMode) => {
    if (!playing) return;
    const current = stateRef.current;
    const next = setMode(current, mode);
    if (next === current) return;

    setState(next);
    playSfx('click');
  };

  const applyToggleMode = () => {
    if (!playing) return;
    const current = stateRef.current;
    const next = toggleMode(current);
    if (next === current) return;

    setState(next);
    playSfx('click');
  };

  const applyDifficulty = (difficulty: Difficulty) => {
    if (!playing) return;
    const current = stateRef.current;
    const next = setDifficulty(current, difficulty);
    if (next === current) return;

    clearLongPress();
    api.storage.set('difficulty', difficulty);
    setState(next);
    api.setScore(0);
    playSfx('click');
  };

  useTicker(
    1000,
    () => {
      const next = tick(stateRef.current);
      setState(next);
      api.setScore(next.seconds);
    },
    timerRunning,
  );

  useKeyDown((key) => {
    const direction = keyToDirection(key);
    if (direction) {
      setState((current) => moveSelection(current, direction));
      return;
    }
    if (key === ' ' || key === 'Enter') {
      applyActivate(stateRef.current.selected);
      return;
    }
    if (key === 'f' || key === 'F') {
      applyFlag(stateRef.current.selected);
      return;
    }
    if (key === 'm' || key === 'M') {
      applyToggleMode();
    }
  }, playing);

  const handlePointerDown = (index: number, event: PointerEvent<HTMLButtonElement>) => {
    clearLongPress();
    longPressTriggeredRef.current = false;
    if (!playing || event.pointerType !== 'touch') return;
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTimerRef.current = null;
      longPressTriggeredRef.current = true;
      applyFlag(index);
    }, LONG_PRESS_MS);
  };

  const handlePointerEnd = () => {
    clearLongPress();
  };

  return (
    <div className="mnf">
      <div className="mnf-top">
        <div className="mnf-modes">
          <button
            type="button"
            className={`btn mnf-mode-btn${state.mode === 'dig' ? ' btn-primary' : ''}`}
            aria-pressed={state.mode === 'dig'}
            disabled={!playing}
            onClick={() => applySetMode('dig')}
          >
            <Shovel size={18} weight="fill" aria-hidden="true" />
            <span>Graben</span>
          </button>
          <button
            type="button"
            className={`btn mnf-mode-btn${state.mode === 'flag' ? ' btn-primary' : ''}`}
            aria-pressed={state.mode === 'flag'}
            disabled={!playing}
            onClick={() => applySetMode('flag')}
          >
            <Flag size={18} weight="fill" aria-hidden="true" />
            <span>Flagge</span>
          </button>
        </div>
        <div className="mnf-difficulties">
          {DIFFICULTY_LIST.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`btn mnf-diff-btn${state.difficulty === item.id ? ' mnf-diff-active' : ''}`}
              aria-pressed={state.difficulty === item.id}
              disabled={!playing}
              onClick={() => applyDifficulty(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mnf-bar">
        <div className="mnf-stat" aria-live="polite">
          <Flag size={16} weight="fill" className="mnf-flag-icon" aria-hidden="true" />
          <span className="t-mono-small">{remainingMines(state)} Minen</span>
        </div>
        <div className="mnf-stat" aria-live="polite">
          <span className="t-mono-small muted">{state.seconds} s</span>
        </div>
      </div>

      <div
        className="mnf-grid"
        style={{ gridTemplateColumns: `repeat(${state.gridSize}, minmax(0, 1fr))` }}
      >
        {state.cells.map((cell, index) => {
          const isSelected = state.selected === index;
          const isExploded = state.explodedIndex === index;
          let stateClass = ' mnf-cell-hidden';
          if (cell.revealed) {
            stateClass = cell.mine
              ? isExploded
                ? ' mnf-cell-mine-exploded'
                : ' mnf-cell-mine'
              : ` mnf-cell-revealed${countClass(cell.adjacentMines)}`;
          } else if (cell.flagged) {
            stateClass = ' mnf-cell-flagged';
          }

          return (
            <button
              key={CELL_IDS[index]}
              type="button"
              className={`mnf-cell t-mono-small${stateClass}${isSelected ? ' mnf-cell-selected' : ''}`}
              aria-label={cellAriaLabel(cell, index, state.gridSize)}
              disabled={!playing}
              onPointerDown={(event) => handlePointerDown(index, event)}
              onPointerUp={handlePointerEnd}
              onPointerCancel={handlePointerEnd}
              onPointerLeave={handlePointerEnd}
              onContextMenu={(event) => {
                event.preventDefault();
                event.stopPropagation();
                if (longPressTimerRef.current !== null) {
                  clearLongPress();
                  longPressTriggeredRef.current = true;
                  applyFlag(index);
                  return;
                }
                if (longPressTriggeredRef.current) {
                  return;
                }
                applyFlag(index);
              }}
              onClick={() => {
                if (longPressTriggeredRef.current) {
                  longPressTriggeredRef.current = false;
                  return;
                }
                applyActivate(index);
              }}
            >
              {cell.revealed ? (
                cell.mine ? (
                  <Bomb size={16} weight="fill" aria-hidden="true" />
                ) : cell.adjacentMines > 0 ? (
                  cell.adjacentMines
                ) : null
              ) : cell.flagged ? (
                <Flag size={14} weight="fill" aria-hidden="true" />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
