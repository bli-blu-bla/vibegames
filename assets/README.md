# Geteilte Assets

Jedes Game darf diese Dateien nutzen, **nur lesen**. Änderungen nur per eigenem Issue/PR.

- Nur CC0 oder selbst Erzeugtes (z. B. Kenney, https://kenney.nl).
- Jede Datei steht in `manifest.json` (`id`, `file`, `use`, `license`, `source`), `source` ist eine ID aus `credits/`.
- Zugriff im Code nur über `@core/assets`: `assetUrl('click')`, `playSound('click')`.
- `npm run check` prüft: jede Datei im Manifest existiert, jede Datei im Ordner steht im Manifest.
