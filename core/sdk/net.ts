// Online-Multiplayer für zwei bis vier Spieler (`players` in game.json, Standard 2). Die Shell baut die Verbindung auf, das Spiel bekommt `api.net`.
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
  /** Eigener Platz in dieser Runde: 0 = Host, 1 bis players-1 = Gäste. Zu zweit: Gast = 1. */
  readonly seat: number;
  /** Spieler in dieser Runde (2 bis `players` aus game.json) */
  readonly players: number;
  /**
   * Nachricht verschicken. Kommt zuverlässig und in Reihenfolge an.
   * Host: an alle Gäste. Gast: nur an den Host (Gäste reden nicht direkt miteinander).
   * `data` muss sich als JSON verschicken lassen (keine Funktionen, Maps, Klassen).
   */
  send(type: string, data?: unknown): void;
  /**
   * Nachrichten eines Typs empfangen. Liefert eine Funktion zum Abmelden.
   * `seat` ist der Platz des Absenders (beim Gast immer 0, der Host).
   * Nachrichten, die vor dem Anmelden ankommen, werden zugestellt, sobald ein Empfänger da ist.
   * Geht ein Gast mitten in der Runde und bleiben mindestens zwei, bekommt der Host `'$left'`
   * mit dem Platz des Gasts als `data`.
   */
  on<T = unknown>(type: string, handler: (data: T, seat: number) => void): () => void;
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
  /** `true`, wenn ein Mitspieler mitten im Spiel gegangen ist und die Runde endete */
  peerLeft: boolean;
  /** Spieler im Raum (Lobby) bzw. in der laufenden Runde, inklusive man selbst */
  players: number;
  /** Höchstens so viele Spieler pro Runde (aus game.json `players`, Standard 2) */
  maxPlayers: number;
  /** Gast ist im Raum, spielt aber erst ab der nächsten Runde mit */
  queued: boolean;
  /** Host: so viele Gäste warten auf die nächste Runde */
  waiting: number;
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
  /** Ein Mitspieler hat pausiert oder fortgesetzt */
  pause(paused: boolean): void;
}

/** Nachricht an das Spiel des Hosts, wenn ein Gast mitten in der Runde geht. `data` ist sein Platz. */
export const LEFT_MESSAGE = '$left';

interface Queued {
  msg: Envelope;
  seat: number;
}

/**
 * Bringt 2 bis `maxPlayers` Browser in einem Raum zusammen. Ein Host, alle anderen sind Gäste
 * (Stern: Gäste reden nur mit dem Host). Synchronisiert Runden und Pause.
 *
 * Ablauf: Wer noch keine Rolle hat, fragt den offenen Host (`ready`). Gibt es keinen, fragt er den
 * Teilnehmer mit der kleinsten ID; der wird Host, sobald ihn jemand fragt. Bei zwei Spielern startet
 * die Runde sofort, bei mehr startet der Host sie (`start()`) oder sie startet, wenn der Raum voll ist.
 * Wer während einer Runde dazukommt, spielt ab der nächsten Runde mit.
 */
export class NetSession {
  state: NetState;
  private transport: Transport | null = null;
  /** Alle sichtbaren Peers */
  private known = new Set<string>();
  /** Bekannte Hosts anderer Gruppen und ob sie noch Platz haben */
  private hosts = new Map<string, boolean>();
  /** Bei wem ohne Rolle schon angefragt wurde */
  private asked: string | null = null;
  /** Gast: ID des Hosts */
  private hostId: string | null = null;
  /** Host: alle Gäste im Raum, in Reihenfolge des Beitritts */
  private members: string[] = [];
  /** Plätze der laufenden Runde, Index = Platz (0 = Host). Gegangene bleiben als `null`. */
  private roster: (string | null)[] = [];
  private handlers = new Map<string, Set<(data: unknown, seat: number) => void>>();
  private queue: Queued[] = [];
  private closed = false;
  private readonly events: SessionEvents;
  private readonly mode: NetMode;
  private readonly max: number;

  constructor(factory: TransportFactory, mode: NetMode, events: SessionEvents, maxPlayers = 2) {
    this.events = events;
    this.mode = mode;
    this.max = Math.max(2, Math.min(4, Math.floor(maxPlayers)));
    this.state = {
      status: 'connecting',
      role: null,
      round: 0,
      peerLeft: false,
      players: 1,
      maxPlayers: this.max,
      queued: false,
      waiting: 0,
    };
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
            if (!this.state.role) this.set({ status: 'error', reason: 'p2p', detail });
          },
        });
      })
      .then((t) => {
        if (this.closed) return t.leave();
        this.transport = t;
        if (this.state.status === 'connecting') this.set({ status: 'waiting' });
        this.evaluate();
      })
      .catch((e: unknown) => {
        if (this.closed) return;
        const insecure = e instanceof Error && e.message === 'insecure';
        const detail = e instanceof Error ? e.message : String(e);
        this.set({ status: 'error', reason: insecure ? 'insecure' : 'network', detail });
      });
  }

  /** Host in der Lobby: Runde mit allen, die schon da sind, starten (ab zwei Spielern). */
  start() {
    if (this.state.role === 'host' && this.state.status !== 'playing' && this.members.length > 0) {
      this.startRound(this.state.round + 1);
    }
  }

  /** Neustart: Der Host zählt die Runde hoch, Gäste fragen beim Host an. */
  restart() {
    if (this.state.status !== 'playing') return;
    if (this.state.role === 'host') this.startRound(this.state.round + 1);
    else this.toHost('restart');
  }

  pause(paused: boolean) {
    if (this.state.status !== 'playing') return;
    if (this.state.role === 'host')
      this.toRoster({ ch: 's', round: this.state.round, type: 'pause', data: paused });
    else this.toHost('pause', paused);
  }

  /** API für das Spiel dieser Runde. */
  game(): GameNet | null {
    const { role, round, status } = this.state;
    if (!role || status !== 'playing') return null;
    const self = this.transport?.selfId ?? '';
    const seat = role === 'host' ? 0 : Math.max(0, this.roster.indexOf(self));
    return {
      role,
      mode: this.mode,
      seat,
      players: this.roster.length,
      send: (type, data) => {
        if (this.state.round !== round || this.state.status !== 'playing') return;
        const msg: Envelope = { ch: 'g', round, type, data };
        if (this.state.role === 'host') this.toRoster(msg);
        else if (this.hostId) this.transport?.send(msg, this.hostId);
      },
      on: <T>(type: string, handler: (data: T, seat: number) => void) => {
        const fn = handler as (data: unknown, seat: number) => void;
        const set = this.handlers.get(type) ?? new Set();
        this.handlers.set(type, set);
        set.add(fn);
        const waiting = this.queue.filter((q) => q.msg.type === type);
        this.queue = this.queue.filter((q) => q.msg.type !== type);
        for (const q of waiting) fn(q.msg.data ?? null, q.seat);
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

  // ---------- intern ----------

  private get self() {
    return this.transport?.selfId ?? '';
  }

  private set(patch: Partial<NetState>) {
    this.state = { ...this.state, ...patch };
    this.events.change(this.state);
  }

  private sendTo(id: string, type: string, data?: unknown) {
    this.transport?.send({ ch: 's', round: this.state.round, type, data }, id);
  }

  private toHost(type: string, data?: unknown) {
    if (this.hostId) this.sendTo(this.hostId, type, data);
  }

  private toRoster(msg: Envelope, except?: string) {
    for (const id of this.roster.slice(1)) {
      if (id && id !== except) this.transport?.send(msg, id);
    }
  }

  private open() {
    return this.state.role === 'host' && this.members.length + 1 < this.max;
  }

  /** Host: allen, die noch nicht dazugehören, sagen, ob hier Platz ist. */
  private announce(to?: string) {
    if (this.state.role !== 'host') return;
    const targets = to ? [to] : [...this.known].filter((id) => !this.members.includes(id));
    for (const id of targets) this.sendTo(id, 'host', { open: this.open() });
  }

  /** Ohne Rolle: passenden Host suchen. */
  private evaluate() {
    if (this.state.role || !this.transport || this.closed) return;
    const open = [...this.hosts].filter(([, o]) => o).map(([id]) => id);
    let target: string | null = null;
    if (open.length > 0) target = open.sort()[0] as string;
    else if (this.hosts.size > 0) {
      // Alle Hosts im Raum sind voll. Wird einer frei, meldet er sich.
      this.asked = null;
      if (this.state.status !== 'error') this.set({ status: 'full' });
      return;
    } else {
      const min = [this.self, ...this.known].sort()[0] as string;
      if (min !== this.self) target = min;
    }
    if (target && this.asked !== target) {
      this.asked = target;
      this.sendTo(target, 'ready');
    }
    if (!target) this.asked = null;
    if (this.state.status === 'full') this.set({ status: 'waiting' });
  }

  private becomeHost() {
    this.asked = null;
    this.hostId = null;
    this.members = [];
    this.roster = [];
    this.hosts.clear();
    this.set({
      role: 'host',
      status: 'waiting',
      reason: undefined,
      detail: undefined,
      queued: false,
    });
  }

  /** Zurück auf "ohne Rolle", z. B. wenn der Host oder alle Gäste weg sind. */
  private dropRole(peerLeft: boolean) {
    const wasHost = this.state.role === 'host';
    this.asked = null;
    this.hostId = null;
    this.members = [];
    this.roster = [];
    this.handlers.clear();
    this.queue = [];
    this.set({ status: 'waiting', role: null, peerLeft, players: 1, queued: false, waiting: 0 });
    if (wasHost) for (const id of this.known) this.sendTo(id, 'nohost');
    this.evaluate();
  }

  private lobbyUpdate() {
    const players = this.members.length + 1;
    if (this.state.status === 'playing') {
      this.set({ waiting: this.members.length - (this.roster.length - 1) });
    } else {
      this.set({ players, waiting: 0 });
      for (const id of this.members) this.sendTo(id, 'lobby', { players, max: this.max });
    }
  }

  private startRound(round: number) {
    this.queue = [];
    this.roster = [this.self, ...this.members.slice(0, this.max - 1)];
    this.set({
      status: 'playing',
      round,
      peerLeft: false,
      players: this.roster.length,
      waiting: this.members.length - (this.roster.length - 1),
    });
    for (const id of this.members) this.sendTo(id, 'round', { round, seats: this.roster });
  }

  private onJoin(id: string) {
    if (this.known.has(id)) return;
    this.known.add(id);
    if (this.state.role === 'host') this.announce(id);
    else if (!this.state.role) this.evaluate();
  }

  private onLeave(id: string) {
    this.known.delete(id);
    this.hosts.delete(id);
    if (this.asked === id) this.asked = null;
    const { role, status } = this.state;
    if (role === 'guest') {
      if (id === this.hostId) this.dropRole(status === 'playing');
      return;
    }
    if (role === 'host' && this.members.includes(id)) {
      this.members = this.members.filter((m) => m !== id);
      const seat = this.roster.indexOf(id);
      if (status === 'playing' && seat > 0) {
        this.roster = this.roster.map((r) => (r === id ? null : r));
        const left = this.roster.filter(Boolean).length;
        if (left >= 2) {
          this.set({ players: left });
          this.dispatch({ ch: 'g', round: this.state.round, type: LEFT_MESSAGE, data: seat }, 0);
        } else if (this.members.length > 0) {
          // Nur noch der Host in der Runde, aber Wartende da: neue Runde mit ihnen
          this.startRound(this.state.round + 1);
        } else {
          this.dropRole(true);
          return;
        }
      } else if (this.members.length === 0) {
        this.dropRole(false);
        return;
      }
      this.lobbyUpdate();
      this.announce();
      return;
    }
    this.evaluate();
  }

  private onReady(from: string) {
    if (this.state.role === 'guest') return;
    if (!this.state.role) {
      // Nur Host werden, wenn man selbst niemanden anderen gefragt hat
      if (this.asked && this.asked !== from) return;
      this.becomeHost();
    }
    if (this.members.includes(from)) {
      if (this.state.status === 'playing')
        this.sendTo(from, 'round', { round: this.state.round, seats: this.roster });
      else this.sendTo(from, 'lobby', { players: this.members.length + 1, max: this.max });
      return;
    }
    if (!this.open()) {
      this.sendTo(from, 'host', { open: false });
      return;
    }
    this.members = [...this.members, from];
    if (this.state.status === 'playing') {
      this.sendTo(from, 'round', { round: this.state.round, seats: this.roster });
      this.lobbyUpdate();
    } else if (this.max === 2 || !this.open()) {
      this.startRound(this.state.round + 1);
    } else {
      this.lobbyUpdate();
    }
    this.announce();
  }

  private onMessage(msg: Envelope, from: string) {
    // Nachricht kann vor dem Join-Ereignis ankommen: dann gilt sie als Beitritt
    if (msg.ch === 's' && !this.known.has(from)) this.onJoin(from);
    if (msg.ch === 's') return this.onShell(msg, from);

    const { role, status, round } = this.state;
    if (msg.round !== round || status !== 'playing') return;
    let seat = -1;
    if (role === 'guest' && from === this.hostId) seat = 0;
    if (role === 'host') seat = this.roster.indexOf(from);
    if (seat < 0) return;
    this.dispatch(msg, seat);
  }

  private dispatch(msg: Envelope, seat: number) {
    const set = this.handlers.get(msg.type);
    if (set && set.size > 0) for (const fn of set) fn(msg.data ?? null, seat);
    else this.queue = [...this.queue.slice(-(QUEUE_MAX - 1)), { msg, seat }];
  }

  private onShell(msg: Envelope, from: string) {
    const { role } = this.state;
    const data = (msg.data ?? {}) as Record<string, unknown>;
    switch (msg.type) {
      case 'ready':
        return this.onReady(from);
      case 'host': {
        const open = data.open === true;
        this.hosts.set(from, open);
        if (!role) return this.evaluate();
        // Zwei Gruppen in der Lobby: die mit der größeren Host-ID löst sich auf und geht rüber
        if (role === 'host' && open && from < this.self && this.state.status !== 'playing') {
          for (const id of this.members) this.sendTo(id, 'disband');
          this.dropRole(false);
        }
        return;
      }
      case 'nohost':
        this.hosts.delete(from);
        if (!role) this.evaluate();
        return;
      case 'disband':
        if (role === 'guest' && from === this.hostId) {
          this.hosts.delete(from);
          this.dropRole(false);
        }
        return;
      case 'lobby':
        if (!role && this.asked === from) {
          this.hostId = from;
          this.asked = null;
          this.set({ role: 'guest', reason: undefined, detail: undefined });
        }
        if (this.state.role === 'guest' && from === this.hostId) {
          this.set({ status: 'waiting', players: Number(data.players) || 2, queued: false });
        }
        return;
      case 'round': {
        const seats = Array.isArray(data.seats) ? (data.seats as (string | null)[]) : [];
        const round = Number(data.round);
        if (!Number.isFinite(round)) return;
        if (!role) {
          this.hostId = from;
          this.asked = null;
          this.set({ role: 'guest', reason: undefined, detail: undefined });
        }
        if (this.state.role !== 'guest' || from !== this.hostId) return;
        if (seats.includes(this.self)) {
          this.roster = seats;
          this.queue = [];
          this.set({
            status: 'playing',
            round,
            peerLeft: false,
            players: seats.filter(Boolean).length,
            queued: false,
          });
        } else {
          this.set({ status: 'waiting', queued: true, players: seats.filter(Boolean).length });
        }
        return;
      }
      case 'restart':
        if (role === 'host' && this.roster.includes(from)) this.restart();
        return;
      case 'pause':
        if (msg.round !== this.state.round || this.state.status !== 'playing') return;
        if (role === 'host' && this.roster.includes(from)) {
          this.toRoster(msg, from);
          this.events.pause(msg.data === true);
        } else if (role === 'guest' && from === this.hostId) {
          this.events.pause(msg.data === true);
        }
        return;
    }
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
