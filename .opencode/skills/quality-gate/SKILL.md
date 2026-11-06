---

name: quality-gate
description: Führt das VibeGames Quality Gate aus (Biome, Repo-Checks, Vitest, TypeScript, Build) und erklärt, wie jede Fehlermeldung behoben wird. Nutzen am Ende jeder Aufgabe und wenn das Gate rot ist.
---

# Quality Gate

```bash
npm run format   # zuerst: behebt Formatierung und Import-Reihenfolge automatisch
npm run gate     # lint → check → test → build, bricht beim ersten roten Schritt ab
```
Einzeln: `npm run lint`, `npm run check`, `npm run test`, `npm run build`.
Erst aufhören, wenn `npm run gate` ohne Fehler durchläuft.

## Fehler → Lösung

### Biome (`npm run lint`)

- Formatierung/Imports → `npm run format`
- `noUnusedVariables`/`noUnusedImports` → entfernen
- `useExhaustiveDependencies` → fehlende Abhängigkeit ins Array; ist sie absichtlich weggelassen,
  Callback in `useRef` legen (wie `useGameLoop` es macht)
- `noArrayIndexKey` → stabilen Schlüssel nutzen; sonst `// biome-ignore lint/suspicious/noArrayIndexKey: <Grund>`
- a11y-Regeln → echte `<button type="button">`, `aria-label` an Icon-Buttons

### Repo-Checks (`npm run check`)

| Meldung                                                 | Lösung                                                                                      |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `game.json fehlt` / `logo.svg fehlt` / `main.tsx fehlt` | Datei anlegen (Skill `new-game`)                                                            |
| `mindestens ein Test (*.test.ts)`                       | `logic.test.ts` mit Tests für `logic.ts`                                                    |
| `game.json: category …`                                 | `arcade`, `denken` oder `karten-wuerfel`                                                    |
| `score.label in Großbuchstaben`                         | z. B. `HIGHSCORE`                                                                           |
| `description höchstens 120 Zeichen`                     | kürzen, ein Satz                                                                            |
| `logo.svg: viewBox`                                     | `viewBox="0 0 64 64"`                                                                       |
| `logo.svg: Farbe "#…" nicht erlaubt`                    | `currentColor` oder `style="fill: var(--token)"`                                            |
| `höchstens drei Farben`                                 | Farben im Logo reduzieren                                                                   |
| `Hex-Farben …`                                          | `useColors()['token']` im Canvas, `var(--token)` in CSS; eigener Akzent nur in `palette.ts` |
| `keine Verläufe` / `keine Schatten`                     | entfernen, flach zeichnen                                                                   |
| `Import "../…" verlässt den Spielordner`                | aus `@core/sdk` oder `@core/assets` importieren                                             |
| `nur @core/sdk und @core/assets`                        | Funktion aus `@core/sdk` nutzen; fehlt sie, im Spiel selbst schreiben                       |
| `Paket "x" ist keine Abhängigkeit`                      | Paket nicht nutzen (keine neuen Libs ohne Begründung)                                       |
| `… steht nicht in …/manifest.json`                      | Eintrag ergänzen (Skill `game-assets-credits`)                                              |
| `Feld use fehlt`                                        | `use` im Manifest ausfüllen                                                                 |
| `source "x" fehlt in credits/`                          | `credits/x/credit.json` anlegen oder `"self"`                                               |
| `Credit "x" fehlt in credits/`                          | Ordner anlegen oder ID in `game.json` korrigieren                                           |
| `keine gültige SPDX-ID`                                 | ID von https://spdx.org/licenses/ (z. B. `CC0-1.0`, `MIT`, `OFL-1.1`)                       |
| `LICENSE-Datei fehlt`                                   | Lizenztext der Quelle als `credits/<id>/LICENSE`                                            |
| `Game-Liste veraltet`                                   | `npm run sync:forms`                                                                        |
| `tokens.css ist veraltet`                               | nicht von Hand ändern; `npm run tokens` (nur bei Core-Aufgaben)                             |

### Vitest (`npm run test`)

- Test rot nach eigener Änderung: zuerst prüfen, ob die **Logik** falsch ist. Tests nur anpassen,
  wenn sich die Regel laut Aufgabe ändert.
- `AudioContext is not defined` → kein Sound in `logic.ts`; `playSfx` nur in `main.tsx`.
- `window`/`document is not defined` → DOM-Zugriff aus `logic.ts` nach `main.tsx` verschieben.

### TypeScript/Build (`npm run build`)

- `Object is possibly undefined` bei Array-Zugriff (`noUncheckedIndexedAccess`) →
  `const head = snake[0]; if (!head) return s;` oder `snake[0] as Point`, wenn sicher.
- `Cannot find module './logic'` → Endung angeben: `./logic.ts`.
- Typfehler bei `useColors()` → Token-Namen genau wie in `design/tokens.json` (`'game-rose'`, nicht `'rose'`).

## Nie

- Checks, Skripte, Biome- oder TS-Konfiguration ändern, um das Gate grün zu bekommen.
- Tests löschen oder mit `.skip` abschalten.
- `// @ts-ignore` oder `any` statt einer Lösung.
