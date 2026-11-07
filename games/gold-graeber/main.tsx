import {
  createRng,
  type GameProps,
  playSfx,
  useCanvas,
  useColors,
  useGameLoop,
  useKeyDown,
} from '@core/sdk';
import { AnchorSimple, ArrowRight, Fire, Lightning, Storefront } from '@phosphor-icons/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  activateConsumable,
  buyShopItem,
  createState,
  type FieldItem,
  GROUND_Y,
  HEIGHT,
  hookPosition,
  isOver,
  NUGGET_SHAPES,
  nextRound,
  ORIGIN_X,
  ORIGIN_Y,
  roundTarget,
  SHOP_ITEMS,
  type ShopItemId,
  type State,
  shootHook,
  update,
  WIDTH,
} from './logic.ts';
import './style.css';

interface FloatingPopup {
  x: number;
  y: number;
  text: string;
  life: number;
}

const MONO = '"Geist Mono", ui-monospace, monospace';

export default function GoldGraeber({ api, paused }: GameProps) {
  const rng = useMemo(() => createRng(api.seed), [api.seed]);
  const stateRef = useRef<State>(createState(rng));
  const [uiState, setUiState] = useState<State>(stateRef.current);
  const popupsRef = useRef<FloatingPopup[]>([]);
  const grabbedNuggetRef = useRef<SVGGElement>(null);
  const gameOverCalled = useRef(false);

  const colors = useColors();
  const canvas = useCanvas(WIDTH, HEIGHT);

  const syncUi = (next: State) => {
    stateRef.current = next;
    setUiState(next);
  };

  const triggerShoot = () => {
    if (paused) return;
    const before = stateRef.current;
    if (before.phase !== 'playing' || before.hookPhase !== 'swinging') return;
    playSfx('jump');
    syncUi(shootHook(before));
  };

  const triggerConsumable = (kind: 'dynamite' | 'tonic') => {
    if (paused) return;
    const before = stateRef.current;
    const next = activateConsumable(before, kind);
    if (next !== before) {
      playSfx(kind === 'dynamite' ? 'hit' : 'jump');
      syncUi(next);
    }
  };

  const handleBuy = (id: ShopItemId) => {
    if (paused) return;
    const before = stateRef.current;
    const next = buyShopItem(before, id);
    if (next !== before) {
      playSfx('coin');
      syncUi(next);
    }
  };

  const handleNextRound = () => {
    if (paused) return;
    const before = stateRef.current;
    if (before.phase !== 'shop') return;
    playSfx('click');
    syncUi(nextRound(before, rng));
  };

  useKeyDown((key) => {
    const cur = stateRef.current;
    if (cur.phase === 'playing') {
      if (key === ' ' || key === 'ArrowDown' || key === 's' || key === 'S') {
        triggerShoot();
      } else if (key === '1' || key === 'd' || key === 'D') {
        triggerConsumable('dynamite');
      } else if (key === '2' || key === 'k' || key === 'K') {
        triggerConsumable('tonic');
      }
    } else if (cur.phase === 'shop') {
      if (key === 'Enter') {
        handleNextRound();
      }
    }
  }, !paused);

  useGameLoop((dt) => {
    const before = stateRef.current;
    if (before.phase === 'playing') {
      const next = update(before, {}, dt);
      stateRef.current = next;

      if (next.grabbed && !before.grabbed) {
        playSfx(next.grabbed.kind === 'rock' ? 'hit' : 'click');
      }

      if (next.lastCollected) {
        playSfx('coin');
        api.setScore(next.score);
        popupsRef.current.push({
          x: ORIGIN_X,
          y: ORIGIN_Y + 24,
          text: `+${next.lastCollected.value}`,
          life: 1.1,
        });
      }

      if (next.phase !== before.phase) {
        if (next.phase === 'shop') {
          playSfx('win');
        } else if (isOver(next) && !gameOverCalled.current) {
          gameOverCalled.current = true;
          playSfx('lose');
          api.gameOver({
            outcome: 'lose',
            message: `Runde ${next.round}: ${next.money} von ${next.target} Gold erreicht.`,
          });
        }
        setUiState(next);
      } else if (
        Math.floor(next.timeLeft) !== Math.floor(before.timeLeft) ||
        next.hookPhase !== before.hookPhase ||
        next.score !== before.score
      ) {
        setUiState(next);
      }
    }

    popupsRef.current = popupsRef.current
      .map((p) => ({ ...p, y: p.y - 22 * dt, life: p.life - dt }))
      .filter((p) => p.life > 0);

    const cur = stateRef.current;
    if (grabbedNuggetRef.current && cur.grabbed && isGoldNugget(cur.grabbed)) {
      const tip = hookPosition(cur);
      grabbedNuggetRef.current.setAttribute('transform', `translate(${tip.x}, ${tip.y})`);
    }

    canvas.draw((ctx) => draw(ctx, cur, popupsRef.current, colors));
  }, !paused);

  useEffect(() => {
    canvas.draw((ctx) => draw(ctx, stateRef.current, popupsRef.current, colors));
  }, [canvas, colors]);

  const s = uiState;
  const canDynamite =
    s.phase === 'playing' &&
    s.hookPhase === 'reeling' &&
    s.grabbed !== null &&
    s.consumables.dynamite > 0;
  const canTonic = s.phase === 'playing' && s.consumables.tonic > 0 && s.tonicTimer <= 0;
  const goldItems = s.items.filter(isGoldNugget);
  const grabbedGold = s.grabbed && isGoldNugget(s.grabbed) ? s.grabbed : null;
  const grabbedTip = hookPosition(s);

  return (
    <div className="gg-root">
      <div className="gg-stage" hidden={s.phase === 'shop'}>
        <canvas
          {...canvas.props}
          style={{ ...canvas.props.style, maxWidth: '100%' }}
          onPointerDown={() => {
            if (stateRef.current.phase === 'playing') triggerShoot();
          }}
          role="img"
          aria-label={`Spielfeld Runde ${s.round}: ${s.money} von ${s.target} Gold, noch ${Math.ceil(s.timeLeft)} Sekunden`}
        />
        <svg className="gg-nuggets-svg" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} aria-hidden="true">
          {goldItems.map((item) => (
            <GoldNuggetSvg key={item.id} item={item} x={item.x} y={item.y} />
          ))}
          {grabbedGold && (
            <g ref={grabbedNuggetRef} transform={`translate(${grabbedTip.x}, ${grabbedTip.y})`}>
              <GoldNuggetSvg
                item={grabbedGold}
                x={Math.sin(s.angle) * (grabbedGold.radius + 4)}
                y={Math.cos(s.angle) * (grabbedGold.radius + 4)}
              />
              <g transform={`rotate(${(-s.angle * 180) / Math.PI})`}>
                <path
                  d="M 0 -2 L -9 8 L -5 14 M 0 -2 L 9 8 L 5 14"
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </g>
            </g>
          )}
        </svg>
      </div>

      {s.phase === 'playing' && (
        <div className="gg-controls">
          <button
            type="button"
            className="btn btn-primary gg-shoot-btn"
            disabled={paused || s.hookPhase !== 'swinging'}
            onClick={triggerShoot}
          >
            <AnchorSimple size={20} />
            <span>Haken auswerfen (Leertaste)</span>
          </button>

          {s.consumables.dynamite > 0 && (
            <button
              type="button"
              className="btn gg-item-btn"
              disabled={paused || !canDynamite}
              onClick={() => triggerConsumable('dynamite')}
              title="Taste 1 oder D: Sprengt Gegenstand am Haken"
            >
              <Fire size={18} />
              <span>Dynamit ({s.consumables.dynamite})</span>
            </button>
          )}

          {s.consumables.tonic > 0 && (
            <button
              type="button"
              className="btn gg-item-btn"
              disabled={paused || !canTonic}
              onClick={() => triggerConsumable('tonic')}
              title="Taste 2 oder K: Schnelleres Einziehen für 15 Sek."
            >
              <Lightning size={18} />
              <span>Krafttrank ({s.consumables.tonic})</span>
            </button>
          )}
        </div>
      )}

      {s.phase === 'shop' && (
        <section className="gg-shop" aria-label="Ausrüstungs-Shop">
          <div className="gg-shop-header">
            <div>
              <h2 className="t-heading" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Storefront size={22} />
                <span>Runde {s.round} geschafft!</span>
              </h2>
              <p className="t-small muted">
                Nicht ausgegebenes Geld bleibt für Runde {s.round + 1} erhalten.
              </p>
            </div>
            <div className="gg-shop-stats">
              <div>
                <div className="t-label muted">GUTHABEN</div>
                <div className="t-score" style={{ color: 'var(--highlight)' }}>
                  {s.money}
                </div>
              </div>
              <div>
                <div className="t-label muted">NÄCHSTES ZIEL</div>
                <div className="t-score">{roundTarget(s.round + 1)}</div>
              </div>
            </div>
          </div>

          <div className="gg-shop-grid">
            {SHOP_ITEMS.map((item) => {
              const bought = s.shopPurchased.includes(item.id);
              const affordable = s.money >= item.cost;
              const ownedCount =
                item.id === 'winch'
                  ? `Stufe ${s.upgrades.winch}`
                  : item.id === 'luck'
                    ? `Stufe ${s.upgrades.luck}`
                    : item.id === 'dynamite'
                      ? `${s.consumables.dynamite}× im Vorrat`
                      : `${s.consumables.tonic}× im Vorrat`;

              return (
                <div key={item.id} className="gg-shop-card">
                  <div>
                    <div className="gg-shop-card-top">
                      <span className="t-body-strong">{item.name}</span>
                      <span className="chip t-mono-small">{item.cost} Gold</span>
                    </div>
                    <p className="t-small muted" style={{ marginTop: 4 }}>
                      {item.description}
                    </p>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <span className="t-small muted">{ownedCount}</span>
                    <button
                      type="button"
                      className="btn"
                      disabled={paused || bought || !affordable}
                      onClick={() => handleBuy(item.id)}
                    >
                      {bought ? 'Gekauft' : 'Kaufen'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="gg-shop-footer">
            <button
              type="button"
              className="btn btn-primary"
              disabled={paused}
              onClick={handleNextRound}
            >
              <span>Weiter zu Runde {s.round + 1}</span>
              <ArrowRight size={18} />
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

function draw(
  ctx: CanvasRenderingContext2D,
  s: State,
  popups: FloatingPopup[],
  c: ReturnType<typeof useColors>,
) {
  // Hintergrund (Untergrund in surface-100, Oberwelt in surface-200)
  ctx.fillStyle = c['surface-100'];
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.fillStyle = c['surface-200'];
  ctx.fillRect(0, 0, WIDTH, GROUND_Y);

  // Dezente Schichtlinien im Untergrund
  ctx.strokeStyle = c['surface-300'];
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let y = GROUND_Y + 60; y < HEIGHT; y += 60) {
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(WIDTH, y + 0.5);
  }
  ctx.stroke();

  // Bodenlinie
  ctx.strokeStyle = c['line-strong'];
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y);
  ctx.lineTo(WIDTH, GROUND_Y);
  ctx.stroke();

  // Seilwinde / Gestell oben in der Mitte
  ctx.strokeStyle = c.ink;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(ORIGIN_X - 18, GROUND_Y);
  ctx.lineTo(ORIGIN_X, ORIGIN_Y - 14);
  ctx.lineTo(ORIGIN_X + 18, GROUND_Y);
  ctx.stroke();

  ctx.fillStyle = s.tonicTimer > 0 ? c.accent : c['surface-300'];
  ctx.beginPath();
  ctx.arc(ORIGIN_X, ORIGIN_Y, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = c.ink;
  ctx.lineWidth = 2;
  ctx.stroke();

  // HUD-Infos in der Kopfzeile
  const goalReached = s.money >= s.target;
  ctx.font = `600 13px ${MONO}`;
  ctx.textAlign = 'left';
  ctx.fillStyle = c['ink-muted'];
  ctx.fillText(`RUNDE ${s.round}`, 14, 22);

  ctx.font = `700 15px ${MONO}`;
  ctx.fillStyle = goalReached ? c.highlight : c.ink;
  ctx.fillText(`GELD ${s.money} / ${s.target}${goalReached ? ' ✓' : ''}`, 14, 44);

  ctx.textAlign = 'right';
  ctx.font = `600 13px ${MONO}`;
  ctx.fillStyle = c['ink-muted'];
  ctx.fillText('ZEIT', WIDTH - 14, 22);

  const secs = Math.ceil(s.timeLeft);
  ctx.font = `700 16px ${MONO}`;
  ctx.fillStyle = secs <= 10 ? c.highlight : c.ink;
  ctx.fillText(`${secs}s`, WIDTH - 14, 44);

  if (s.tonicTimer > 0) {
    ctx.textAlign = 'center';
    ctx.font = `600 11px ${MONO}`;
    ctx.fillStyle = c.accent;
    ctx.fillText(`KRAFTTRANK ${Math.ceil(s.tonicTimer)}s`, ORIGIN_X, 20);
  }

  // Gegenstände im Boden zeichnen
  for (const item of s.items) {
    drawItem(ctx, item, item.x, item.y, c);
  }

  // Seil und Greifhaken
  const tip = hookPosition(s);

  ctx.strokeStyle = c.ink;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(ORIGIN_X, ORIGIN_Y);
  ctx.lineTo(tip.x, tip.y);
  ctx.stroke();

  // Wenn ein Gegenstand am Haken hängt, direkt am Haken-Ende zeichnen
  if (s.grabbed) {
    const offset = s.grabbed.radius + 4;
    const gx = tip.x + Math.sin(s.angle) * offset;
    const gy = tip.y + Math.cos(s.angle) * offset;
    drawItem(ctx, s.grabbed, gx, gy, c);
  }

  // Greifklaue am Ende des Seils
  ctx.save();
  ctx.translate(tip.x, tip.y);
  ctx.rotate(-s.angle);
  ctx.strokeStyle = c.accent;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, -2);
  ctx.lineTo(-9, 8);
  ctx.lineTo(-5, 14);
  ctx.moveTo(0, -2);
  ctx.lineTo(9, 8);
  ctx.lineTo(5, 14);
  ctx.stroke();
  ctx.restore();

  // Schwebende Punkte-Popups
  for (const p of popups) {
    ctx.textAlign = 'center';
    ctx.font = `700 16px ${MONO}`;
    ctx.fillStyle = c.highlight;
    ctx.fillText(p.text, p.x, p.y);
  }
}

function isGoldNugget(item: FieldItem): boolean {
  return item.kind === 'gold_small' || item.kind === 'gold_large';
}

function GoldNuggetSvg({ item, x, y }: { item: FieldItem; x: number; y: number }) {
  const shape = NUGGET_SHAPES[(item.variant ?? 0) % NUGGET_SHAPES.length] ?? NUGGET_SHAPES[0];
  if (!shape) return null;
  const isLarge = item.kind === 'gold_large';
  const scale = item.radius / 18;
  const strokeW = isLarge ? 1.65 : 2.3;
  const ridgeW = isLarge ? 1.25 : 1.7;

  return (
    <g className="gg-nugget" transform={`translate(${x}, ${y})`}>
      <g transform={`scale(${scale})`}>
        <path
          d={shape.outer}
          fill="var(--highlight)"
          stroke="var(--ink)"
          strokeWidth={strokeW}
          strokeLinejoin="round"
        />
        <path d={shape.crown} fill="var(--game-sand)" />
        <path d={shape.bevel} fill="var(--highlight)" />
        <path d={shape.glint} fill="var(--surface-200)" />
        <path
          d={shape.ridges}
          fill="none"
          stroke="var(--ink)"
          strokeWidth={ridgeW}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={shape.outer}
          fill="none"
          stroke="var(--ink)"
          strokeWidth={strokeW}
          strokeLinejoin="round"
        />
      </g>
      <text
        x={0}
        y={isLarge ? 4.5 : 3.5}
        textAnchor="middle"
        className="gg-nugget-label"
        fontSize={isLarge ? 11.5 : 9.5}
        fontWeight={700}
        fill="var(--surface-100)"
      >
        {item.value}
      </text>
    </g>
  );
}

function drawItem(
  ctx: CanvasRenderingContext2D,
  item: FieldItem,
  x: number,
  y: number,
  c: ReturnType<typeof useColors>,
) {
  if (isGoldNugget(item)) return;
  const r = item.radius;
  ctx.save();
  ctx.translate(x, y);

  if (item.kind === 'gem') {
    ctx.fillStyle = c['game-sky'];
    ctx.strokeStyle = c.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -r - 2);
    ctx.lineTo(r + 2, 0);
    ctx.lineTo(0, r + 2);
    ctx.lineTo(-r - 2, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else {
    // Stein: kantiges Sechseck in game-sand mit Risslinie
    ctx.fillStyle = c['game-sand'];
    ctx.strokeStyle = c.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-r * 0.8, -r * 0.6);
    ctx.lineTo(r * 0.3, -r * 0.85);
    ctx.lineTo(r * 0.95, -r * 0.2);
    ctx.lineTo(r * 0.7, r * 0.75);
    ctx.lineTo(-r * 0.4, r * 0.85);
    ctx.lineTo(-r * 0.95, r * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = c['surface-100'];
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-r * 0.3, -r * 0.2);
    ctx.lineTo(r * 0.1, r * 0.1);
    ctx.lineTo(r * 0.35, -r * 0.15);
    ctx.stroke();
  }

  ctx.restore();
}
