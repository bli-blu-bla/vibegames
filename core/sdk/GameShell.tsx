import {
  ArrowCounterClockwise,
  ArrowLeft,
  Globe,
  Handshake,
  Info,
  Moon,
  Pause,
  Play,
  SignOut,
  SpeakerHigh,
  SpeakerSlash,
  Sun,
  Trophy,
  XCircle,
} from '@phosphor-icons/react';
import { AnimatePresence, motion } from 'motion/react';
import { type ComponentType, useEffect, useMemo, useRef, useState } from 'react';
import { formatScore, isBetter } from './format.ts';
import { Lobby, modeLabel, OnlineDialog, roomHash } from './Lobby.tsx';
import { useOnline } from './online.ts';
import { randomSeed } from './rng.ts';
import { useShellStore } from './shellStore.ts';
import { useSoundStore } from './sound.ts';
import { createStorage } from './storage.ts';
import { useThemeStore } from './theme.ts';
import type { GameApi, GameMeta, GameProps, GameResult } from './types.ts';
import './shell.css';

interface Props {
  meta: GameMeta;
  game: ComponentType<GameProps>;
  /** Raum-Code aus der URL, wenn online gespielt wird */
  room?: string | null;
  /** Lokaler Transport statt Nostr (zwei Tabs, Tests) */
  localNet?: boolean;
}

/**
 * Rahmen für jedes Spiel: Leiste mit Zurück, Titel, Score, Rekord, Ton, Theme, Pause, Neustart.
 * Bei Spielen mit `multiplayer` zusätzlich Online-Spiel mit 2 bis `players` Spielern
 * (Lobby, gemeinsame Pause und Runde).
 */
export function GameShell({ meta, game: Game, room = null, localNet = false }: Props) {
  const { score, status, run, pause: localPause, restart: localRestart } = useShellStore();
  const [dialog, setDialog] = useState(false);
  const [info, setInfo] = useState(false);
  const online = Boolean(meta.multiplayer && room);
  const { session, state: net } = useOnline({
    gameId: meta.id,
    mode: meta.multiplayer,
    maxPlayers: meta.players,
    room,
    localNet,
    onPause: (p) => {
      const shell = useShellStore.getState();
      if (shell.status !== 'over') useShellStore.setState({ status: p ? 'paused' : 'playing' });
    },
  });
  const round = net?.status === 'playing' ? net.round : 0;
  const ready = !online || round > 0;

  // Online gelten Pause und Neustart für beide
  const togglePause = () => {
    useShellStore.getState().togglePause();
    const now = useShellStore.getState().status;
    if (now !== 'over') session?.pause(now === 'paused');
  };
  const pause = () => {
    if (useShellStore.getState().status !== 'playing') return;
    localPause();
    session?.pause(true);
  };
  const restart = () => (online ? session?.restart() : localRestart());
  const muted = useSoundStore((s) => s.muted);
  const toggleMute = useSoundStore((s) => s.toggle);
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggle);

  const storage = useMemo(() => createStorage(meta.id), [meta.id]);
  const [best, setBest] = useState<number | null>(() => storage.get<number | null>('best', null));
  const [newRecord, setNewRecord] = useState(false);
  const [result, setResult] = useState<GameResult>({});
  // Siege/Niederlagen gegen andere (nur online bei `versus`), pro Spiel gespeichert
  const versus = meta.multiplayer === 'versus';
  const [tally, setTally] = useState<Tally>(() => storage.get('tally', EMPTY_TALLY));

  // Frischer Shell-Zustand beim Öffnen eines Spiels und bei jeder neuen Online-Runde
  // biome-ignore lint/correctness/useExhaustiveDependencies: round und room setzen bewusst zurück
  useEffect(() => {
    localRestart();
    setDialog(false);
    setInfo(false);
    createStorage('core').set('lastPlayed', meta.id);
  }, [meta.id, localRestart, round, room]);

  // Pro Run ein neues, stabiles API-Objekt
  // biome-ignore lint/correctness/useExhaustiveDependencies: run und round erzwingen bewusst ein neues Objekt
  const api = useMemo<GameApi>(() => {
    let over = false;
    return {
      gameId: meta.id,
      // Online: beide Seiten bekommen denselben Seed
      seed: online ? `${room}:${round}` : randomSeed(),
      storage,
      net: online ? (session?.game() ?? null) : null,
      setScore: (value) => {
        if (!over) useShellStore.getState().setScore(value);
      },
      gameOver: (res = {}) => {
        if (over) return;
        over = true;
        const final = useShellStore.getState().score;
        const previous = storage.get<number | null>('best', null);
        const outcome = res.outcome ?? 'lose';
        // 0 zählt nie als Rekord. "Weniger ist besser" (Zeit, Züge) zählt nur bei einem Sieg.
        // Online zählt kein Rekord: Der Mitspieler könnte absichtlich verlieren.
        const counts =
          !online && final > 0 && (meta.score.better === 'higher' || outcome === 'win');
        const record = counts && isBetter(final, previous, meta.score.better);
        setResult(res);
        if (online && versus) {
          const next = addOutcome(storage.get('tally', EMPTY_TALLY), outcome);
          storage.set('tally', next);
          setTally(next);
        }
        if (record) {
          storage.set('best', final);
          setBest(final);
        }
        setNewRecord(record);
        useShellStore.getState().gameOver();
      },
    };
  }, [meta.id, meta.score.better, storage, run, round, online, versus, room, session]);

  // Tastatur der Shell: Escape/P pausiert, R startet neu
  const keys = useRef({ togglePause, restart, pause });
  keys.current = { togglePause, restart, pause };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === 'Escape' || e.key.toLowerCase() === 'p') keys.current.togglePause();
      if (e.key.toLowerCase() === 'r') keys.current.restart();
    };
    const onHidden = () => document.hidden && keys.current.pause();
    window.addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', onHidden);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('visibilitychange', onHidden);
    };
  }, []);

  // Info schließt, sobald das Spiel weiterläuft (Weiter-Button, Escape, P)
  useEffect(() => {
    if (status === 'playing') setInfo(false);
  }, [status]);

  const openDialog = () => {
    pause();
    setInfo(false);
    setDialog(true);
  };
  const closeInfo = () => {
    setInfo(false);
    if (status === 'paused') togglePause();
  };
  const openInfo = () => {
    pause();
    setDialog(false);
    setInfo(true);
  };

  const fmt = (v: number) => formatScore(v, meta.score.format);

  return (
    <div className="shell">
      <header className="shell-bar">
        <div className="shell-group shell-title">
          <a href="#/" className="btn btn-icon" aria-label="Zurück zur Galerie">
            <ArrowLeft size={20} />
          </a>
          <h1 className="t-heading">{meta.title}</h1>
          {online && (
            <span className="chip shell-online">
              Online{net && net.waiting > 0 ? ` · ${net.waiting} wartet` : ''}
            </span>
          )}
        </div>
        <div className="shell-group shell-stats">
          {online && versus ? (
            <>
              <div className="shell-stat">
                <span className="t-label muted">SIEGE</span>
                <span className="t-score shell-score" data-testid="wins">
                  {tally.win}
                </span>
              </div>
              <div className="shell-stat">
                <span className="t-label muted">NIEDERLAGEN</span>
                <span className="t-score shell-score" data-testid="losses">
                  {tally.lose}
                </span>
              </div>
            </>
          ) : (
            <>
              <div className="shell-stat">
                <span className="t-label muted">SCORE</span>
                <span className="t-score shell-score" data-testid="score">
                  {fmt(score)}
                </span>
              </div>
              <div className="shell-stat">
                <span className="t-label muted">{meta.score.label}</span>
                <span className="t-score shell-score score-value">
                  {best === null ? '–' : fmt(best)}
                </span>
              </div>
            </>
          )}
        </div>
        <div className="shell-group shell-settings">
          {meta.multiplayer &&
            (online ? (
              <a
                className="btn btn-icon"
                href={roomHash(meta.id, null)}
                aria-label="Online verlassen"
              >
                <SignOut size={20} />
              </a>
            ) : (
              <button
                type="button"
                className="btn btn-icon"
                onClick={openDialog}
                aria-label="Online spielen"
              >
                <Globe size={20} />
              </button>
            ))}
          <button type="button" className="btn btn-icon" onClick={openInfo} aria-label="Steuerung">
            <Info size={20} />
          </button>
          <button
            type="button"
            className="btn btn-icon"
            onClick={toggleMute}
            aria-label={muted ? 'Ton an' : 'Ton aus'}
          >
            {muted ? <SpeakerSlash size={20} /> : <SpeakerHigh size={20} />}
          </button>
          <button
            type="button"
            className="btn btn-icon"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Helles Theme' : 'Dunkles Theme'}
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>
        <div className="shell-group shell-controls">
          <button
            type="button"
            className="btn btn-icon"
            onClick={togglePause}
            disabled={status === 'over' || !ready}
            aria-label={status === 'paused' ? 'Weiter' : 'Pause'}
          >
            {status === 'paused' ? <Play size={20} /> : <Pause size={20} />}
          </button>
          <button
            type="button"
            className="btn btn-icon btn-primary"
            onClick={restart}
            disabled={!ready}
            aria-label="Neu starten"
          >
            <ArrowCounterClockwise size={20} />
          </button>
        </div>
      </header>

      <main className="shell-main">
        <div className="shell-field">
          {ready ? (
            <Game key={online ? `online-${round}` : run} api={api} paused={status !== 'playing'} />
          ) : (
            net &&
            room && (
              <Lobby
                gameId={meta.id}
                room={room}
                state={net}
                localNet={localNet}
                onStart={() => session?.start()}
              />
            )
          )}
          <AnimatePresence>
            {ready && (status !== 'playing' || dialog || info) && (
              <motion.div
                className="shell-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                {info ? (
                  <>
                    <p className="t-heading">Steuerung</p>
                    <p className="t-mono-small muted shell-message">{meta.controls}</p>
                    <p className="t-mono-small muted">P Pause · R Neustart</p>
                    <button type="button" className="btn btn-primary" onClick={closeInfo}>
                      <Play size={20} weight="fill" /> Weiter
                    </button>
                  </>
                ) : dialog && meta.multiplayer ? (
                  <OnlineDialog
                    gameId={meta.id}
                    mode={meta.multiplayer}
                    players={meta.players}
                    localNet={localNet}
                    onClose={() => setDialog(false)}
                  />
                ) : status === 'paused' ? (
                  <>
                    <p className="t-display">Pause</p>
                    <button type="button" className="btn btn-primary" onClick={togglePause}>
                      <Play size={20} weight="fill" /> Weiter
                    </button>
                  </>
                ) : (
                  <>
                    <ResultTitle outcome={result.outcome ?? 'lose'} />
                    {result.message && <p className="muted shell-message">{result.message}</p>}
                    <p className="t-score score-value">{fmt(score)}</p>
                    {newRecord && (
                      <p className="shell-record">
                        <Trophy size={20} weight="fill" aria-hidden /> Neuer Rekord
                      </p>
                    )}
                    <button type="button" className="btn btn-primary" onClick={restart}>
                      <ArrowCounterClockwise size={20} weight="bold" /> Nochmal
                    </button>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {online && ready && <NetCorner pings={net?.pings ?? {}} />}
        {meta.multiplayer && !online && (
          <p className="t-small muted shell-hint">
            <Globe size={16} aria-hidden /> {modeLabel(meta.multiplayer, meta.players)}: oben
            „Online spielen“
          </p>
        )}
        {meta.credits.length > 0 && (
          <a className="t-small muted shell-credits" href={`#/credits?game=${meta.id}`}>
            Credits
          </a>
        )}
      </main>
    </div>
  );
}

interface Tally {
  win: number;
  lose: number;
  draw: number;
}

const EMPTY_TALLY: Tally = { win: 0, lose: 0, draw: 0 };

function addOutcome(t: Tally, outcome: 'win' | 'lose' | 'draw'): Tally {
  return { ...t, [outcome]: t[outcome] + 1 };
}

/** Ecke unten rechts: Ping zu den Mitspielern */
function NetCorner({ pings }: { pings: Record<number, number> }) {
  const seats = Object.keys(pings)
    .map(Number)
    .sort((a, b) => a - b);
  return (
    <output className="t-mono-small muted shell-corner" data-testid="net-corner">
      {seats.map((seat) => (
        <span key={seat}>
          {seat === 0 ? 'Host' : `Spieler ${seat + 1}`} {pings[seat]} ms
        </span>
      ))}
    </output>
  );
}

function ResultTitle({ outcome }: { outcome: 'win' | 'lose' | 'draw' }) {
  if (outcome === 'win') {
    return (
      <p className="t-display shell-result shell-win" role="status">
        <Trophy size={36} weight="bold" aria-hidden /> Gewonnen
      </p>
    );
  }
  if (outcome === 'draw') {
    return (
      <p className="t-display shell-result" role="status">
        <Handshake size={36} weight="bold" aria-hidden /> Unentschieden
      </p>
    );
  }
  return (
    <p className="t-display shell-result shell-over" role="status">
      <XCircle size={36} weight="bold" aria-hidden /> Game Over
    </p>
  );
}
