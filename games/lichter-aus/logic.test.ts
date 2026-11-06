import { createRng } from '@core/sdk';
import { describe, expect, it } from 'vitest';
import { CELL_COUNT, createState, moveSelection, toggle } from './logic.ts';

describe('Lichter aus logic', () => {
  it('creates a five by five board with no moves', () => {
    const state = createState(createRng('lichter-aus'));

    expect(state.lights).toHaveLength(CELL_COUNT);
    expect(state.moves).toBe(0);
    expect(state.status).toBe('playing');
  });

  it('toggles a cell and its direct neighbours', () => {
    const state = {
      ...createState(createRng('test')),
      lights: Array<boolean>(CELL_COUNT).fill(false),
    };
    const next = toggle(state, 12);

    expect(next.lights[12]).toBe(true);
    expect(next.lights[7]).toBe(true);
    expect(next.lights[17]).toBe(true);
    expect(next.lights[11]).toBe(true);
    expect(next.lights[13]).toBe(true);
    expect(next.moves).toBe(1);
  });

  it('wins when the last lights are turned off', () => {
    const state = {
      ...createState(createRng('test')),
      lights: Array<boolean>(CELL_COUNT).fill(false),
    };
    const cross = new Set([7, 11, 12, 13, 17]);
    const lastLights = { ...state, lights: state.lights.map((_, index) => cross.has(index)) };
    const next = toggle(lastLights, 12);

    expect(next.status).toBe('won');
    expect(next.moves).toBe(1);
    expect(next.lights.every((light) => !light)).toBe(true);
  });

  it('moves the keyboard selection without leaving the board', () => {
    const state = { ...createState(createRng('test')), selected: 0 };

    expect(moveSelection(state, 'left').selected).toBe(0);
    expect(moveSelection(state, 'up').selected).toBe(0);
    expect(moveSelection(state, 'right').selected).toBe(1);
    expect(moveSelection(state, 'down').selected).toBe(5);
  });
});
