/**
 * Core-SDK für alle Games. Spiele importieren nur von hier:  import { ... } from '@core/sdk';
 */
export { useCanvas } from './canvas.ts';
export { formatScore } from './format.ts';
export {
  type Direction,
  keyToDirection,
  useJoystick,
  useKeyDown,
  usePressedKeys,
  useSwipe,
} from './input.ts';
export { useGameLoop, useTicker } from './loop.ts';
export type { GameNet, NetMode, NetRole } from './net.ts';
export { useNet } from './online.ts';
export { createRng, dailySeed, type Rng, randomSeed } from './rng.ts';
export { playSfx, SFX, type SfxName } from './sound.ts';
export { createStorage, type GameStorage } from './storage.ts';
export { useColors } from './theme.ts';
export { COLOR_TOKENS, type ColorToken } from './tokens.ts';
export type { GameApi, GameProps, GameResult } from './types.ts';
