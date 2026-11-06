# VibeGames

Kleine, schlichte Browser-Games für zwischendurch. Neue Games, Features und Bugfixes kommen über
GitHub Issues, opencode baut sie als Pull Request. Die Galerie läuft auf GitHub Pages.

## Spiel vorschlagen

Neue Spiele wünscht man sich über das Formular
[Game Request](https://github.com/bli-blu-bla/vibegames/issues/new?template=game_request.yml).
Wer die Idee erst mit einem KI-Assistenten (ChatGPT, Claude, Gemini …) ausarbeiten möchte, kopiert
diesen Prompt in einen neuen Chat und ersetzt die letzte Zeile durch die eigene Idee. Der Assistent
stellt Rückfragen, hält das Spiel klein und gibt am Ende alle Felder fertig zum Einfügen aus.

```text
Du hilfst mir, eine Spielidee für "VibeGames" auszuarbeiten, eine Sammlung kleiner Browser-Games
für zwischendurch. Das Ergebnis trage ich in dieses GitHub-Issue-Formular ein:
https://github.com/bli-blu-bla/vibegames/issues/new?template=game_request.yml
Danach baut ein KI-Agent das Spiel allein aus meinem Formular. Was dort nicht klar steht, rät er.

Falls du Links öffnen kannst, lies vorher diese beiden Dateien. Sie sind aktueller als dieser Prompt:
- Formular-Definition: https://raw.githubusercontent.com/bli-blu-bla/vibegames/main/.github/ISSUE_TEMPLATE/game_request.yml
- Regeln für den Agenten: https://raw.githubusercontent.com/bli-blu-bla/vibegames/main/AGENTS.md
Kannst du keine Links öffnen, reicht der Rest dieses Prompts.

Rahmen, an den du dich hältst:
- In unter zwei Minuten verstanden, eine Runde dauert wenige Minuten.
- Kein Menü, keine Einstellungen, keine Level-Auswahl, kein Login, keine Story.
  Einzige Ausnahme: die Stufen Leicht, Mittel, Schwer, wenn das Spiel stark vom Können abhängt
  (Computer-Gegner, Tempo, Rätselgröße, Zeitlimit). Wird es von selbst schwerer, keine Stufen.
- Ein Spieler im Browser, mit Tastatur und mit Touch (Wischen, Joystick oder Tippen) spielbar.
  Online zu zweit nur, wenn es wirklich passt (rundenbasiert gegeneinander oder gemeinsam).
- Schlichte, flache 2D-Grafik aus einfachen Formen, höchstens vier Farben im Spielfeld.
- Eine eigene Idee oder ein bekanntes Genre, aber keine Kopie eines bestimmten Spiels
  (kein fremder Name, keine fremden Figuren, Level oder Grafiken).
- Eine einzige Wertung: Punkte (mehr ist besser), Zeit oder Züge (weniger ist besser).

So gehst du vor:
1. Frag mich nach meiner Idee, falls sie unten fehlt.
2. Stell mir höchstens fünf kurze Rückfragen auf einmal, nur zu dem, was für die Regeln noch
   offen ist: Ziel, Ablauf, Spielende, Wertung, Steuerung, Schwierigkeit.
3. Ist die Idee zu groß, schlag vor, was wegfallen kann, und erklär kurz warum.
4. Fasse dann alles in genau diesen Feldern des Formulars zusammen, jedes Feld in einem eigenen
   Codeblock, damit ich es einzeln kopieren kann:

   Titel: Name des Spiels, kurz, auf Deutsch oder Englisch
   Ordnername: nur Kleinbuchstaben, Ziffern und Bindestrich, z. B. pixel-snake
   Kurzbeschreibung: ein Satz, höchstens 120 Zeichen, Du-Form
   Kategorie: genau eins von: Arcade | Denken | Karten und Würfel
   Spielregeln: Stichpunkte zu Ziel, Ablauf, Spielende und Zählweise. Konkrete Zahlen nennen
     (Feldgröße, Tempo, Leben, Punkte pro Aktion). Bei Stufen eine Zeile pro Stufe mit den Werten,
     die sich ändern. Bei Online-Modus kurz, wie zwei Spieler zusammen spielen.
   Steuerung: eine Zeile für Tastatur und Touch, z. B. Pfeiltasten, WASD oder Wischen
   Wertung: genau eins von: Punkte (mehr ist besser) | Zeit (weniger ist besser) |
     Züge (weniger ist besser)
   Assets: meist leer lassen. Nur wenn ich eigene Bilder oder Sounds habe: was es ist und
     woher es stammt (selbst gemacht oder CC0).

Schreib alles auf Deutsch.

Meine Idee: <hier deine Idee in ein, zwei Sätzen>
```

Danach die Felder in das Formular übernehmen. Eine Person mit Schreibrechten setzt das Label
`approved`, dann baut opencode das Spiel als Pull Request. Die Links im Prompt funktionieren nur,
solange das Repo öffentlich ist. Sonst nutzt der Assistent die Feldliste im Prompt.

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
- **Agent** (`agent.yml`): Label `approved` auf einem Issue (nur mit Schreibrechten) →
  Anhänge laden, Typ prüfen, ClamAV → OIDC-Anmeldung bei OpenCode → opencode mit passendem Skill →
  Gate (ein Korrekturversuch) → Smoke-Test → Umfang-Check → Patch. Ein separater Job ohne Modell
  erstellt daraus Branch und Pull Request.

### Einrichtung

1. Settings → Pages → Source: GitHub Actions.
2. Labels anlegen: `game-request`, `bug`, `feature`, `approved`.
3. OpenCode-Konsole → Credential für GitHub Actions (OIDC, Branch `main`, Models mehr als „Read“).
   Dessen ID (`sk_…`) als Secret `OPENCODE_CLIENT_ID` anlegen.
4. Variable `OPENCODE_MODEL` (z. B. `opencode-go/claude-haiku-5-5`), optional `OPENCODE_VERSION`
   (Version von `@opencode/cli`).
5. Settings → Actions → General: "Allow GitHub Actions to create and approve pull requests".
