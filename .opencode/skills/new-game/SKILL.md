---

name: new-game
description: Baut ein neues VibeGames-Spiel aus einem Game Request in games/<ordner>/ – game.json, logo.svg, Logik mit Tests, main.tsx. Nutzen bei jeder Aufgabe "neues Spiel".
---

# Neues Spiel bauen

Ziel: ein kleines, fertiges Spiel in `games/<ordner>/`, das das Quality Gate besteht.
Der Ordnername steht in der Aufgabe. Nur in diesem Ordner arbeiten (plus `credits/`, falls nötig).

## Ablauf

1. **Lesen:** Aufgabe (`task.md`), `AGENTS.md`, `design/README.md`, `assets/manifest.json`.
   Referenzspiel ansehen: `games/snake/` (alle Dateien, sie sind kurz).
2. **Vorlage wählen** und nach `games/<ordner>/` kopieren:

   | Spieltyp                                   | Vorlage                                            | Beispiele                                |
   | ------------------------------------------ | -------------------------------------------------- | ---------------------------------------- |
   | Raster, Schritt für Schritt (Ticker)       | `games/snake/`                                     | Snake, Tetris-artig, Minenfeld mit Timer |
   | Echtzeit, freie Bewegung (Game Loop)       | `.opencode/skills/new-game/templates/canvas-loop/` | Ballfang, Ausweichen, Flappy             |
   | Rundenbasiert, Klicks/Buttons, kein Canvas | `.opencode/skills/new-game/templates/dom-turns/`   | Würfel, Karten, Memory, Rätsel           |

   ```bash
   mkdir -p games/<ordner>
   cp .opencode/skills/new-game/templates/canvas-loop/* games/<ordner>/
   ```
3. **Spiellogik** in `logic.ts` umbauen (Skill `game-sdk`, Abschnitt "Logik"):
   - Ein `State`-Typ, `createState()`, und Funktionen `(state, …) => neuer State`.
   - Kein React, kein DOM, kein `Math.random` (Zufall über das übergebene `Rng`).
   - Spielende eindeutig: `isOver(state)` oder ein `status`-Feld.
   - **Schwierigkeit prüfen:** Hängt der Spaß stark vom Können ab (Computer-Gegner, Tempo,
     Rätselgröße, Zeitlimit), drei Stufen **Leicht, Mittel, Schwer** anbieten (Skill `game-sdk`,
     Abschnitt "Schwierigkeit"). Weglassen, wenn das Spiel schon von selbst schwerer wird
     (Snake, Stellwerk) oder eine Stufe kaum etwas ändern würde.
4. **Tests** in `logic.test.ts`: mindestens Start-Zustand, eine Kernregel, Spielende, Punkte.
   Mit Stufen zusätzlich: jede Stufe startet gültig, Schwer ist messbar schwerer als Leicht.
5. **Darstellung** in `main.tsx`: Default-Export `function Game({ api, paused }: GameProps)`.
   - `api.setScore(n)` bei jeder Punkteänderung, `api.gameOver()` genau einmal am Ende.
     Spiele mit Sieg (Schach, Karten-Runs, Schicht überstanden): `api.gameOver({ outcome: 'win', message: '…' })`.
   - Bei `paused === true` keine Updates und keine Eingaben (Hooks bekommen `!paused`).
   - Farben aus `useColors()` (Canvas) oder `var(--token)` (CSS). Keine Hex-Werte.
   - Tastatur **und** Touch (Wischen, Joystick oder Buttons). Tasten `P`, `R`, `Escape` gehören der Shell.
6. **`game.json`** schreiben:

   ```json
   {
     "title": "Ballfang",
     "description": "Fang fallende Bälle mit dem Schläger, lass keinen durch.",
     "category": "arcade",
     "score": { "label": "HIGHSCORE", "better": "higher", "format": "points" },
     "controls": "Pfeiltasten, A/D oder Joystick",
     "credits": []
   }
   ```

   - `category`: `arcade` | `denken` | `karten-wuerfel`
   - `score.better`: `higher` (Punkte) oder `lower` (Zeit, Züge). `score.format`: `points` | `moves` | `ms` | `seconds`
   - `score.label` in Großbuchstaben: `HIGHSCORE`, `BESTZEIT`, `BESTE ZÜGE`, `SERIE`
   - `description`: ein Satz, höchstens 120 Zeichen, aus dem Issue übernehmen.
   - `multiplayer`: nur wenn das Issue „zu zweit“/„online“ verlangt und es passt (`"versus"` oder
     `"coop"`). Erst das Solo-Spiel fertig bauen, dann Skill `game-multiplayer`. Sonst weglassen.
7. **`logo.svg`** zeichnen (Skill `game-design`, Abschnitt "Logo").
8. **Assets** aus dem Issue liegen ggf. schon in `games/<ordner>/assets/` mit einem `manifest.json`,
   in dem `use` leer ist: ausfüllen und im Spiel nutzen (Skill `game-assets-credits`).
9. **Prüfen:**

   ```bash
   npm run format
   npm run sync:forms
   npm run gate
   ```

   Fehler mit dem Skill `quality-gate` beheben, bis alles grün ist.

## Checkliste vor dem Ende

- [ ] Spiel ist in zwei Minuten verstanden, kein Menü, keine Optionen
  (einzige Ausnahme: die Stufenwahl Leicht/Mittel/Schwer, wenn sie sinnvoll ist)
- [ ] Schwierigkeit bewusst entschieden: drei Stufen mit Standard Mittel, oder bewusst keine
- [ ] `game.json`, `logo.svg`, `main.tsx`, `logic.ts`, `logic.test.ts` vorhanden
- [ ] Score wird gemeldet, Game Over wird ausgelöst, Restart funktioniert (Shell mountet neu)
- [ ] Pause stoppt alles
- [ ] Bedienbar mit Tastatur und Touch, Spielfeld passt auf 360px Breite (`useCanvas` skaliert)
- [ ] Nur Tokens, höchstens vier Spielfeld-Farben, keine Schatten/Verläufe
- [ ] `npm run gate` grün

## Typische Fehler

- `Math.random()` in der Logik → `createRng(api.seed)` in `main.tsx`, `rng` an die Logik übergeben.
- Zustand für 60-fps-Spiele in `useState` → ruckelt. Echtzeit-Zustand in `useRef`, siehe Vorlage `canvas-loop`.
- `api.gameOver()` mehrfach oder ohne vorheriges `api.setScore()` → Rekord stimmt nicht.
- Andere Stufennamen („Normal“, „Profi“), mehr als drei Stufen oder ein Stufen-Menü vor dem Spiel
  → genau `Leicht`, `Mittel`, `Schwer` als Knopfreihe neben dem Feld.
- Eigene Pause-/Restart-Buttons oder Score-Anzeige → gibt es schon in der Shell, weglassen.
- Eigenes Fenster-Layout, Header, Titel → die Shell zeigt Titel und Leiste, das Spiel rendert nur das Feld.
