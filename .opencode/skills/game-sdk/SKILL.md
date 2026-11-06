---

name: game-sdk
description: Referenz für @core/sdk und @core/assets – GameProps, Game Loop, Ticker, Canvas, Eingabe (Tasten, Wischen, Joystick), Farben, Sound, Speicher, Zufall. Nutzen beim Schreiben von main.tsx und logic.ts.
---

# Core-SDK

Games importieren nur aus `@core/sdk` und `@core/assets`. Quelle: `core/sdk/index.ts`.

## Vertrag mit der Shell

```tsx
import type { GameProps } from '@core/sdk';

export default function Game({ api, paused }: GameProps) { … }
```

|                         |                                                                                                                                                                                                                                               |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `paused`                | `true` bei Pause und Game Over. Dann nichts bewegen, keine Eingaben annehmen.                                                                                                                                                                 |
| `api.setScore(n)`       | aktuellen Score melden (die Shell zeigt ihn an)                                                                                                                                                                                               |
| `api.gameOver(result?)` | Spiel beenden, genau einmal. Ohne Argument: verloren („Game Over“). Mit `{ outcome: 'win' \| 'lose' \| 'draw', message: 'Ein Satz' }` zeigt die Shell „Gewonnen“/„Unentschieden“. Bei `score.better: 'lower'` zählt ein Rekord nur bei `win`. |
| `api.seed`              | Zufalls-Seed dieses Runs → `createRng(api.seed)`                                                                                                                                                                                              |
| `api.storage`           | Speicher nur für dieses Spiel: `get(key, fallback)`, `set(key, value)`, `remove(key)`                                                                                                                                                         |
| `api.gameId`            | Ordnername                                                                                                                                                                                                                                    |
| `api.net`               | Mitspieler-Verbindung, wenn online gespielt wird, sonst `null`. Siehe Skill `game-multiplayer`.                                                                                                                                               |

Neustart: Die Shell mountet die Komponente neu. Kein eigener Reset-Code nötig.
Rekord, Pause, Neustart, Theme und Ton macht die Shell. Nicht nachbauen.

## Zeit

```ts
// Echtzeit: jeden Frame, dt in Sekunden (max. 0.1)
useGameLoop((dt) => {
  state.current = update(state.current, input, dt, rng);
  draw();
}, !paused);

// Schrittweise: alle n Millisekunden (Raster-Spiele)
useTicker(150, () => setState((s) => step(s, rng)), !paused && alive);
```

## Canvas

```tsx
const canvas = useCanvas(480, 360);          // logische Größe, HiDPI und Skalierung inklusive
canvas.draw((ctx) => { ctx.fillStyle = colors.accent; ctx.fillRect(0, 0, 10, 10); });
return <canvas {...canvas.props} role="img" aria-label="Spielfeld: …" />;
```

- `draw` löscht vorher und setzt den Maßstab. Koordinaten immer logisch (0..480).
- Das Canvas bekommt automatisch Rahmen `line-strong`, `radius-sm`, Hintergrund `surface-100`.
- Größe: höchstens 960 breit, gut sind 320–480. Auf dem Handy wird es kleiner skaliert.

## Farben

```ts
const colors = useColors(); // Record<ColorToken, string>, aktualisiert beim Theme-Wechsel
ctx.fillStyle = colors['game-rose'];
```
In CSS: `var(--accent)`, `var(--surface-200)` … Liste: `COLOR_TOKENS`.

## Eingabe

```ts
useKeyDown((key) => { const dir = keyToDirection(key); … }, !paused);  // einzelne Tastendrücke
const keys = usePressedKeys();  keys.current.has('ArrowLeft')          // gedrückt halten (im Loop)
useSwipe(fieldRef, (dir) => …, !paused);                               // Wischen 'up'|'down'|'left'|'right'
useJoystick(fieldRef, ({ x, y }) => …, !paused);                       // virtueller Joystick, x/y in [-1, 1]
```

- `fieldRef` ist ein `useRef<HTMLDivElement>(null)` auf dem Element um das Spielfeld.
- Klick/Tap auf Spielobjekte: normale `<button>`-Elemente (DOM-Spiele) oder `onPointerDown` am Canvas.
- `P`, `R`, `Escape` erreichen das Spiel nie (gehören der Shell).

## Online zu zweit

```ts
const { net } = api;                                   // null = allein
net?.send('move', { key, ply });                       // nur JSON
useNet<MoveMsg>(net, 'move', (m) => …);                // empfangen
```
Nur mit `"multiplayer": "versus" | "coop"` in `game.json`. Details: Skill `game-multiplayer`.

## Zufall

```ts
const rng = useMemo(() => createRng(api.seed), [api.seed]);
rng.next();
rng.int(1, 6);
rng.pick(list);
rng.shuffle(list);
createRng(dailySeed(api.gameId)); // Daily Challenge: für alle gleich, jeden Tag neu
```

## Sound

```ts
playSfx('coin');   // 'click' | 'coin' | 'hit' | 'jump' | 'lose' | 'win', per Code erzeugt (ZzFX)
playSfx([0.5, 0, 440, …]);   // eigene ZzFX-Parameter
import { playSound, assetUrl } from '@core/assets';
playSound('click');          // Sound-Datei aus assets/manifest.json (Howler)
```
Stummschalten macht die Shell, beide Funktionen beachten es.

## Logik (logic.ts)

```ts
import type { Rng } from '@core/sdk';
export interface State { … }
export function createState(): State { … }
export function update(s: State, input: Input, dt: number, rng: Rng): State { … }  // Echtzeit
export function step(s: State, rng: Rng): State { … }                                // Ticker
export const isOver = (s: State) => …;
```

- Immer neue Objekte zurückgeben, nie `s.x = …` (Tests und React verlassen sich darauf).
- Konstanten (Größen, Geschwindigkeiten) oben als `export const`.

## Schwierigkeit (Leicht, Mittel, Schwer)

Nur wenn sinnvoll (Computer-Gegner, Tempo, Rätselgröße, Zeitlimit). Dann **immer genau diese drei
Stufen**, Standard ist **Mittel**. Keine anderen Namen, keine vierte Stufe, kein eigener Bildschirm.

```ts
// logic.ts – Stufen als Daten, die Logik bekommt nur die Werte
export interface Level { name: 'Leicht' | 'Mittel' | 'Schwer'; speed: number; lives: number }
export const LEVELS: readonly Level[] = [
  { name: 'Leicht', speed: 80, lives: 5 },
  { name: 'Mittel', speed: 120, lives: 3 },
  { name: 'Schwer', speed: 170, lives: 2 },
];
export const DEFAULT_LEVEL = 1;
export function createState(level: Level = LEVELS[DEFAULT_LEVEL] as Level): State { … }
```

```tsx
// main.tsx – Wahl merken, nur vor dem ersten Zug änderbar
const [level, setLevel] = useState(() => api.storage.get('level', DEFAULT_LEVEL));
const started = …; // erster Zug/erste Eingabe passiert
const chooseLevel = (i: number) => {
  setLevel(i);
  api.storage.set('level', i);
  setState(createState(LEVELS[i]));            // bzw. state.current = … bei Echtzeit
};

<fieldset className="xyz-levels">                {/* display:flex, gap var(--space-2), border 0 */}
  <legend className="t-label muted">SCHWIERIGKEIT</legend>
  {LEVELS.map((l, i) => (
    <button key={l.name} type="button" className={level === i ? 'btn btn-primary' : 'btn'}
      aria-pressed={level === i} disabled={started || paused} onClick={() => chooseLevel(i)}>
      {l.name}
    </button>
  ))}
</fieldset>
```

- Die Knopfreihe steht unter oder neben dem Spielfeld, nicht davor als Menü.
- Während eines Laufs gesperrt. Neue Stufe = neuer Lauf (Neustart über die Shell, die Wahl bleibt
  über `api.storage` erhalten).
- **Echtzeit-Spiele** laufen erst nach der ersten Eingabe los (im Feld kurz „Taste drücken zum
  Starten“), sonst bleibt keine Zeit für die Wahl.
- **Rekord:** Die Shell kennt nur einen Rekord pro Spiel. Bei `better: 'higher'` Punkte nach Stufe
  gewichten (z. B. ×1, ×2, ×3), damit Leicht keine Schwer-Rekorde schlägt. Bei `better: 'lower'`
  (Zeit, Züge) die Stufe in die `message` von `api.gameOver` schreiben.
- Online (`api.net`) keine Stufenwahl, es gilt Mittel.
- Stufen unterscheiden sich in **Werten** (Tempo, Größe, Leben, Suchtiefe), nicht in Regeln.
- Tests: jede Stufe startet gültig, Schwer ist messbar schwerer (schneller, weniger Leben …).
- Beispiel: `games/pinguin-schach` (Stärke des Pinguins).

## Muster für main.tsx

- **Ticker/Raster:** Zustand in `useState`, `useTicker`, Zeichnen in `useEffect([state, colors])`. → `games/snake/main.tsx`
- **Echtzeit:** Zustand in `useRef`, `useGameLoop` macht Update und Zeichnen. → Vorlage `canvas-loop`
- **Runden/DOM:** Zustand in `useState`, Buttons mit Klassen `btn`/`btn-primary`, eigenes `style.css`. → Vorlage `dom-turns` Beispiele: `games/trumpf-pruegel`, `games/pinguin-schach`.
- **Echtzeit mit Klick ins Canvas:** `onPointerDown` am Canvas, Koordinaten über `getBoundingClientRect()` umrechnen, Treffer in der Logik prüfen (`hitTest`). → `games/stellwerk`

Vorhandene CSS-Klassen: `btn`, `btn-primary`, `btn-icon`, `chip`, `card`, `muted`, `score-value`,
Typografie `t-display`, `t-heading`, `t-body`, `t-body-strong`, `t-small`, `t-label`, `t-score`, `t-mono-small`.
Eigene Klassen mit Spiel-Präfix (`.snk-…`) in `games/<ordner>/style.css`.
