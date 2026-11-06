---

name: game-design
description: Design-Regeln für ein VibeGames-Spiel – Tokens, Spielfeld-Farben, eigener Akzent, Typografie, Formen, Icons und das Pflicht-Logo (logo.svg). Nutzen beim Gestalten von Spielfeld, Sprites und Logo.
---

# Design für Games

Quelle: `design/README.md` und `design/tokens.json`. Dark ist Standard, Light das zweite Theme.
Alles muss in beiden Themes funktionieren, deshalb **nur Tokens**, nie feste Farbwerte.

## Fest (nicht ändern)

- Shell, Leiste, Score, Pause/Restart, Game-Over-Overlay kommen aus dem Core.
- Schriften: Titel `t-display`/`t-heading` (Pixelify Sans), Text `t-body`/`t-small` (Geist),
  Zahlen `t-score`/`t-mono-small` (Geist Mono). Keine anderen Schriften.
- Rundungen: `--radius-sm` 4px (Spielobjekte, Kacheln), `--radius-md` 8px (Buttons), `--radius-lg` 16px (Karten).
- Abstände nur `--space-1` … `--space-7` (4, 8, 12, 16, 24, 32, 48px).
- Primäre Aktion: Klasse `btn btn-primary` (accent auf on-accent). Höchstens eine pro Bereich.
- `danger` nur für Verlust/Fehler und immer mit Wort oder Icon.
- Keine Schatten, keine Verläufe, kein Glow, keine Fotos.

## Frei im Spielfeld

- **Hintergrund:** `surface-100` (Standard) oder `surface-200`. Raster/Linien in `surface-300` oder `line`.
- **Spielfarben:** höchstens **vier** aus `accent`, `highlight`, `game-sky`, `game-rose`, `game-sand`, `danger`.
  - Spieler/eigene Figur: meist `accent`
  - Ziele, Futter, Sammelobjekte: `game-rose` oder `highlight`
  - Gegner, Hindernisse: `game-sky` oder `game-sand`; `danger` nur, wenn es "Verlust" bedeutet
  - Text im Feld: `ink`, Nebeninfos `ink-muted`
- **Ein eigener Akzent** (optional): nur im Spielfeld, als einzige Hex-Farbe in `games/<ordner>/palette.ts`:

  ```ts
  // Eigener Akzent für die Lava. Kontrast auf surface-100 (dark) 5.1:1, auf surface-100 (light) 3.4:1.
  export const LAVA = '#ff9f43';
  ```

  Mindestens 3:1 Kontrast auf dem Spielfeld-Hintergrund in beiden Themes, im Kommentar belegen.
- **Formen:** flach, eckig oder `radius-sm` (im Canvas `ctx.roundRect(x, y, w, h, 4)`), Kreise erlaubt.
- **Animation:** im Feld frei, solange flach. Menüs/Übergänge unter 200 ms.

## Farbe darf nie allein Bedeutung tragen

Zustände (getroffen, falsch, gewonnen) zusätzlich mit Form, Symbol oder Text unterscheiden.
Farben, die man unterscheiden muss, auch in der Helligkeit unterscheiden (z. B. `accent` vs. `game-rose`).

## Barrierefreiheit

- Canvas: `role="img"` und ein `aria-label`, das den Zustand kurz beschreibt.
- Bedienelemente sind echte `<button>`, mindestens 44px hoch (Klasse `btn` erfüllt das).
- Icon-only-Buttons brauchen `aria-label`.

## Icons

Phosphor aus `@phosphor-icons/react`, z. B. `import { Heart } from '@phosphor-icons/react'`.
`<Heart size={20} />` (regular) für UI, `weight="fill"` oder `"bold"` für Akzente. Pro Kontext ein Gewicht.
Keine Emojis als Spielgrafik, außer das Spiel lebt davon (dann im Code begründen).

## Logo (`logo.svg`, Pflicht)

Regeln (das Gate prüft sie):

- `viewBox="0 0 64 64"`, eine einfache, flache Form aus dem Spiel (Karte, Würfel, Ball, Schlange).
- Höchstens **drei Farben**: `currentColor` (wird zu `ink`) und Tokens als `style="fill: var(--game-rose)"`.
- Keine Hex-Farben, kein Text, kein `<style>`, keine Verläufe, Filter, Bilder, Links oder Scripts.
- Rand von etwa 8px lassen, Strichstärke 4, Rundungen `rx="4"` bis `rx="10"`.

Beispiele:

```svg
<!-- Würfel -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect x="8" y="8" width="48" height="48" rx="10" fill="none" stroke="currentColor" stroke-width="4"/><circle cx="22" cy="22" r="4" fill="currentColor"/><circle cx="32" cy="32" r="4" fill="currentColor"/><circle cx="42" cy="42" r="4" fill="currentColor"/></svg>

<!-- Ball und Schläger, Ball als Akzent -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="currentColor"><circle cx="32" cy="20" r="10" style="fill: var(--game-rose)"/><rect x="12" y="46" width="40" height="10" rx="5"/></svg>

<!-- Zielscheibe -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="22" fill="none" stroke="currentColor" stroke-width="4"/><circle cx="32" cy="32" r="8" style="fill: var(--accent)"/></svg>
```
Ein Phosphor-Icon passt oft als Ausgangspunkt (Form nachzeichnen, nicht einbetten).
Hast du eine bessere, eigene Form: nimm sie und begründe sie in einem Satz im PR-Text bzw. als
Kommentar `<!-- … -->` im SVG.
