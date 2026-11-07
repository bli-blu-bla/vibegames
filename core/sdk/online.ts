import { useEffect, useRef, useState } from 'react';
import { NOSTR_RELAYS, TURN_SERVERS } from '../config.ts';
import {
  type GameNet,
  localTransport,
  type NetMode,
  NetSession,
  type NetState,
  nostrTransport,
} from './net.ts';

interface OnlineOptions {
  gameId: string;
  mode: NetMode | undefined;
  /** Höchstens so viele Spieler pro Runde (game.json `players`) */
  maxPlayers?: number;
  room: string | null;
  localNet: boolean;
  onPause(paused: boolean): void;
}

/** Für die Shell: baut die Sitzung für einen Raum auf und räumt beim Verlassen auf. */
export function useOnline({
  gameId,
  mode,
  maxPlayers = 2,
  room,
  localNet,
  onPause,
}: OnlineOptions) {
  const [state, setState] = useState<NetState | null>(null);
  const [session, setSession] = useState<NetSession | null>(null);
  const pauseRef = useRef(onPause);
  pauseRef.current = onPause;

  useEffect(() => {
    if (!mode || !room) return;
    const factory = localNet
      ? localTransport(gameId, room)
      : nostrTransport(gameId, room, { relayUrls: NOSTR_RELAYS, turn: TURN_SERVERS });
    const s = new NetSession(
      factory,
      mode,
      { change: setState, pause: (p) => pauseRef.current(p) },
      maxPlayers,
    );
    setSession(s);
    setState(s.state);
    return () => {
      s.close();
      setSession(null);
      setState(null);
    };
  }, [gameId, mode, maxPlayers, room, localNet]);

  return { session, state };
}

/**
 * Für Spiele: Nachrichten eines Typs empfangen, solange die Komponente lebt.
 *
 *   useNet(api.net, 'move', (m: MoveMsg) => setGame((g) => play(g, m)));
 *   useNet(api.net, 'input', (inp: Input, seat) => …);   // seat: Platz des Absenders
 */
export function useNet<T = unknown>(
  net: GameNet | null,
  type: string,
  handler: (data: T, seat: number) => void,
) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => net?.on<T>(type, (data, seat) => ref.current(data, seat)), [net, type]);
}
