import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { createStorage } from './storage.ts';
import { COLOR_TOKENS, type ColorToken } from './tokens.ts';

export type { ColorToken };

export type Theme = 'dark' | 'light';

const storage = createStorage('core');

interface ThemeState {
  theme: Theme;
  toggle(): void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: storage.get<Theme>('theme', 'dark'),
  toggle() {
    const theme = get().theme === 'dark' ? 'light' : 'dark';
    storage.set('theme', theme);
    set({ theme });
  },
}));

/** Setzt data-theme auf <html>. Einmal in der App aufrufen. */
export function useApplyTheme() {
  const theme = useThemeStore((s) => s.theme);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
}

function readColors(): Record<ColorToken, string> {
  const style = getComputedStyle(document.documentElement);
  return Object.fromEntries(
    COLOR_TOKENS.map((name) => [name, style.getPropertyValue(`--${name}`).trim()]),
  ) as Record<ColorToken, string>;
}

/**
 * Alle Farb-Tokens als Strings für Canvas-Zeichnungen (Canvas kennt keine CSS-Variablen).
 * Aktualisiert sich beim Theme-Wechsel.  ctx.fillStyle = colors['game-rose'];
 */
export function useColors(): Record<ColorToken, string> {
  const theme = useThemeStore((s) => s.theme);
  const [colors, setColors] = useState(readColors);
  // biome-ignore lint/correctness/useExhaustiveDependencies: theme ist der Auslöser fürs Neulesen
  useEffect(() => {
    // Erst nach dem Setzen von data-theme lesen
    requestAnimationFrame(() => setColors(readColors()));
  }, [theme]);
  return colors;
}
