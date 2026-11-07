---

name: game-multiplayer
description: Online-Modus für zwei Spieler in einem VibeGames-Spiel (versus oder coop) über api.net – wann es Sinn ergibt, Rollen, Nachrichten, Host-Simulation, Tests. Nutzen bei Requests wie "Multiplayer", "online zu zweit", "gegen Freunde".
---

# Online zu zweit

Verbindung, Lobby (Raum-Code, Link), Pause, Neustart und Seed macht die **Shell**. Das Spiel
bekommt nur `api.net` und schickt sich damit Nachrichten. Technik dahinter: WebRTC direkt zwischen
den Browsern, gefunden über öffentliche Nostr-Relays (Trystero). Kein Server, GitHub Pages reicht.
`trystero` nie selbst importieren.

## Erst prüfen: Ergibt es Sinn?

Gut: rundenbasiert gegeneinander (Brettspiele, Karten-Duelle), gemeinsames Echtzeit-Spiel auf einem
Feld, bei dem beide dasselbe steuern (Koop). Schlecht: schnelle Reaktions-Duelle (Latenz), Spiele
mit Geheiminformation, die man nicht verstecken kann (der Gegner sieht alle Nachrichten), mehr als
zwei Spieler ohne Host-Simulation. **Im Zweifel weglassen** und im Issue begründen.

## Einschalten

`game.json`: `"multiplayer": "versus"` (gegeneinander) oder `"coop"` (miteinander).
Dann zeigt die Shell den Online-Knopf und die Galerie den Hinweis „Online zu zweit“.

## Mehr als zwei Spieler

`"players": 3` oder `4` in `game.json` (nur mit `multiplayer`, Standard 2). Dann sammelt die Lobby
alle im Raum, der Host startet mit „Starten“ (oder automatisch, wenn der Raum voll ist). Wer während
einer Runde kommt, spielt ab der nächsten mit. Sinnvoll nur mit Host-Simulation (Echtzeit-Muster).

- `net.seat` ist der eigene Platz (0 = Host), `net.players` die Anzahl in dieser Runde.
- Host-`send` geht an alle Gäste, Gast-`send` nur an den Host. Der Handler bekommt den Platz des
  Absenders: `useNet(net, 'input', (data, seat) => …)`.
- Geht ein Gast mitten in der Runde (und bleiben mindestens zwei), bekommt der Host `'$left'` mit dem
  Platz. Beispiel: `games/zuendschnur`.

## API

```ts
const { net } = api;                  // null = allein
net.role;                             // 'host' | 'guest', fest für die Runde
net.mode;                             // 'versus' | 'coop'
net.send('move', { key: '52-36', ply: 0 });         // nur JSON
useNet<MoveMsg>(net, 'move', (m) => …);             // empfangen, aus @core/sdk
```

- Beide Seiten bekommen denselben `api.seed`. Jede Runde mountet das Spiel neu (wie bei Neustart).
- Nachrichten kommen zuverlässig und in Reihenfolge an. Was vor dem Anmelden mit `useNet` ankommt,
  wird nachgeliefert.
- Pause, Neustart und „Mitspieler ist gegangen“ macht die Shell. Kein eigener Code dafür.
- Rekorde zählen online nicht. `api.gameOver(...)` trotzdem aufrufen, mit dem eigenen Ergebnis.

## Muster

**Rundenbasiert (versus)** → `games/pinguin-schach`

- Host und Gast bekommen feste Seiten (Host = Weiß, beginnt).
- Eigenen Zug lokal anwenden und schicken. Fremden Zug in der Logik **auf Legalität prüfen**
  (`playKey(game, key)` liefert `null` bei Unsinn) und Zählerstand mitschicken (`ply`), damit
  doppelte oder veraltete Züge ignoriert werden.
- Beide Seiten erkennen das Ende selbst (gleiche Logik, gleiche Züge) und melden ihr eigenes Ergebnis.
- Was es nur gegen den Computer gibt (Stufen Leicht/Mittel/Schwer, Zug zurück), online ausblenden.

**Echtzeit (coop)** → `games/stellwerk`

- **Nur der Host simuliert** (`update` mit `rng`) und schickt ~20 Snapshots pro Sekunde.
  Snapshots klein halten: Abgeleitetes (Spuren, Partikel) weglassen und beim Gast nachrechnen.
- Der Gast schickt nur Eingaben (`{ kind: 'switch', id, branch }`). Eingaben als **Zielzustand**
  statt als Umschalten schicken, dann ist doppeltes Ankommen harmlos.
- Zwischen Snapshots bewegt der Gast nur weiter (`predict`), ohne Zufall und ohne Punkte.
- Ereignisse (Texte, Sounds) sammelt der Host und schickt sie mit dem nächsten Snapshot.
- Spielende entscheidet der Host. Der Gast meldet `gameOver`, wenn der Snapshot `isOver` ist.

## Logik und Tests

Alles Netz-Spezifische als pure Funktionen in `logic.ts` (`moveKey`, `playKey`, `toSnapshot`,
`applySnapshot`, `predict`, `applyAction`). Tests in `logic.test.ts`: Snapshot ist JSON und
klein, fremde Züge werden geprüft, beide Seiten werten das Ende spiegelbildlich.

## Ausprobieren

Zwei Tabs im selben Browser, ohne Internet:
`http://localhost:5173/#/play/<ordner>?room=TEST23&net=local`
Raum-Codes: 6 Zeichen aus `A–Z` ohne `I L O` und `2–9`.
E2E-Beispiel: `e2e/online.spec.ts`.
