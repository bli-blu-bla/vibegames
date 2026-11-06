import type { Direction, Rng } from '@core/sdk';

export const GRID_SIZE = 9;
export const CELL_COUNT = GRID_SIZE * GRID_SIZE;
export const MINE_COUNT = 10;

export type Status = 'playing' | 'won' | 'lost';
export type ActionMode = 'dig' | 'flag';
export type Difficulty = 'easy' | 'medium' | 'hard';

export interface DifficultyConfig {
  id: Difficulty;
  label: string;
  gridSize: number;
  mineCount: number;
}

export const DIFFICULTIES: Record<Difficulty, DifficultyConfig> = {
  easy: { id: 'easy', label: 'Leicht', gridSize: 9, mineCount: 10 },
  medium: { id: 'medium', label: 'Mittel', gridSize: 11, mineCount: 18 },
  hard: { id: 'hard', label: 'Schwer', gridSize: 12, mineCount: 26 },
};

export const DIFFICULTY_LIST: DifficultyConfig[] = [
  DIFFICULTIES.easy,
  DIFFICULTIES.medium,
  DIFFICULTIES.hard,
];

export interface Cell {
  mine: boolean;
  revealed: boolean;
  flagged: boolean;
  adjacentMines: number;
}

export interface State {
  difficulty: Difficulty;
  gridSize: number;
  mineCount: number;
  cells: Cell[];
  minesPlaced: boolean;
  status: Status;
  seconds: number;
  selected: number;
  explodedIndex: number | null;
  mode: ActionMode;
}

const DELTAS: Record<Direction, { x: number; y: number }> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export function createState(difficulty: Difficulty = 'easy'): State {
  const config = DIFFICULTIES[difficulty];
  const cellCount = config.gridSize * config.gridSize;
  const cells: Cell[] = Array.from({ length: cellCount }, () => ({
    mine: false,
    revealed: false,
    flagged: false,
    adjacentMines: 0,
  }));

  return {
    difficulty,
    gridSize: config.gridSize,
    mineCount: config.mineCount,
    cells,
    minesPlaced: false,
    status: 'playing',
    seconds: 0,
    selected: Math.floor(cellCount / 2),
    explodedIndex: null,
    mode: 'dig',
  };
}

export function createStateWithMines(
  mineIndices: Iterable<number>,
  difficulty: Difficulty = 'easy',
): State {
  const mineSet = new Set(mineIndices);
  const base = createState(difficulty);
  const cells = base.cells.map((cell, index) => ({
    ...cell,
    mine: mineSet.has(index),
  }));
  updateAdjacentCounts(cells, base.gridSize);

  return {
    ...base,
    cells,
    minesPlaced: true,
  };
}

export function getNeighbors(index: number, gridSize: number = GRID_SIZE): number[] {
  const x = index % gridSize;
  const y = Math.floor(index / gridSize);
  const neighbors: number[] = [];

  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < gridSize && ny >= 0 && ny < gridSize) {
        neighbors.push(ny * gridSize + nx);
      }
    }
  }

  return neighbors;
}

function updateAdjacentCounts(cells: Cell[], gridSize: number): void {
  for (let i = 0; i < cells.length; i += 1) {
    const cell = cells[i];
    if (!cell) continue;
    let count = 0;
    for (const neighborIndex of getNeighbors(i, gridSize)) {
      if (cells[neighborIndex]?.mine) {
        count += 1;
      }
    }
    cell.adjacentMines = count;
  }
}

function placeMines(
  cells: Cell[],
  safeIndex: number,
  mineCount: number,
  gridSize: number,
  rng: Rng,
): Cell[] {
  const candidates: number[] = [];
  for (let i = 0; i < cells.length; i += 1) {
    if (i !== safeIndex) {
      candidates.push(i);
    }
  }

  const shuffled = rng.shuffle(candidates);
  const mineSet = new Set(shuffled.slice(0, mineCount));

  const nextCells = cells.map((cell, index) => ({
    ...cell,
    mine: mineSet.has(index),
  }));

  updateAdjacentCounts(nextCells, gridSize);
  return nextCells;
}

export function reveal(state: State, index: number, rng: Rng): State {
  if (state.status !== 'playing' || index < 0 || index >= state.cells.length) {
    return state;
  }

  const currentCell = state.cells[index];
  if (!currentCell || currentCell.revealed || currentCell.flagged) {
    return state;
  }

  const cells = state.minesPlaced
    ? state.cells.map((cell) => ({ ...cell }))
    : placeMines(state.cells, index, state.mineCount, state.gridSize, rng);

  const clicked = cells[index];
  if (!clicked) return state;

  if (clicked.mine) {
    for (const cell of cells) {
      if (cell.mine) {
        cell.revealed = true;
      }
    }
    return {
      ...state,
      cells,
      minesPlaced: true,
      status: 'lost',
      selected: index,
      explodedIndex: index,
    };
  }

  const queue: number[] = [index];
  const visited = new Set<number>([index]);

  while (queue.length > 0) {
    const currentIndex = queue.shift();
    if (currentIndex === undefined) break;

    const cell = cells[currentIndex];
    if (!cell || cell.mine || cell.flagged) continue;

    cell.revealed = true;

    if (cell.adjacentMines === 0) {
      for (const neighborIndex of getNeighbors(currentIndex, state.gridSize)) {
        if (!visited.has(neighborIndex)) {
          const neighbor = cells[neighborIndex];
          if (neighbor && !neighbor.revealed && !neighbor.flagged && !neighbor.mine) {
            visited.add(neighborIndex);
            queue.push(neighborIndex);
          }
        }
      }
    }
  }

  const allSafeRevealed = cells.every((cell) => cell.mine || cell.revealed);

  return {
    ...state,
    cells,
    minesPlaced: true,
    status: allSafeRevealed ? 'won' : 'playing',
    selected: index,
  };
}

export function toggleFlag(state: State, index: number): State {
  if (state.status !== 'playing' || index < 0 || index >= state.cells.length) {
    return state;
  }

  const target = state.cells[index];
  if (!target || target.revealed) {
    return state;
  }

  const cells = state.cells.map((cell, i) =>
    i === index ? { ...cell, flagged: !cell.flagged } : cell,
  );

  return {
    ...state,
    cells,
    selected: index,
  };
}

export function setMode(state: State, mode: ActionMode): State {
  if (state.status !== 'playing' || state.mode === mode) {
    return state;
  }

  return {
    ...state,
    mode,
  };
}

export function toggleMode(state: State): State {
  return setMode(state, state.mode === 'dig' ? 'flag' : 'dig');
}

export function setDifficulty(state: State, difficulty: Difficulty): State {
  if (state.difficulty === difficulty && !state.minesPlaced && state.seconds === 0) {
    return state;
  }
  return {
    ...createState(difficulty),
    mode: state.mode,
  };
}

export function activateCell(state: State, index: number, rng: Rng): State {
  return state.mode === 'flag' ? toggleFlag(state, index) : reveal(state, index, rng);
}

export function remainingMines(state: State): number {
  const flaggedCount = state.cells.filter((cell) => cell.flagged).length;
  return state.mineCount - flaggedCount;
}

export function tick(state: State): State {
  if (state.status !== 'playing') {
    return state;
  }
  return {
    ...state,
    seconds: state.seconds + 1,
  };
}

export function moveSelection(state: State, direction: Direction): State {
  const x = state.selected % state.gridSize;
  const y = Math.floor(state.selected / state.gridSize);
  const delta = DELTAS[direction];
  const nextX = Math.max(0, Math.min(state.gridSize - 1, x + delta.x));
  const nextY = Math.max(0, Math.min(state.gridSize - 1, y + delta.y));
  return { ...state, selected: nextY * state.gridSize + nextX };
}
