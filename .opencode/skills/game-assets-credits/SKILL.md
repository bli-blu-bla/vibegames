---

name: game-assets-credits
description: Umgang mit Bildern, Sounds und Schriften (geteilte Assets, Spiel-Assets, manifest.json) und mit Credits für externe Quellen (credits/<id>/credit.json, LICENSE). Nutzen, sobald ein Spiel Dateien oder fremde Quellen verwendet.
---

# Assets und Credits

## Reihenfolge

1. Braucht das Spiel überhaupt Dateien? Formen im Canvas und `playSfx()` reichen meistens. **Bevorzugt.**
2. Sonst `assets/manifest.json` lesen und Vorhandenes nutzen (geteilt, nur lesen).
3. Erst dann eigene Dateien in `games/<ordner>/assets/`.

## Geteilte Assets nutzen

```ts
import { assetUrl, playSound } from '@core/assets';
playSound('click'); // Sound-ID aus assets/manifest.json
const img = new Image();
img.src = assetUrl('card-back');
```

- Nie relative Pfade wie `../../assets/…`, nie Dateien in `assets/` ändern oder hinzufügen.
- Ein geteiltes Asset fehlt? Im eigenen Spielordner ablegen und im PR-Text vorschlagen, es zu teilen.

## Eigene Assets eines Spiels

Dateien nach `games/<ordner>/assets/`, dazu `games/<ordner>/assets/manifest.json`:

```json
{
  "sounds": [],
  "sprites": [
    {
      "id": "ship",
      "file": "ship.png",
      "use": "Spielerfigur",
      "license": "CC0-1.0",
      "source": "kenney-space-shooter"
    }
  ],
  "fonts": []
}
```

- Jede Datei steht im Manifest, jeder Eintrag hat eine Datei. Alle Felder füllen, `use` beschreibt die Verwendung.
- `source`: ID eines Ordners in `credits/` oder `"self"` (selbst erzeugt oder vom Issue-Ersteller hochgeladen).
- Hochgeladene Issue-Anhänge sind schon eingetragen (`license: "LicenseRef-Issue-Upload"`, `use: ""`):
  nur `use` ausfüllen, ggf. `id` sprechender machen.
- Im Code importieren (Vite liefert die URL):

  ```ts
  import shipUrl from './assets/ship.png';
  ```
- Klein halten: Bilder ≤ 200 KB, Sounds ≤ 300 KB, bevorzugt PNG/WebP und OGG.

## Credits

Jede **externe** Quelle (Asset-Pack, Schrift, Sound, neue npm-Library) bekommt einen Ordner:

```
credits/<id>/
  credit.json
  LICENSE        # Pflicht, außer bei CC0-1.0 / Unlicense / 0BSD
```
```json
{
  "name": "Space Shooter Redux",
  "author": "Kenney",
  "url": "https://kenney.nl/assets/space-shooter-redux",
  "license": "CC0-1.0",
  "type": "assets",
  "usedIn": ["mein-spiel"]
}
```

- `<id>`: Kleinbuchstaben, Ziffern, Bindestrich, z. B. `kenney-space-shooter`.
- `url` beginnt mit `https://`. `license` ist eine SPDX-ID (`CC0-1.0`, `MIT`, `OFL-1.1`, `CC-BY-4.0` …).
- `type`: `assets` | `icons` | `fonts` | `sounds` | `libraries`
- `usedIn`: Spielordner oder `"shared"`. Gibt es den Ordner schon, nur den eigenen Spielordner ergänzen.
- In `game.json` die ID eintragen: `"credits": ["kenney-space-shooter"]`.
- npm-Libraries erscheinen automatisch auf der Credits-Seite (aus `package.json`). Ein Ordner ist nur nötig,
  wenn die Library zusätzlich ein Asset/Icon-Set ist; dann `"packages": ["paketname"]` setzen.
- Keine Quelle mit unklarer Lizenz verwenden. Im Zweifel selbst zeichnen.

## Prüfen

`npm run check` meldet fehlende Dateien, Manifest-Einträge, Credits, SPDX-IDs und Lizenzdateien.
