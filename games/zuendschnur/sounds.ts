import type { GameEvent } from './logic.ts';

/**
 * Eigene Effekte für Zündschnur, per Code erzeugt (ZzFX-Parameter, siehe
 * https://killedbyapixel.github.io/ZzFX/). Reihenfolge: Lautstärke, Zufall, Frequenz, Anschlag,
 * Halten, Ausklang, Form (0 Sinus, 1 Dreieck, 2 Säge, 4 Rauschen), Formkurve, Gleiten, …
 */
export const SOUNDS: Record<GameEvent, number[]> = {
  // Bombe legen: kurzes, tiefes Plopp
  place: [0.35, 0, 180, 0, 0.02, 0.06, 0, 1, -6],
  // Explosion: weicher, tiefer Rumms (Sinus mit etwas Rauschen statt reinem Rauschen)
  boom: [0.6, 0.05, 90, 0.01, 0.05, 0.3, 0, 1, -1, 0, 0, 0, 0, 0.8, 0, 0, 0, 0.5],
  // Extra: zwei helle, steigende Töne
  pickup: [0.4, 0, 600, 0, 0.05, 0.15, 1, 1.4, 0, 0, 300, 0.05, 0.06],
  // Monster erwischt: fallendes Quieken
  mob: [0.7, 0, 700, 0, 0.04, 0.25, 2, 1, -12, 0, 0, 0, 0, 0.2],
  // Stufe geschafft: aufsteigende Fanfare
  clear: [0.7, 0, 500, 0.02, 0.25, 0.4, 1, 1.8, 0, 0, 250, 0.08, 0.12],
  // Getroffen: fallender, wackelnder Ton
  death: [0.9, 0, 300, 0.02, 0.25, 0.5, 2, 1, -4, 0, 0, 0, 0.12, 0.3],
  // Bombe treten: kurzes Wusch
  kick: [0.6, 0, 120, 0, 0.01, 0.08, 4, 1, 20, 0, 0, 0, 0, 0.5],
  // Schild fängt Treffer ab: schimmernder Glockenton
  shield: [0.7, 0, 1200, 0, 0.08, 0.35, 0, 1, 0, 0, 0, 0, 0, 0, 40],
  // Bombe werfen: steigendes Wusch
  throw: [0.5, 0, 220, 0.01, 0.04, 0.12, 1, 1, 8],
};
