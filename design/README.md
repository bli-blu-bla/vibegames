# VibeGames Design Guide

> Kopie des Claude Design Systems „VibeGames“ (https://claude.ai/artifact/RypjLdjNGcNztkuhmApRCb).
> `tokens.json` ist die Quelle, `npm run tokens` erzeugt daraus `core/styles/tokens.css`.
> Abweichung zum Original: Schriften werden selbst gehostet (`@fontsource`), nicht über Google Fonts geladen.

Kleine, schlichte Spiele für zwischendurch. Dieses Design System sorgt dafür, dass jedes Game als Teil derselben Sammlung erkennbar bleibt, auch wenn es sein eigenes Aussehen hat. Es richtet sich an Claude Code und an die Modelle, die Games per Issue erzeugen.

## Grundprinzip

- Schlicht vor auffällig: wenige Farben, viel Fläche, klare Kanten. Weglassen ist die Standardantwort.
- Dark-Mode ist der Standard (`dark` ist das erste Theme), `light` ist die Alternative. Jede Farbe kommt aus `tokens.json`, nie als Hex-Wert im Code.
- Rahmen statt Schatten. Es gibt keine Schatten, keine Verläufe und keine Glow-Effekte.
- Die Wiedererkennung entsteht durch die festen Elemente unten. Alles andere im Spielfeld darf ein Game frei gestalten.

## Fest für jedes Game (Wiedererkennung)

Diese Elemente werden nicht verändert:

- **Rahmen:** Jedes Game läuft in der `GameShell` des Core (Pause, Restart, Score, Zurück zur Galerie). Die Shell nutzt `surface-200` auf `surface-100`, Haarlinien in `line`, Text in `ink`.
- **Typografie:** Titel in `display` oder `heading` (Pixelify Sans), Beschreibungen in `body` und `small`, Zahlen in `score` (Geist Mono). Keine weiteren Schriften in Menüs und Shell.
- **Form:** Buttons und Eingabefelder `radius-md`, Karten und Game-Kacheln `radius-lg`, kleine Spielobjekte `radius-sm`. Abstände nur aus `space-1` bis `space-7`.
- **Icons:** Phosphor. `regular` für UI, `bold` oder `fill` für Akzente. Pro Kontext ein Gewicht, keine anderen Icon-Sets.
- **Logo:** Jedes Game hat ein `logo.svg` (viewBox 64x64, höchstens drei Farben, Farben über `currentColor` oder Tokens). Das Logo ist eine einfache, flache Form ohne Schrift.
- **Zustände:** Primäre Aktion in `accent` mit `on-accent`. Fokusring: 2px `accent`, 2px Abstand, auf jedem Element sichtbar. Game Over und Fehler in `danger`, immer mit Wort oder Icon.

## Frei pro Game (eigenes Design)

Ein Game darf innerhalb der Spielfläche abweichen:

- **Spielfeld-Farben:** Sprites und Objekte aus `accent`, `highlight`, `game-sky`, `game-rose`, `game-sand` und `danger`. Ein Game wählt höchstens vier dieser Farben.
- **Ein eigener Akzent:** Ein Game darf einen zusätzlichen Farbton einführen, der nur im Spielfeld vorkommt und im Code als benannte Konstante steht. Er ersetzt `accent` nie in der Shell. Der neue Ton muss auf dem Spielfeld-Hintergrund mindestens 3:1 Kontrast haben.
- **Spielfeld-Hintergrund:** `surface-100` (Standard) oder `surface-200`. Kein Foto, kein Verlauf.
- **Sprites und Formen:** eigene Pixel-Sprites, Formen und Animationen, solange sie flach bleiben und `radius-sm` oder eckige Kanten nutzen.
- **Assets:** Geteilte Assets aus dem `assets/`-Ordner haben Vorrang vor neu erzeugten.

Faustregel: Wer das Spielfeld abdeckt, erkennt trotzdem Shell, Schrift, Rundungen und Icons als VibeGames.

## Spielfeld und Spielleiste

- **Größe:** Das Spielfeld nutzt am Desktop die verfügbare Breite der Shell (bis 1280px) und ist dort deutlich größer als mobil. Auf dem Smartphone füllt es die Breite abzüglich Seitenrand. Das Seitenverhältnis bleibt gleich, nur die Skalierung ändert sich. Bedienelemente bleiben mindestens 44px hoch.
- **Leiste über dem Spielfeld:** Eine Zeile. Links der Modus (Icon-Buttons, zum Beispiel 1 Spieler / 2 Spieler), rechts die Schwierigkeit (Leicht, Mittel, Schwer) als Button-Gruppe. Aktive Auswahl in `accent` mit `on-accent`, die übrigen in `surface-100` mit `line-strong`. Gibt es nur eines von beiden, steht es auf seiner Seite. Auf dem Smartphone darf die Zeile umbrechen.
- **Statuszeile unter dem Spielfeld:** `mono-small` in `ink-muted`, ein Hinweis pro Zeile. Zusätzliche Aktionen (zum Beispiel Bombe, Flagge) als Buttons darunter.
- **Geschlossenes Layout:** Ein Game ist ein zusammenhängender Block aus Leiste, Spielfeld und Status. Die Leiste und das Spielfeld teilen sich dieselbe Breite und dieselbe Kante, damit nichts lose im Raum steht. Ein Rahmen um das Ganze ist für Games mit Bedienelementen im Spielfeld (Minenfeld) erwünscht, für Games mit reiner Tastatursteuerung nicht nötig.
- Gilt für neue und bestehende Games. Abweichungen brauchen einen Grund im Code-Kommentar.

## Dialoge

- Dialoge (Steuerung, Hinweise) liegen als Panel (`.shell-modal`) auf dem Overlay-Scrim der Shell: `surface-200`, Rahmen `line`, `radius-lg`, Innenabstand `space-5`. Das Spielfeld scheint nie direkt hinter Text durch.
- Pause, Game Over und Lobby stehen direkt auf dem Scrim, weil sie nur kurze Texte enthalten.

## Farbe

- Text: `ink` für Haupttext, `ink-muted` für Sekundärtext. Beide auf `surface-100`, `surface-200` und `surface-300` im Kontrast mindestens 4,5:1 in beiden Themes.
- `accent` ist die einzige Markenfarbe. Maximal ein `accent`-Element pro Bildschirmbereich. Als Text nur auf `surface-100` und `surface-200`.
- `highlight` ausschließlich für Score, Highscore und Belohnungen.
- `danger` nur für Verlust und Fehler. Nie als dekorative Farbe.
- Rahmen von Bedienelementen: `line-strong`. `line` ist nur für dekorative Trenner.
- Farben allein tragen nie eine Bedeutung. Zustand immer mit Wort oder Icon zusätzlich, zum Beispiel "Game Over" mit Icon neben `danger`.

## Typografie

- `display` nur für den Spieltitel auf Start- und Game-Over-Bildschirmen, `heading` für Kachel- und Abschnittstitel.
- `body` für Beschreibungen, `body-strong` für Buttons, `small` für Metadaten in `ink-muted`, `label` für kurze Beschriftungen über Zahlen.
- Zahlen (Score, Timer, Combo) in `score` oder `mono-small`, damit sich Ziffern nicht verschieben.
- Pixelify Sans, Geist und Geist Mono werden selbst gehostet (`@fontsource`, OFL-1.1). Als Fallback gelten `system-ui` und `monospace`; Layouts müssen mit dem Fallback funktionieren.

## Layout und Bewegung

- Galerie: Raster aus Karten (`surface-200`, `radius-lg`, Innenabstand `space-4`, Lücke `space-4`). Karte = Logo, Titel in `heading`, Beschreibung in `body` mit `ink-muted`.
- Seitenrand `space-6` auf Desktop, `space-4` auf dem Smartphone. Bedienelemente mindestens 44px hoch.
- Bewegung kurz und funktional (unter 200 ms) für Menüs und Übergänge. Im Spielfeld ist alles erlaubt, was flach bleibt. `prefers-reduced-motion` wird respektiert.

## Icons und Logo

- Phosphor-Icons in `ink` oder `ink-muted`, in `accent` nur für die aktive Aktion.
- Ein Logo ist eine einzelne, erkennbare Form aus dem Spiel (zum Beispiel eine Karte, ein Würfel, ein Ball), flach gezeichnet, ohne Verlauf und ohne Text. Es soll auf `surface-200` im Dark- und im Light-Theme gut lesbar sein.
- Die Galerie rendert Logos so, dass `currentColor` die Farbe `ink` bekommt. Ein Logo, das eigene Farben nutzt, nimmt sie ausschließlich aus den Tokens.
