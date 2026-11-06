import { create } from 'zustand';

export type ShellStatus = 'playing' | 'paused' | 'over';

interface ShellState {
  score: number;
  status: ShellStatus;
  /** Zählt bei jedem Neustart hoch. Das Spiel wird dann neu gemountet. */
  run: number;
  setScore(score: number): void;
  togglePause(): void;
  pause(): void;
  gameOver(): void;
  restart(): void;
}

export const useShellStore = create<ShellState>((set, get) => ({
  score: 0,
  status: 'playing',
  run: 0,
  setScore: (score) => {
    if (get().status !== 'over') set({ score });
  },
  togglePause: () => {
    const { status } = get();
    if (status !== 'over') set({ status: status === 'paused' ? 'playing' : 'paused' });
  },
  pause: () => {
    if (get().status === 'playing') set({ status: 'paused' });
  },
  gameOver: () => set({ status: 'over' }),
  restart: () => set((s) => ({ score: 0, status: 'playing', run: s.run + 1 })),
}));
