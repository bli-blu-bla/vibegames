import { create } from 'zustand';
import { createStorage } from './storage.ts';

const storage = createStorage('core');

interface SoundState {
  muted: boolean;
  toggle(): void;
}

export const useSoundStore = create<SoundState>((set, get) => ({
  muted: storage.get('muted', false),
  toggle() {
    const muted = !get().muted;
    storage.set('muted', muted);
    set({ muted });
  },
}));

/**
 * Fertige Effekte, per Code erzeugt (ZzFX). Eigene Effekte: https://killedbyapixel.github.io/ZzFX/
 * Parameter-Arrays dort erzeugen und als neuen Eintrag in einem Spiel definieren.
 */
export const SFX = {
  click: [0.6, 0, 900, 0, 0.01, 0.02, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.5],
  coin: [0.7, 0, 1300, 0, 0.02, 0.15, 1, 1.5, 0, 0, 400, 0.06],
  hit: [0.8, 0, 200, 0, 0.02, 0.12, 4, 1.4, -8, 0, 0, 0, 0, 0.5],
  jump: [0.6, 0, 300, 0.01, 0.05, 0.1, 0, 1.2, 12],
  lose: [0.8, 0, 400, 0.02, 0.2, 0.4, 2, 0.7, -2, 0, 0, 0, 0.1],
  win: [0.7, 0, 600, 0.02, 0.2, 0.35, 1, 1.8, 0, 0, 300, 0.08, 0.1],
} satisfies Record<string, number[]>;

export type SfxName = keyof typeof SFX;

/** Spielt einen Effekt ab: playSfx('coin') oder playSfx([...eigene Parameter]). */
export function playSfx(sound: SfxName | number[]) {
  if (useSoundStore.getState().muted) return;
  const params = typeof sound === 'string' ? SFX[sound] : sound;
  // ZzFX erst beim ersten Ton laden: legt beim Import einen AudioContext an
  zzfx ??= import('zzfx').then((m) => m.zzfx);
  zzfx
    .then((play) => play(...params))
    .catch(() => {
      // Audio nicht verfügbar (z. B. vor der ersten Nutzer-Interaktion)
    });
}

let zzfx: Promise<(...params: number[]) => unknown> | undefined;
