# VibeGames

Kleine, schlichte Browser-Games für zwischendurch. Neue Games, Features und Bugfixes kommen über
GitHub Issues, opencode baut sie als Pull Request. Die Galerie läuft auf GitHub Pages.

## Lokal

```bash
npm install
npm run dev       # http://localhost:5173
npm run gate      # Quality Gate: Biome, Repo-Checks, Vitest, Build
npm run test:e2e  # Playwright-Smoke-Test (braucht Chromium: npx playwright install --with-deps chromium)
```

## Aufbau

| Pfad                             | Inhalt                                                                                                                                      |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `core/sdk/`                      | SDK für Games (`@core/sdk`): GameShell, Loop, Input, Canvas, Sound, Speicher, Zufall, Farben                                                |
| `core/assets/`                   | Zugriff auf geteilte Assets (`@core/assets`)                                                                                                |
| `core/gallery/`, `core/credits/` | Galerie (`#/`) und Credits-Seite (`#/credits`)                                                                                              |
| `games/<ordner>/`                | ein Spiel pro Ordner (`game.json`, `logo.svg`, `main.tsx`, `logic.ts`, `logic.test.ts`)                                                     |
| `assets/`                        | geteilte Assets (nur CC0), `manifest.json`                                                                                                  |
| `credits/<id>/`                  | eine externe Quelle pro Ordner (`credit.json`, ggf. `LICENSE`)                                                                              |
| `design/`                        | Design Guide (Kopie des Claude Design Systems), `npm run tokens` erzeugt `core/styles/tokens.css`                                           |
| `AGENTS.md`, `.opencode/skills/` | Regeln und Skills für opencode                                                                                                              |
| `scripts/`                       | Checks, Token-Build, Issue-Form-Sync, CI-Helfer                                                                                             |
| `legacy/`                        | Originale der alten Vanilla-JS-Spiele, portiert als `games/pinguin-schach`, `games/stellwerk`, `games/trumpf-pruegel`. Kann gelöscht werden |

## Online zu zweit

Spiele mit `"multiplayer"` in `game.json` (zurzeit Pinguin-Schach als `versus`, Stellwerk als `coop`)
lassen sich über den Weltkugel-Knopf online spielen: Raum erstellen, Link oder 6-stelligen Code
weitergeben. Die Verbindung läuft per WebRTC direkt zwischen den Browsern
([Trystero](https://github.com/dmotz/trystero)). Zum Finden dienen öffentliche Nostr-Relays, darum
braucht es keinen eigenen Server und GitHub Pages reicht.

- Eigene Relays: Repo-Variable `NOSTR_RELAYS` (kommagetrennt, `wss://…`), wird im Pages-Build als
  `VITE_NOSTR_RELAYS` gesetzt. Ohne Variable nutzt Trystero seine Standard-Relays.
- TURN-Server: Ohne ihn scheitert die direkte Verbindung in manchen Netzen („ICE failed“: Firewall,
  VPN, Router ohne Hairpinning, mDNS-Adressen im LAN). Repo-Variablen `TURN_URLS`
  (kommagetrennt, `turn:…`/`turns:…`), `TURN_USERNAME` und Secret `TURN_CREDENTIAL`; lokal dieselben
  Werte als `VITE_TURN_URLS`, `VITE_TURN_USERNAME`, `VITE_TURN_CREDENTIAL` in `.env.local`.
  Die Zugangsdaten stehen im ausgelieferten JavaScript, also nur Free-Tier-Zugänge mit Limit nutzen
  (z. B. Metered Open Relay, Cloudflare Realtime TURN) oder einen eigenen coturn.
- Online braucht HTTPS (oder `localhost`), weil Trystero WebCrypto nutzt. Zum Testen mit zwei
  Geräten im LAN: `npm run dev:https` (selbstsigniertes Zertifikat, Warnung einmal bestätigen).
- Lokal testen mit zwei Tabs, ganz ohne Netz: `#/play/stellwerk?room=TEST23&net=local`.
- `npm run test:e2e` testet den Ablauf lokal, `NOSTR_E2E=1 npx playwright test e2e/nostr.spec.ts`
  über echte Relays.

## Skills für opencode (`.opencode/skills/`)

| Skill                 | Wofür                                                                                                                       |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `new-game`            | Game Request → neues Spiel, mit drei geprüften Vorlagen (Raster/Ticker = `games/snake`, Echtzeit-Canvas, rundenbasiert/DOM) |
| `game-feature`        | Feature für ein bestehendes Spiel                                                                                           |
| `game-bugfix`         | Bug in Game oder Core: reproduzieren, Test, minimaler Fix                                                                   |
| `game-sdk`            | API-Referenz `@core/sdk` / `@core/assets` mit Mustern                                                                       |
| `game-design`         | Tokens, Spielfeld-Farben, eigener Akzent, Logo-Regeln mit Beispielen                                                        |
| `game-assets-credits` | Manifest, Spiel-Assets, Credits-Ordner                                                                                      |
| `game-multiplayer`    | Online zu zweit über `api.net`: wann sinnvoll, versus (Züge prüfen) und coop (Host simuliert, Snapshots)                    |
| `quality-gate`        | Gate ausführen, jede Fehlermeldung → Lösung                                                                                 |

## Workflows

- **CI** (`ci.yml`): Gate und Smoke-Test für jeden PR und `main`.
- **Pages** (`pages.yml`): Build und Deployment auf GitHub Pages bei Push auf `main`.
- **Agent** (`agent.yml`): Label `approved` auf einem Issue (nur mit Schreibrechten) → Environment `agent`
  (Required Reviewer) → Anhänge laden, Typ prüfen, ClamAV → opencode mit passendem Skill →
  Gate (ein Korrekturversuch) → Smoke-Test → Umfang-Check → Patch. Ein separater Job ohne Modell
  erstellt daraus Branch und Pull Request.

### Einrichtung

1. Settings → Pages → Source: GitHub Actions.
2. Labels anlegen: `game-request`, `bug`, `feature`, `approved`.
3. Settings → Environments → `agent` mit Required Reviewers.
4. Variable `OPENCODE_MODEL` (z. B. `opencode-go/claude-haiku-5-5`), optional `OPENCODE_VERSION`,
   und das Secret des Providers (`OPENCODE_API_KEY` für OpenCode Go/Zen, sonst `ANTHROPIC_API_KEY`,
   `OPENAI_API_KEY` oder `OPENROUTER_API_KEY`).
5. Settings → Actions → General: "Allow GitHub Actions to create and approve pull requests".
