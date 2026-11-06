// Vorlage rundenbasiertes Spiel ohne Canvas (Karten, Würfel, Rätsel): Würfel 21.
// Würfle so nah wie möglich an 21. Über 21 ist verloren.
import type { Rng } from '@core/sdk';

export const TARGET = 21;

export type Status = 'playing' | 'stood' | 'bust';

export interface State {
  rolls: number[];
  status: Status;
}

export const createState = (): State => ({ rolls: [], status: 'playing' });

export const total = (s: State) => s.rolls.reduce((sum, r) => sum + r, 0);

/** Punkte am Ende: die Summe, oder 0 bei über 21. */
export const finalScore = (s: State) => (s.status === 'bust' ? 0 : total(s));

export function roll(s: State, rng: Rng): State {
  if (s.status !== 'playing') return s;
  const rolls = [...s.rolls, rng.int(1, 6)];
  const sum = rolls.reduce((a, b) => a + b, 0);
  return { rolls, status: sum > TARGET ? 'bust' : sum === TARGET ? 'stood' : 'playing' };
}

export function stand(s: State): State {
  return s.status === 'playing' ? { ...s, status: 'stood' } : s;
}
