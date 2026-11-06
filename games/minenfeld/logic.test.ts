import { createRng } from '@core/sdk';
import { describe, expect, it } from 'vitest';
import {
  activateCell,
  CELL_COUNT,
  createState,
  createStateWithMines,
  DIFFICULTIES,
  MINE_COUNT,
  moveSelection,
  remainingMines,
  reveal,
  setDifficulty,
  setMode,
  tick,
  toggleFlag,
  toggleMode,
} from './logic.ts';

describe('Minenfeld logic', () => {
  it('creates an unrevealed 9x9 board with 10 remaining mines and 0 seconds', () => {
    const state = createState();

    expect(state.cells).toHaveLength(CELL_COUNT);
    expect(state.cells.every((c) => !c.revealed && !c.flagged && !c.mine)).toBe(true);
    expect(state.minesPlaced).toBe(false);
    expect(state.status).toBe('playing');
    expect(state.seconds).toBe(0);
    expect(remainingMines(state)).toBe(MINE_COUNT);
  });

  it('guarantees the first click is always safe and places exactly 10 mines', () => {
    for (let index = 0; index < CELL_COUNT; index += 1) {
      const rng = createRng(`seed-${index}`);
      const next = reveal(createState(), index, rng);

      expect(next.minesPlaced).toBe(true);
      expect(next.cells[index]?.mine).toBe(false);
      expect(next.cells[index]?.revealed).toBe(true);
      expect(next.cells.filter((c) => c.mine)).toHaveLength(MINE_COUNT);
      expect(next.status).not.toBe('lost');
    }
  });

  it('calculates adjacent mine counts and auto-reveals neighbors when count is 0', () => {
    // Place a single mine at bottom-right corner (index 80)
    const state = createStateWithMines([80]);

    // Cell 70 is top-left of 80 (row 7, col 7 -> 7*9+7 = 70), adjacent to mine 80
    expect(state.cells[70]?.adjacentMines).toBe(1);
    // Cell 0 (top-left corner) has 0 adjacent mines
    expect(state.cells[0]?.adjacentMines).toBe(0);

    // Revealing cell 0 should flood-fill all safe cells because the only mine is isolated in corner 80
    const next = reveal(state, 0, createRng('flood'));
    expect(next.cells[0]?.revealed).toBe(true);
    expect(next.cells[70]?.revealed).toBe(true);
    expect(next.cells[80]?.revealed).toBe(false);
    expect(next.status).toBe('won');
  });

  it('toggles flags on unrevealed cells and updates remaining mines counter', () => {
    const state = createState();
    const flagged = toggleFlag(state, 10);

    expect(flagged.cells[10]?.flagged).toBe(true);
    expect(remainingMines(flagged)).toBe(MINE_COUNT - 1);

    // Flagged cell cannot be revealed until unflagged
    const afterRevealAttempt = reveal(flagged, 10, createRng('flag-test'));
    expect(afterRevealAttempt.cells[10]?.revealed).toBe(false);

    const unflagged = toggleFlag(flagged, 10);
    expect(unflagged.cells[10]?.flagged).toBe(false);
    expect(remainingMines(unflagged)).toBe(MINE_COUNT);
  });

  it('loses the game when revealing a mine', () => {
    const state = createStateWithMines([12, 24]);
    const lost = reveal(state, 12, createRng('lose-test'));

    expect(lost.status).toBe('lost');
    expect(lost.explodedIndex).toBe(12);
    expect(lost.cells[12]?.revealed).toBe(true);
    expect(lost.cells[24]?.revealed).toBe(true);
  });

  it('increments seconds while playing and moves keyboard selection within bounds', () => {
    const state = { ...createState(), selected: 0 };
    const ticked = tick(state);
    expect(ticked.seconds).toBe(1);

    expect(moveSelection(state, 'left').selected).toBe(0);
    expect(moveSelection(state, 'up').selected).toBe(0);
    expect(moveSelection(state, 'right').selected).toBe(1);
    expect(moveSelection(state, 'down').selected).toBe(9);
  });

  it('switches between dig and flag mode and performs the matching action on activateCell', () => {
    const rng = createRng('mode-test');
    const initial = createState();
    expect(initial.mode).toBe('dig');

    const flagMode = toggleMode(initial);
    expect(flagMode.mode).toBe('flag');

    // In flag mode, activating a cell toggles its flag without revealing it
    const flagged = activateCell(flagMode, 5, rng);
    expect(flagged.cells[5]?.flagged).toBe(true);
    expect(flagged.cells[5]?.revealed).toBe(false);
    expect(flagged.minesPlaced).toBe(false);

    // Unflagging in flag mode
    const unflagged = activateCell(flagged, 5, rng);
    expect(unflagged.cells[5]?.flagged).toBe(false);

    // Switching back to dig mode reveals the cell on activateCell
    const digMode = setMode(unflagged, 'dig');
    expect(digMode.mode).toBe('dig');

    const revealed = activateCell(digMode, 5, rng);
    expect(revealed.cells[5]?.revealed).toBe(true);
    expect(revealed.minesPlaced).toBe(true);
  });

  it('supports easy, medium, and hard difficulties with matching board sizes and mine counts', () => {
    const easy = createState('easy');
    expect(easy.gridSize).toBe(DIFFICULTIES.easy.gridSize);
    expect(easy.cells).toHaveLength(DIFFICULTIES.easy.gridSize ** 2);
    expect(remainingMines(easy)).toBe(DIFFICULTIES.easy.mineCount);

    const medium = setDifficulty(toggleMode(easy), 'medium');
    expect(medium.difficulty).toBe('medium');
    expect(medium.mode).toBe('flag');
    expect(medium.gridSize).toBe(DIFFICULTIES.medium.gridSize);
    expect(medium.cells).toHaveLength(DIFFICULTIES.medium.gridSize ** 2);
    expect(remainingMines(medium)).toBe(DIFFICULTIES.medium.mineCount);

    const hard = setDifficulty(medium, 'hard');
    expect(hard.difficulty).toBe('hard');
    expect(hard.gridSize).toBe(DIFFICULTIES.hard.gridSize);
    expect(hard.cells).toHaveLength(DIFFICULTIES.hard.gridSize ** 2);
    expect(remainingMines(hard)).toBe(DIFFICULTIES.hard.mineCount);

    const revealedHard = reveal(hard, 0, createRng('hard-seed'));
    expect(revealedHard.cells.filter((c) => c.mine)).toHaveLength(DIFFICULTIES.hard.mineCount);
    expect(revealedHard.cells[0]?.mine).toBe(false);
  });
});
