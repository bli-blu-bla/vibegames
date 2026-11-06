import type { Direction, Rng } from '@core/sdk';

export const GRID_SIZE = 5;
export const CELL_COUNT = GRID_SIZE * GRID_SIZE;

export type Status = 'playing' | 'won';

export interface State {
  lights: boolean[];
  moves: number;
  selected: number;
  status: Status;
}

const DELTAS: Record<Direction, { x: number; y: number }> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export function createState(rng: Rng): State {
  const lights = Array<boolean>(CELL_COUNT).fill(false);
  const clicks = rng.int(8, 12);

  for (let i = 0; i < clicks; i += 1) {
    toggleLights(lights, rng.int(0, CELL_COUNT - 1));
  }

  return { lights, moves: 0, selected: 12, status: 'playing' };
}

export function toggle(state: State, index: number): State {
  if (state.status === 'won' || index < 0 || index >= CELL_COUNT) return state;

  const lights = [...state.lights];
  toggleLights(lights, index);
  const status = lights.every((light) => !light) ? 'won' : 'playing';
  return { ...state, lights, moves: state.moves + 1, status };
}

export function moveSelection(state: State, direction: Direction): State {
  const x = state.selected % GRID_SIZE;
  const y = Math.floor(state.selected / GRID_SIZE);
  const delta = DELTAS[direction];
  const nextX = Math.max(0, Math.min(GRID_SIZE - 1, x + delta.x));
  const nextY = Math.max(0, Math.min(GRID_SIZE - 1, y + delta.y));
  return { ...state, selected: nextY * GRID_SIZE + nextX };
}

function toggleLights(lights: boolean[], index: number) {
  const x = index % GRID_SIZE;
  const y = Math.floor(index / GRID_SIZE);
  const positions: Array<[number, number]> = [
    [x, y],
    [x - 1, y],
    [x + 1, y],
    [x, y - 1],
    [x, y + 1],
  ];

  for (const [nextX, nextY] of positions) {
    if (nextX >= 0 && nextX < GRID_SIZE && nextY >= 0 && nextY < GRID_SIZE) {
      const nextIndex = nextY * GRID_SIZE + nextX;
      lights[nextIndex] = !lights[nextIndex];
    }
  }
}
