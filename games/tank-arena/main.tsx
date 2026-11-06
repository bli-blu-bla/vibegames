import {
  createRng,
  type GameProps,
  playSfx,
  useCanvas,
  useColors,
  useGameLoop,
  useJoystick,
  useKeyDown,
  useNet,
  usePressedKeys,
} from '@core/sdk';
import { Crosshair } from '@phosphor-icons/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ARENA_MARGIN,
  applySnapshot,
  BULLET_RADIUS,
  createState,
  DEFAULT_LEVEL,
  type EnemyTank,
  type GameEvent,
  type GameMode,
  HEIGHT,
  INITIAL_LIVES,
  isOver,
  LEVELS,
  type Obstacle,
  type PlayerInput,
  type PlayerTank,
  predict,
  type Snapshot,
  type State,
  TANK_RADIUS,
  toSnapshot,
  update,
  WIDTH,
} from './logic.ts';
import './style.css';

type Colors = ReturnType<typeof useColors>;

const SNAPSHOT_HZ = 20;
const MONO = '"Geist Mono", ui-monospace, monospace';

export default function TankArena({ api, paused }: GameProps) {
  const { net } = api;
  const guest = net?.role === 'guest';
  const rng = useMemo(() => createRng(api.seed), [api.seed]);

  const [level, setLevel] = useState<number>(() => {
    const saved = api.storage.get('level', DEFAULT_LEVEL);
    return saved >= 0 && saved < LEVELS.length ? saved : DEFAULT_LEVEL;
  });
  const [onlineMode, setOnlineMode] = useState<'coop' | 'versus'>(() =>
    net?.mode === 'versus' ? 'versus' : 'coop',
  );
  const [started, setStarted] = useState<boolean>(() => net !== null);
  const startedRef = useRef(started);
  startedRef.current = started;

  const initialMode: GameMode = net ? onlineMode : 'solo';
  const defaultLevel = LEVELS[DEFAULT_LEVEL] as (typeof LEVELS)[number];
  const state = useRef<State>(
    createState(rng, LEVELS[net ? DEFAULT_LEVEL : level] ?? defaultLevel, initialMode),
  );

  const touchMove = useRef({ x: 0, y: 0 });
  const touchFire = useRef(false);
  const tapFire = useRef(false);
  const guestInput = useRef<PlayerInput>({ moveX: 0, moveY: 0, fire: false });
  const outbox = useRef<GameEvent[]>([]);
  const sinceSnap = useRef(0);
  const reported = useRef(false);

  const keys = usePressedKeys();
  const colors = useColors();
  const canvas = useCanvas(WIDTH, HEIGHT);
  const fieldRef = useRef<HTMLDivElement>(null);

  const markStarted = () => {
    if (!startedRef.current) {
      startedRef.current = true;
      setStarted(true);
    }
  };

  useJoystick(
    fieldRef,
    (v) => {
      // nipplejs liefert y positiv nach oben; im Canvas ist +y nach unten
      touchMove.current = { x: v.x, y: -v.y };
      if (Math.hypot(v.x, v.y) > 0.1) markStarted();
    },
    !paused,
  );

  useKeyDown((key) => {
    if (key === ' ' || key === 'Enter') {
      tapFire.current = true;
      markStarted();
    } else if (['w', 'a', 's', 'd', 'W', 'A', 'S', 'D'].includes(key) || key.startsWith('Arrow')) {
      markStarted();
    }
  }, !paused);

  const handleEvents = (events: readonly GameEvent[]) => {
    for (const ev of events) {
      if (ev.type === 'explosion') playSfx('hit');
      else if (ev.type === 'enemy-destroyed') playSfx('coin');
      else if (ev.type === 'round-cleared') playSfx('win');
      else if (ev.type === 'player-hit') playSfx('hit');
      else if (ev.type === 'shoot') playSfx('click');
    }
  };

  const apply = (next: State) => {
    if (net && !guest) outbox.current.push(...next.events);
    handleEvents(next.events);
    if (next.score !== state.current.score) {
      api.setScore(next.score);
    }
    state.current = { ...next, events: [] };

    if (isOver(next) && !reported.current) {
      reported.current = true;
      if (next.mode === 'versus') {
        const myId = guest ? 2 : 1;
        const won = next.winner === myId;
        playSfx(won ? 'win' : 'lose');
        api.gameOver({
          outcome: won ? 'win' : 'lose',
          message: won ? 'Du hast das Panzer-Duell gewonnen!' : 'Dein Panzer wurde ausgeschaltet.',
        });
      } else {
        playSfx('lose');
        api.gameOver({
          outcome: 'lose',
          message: `Bis Runde ${next.round} gekämpft!`,
        });
      }
    }
  };

  // Online: Snapshot beim Gast empfangen
  useNet<Snapshot>(net, 'snap', (snap) => {
    if (guest) {
      if (snap.mode === 'coop' || snap.mode === 'versus') {
        setOnlineMode(snap.mode);
      }
      apply(applySnapshot(state.current, snap));
    }
  });

  // Online: Eingabe des Gasts beim Host empfangen
  useNet<PlayerInput>(net, 'input', (inp) => {
    if (net && !guest) {
      guestInput.current = inp;
    }
  });

  // Online: Moduswechsel (Koop / Duell) synchronisieren
  useNet<{ mode: 'coop' | 'versus' }>(net, 'mode', ({ mode }) => {
    setOnlineMode(mode);
    reported.current = false;
    const fresh = createState(rng, defaultLevel, mode);
    state.current = fresh;
    api.setScore(0);
  });

  const readLocalInput = (): PlayerInput => {
    const k = keys.current;
    const kx =
      (k.has('d') || k.has('D') || k.has('ArrowRight') ? 1 : 0) -
      (k.has('a') || k.has('A') || k.has('ArrowLeft') ? 1 : 0);
    const ky =
      (k.has('s') || k.has('S') || k.has('ArrowDown') ? 1 : 0) -
      (k.has('w') || k.has('W') || k.has('ArrowUp') ? 1 : 0);
    const moveX = kx !== 0 ? kx : touchMove.current.x;
    const moveY = ky !== 0 ? ky : touchMove.current.y;
    const fire = k.has(' ') || k.has('Enter') || touchFire.current || tapFire.current;
    tapFire.current = false;
    if (Math.hypot(moveX, moveY) > 0.05 || fire) {
      markStarted();
    }
    return { moveX, moveY, fire };
  };

  useGameLoop((dt) => {
    const localIn = readLocalInput();

    if (guest) {
      net?.send('input', localIn);
      state.current = predict(state.current, dt);
    } else if (startedRef.current) {
      const next = update(state.current, { ...localIn, guest: guestInput.current }, dt, rng);
      apply(next);

      if (net) {
        sinceSnap.current += dt;
        if (sinceSnap.current >= 1 / SNAPSHOT_HZ || isOver(state.current)) {
          sinceSnap.current = 0;
          net.send('snap', toSnapshot(state.current, outbox.current));
          outbox.current = [];
        }
      }
    }

    canvas.draw((ctx) => draw(ctx, state.current, colors, !startedRef.current));
  }, !paused);

  // Erstes Zeichnen auch im pausierten Zustand
  useEffect(() => {
    canvas.draw((ctx) => draw(ctx, state.current, colors, !startedRef.current));
  }, [canvas, colors]);

  const chooseLevel = (i: number) => {
    if (started || paused) return;
    const chosen = LEVELS[i] ?? defaultLevel;
    setLevel(i);
    api.storage.set('level', i);
    const next = createState(rng, chosen, 'solo');
    state.current = next;
    canvas.draw((ctx) => draw(ctx, next, colors, true));
  };

  const chooseOnlineMode = (mode: 'coop' | 'versus') => {
    if (paused || !net) return;
    setOnlineMode(mode);
    reported.current = false;
    const fresh = createState(rng, defaultLevel, mode);
    state.current = fresh;
    api.setScore(0);
    net.send('mode', { mode });
  };

  return (
    <div className="ta-root">
      <div ref={fieldRef} className="ta-field">
        <canvas
          {...canvas.props}
          role="img"
          aria-label={`Tank Arena: Runde ${state.current.round}, ${state.current.lives} Leben`}
        />
      </div>

      <div className="ta-bar">
        {!net ? (
          <fieldset className="ta-levels">
            <legend className="t-label muted">SCHWIERIGKEIT</legend>
            {LEVELS.map((l, i) => (
              <button
                key={l.name}
                type="button"
                className={level === i ? 'btn btn-primary' : 'btn'}
                aria-pressed={level === i}
                disabled={started || paused}
                onClick={() => chooseLevel(i)}
              >
                {l.name}
              </button>
            ))}
          </fieldset>
        ) : (
          <fieldset className="ta-levels">
            <legend className="t-label muted">MODUS</legend>
            <button
              type="button"
              className={onlineMode === 'coop' ? 'btn btn-primary' : 'btn'}
              aria-pressed={onlineMode === 'coop'}
              disabled={paused}
              onClick={() => chooseOnlineMode('coop')}
            >
              Koop
            </button>
            <button
              type="button"
              className={onlineMode === 'versus' ? 'btn btn-primary' : 'btn'}
              aria-pressed={onlineMode === 'versus'}
              disabled={paused}
              onClick={() => chooseOnlineMode('versus')}
            >
              Duell
            </button>
          </fieldset>
        )}

        <button
          type="button"
          className="btn btn-primary ta-fire-btn"
          disabled={paused}
          aria-label="Schießen"
          onPointerDown={() => {
            touchFire.current = true;
            tapFire.current = true;
            markStarted();
          }}
          onPointerUp={() => {
            touchFire.current = false;
          }}
          onPointerCancel={() => {
            touchFire.current = false;
          }}
          onPointerLeave={() => {
            touchFire.current = false;
          }}
          onClick={() => {
            tapFire.current = true;
            markStarted();
          }}
        >
          <Crosshair size={20} weight="bold" aria-hidden /> Feuer
        </button>
      </div>
    </div>
  );
}

// ---------- Canvas-Darstellung ----------

function draw(ctx: CanvasRenderingContext2D, s: State, c: Colors, waitingForStart: boolean) {
  ctx.fillStyle = c['surface-100'];
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Dezentes Bodenraster innerhalb der Arena
  ctx.strokeStyle = c['surface-200'];
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = ARENA_MARGIN + 32; x < WIDTH - ARENA_MARGIN; x += 32) {
    ctx.moveTo(x + 0.5, ARENA_MARGIN);
    ctx.lineTo(x + 0.5, HEIGHT - ARENA_MARGIN);
  }
  for (let y = ARENA_MARGIN + 32; y < HEIGHT - ARENA_MARGIN; y += 32) {
    ctx.moveTo(ARENA_MARGIN, y + 0.5);
    ctx.lineTo(WIDTH - ARENA_MARGIN, y + 0.5);
  }
  ctx.stroke();

  // Geschlossener Arena-Rand
  ctx.strokeStyle = c['line-strong'];
  ctx.lineWidth = 2;
  ctx.strokeRect(ARENA_MARGIN, ARENA_MARGIN, WIDTH - ARENA_MARGIN * 2, HEIGHT - ARENA_MARGIN * 2);

  // Wände und Hindernisse (unzerstörbar vs. zerstörbar)
  for (const obs of s.obstacles) {
    drawObstacle(ctx, obs, c);
  }

  // Explosive Fässer (mit Warnsymbol '!' für klare Formunterscheidung)
  for (const bar of s.barrels) {
    ctx.fillStyle = c['game-rose'];
    ctx.beginPath();
    ctx.arc(bar.x, bar.y, bar.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = c['surface-100'];
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(bar.x, bar.y, bar.radius - 3, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = c['surface-100'];
    ctx.font = `700 12px ${MONO}`;
    ctx.textAlign = 'center';
    ctx.fillText('!', bar.x, bar.y + 4);
  }

  // Projektile
  for (const b of s.bullets) {
    ctx.fillStyle = b.fromPlayer ? (b.ownerId === 2 ? c['game-sky'] : c.accent) : c['game-rose'];
    ctx.beginPath();
    ctx.arc(b.x, b.y, BULLET_RADIUS, 0, Math.PI * 2);
    ctx.fill();
  }

  // Gegner-Panzer
  for (const enemy of s.enemies) {
    drawEnemyTank(ctx, enemy, c);
  }

  // Spieler-Panzer
  for (const p of s.players) {
    if (p.lives > 0) {
      drawPlayerTank(ctx, p, c);
    }
  }

  // Explosionen (flache konzentrische Kreise)
  for (const exp of s.explosions) {
    const progress = 1 - exp.timer / exp.maxTimer;
    const currentR = exp.radius * (0.35 + 0.65 * progress);
    ctx.globalAlpha = Math.max(0.2, exp.timer / exp.maxTimer);
    ctx.fillStyle = c['game-rose'];
    ctx.beginPath();
    ctx.arc(exp.x, exp.y, currentR, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = c['surface-100'];
    ctx.beginPath();
    ctx.arc(exp.x, exp.y, currentR * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // HUD-Zeile oben
  drawHud(ctx, s, c);

  // Starthinweis vor der ersten Eingabe im Einzelspieler
  if (waitingForStart) {
    ctx.fillStyle = c['surface-200'];
    ctx.strokeStyle = c['line-strong'];
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(WIDTH / 2 - 156, HEIGHT - 54, 312, 32, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = c.ink;
    ctx.font = `500 13px ${MONO}`;
    ctx.textAlign = 'center';
    ctx.fillText('WASD / Leertaste oder Touch zum Starten', WIDTH / 2, HEIGHT - 34);
  }
}

function drawObstacle(ctx: CanvasRenderingContext2D, obs: Obstacle, c: Colors) {
  if (!obs.destructible) {
    // Unzerstörbare Stahlwand: surface-300 mit Rahmen und 4 Eck-Nieten
    ctx.fillStyle = c['surface-300'];
    ctx.strokeStyle = c['ink-muted'];
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(obs.x, obs.y, obs.w, obs.h, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = c['ink-muted'];
    const inset = 6;
    const rivets: Array<[number, number]> = [
      [obs.x + inset, obs.y + inset],
      [obs.x + obs.w - inset, obs.y + inset],
      [obs.x + inset, obs.y + obs.h - inset],
      [obs.x + obs.w - inset, obs.y + obs.h - inset],
    ];
    for (const [rx, ry] of rivets) {
      ctx.beginPath();
      ctx.arc(rx, ry, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }

  // Zerstörbare Ziegelwand: game-sand mit Fugen und Rissen bei Schaden
  ctx.fillStyle = c['game-sand'];
  ctx.beginPath();
  ctx.roundRect(obs.x, obs.y, obs.w, obs.h, 4);
  ctx.fill();

  ctx.strokeStyle = c['surface-100'];
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(obs.x, obs.y + obs.h / 2);
  ctx.lineTo(obs.x + obs.w, obs.y + obs.h / 2);
  ctx.moveTo(obs.x + obs.w / 2, obs.y);
  ctx.lineTo(obs.x + obs.w / 2, obs.y + obs.h / 2);
  if (obs.hp < obs.maxHp) {
    // Deutlicher Riss nach Treffer
    ctx.moveTo(obs.x + 6, obs.y + 6);
    ctx.lineTo(obs.x + obs.w - 6, obs.y + obs.h - 6);
    ctx.moveTo(obs.x + obs.w - 8, obs.y + 8);
    ctx.lineTo(obs.x + 10, obs.y + obs.h - 8);
  }
  ctx.stroke();
}

function drawPlayerTank(ctx: CanvasRenderingContext2D, p: PlayerTank, c: Colors) {
  if (p.invuln > 0 && Math.floor(p.invuln * 10) % 2 === 1) {
    ctx.globalAlpha = 0.55;
  }
  const bodyColor = p.id === 2 ? c['game-sky'] : c.accent;

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);

  // Ketten
  ctx.fillStyle = c.ink;
  ctx.beginPath();
  ctx.roundRect(-TANK_RADIUS, -TANK_RADIUS, TANK_RADIUS * 2, 5, 2);
  ctx.roundRect(-TANK_RADIUS, TANK_RADIUS - 5, TANK_RADIUS * 2, 5, 2);
  ctx.fill();

  // Wanne
  ctx.fillStyle = bodyColor;
  ctx.beginPath();
  ctx.roundRect(-TANK_RADIUS + 2, -TANK_RADIUS + 3, TANK_RADIUS * 2 - 4, TANK_RADIUS * 2 - 6, 4);
  ctx.fill();

  // Kanonenrohr
  ctx.fillStyle = c.ink;
  ctx.beginPath();
  ctx.roundRect(0, -3, TANK_RADIUS + 6, 6, 2);
  ctx.fill();

  // Turm
  ctx.fillStyle = c['surface-100'];
  ctx.beginPath();
  ctx.arc(0, 0, 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawEnemyTank(ctx: CanvasRenderingContext2D, e: EnemyTank, c: Colors) {
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.rotate(e.angle);

  // Ketten
  ctx.fillStyle = c.ink;
  ctx.beginPath();
  ctx.roundRect(-TANK_RADIUS, -TANK_RADIUS, TANK_RADIUS * 2, 5, 2);
  ctx.roundRect(-TANK_RADIUS, TANK_RADIUS - 5, TANK_RADIUS * 2, 5, 2);
  ctx.fill();

  // Wanne in game-rose
  ctx.fillStyle = c['game-rose'];
  ctx.beginPath();
  ctx.roundRect(-TANK_RADIUS + 2, -TANK_RADIUS + 3, TANK_RADIUS * 2 - 4, TANK_RADIUS * 2 - 6, 3);
  ctx.fill();

  // Kanonenrohr
  ctx.fillStyle = c.ink;
  ctx.beginPath();
  ctx.roundRect(0, -3, TANK_RADIUS + 5, 6, 2);
  ctx.fill();

  // Eckiger Turm mit Kreuz-Symbol zur klaren Unterscheidung
  ctx.fillStyle = c['surface-100'];
  ctx.fillRect(-4, -4, 8, 8);

  ctx.restore();
}

function drawHud(ctx: CanvasRenderingContext2D, s: State, c: Colors) {
  // Leben Spieler 1 oben links
  const p1Lives = s.players[0]?.lives ?? 0;
  ctx.fillStyle = c.ink;
  ctx.font = `600 13px ${MONO}`;
  ctx.textAlign = 'left';
  ctx.fillText('P1', 20, 30);

  for (let i = 0; i < INITIAL_LIVES; i++) {
    const x = 44 + i * 18;
    const y = 19;
    ctx.strokeStyle = c.ink;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, 12, 12);
    if (i < p1Lives) {
      ctx.fillStyle = c.accent;
      ctx.fillRect(x + 2, y + 2, 8, 8);
    }
  }

  // Bei Online-Spiel (Koop / Versus): Leben Spieler 2 anzeigen
  if (s.players.length > 1) {
    const p2Lives = s.players[1]?.lives ?? 0;
    ctx.fillStyle = c.ink;
    ctx.fillText('P2', 112, 30);
    for (let i = 0; i < INITIAL_LIVES; i++) {
      const x = 136 + i * 18;
      const y = 19;
      ctx.strokeStyle = c.ink;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x, y, 12, 12);
      if (i < p2Lives) {
        ctx.fillStyle = c['game-sky'];
        ctx.fillRect(x + 2, y + 2, 8, 8);
      }
    }
  }

  // Runde & verbleibende Gegner oben rechts
  ctx.fillStyle = c.ink;
  ctx.textAlign = 'right';
  if (s.mode === 'versus') {
    ctx.fillText('DUELL', WIDTH - 20, 30);
  } else {
    ctx.fillText(`RUNDE ${s.round} · GEGNER ${s.enemies.length}`, WIDTH - 20, 30);
  }
}
