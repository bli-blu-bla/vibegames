// Online-Multiplayer für zwei Spieler. Die Shell baut die Verbindung auf, das Spiel bekommt `api.net`.
//
// Verbindung: WebRTC direkt zwischen den Browsern. Zum Finden nutzt Trystero öffentliche
// Nostr-Relays, darum braucht es keinen eigenen Server und GitHub Pages reicht.
// Für Tests und Entwicklung gibt es einen lokalen Transport (BroadcastChannel, zwei Tabs).

export type NetRole = 'host' | 'guest';
export type NetMode = 'versus' | 'coop';

/** Online-Teil der GameApi. `null`, wenn allein gespielt wird. */
export interface GameNet {
  /** `host` entscheidet bei Koop (Simulation, Zufall). Bei `versus` z. B. Weiß. */
  readonly role: NetRole;
  readonly mode: NetMode;
  /**
   * Nachricht an den Mitspieler. Kommt zuverlässig und in Reihenfolge an.
   * `data` muss sich als JSON verschicken lassen (keine Funktionen, Maps, Klassen).
   */
  send(type: string, data?: unknown): void;
  /**
   * Nachrichten eines Typs empfangen. Liefert eine Funktion zum Abmelden.
   * Nachrichten, die vor dem Anmelden ankommen, werden zugestellt, sobald ein Empfänger da ist.
   */
  on<T = unknown>(type: string, handler: (data: T) => void): () => void;
}

// ---------- Transport ----------

export interface Envelope {
  /** `s` Shell, `g` Spiel */
  ch: 's' | 'g';
  round: number;
  type: string;
  data?: unknown;
}

export interface TransportHandlers {
  message(msg: Envelope, from: string): void;
  join(peerId: string): void;
  leave(peerId: string): void;
  /** Mitspieler gefunden, aber keine direkte Verbindung möglich (Firewall, NAT, kein TURN) */
  fail(detail: string): void;
}

export interface Transport {
  readonly selfId: string;
  send(msg: Envelope, to: string): void;
  leave(): void;
}

export type TransportFactory = (handlers: TransportHandlers) => Promise<Transport>;

const APP_ID = 'vibegames';
/** Höchstens so viele Nachrichten puffern, für die noch kein Empfänger angemeldet ist. */
const QUEUE_MAX = 200;

/** Trystero mit Nostr-Relays. Wird erst beim ersten Online-Spiel geladen. */
export interface TurnServer {
  urls: string[];
  username?: string;
  credential?: string;
}

export interface NostrOptions {
  /** Eigene Nostr-Relays (wss://…). Leer: Standard-Relays von Trystero. */
  relayUrls?: string[];
  /** TURN-Server als Umweg, wenn keine direkte Verbindung klappt. */
  turn?: TurnServer[];
}

export function nostrTransport(
  gameId: string,
  room: string,
  { relayUrls, turn }: NostrOptions = {},
): TransportFactory {
  return async (h) => {
    // Trystero braucht WebCrypto, das gibt es nur unter HTTPS oder localhost
    if (!globalThis.isSecureContext || !globalThis.crypto?.subtle) throw new Error('insecure');
    const { joinRoom, selfId } = await import('trystero/nostr');
    const r = joinRoom(
      {
        appId: APP_ID,
        password: `${gameId}:${room}`,
        ...(relayUrls?.length ? { relayConfig: { urls: relayUrls } } : {}),
        ...(turn?.length ? { turnConfig: turn } : {}),
      },
      `${gameId}-${room}`,
      { onJoinError: (e) => h.fail(e.error) },
    );
    // Als JSON-Text verschickt: einfach zu typisieren und nichts geht verloren
    const action = r.makeAction<string>('vg');
    action.onMessage = (text, ctx) => {
      try {
        h.message(JSON.parse(text) as Envelope, ctx.peerId);
      } catch {
        // kaputte Nachricht ignorieren
      }
    };
    r.onPeerJoin = h.join;
    r.onPeerLeave = h.leave;
    return {
      selfId,
      send: (msg, to) => {
        action.send(JSON.stringify(msg), { target: to }).catch(() => {});
      },
      leave: () => {
        r.leave().catch(() => {});
      },
    };
  };
}

type LocalPacket =
  | { kind: 'hello'; from: string }
  | { kind: 'here'; from: string; to: string }
  | { kind: 'bye'; from: string }
  | { kind: 'msg'; from: string; to: string; msg: Envelope };

/** Zwei Tabs im selben Browser (für Tests und `net=local` beim Entwickeln). */
export function localTransport(gameId: string, room: string): TransportFactory {
  return async (h) => {
    const selfId = Math.random().toString(36).slice(2, 12);
    const channel = new BroadcastChannel(`vibegames-${gameId}-${room}`);
    const peers = new Set<string>();
    const post = (p: LocalPacket) => channel.postMessage(p);
    const add = (id: string) => {
      if (peers.has(id)) return;
      peers.add(id);
      h.join(id);
    };
    channel.onmessage = (e: MessageEvent<LocalPacket>) => {
      const p = e.data;
      if (p.kind === 'hello') {
        post({ kind: 'here', from: selfId, to: p.from });
        add(p.from);
      } else if (p.kind === 'here' && p.to === selfId) add(p.from);
      else if (p.kind === 'bye' && peers.delete(p.from)) h.leave(p.from);
      else if (p.kind === 'msg' && p.to === selfId) h.message(p.msg, p.from);
    };
    const bye = () => post({ kind: 'bye', from: selfId });
    window.addEventListener('pagehide', bye);
    post({ kind: 'hello', from: selfId });
    return {
      selfId,
      send: (msg, to) => post({ kind: 'msg', from: selfId, to, msg }),
      leave: () => {
        bye();
        window.removeEventListener('pagehide', bye);
        channel.close();
      },
    };
  };
}

// ---------- Sitzung ----------

export type NetStatus = 'connecting' | 'waiting' | 'playing' | 'full' | 'error';

export interface NetState {
  status: NetStatus;
  role: NetRole | null;
  /** Zählt bei jedem gemeinsamen (Neu-)Start hoch. Das Spiel wird dann neu gemountet. */
  round: number;
  /** `true`, wenn der Mitspieler mitten im Spiel gegangen ist */
  peerLeft: boolean;
  /**
   * Bei `error`: `insecure` = Seite nicht über HTTPS geladen, `network` = Relays nicht erreichbar,
   * `p2p` = Mitspieler gefunden, aber keine direkte Verbindung (TURN-Server nötig)
   */
  reason?: 'insecure' | 'network' | 'p2p';
  /** Technische Fehlermeldung für die Anzeige */
  detail?: string;
}

export interface SessionEvents {
  change(state: NetState): void;
  /** Der Mitspieler hat pausiert oder fortgesetzt */
  pause(paused: boolean): void;
}

/**
 * Paart genau zwei Browser, legt Host und Gast fest und synchronisiert Runden und Pause.
 * Spielnachrichten laufen über `game()`.
 */
export class NetSession {
  state: NetState = { status: 'connecting', role: null, round: 0, peerLeft: false };
  private transport: Transport | null = null;
  private peer: string | null = null;
  /** Alle sichtbaren Peers, auch abgewiesene. Geht der Partner, rückt einer nach (z. B. nach Neuladen). */
  private known = new Set<string>();
  private handlers = new Map<string, Set<(data: unknown) => void>>();
  private queue: Envelope[] = [];
  private closed = false;
  private readonly events: SessionEvents;
  private readonly mode: NetMode;

  constructor(factory: TransportFactory, mode: NetMode, events: SessionEvents) {
    this.events = events;
    this.mode = mode;
    // Erst im nächsten Microtask verbinden: Eine sofort wieder geschlossene Sitzung
    // (React StrictMode) meldet sich so gar nicht erst an.
    Promise.resolve()
      .then(() => {
        if (this.closed) throw new Error('closed');
        return factory({
          message: (msg, from) => this.onMessage(msg, from),
          join: (id) => this.onJoin(id),
          leave: (id) => this.onLeave(id),
          fail: (detail) => {
            console.warn('[VibeGames online]', detail);
            if (!this.peer) this.set({ status: 'error', reason: 'p2p', detail });
          },
        });
      })
      .then((t) => {
        if (this.closed) return t.leave();
        this.transport = t;
        if (this.state.status === 'connecting') this.set({ status: 'waiting' });
      })
      .catch((e: unknown) => {
        if (this.closed) return;
        const insecure = e instanceof Error && e.message === 'insecure';
        const detail = e instanceof Error ? e.message : String(e);
        this.set({ status: 'error', reason: insecure ? 'insecure' : 'network', detail });
      });
  }

  /** Neustart: Der Host zählt die Runde hoch, der Gast fragt beim Host an. */
  restart() {
    if (this.state.status !== 'playing') return;
    if (this.state.role === 'host') this.startRound(this.state.round + 1);
    else this.sendShell('restart');
  }

  pause(paused: boolean) {
    this.sendShell('pause', paused);
  }

  /** API für das Spiel dieser Runde. */
  game(): GameNet | null {
    const { role, round } = this.state;
    if (!role || this.state.status !== 'playing') return null;
    return {
      role,
      mode: this.mode,
      send: (type, data) => {
        if (this.state.round === round) this.post({ ch: 'g', round, type, data });
      },
      on: <T>(type: string, handler: (data: T) => void) => {
        const fn = handler as (data: unknown) => void;
        const set = this.handlers.get(type) ?? new Set();
        this.handlers.set(type, set);
        set.add(fn);
        const waiting = this.queue.filter((m) => m.type === type);
        this.queue = this.queue.filter((m) => m.type !== type);
        for (const m of waiting) fn(m.data ?? null);
        return () => {
          set.delete(fn);
        };
      },
    };
  }

  close() {
    this.closed = true;
    this.transport?.leave();
    this.transport = null;
  }

  private set(patch: Partial<NetState>) {
    this.state = { ...this.state, ...patch };
    this.events.change(this.state);
  }

  private post(msg: Envelope) {
    if (this.transport && this.peer) this.transport.send(msg, this.peer);
  }

  private sendShell(type: string, data?: unknown) {
    this.post({ ch: 's', round: this.state.round, type, data });
  }

  private startRound(round: number) {
    this.queue = [];
    this.set({ status: 'playing', round, peerLeft: false });
    this.sendShell('round', round);
  }

  private onJoin(id: string) {
    this.known.add(id);
    if (this.peer === id) return;
    if (this.peer) {
      // Schon zu zweit: Neuankömmling abweisen
      this.transport?.send({ ch: 's', round: 0, type: 'full' }, id);
      return;
    }
    this.pair(id);
  }

  private pair(id: string) {
    this.peer = id;
    this.state = { ...this.state, reason: undefined, detail: undefined };
    const self = this.transport?.selfId ?? '';
    // Fester Vergleich der IDs: beide Seiten kommen ohne Absprache auf dieselbe Rolle
    const role: NetRole = self < id ? 'host' : 'guest';
    this.set({ role, status: 'waiting' });
    if (role === 'host') this.startRound(this.state.round + 1);
    else this.sendShell('ready');
  }

  private onLeave(id: string) {
    this.known.delete(id);
    if (id !== this.peer) return;
    this.peer = null;
    this.handlers.clear();
    this.queue = [];
    this.set({ status: 'waiting', role: null, peerLeft: this.state.status === 'playing' });
    const next = this.known.values().next();
    if (!next.done) this.pair(next.value);
  }

  private onMessage(msg: Envelope, from: string) {
    if (msg.ch === 's' && msg.type === 'full') {
      // Der eigene Partner spielt schon mit jemand anderem. Wird er frei, meldet er sich.
      if (from === this.peer) this.set({ status: 'full' });
      return;
    }
    // Nachricht kann vor dem Join-Ereignis ankommen: dann gilt sie als Beitritt
    if (!this.peer && msg.ch === 's') this.onJoin(from);
    if (from !== this.peer) return;
    if (msg.ch === 's') {
      if (msg.type === 'round' && typeof msg.data === 'number' && this.state.role === 'guest') {
        this.queue = [];
        this.set({ status: 'playing', round: msg.data, peerLeft: false });
      }
      if (msg.type === 'ready' && this.state.role === 'host' && this.state.status !== 'playing') {
        this.startRound(this.state.round + 1);
      }
      if (msg.type === 'restart' && this.state.role === 'host') this.restart();
      if (msg.type === 'pause' && msg.round === this.state.round) {
        this.events.pause(msg.data === true);
      }
      return;
    }
    if (msg.round !== this.state.round || this.state.status !== 'playing') return;
    const set = this.handlers.get(msg.type);
    if (set && set.size > 0) for (const fn of set) fn(msg.data ?? null);
    else this.queue = [...this.queue.slice(-(QUEUE_MAX - 1)), msg];
  }
}

// ---------- Raum-Code ----------

// Ohne 0/O, 1/I/L: lässt sich gut vorlesen und abtippen
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_LENGTH = 6;

export function createRoomCode(random: () => number = Math.random): string {
  return Array.from(
    { length: ROOM_CODE_LENGTH },
    () => CODE_CHARS[Math.floor(random() * CODE_CHARS.length)],
  ).join('');
}

/** Bereinigt eine Eingabe. Liefert null, wenn es kein gültiger Code ist. */
export function normalizeRoomCode(input: string): string | null {
  const code = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (code.length !== ROOM_CODE_LENGTH) return null;
  return [...code].every((c) => CODE_CHARS.includes(c)) ? code : null;
}
