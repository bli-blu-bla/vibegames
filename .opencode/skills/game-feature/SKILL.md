---

name: game-feature
description: Erweitert ein bestehendes VibeGames-Spiel um ein Feature aus einem Feature Request, klein und mit Tests. Nutzen bei Aufgaben "Feature für Spiel X".
---

# Feature für ein bestehendes Spiel

Der Spielordner steht in der Aufgabe (`games/<ordner>/`). Nur dort arbeiten (plus `credits/`).

## Ablauf

1. **Verstehen:** Aufgabe, `AGENTS.md`, alle Dateien in `games/<ordner>/` lesen. Spiel starten:
   `npm run dev` → `http://localhost:5173/#/play/<ordner>` (optional).
2. **Kleinste Lösung wählen.** Ein Feature, das das Spiel einfacher macht oder abrundet, ist gut.
   Ein Feature, das Menüs, Einstellungen, Accounts oder Server bräuchte: weglassen und im
   PR-Text erklären, was stattdessen umgesetzt wurde.
3. **Erst die Logik:** neue Regel in `logic.ts` als pure Funktion bzw. Erweiterung des `State`.
   Bestehende Funktionen nicht umbenennen, wenn es nicht nötig ist.
4. **Test zuerst ergänzen** in `logic.test.ts`: ein Test, der das neue Verhalten beschreibt.
   Bestehende Tests müssen weiter grün sein. Tests nur ändern, wenn sich die Regel bewusst ändert.
5. **Dann die Darstellung** in `main.tsx`. Design-Regeln im Skill `game-design` (Farben, max. vier im Feld).
6. Ändert sich die Bedienung: `controls` in `game.json` anpassen.
   Ändert sich die Wertung (z. B. Zeit statt Punkte): `score` in `game.json` anpassen.
7. Neue Dateien oder fremde Quellen: Skill `game-assets-credits`.
8. **Prüfen:** `npm run format && npm run gate`. Fehler mit dem Skill `quality-gate` beheben.

## Nicht tun

- Keine Umbauten ohne Bezug zum Feature (Formatierung macht `npm run format`).
- Keine eigene Pause, Score-Anzeige oder Restart-Logik (macht die Shell).
- Nichts außerhalb von `games/<ordner>/` und `credits/` ändern.
