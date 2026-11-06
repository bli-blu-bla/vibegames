# 🐧 Pinguin Schach & Keks

Ein witziges Schachspiel für den Browser – mit KI-Gegner **„Pinguin"**, Keks-Referenzen
und komplett ohne Build-Tools, Frameworks oder Abhängigkeiten.

Reines **HTML + CSS + JavaScript** (kein React nötig – die Logik ist schlank genug für Vanilla JS).

## Starten

Doppelklick auf `index.html` reicht – das Spiel läuft direkt per `file://`.

Optional mit lokalem Server (z. B. für Mobilgeräte im selben WLAN):

```bash
cd game-browser
python3 -m http.server 8000
# dann http://localhost:8000 im Browser öffnen
```

## Dateien

| Datei       | Inhalt                                                        |
|-------------|---------------------------------------------------------------|
| `index.html`| Seitenstruktur (Brett, Seitenleiste, Overlay)                  |
| `style.css` | Design, Brett-Optik, Animationen, responsive Layout           |
| `chess.js`  | Schach-Engine: legale Züge, Schach/Matt, Rochade, En passant, Promotion, SAN-Notation, KI (Negamax mit Alpha-Beta) |
| `app.js`    | Spiellogik, Rendering, Maus/Touch-Bedienung, Sprüche, Töne     |

## Features

- **Komplette Schachregeln**: alle Figuren, Rochade, En passant, Beförderung,
  Schach/Matt/Patt, Remis (50-Züge-Regel und unzureichendes Material).
- **KI-Gegner „Pinguin"** in drei Stufen (Leicht / Normal / Schwer) –
  Negamax mit Alpha-Beta-Suche und Figurenwerttabellen.
- **Zwei Spieler** am selben Gerät (Hot Seat).
- **Bedienung**: Figur anklicken und Ziel anklicken **oder** mit der Maus ziehen
  (auch auf Touch-Geräten).
- **Witziges**: Kommentare des Pinguins, Toast-Meldungen beim Schlucken,
  „Pinguin überlegt …"-Anzeige, Keks-Sprüche, Retro-Sound-Effekte (abschaltbar).
- **Komfort**: Zug zurück, Brett drehen, Figuren-Fangleiste, Zugliste mit
  algebraischer Notation, Punkteanzeige.

## Qualitätssicherung

Die Engine wurde gegen Referenzwerte geprüft:

- **Perft** (Startposition bis Tiefe 5 und die 5 Standardtest-Positionen) – alle Werte stimmen.
- **~23.000 zufällige Züge** wurden gegen `python-chess` verglichen (Legalität, Stellung, Notation) – keine Abweichungen.

## Tests selbst ausführen (optional)

```bash
node /tmp/perft.js     # Perft-Selbsttest
```
