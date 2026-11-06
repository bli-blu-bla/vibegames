---

name: game-bugfix
description: Findet und behebt einen Bug in einem VibeGames-Spiel oder im Core – reproduzieren, Ursache finden, Test schreiben, minimal fixen. Nutzen bei Bug-Fix-Issues.
---

# Bug fixen

Die Aufgabe nennt den Bereich: `games/<ordner>/` (Game) oder `core/` (Core).
Nur in diesem Bereich ändern.

## Ablauf

1. **Lesen:** Beschreibung, Schritte, Erwartung aus der Aufgabe. `AGENTS.md`.
2. **Ort finden:**
   - Game: `logic.ts` (Regeln, Punkte, Kollision), `main.tsx` (Eingabe, Zeichnen, Score/Game Over melden).
   - Core: `core/sdk/` (Shell, Loop, Input, Canvas, Sound, Speicher), `core/gallery/`, `core/credits/`,
     `core/registry.ts` (Laden der Games), `core/router.ts`.
   - `grep -rn "<Stichwort>" games/<ordner> core` hilft.
3. **Ursache verstehen, bevor geändert wird.** Typische Ursachen:
   - Zustand direkt verändert (`s.x = …`) statt neues Objekt → React rendert nicht neu
   - veralteter Zustand im Callback → `useRef` oder `setState((s) => …)` nutzen
   - `paused` nicht an Hooks übergeben → Spiel läuft in der Pause weiter
   - `api.gameOver()` mehrfach oder Score nach Game Over gesetzt
   - Off-by-one an Spielfeldrändern, `dt` nicht berücksichtigt (Geschwindigkeit hängt an fps)
4. **Test schreiben, der den Bug zeigt** (rot), nahe am Code: `games/<ordner>/logic.test.ts`
   oder `core/**/<datei>.test.ts`. Liegt der Bug nur in der Darstellung und ist nicht testbar,
   im PR-Text kurz erklären, wie er geprüft wurde.
5. **Minimal fixen**, bis der Test grün ist. Keine Umbauten nebenbei.
6. **Prüfen:** `npm run format && npm run gate`, bei Core-Änderungen zusätzlich prüfen, dass
   `games/snake` weiterhin startet (`npm run dev`, oder `npm run test:e2e`, falls ein Browser da ist).

## Core-Änderungen

Der Core gilt für alle Games. Öffentliche Funktionen in `core/sdk/index.ts` nicht umbenennen oder
in ihrer Bedeutung ändern. Neue optionale Parameter sind in Ordnung.
