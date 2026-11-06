import type { GameNet, NetMode } from './net.ts';
import type { GameStorage } from './storage.ts';

export type GameCategory = 'arcade' | 'denken' | 'karten-wuerfel';

export const CATEGORY_LABELS: Record<GameCategory, string> = {
  arcade: 'Arcade',
  denken: 'Denken',
  'karten-wuerfel': 'Karten und Würfel',
};

/** Wie der Score angezeigt wird. `points` 012480, `moves` 014, `ms` 231 ms, `seconds` 01:42 */
export type ScoreFormat = 'points' | 'moves' | 'ms' | 'seconds';

/** Inhalt von games/<ordner>/game.json */
export interface GameJson {
  title: string;
  description: string;
  category: GameCategory;
  score: {
    label: string;
    /** `higher`: mehr ist besser (Punkte). `lower`: weniger ist besser (Zeit, Züge). */
    better: 'higher' | 'lower';
    format: ScoreFormat;
  };
  /** Kurzer Bedienhinweis unter dem Spielfeld, z. B. "Pfeiltasten oder Wischen". */
  controls: string;
  /** IDs aus credits/<id>/. Leeres Array, wenn das Spiel nur Eigenes nutzt. */
  credits: string[];
  /**
   * Online zu zweit spielbar. `versus` gegeneinander, `coop` miteinander.
   * Weglassen, wenn das Spiel nur allein Sinn ergibt.
   */
  multiplayer?: NetMode;
}

export interface GameMeta extends GameJson {
  /** Ordnername unter games/ */
  id: string;
  /** Inhalt von logo.svg */
  logo: string;
}

/** Was die GameShell einem Spiel zur Verfügung stellt. Das Objekt bleibt pro Run gleich. */
export interface GameApi {
  readonly gameId: string;
  /** Zufalls-Seed dieses Runs, für createRng(api.seed). */
  readonly seed: string;
  /** Persistenter Speicher, nur für dieses Spiel. */
  readonly storage: GameStorage;
  /**
   * Verbindung zum Mitspieler, wenn online gespielt wird, sonst `null`.
   * Beide Seiten bekommen denselben `seed`. Rekorde zählen online nicht.
   */
  readonly net: GameNet | null;
  /** Aktuellen Score melden. Die Shell zeigt ihn an. */
  setScore(score: number): void;
  /**
   * Spiel beenden. Die Shell zeigt das Ergebnis und speichert den Rekord.
   * Ohne Argument: verloren ("Game Over"). Bei `better: 'lower'` zählt ein Rekord nur bei `win`.
   */
  gameOver(result?: GameResult): void;
}

export interface GameResult {
  outcome?: 'win' | 'lose' | 'draw';
  /** Kurzer Satz unter dem Titel, z. B. "Schach matt in 23 Zügen." */
  message?: string;
}

export interface GameProps {
  api: GameApi;
  /** true, solange die Shell pausiert oder Game Over zeigt. Dann keine Updates, keine Eingaben. */
  paused: boolean;
}
