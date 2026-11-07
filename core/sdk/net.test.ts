import { describe, expect, it } from 'vitest';
import {
  createRoomCode,
  type Envelope,
  NetSession,
  type NetState,
  normalizeRoomCode,
  type TransportFactory,
  type TransportHandlers,
} from './net.ts';

/** Speicher-Netz: alle Teilnehmer sehen sich, Nachrichten werden mit flush() zugestellt. */
function memoryNet() {
  const nodes = new Map<string, TransportHandlers>();
  const pending: (() => void)[] = [];
  const factory =
    (id: string): TransportFactory =>
    async (h) => {
      for (const [other, oh] of nodes) {
        pending.push(() => oh.join(id));
        pending.push(() => h.join(other));
      }
      nodes.set(id, h);
      return {
        selfId: id,
        send: (msg: Envelope, to: string) => pending.push(() => nodes.get(to)?.message(msg, id)),
        leave: () => {
          nodes.delete(id);
          for (const oh of nodes.values()) pending.push(() => oh.leave(id));
        },
      };
    };
  // Mehrere Durchgänge, weil Sitzungen asynchron verbinden und Antworten neue Nachrichten auslösen
  const flush = async () => {
    for (let i = 0; i < 4; i++) {
      await new Promise((r) => setTimeout(r, 0));
      while (pending.length) pending.shift()?.();
    }
  };
  return { factory, flush };
}

function join(net: ReturnType<typeof memoryNet>, id: string, maxPlayers = 2) {
  const log: NetState[] = [];
  const pauses: boolean[] = [];
  const s = new NetSession(
    net.factory(id),
    'versus',
    { change: (st) => log.push(st), pause: (p) => pauses.push(p) },
    maxPlayers,
  );
  return { s, log, pauses };
}

async function settle(net: ReturnType<typeof memoryNet>) {
  for (let i = 0; i < 4; i++) await net.flush();
}

describe('NetSession', () => {
  it('paart zwei Spieler, legt Rollen fest und startet Runde 1', async () => {
    const net = memoryNet();
    const a = join(net, 'a');
    await net.flush();
    expect(a.s.state.status).toBe('waiting');
    const b = join(net, 'b');
    await net.flush();
    await net.flush();
    expect(a.s.state).toMatchObject({ status: 'playing', role: 'host', round: 1 });
    expect(b.s.state).toMatchObject({ status: 'playing', role: 'guest', round: 1 });
  });

  it('stellt Spielnachrichten zu und puffert sie bis zum Anmelden', async () => {
    const net = memoryNet();
    const a = join(net, 'a');
    const b = join(net, 'b');
    await net.flush();
    await net.flush();
    a.s.game()?.send('move', { from: 12, to: 28 });
    await net.flush();
    const got: unknown[] = [];
    b.s.game()?.on('move', (d) => got.push(d));
    expect(got).toEqual([{ from: 12, to: 28 }]);
  });

  it('Neustart vom Gast läuft über den Host, alte Nachrichten verfallen', async () => {
    const net = memoryNet();
    const a = join(net, 'a');
    const b = join(net, 'b');
    await net.flush();
    await net.flush();
    const old = a.s.game();
    b.s.restart();
    await net.flush();
    await net.flush();
    expect(a.s.state.round).toBe(2);
    expect(b.s.state.round).toBe(2);
    old?.send('move', 1);
    await net.flush();
    const got: unknown[] = [];
    b.s.game()?.on('move', (d) => got.push(d));
    expect(got).toEqual([]);
  });

  it('synchronisiert die Pause', async () => {
    const net = memoryNet();
    const a = join(net, 'a');
    const b = join(net, 'b');
    await net.flush();
    await net.flush();
    a.s.pause(true);
    await net.flush();
    expect(b.pauses).toEqual([true]);
  });

  it('weist einen dritten Spieler ab und meldet, wenn der Mitspieler geht', async () => {
    const net = memoryNet();
    const a = join(net, 'a');
    const b = join(net, 'b');
    await net.flush();
    await net.flush();
    const c = join(net, 'c');
    await net.flush();
    await net.flush();
    expect(c.s.state.status).toBe('full');
    expect(a.s.state.status).toBe('playing');
    b.s.close();
    await net.flush();
    // c rückt nach
    expect(a.s.state).toMatchObject({ status: 'playing' });
    expect(c.s.state).toMatchObject({ status: 'playing', round: a.s.state.round });
  });

  it('meldet, wenn der Mitspieler geht', async () => {
    const net = memoryNet();
    const a = join(net, 'a');
    const b = join(net, 'b');
    await net.flush();
    b.s.close();
    await net.flush();
    expect(a.s.state).toMatchObject({ status: 'waiting', peerLeft: true, role: null });
  });
});

describe('NetSession nach Neuladen', () => {
  it('der neue Tab rückt nach, sobald der alte weg ist', async () => {
    const net = memoryNet();
    const a = join(net, 'a');
    const b = join(net, 'b');
    await net.flush();
    await net.flush();
    // b lädt neu: der neue Tab ist da, bevor der alte als gegangen gemeldet wird
    const b2 = join(net, 'b2');
    await net.flush();
    await net.flush();
    expect(b2.s.state.status).toBe('full');
    b.s.close();
    await net.flush();
    await net.flush();
    await net.flush();
    expect(a.s.state).toMatchObject({ status: 'playing', role: 'host' });
    expect(b2.s.state).toMatchObject({ status: 'playing', role: 'guest' });
    expect(b2.s.state.round).toBe(a.s.state.round);
  });

  it('auch wenn der Neue Host wird', async () => {
    const net = memoryNet();
    const m = join(net, 'm');
    const z = join(net, 'z');
    await net.flush();
    await net.flush();
    const a = join(net, 'a');
    await net.flush();
    await net.flush();
    z.s.close();
    await net.flush();
    await net.flush();
    await net.flush();
    expect(a.s.state).toMatchObject({ status: 'playing', role: 'host' });
    expect(m.s.state).toMatchObject({ status: 'playing', role: 'guest' });
  });
});

describe('Raum-Code', () => {
  it('erzeugt gültige Codes und bereinigt Eingaben', () => {
    const code = createRoomCode();
    expect(normalizeRoomCode(code)).toBe(code);
    expect(normalizeRoomCode('abc-def')).toBe('ABCDEF');
    expect(normalizeRoomCode('ABC')).toBeNull();
    expect(normalizeRoomCode('ABCDE0')).toBeNull();
  });
});

describe('NetSession Reihenfolge', () => {
  it('Rundennachricht vor dem Join-Ereignis zählt als Beitritt', async () => {
    let handlers: TransportHandlers | undefined;
    const sent: Envelope[] = [];
    const s = new NetSession(
      async (h) => {
        handlers = h;
        return { selfId: 'z', send: (m) => sent.push(m), leave: () => {} };
      },
      'coop',
      { change: () => {}, pause: () => {} },
    );
    await new Promise((r) => setTimeout(r, 0));
    handlers?.message(
      { ch: 's', round: 1, type: 'round', data: { round: 1, seats: ['a', 'z'] } },
      'a',
    );
    handlers?.join('a');
    expect(s.state).toMatchObject({ status: 'playing', role: 'guest', round: 1 });
    expect(sent.filter((m) => m.type === 'full')).toEqual([]);
  });
});

describe('nostrTransport', () => {
  it('meldet ohne sicheren Kontext einen verständlichen Fehler', async () => {
    const { nostrTransport } = await import('./net.ts');
    const secure = Object.getOwnPropertyDescriptor(globalThis, 'isSecureContext');
    Object.defineProperty(globalThis, 'isSecureContext', { value: false, configurable: true });
    const states: NetState[] = [];
    new NetSession(nostrTransport('snake', 'ABC234'), 'versus', {
      change: (s) => states.push(s),
      pause: () => {},
    });
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    if (secure) Object.defineProperty(globalThis, 'isSecureContext', secure);
    else Reflect.deleteProperty(globalThis, 'isSecureContext');
    expect(states.at(-1)).toMatchObject({ status: 'error', reason: 'insecure' });
  });
});

describe('Verbindungsfehler', () => {
  it('zeigt die Ursache, bis doch ein Mitspieler durchkommt', async () => {
    let handlers: TransportHandlers | undefined;
    const s = new NetSession(
      async (h) => {
        handlers = h;
        return { selfId: 'a', send: () => {}, leave: () => {} };
      },
      'versus',
      { change: () => {}, pause: () => {} },
    );
    await new Promise((r) => setTimeout(r, 0));
    handlers?.fail('could not connect to peer x after exchanging SDP');
    expect(s.state).toMatchObject({ status: 'error', reason: 'p2p' });
    expect(s.state.detail).toContain('SDP');
    handlers?.join('b');
    handlers?.message({ ch: 's', round: 0, type: 'ready' }, 'b');
    expect(s.state).toMatchObject({ status: 'playing', role: 'host', detail: undefined });
  });
});

describe('NetSession mit bis zu vier Spielern', () => {
  it('sammelt Spieler in der Lobby, der Host startet, Plätze sind fest', async () => {
    const net = memoryNet();
    const a = join(net, 'a', 4);
    const b = join(net, 'b', 4);
    const c = join(net, 'c', 4);
    await settle(net);
    expect(a.s.state).toMatchObject({ status: 'waiting', role: 'host', players: 3 });
    expect(b.s.state).toMatchObject({ status: 'waiting', role: 'guest', players: 3 });
    a.s.start();
    await settle(net);
    expect(b.s.state).toMatchObject({ status: 'playing', round: 1, players: 3 });
    expect(a.s.game()).toMatchObject({ seat: 0, players: 3 });
    expect(b.s.game()).toMatchObject({ seat: 1, players: 3 });
    expect(c.s.game()).toMatchObject({ seat: 2, players: 3 });
  });

  it('startet von selbst, wenn der Raum voll ist, und weist den Fünften ab', async () => {
    const net = memoryNet();
    const all = ['a', 'b', 'c', 'd'].map((id) => join(net, id, 4));
    await settle(net);
    for (const p of all) expect(p.s.state).toMatchObject({ status: 'playing', round: 1 });
    const e = join(net, 'e', 4);
    await settle(net);
    expect(e.s.state.status).toBe('full');
  });

  it('Host schickt an alle, Gäste nur an den Host, mit Platz des Absenders', async () => {
    const net = memoryNet();
    const [a, b, c] = ['a', 'b', 'c'].map((id) => join(net, id, 3));
    await settle(net);
    const atHost: [unknown, number][] = [];
    const atC: unknown[] = [];
    a?.s.game()?.on('input', (d, seat) => atHost.push([d, seat]));
    c?.s.game()?.on('input', (d) => atC.push(d));
    c?.s.game()?.on('snap', (d) => atC.push(d));
    b?.s.game()?.send('input', 'b');
    c?.s.game()?.send('input', 'c');
    a?.s.game()?.send('snap', 1);
    await settle(net);
    expect(atHost).toEqual([
      ['b', 1],
      ['c', 2],
    ]);
    expect(atC).toEqual([1]);
  });

  it('wer während der Runde kommt, spielt ab der nächsten mit', async () => {
    const net = memoryNet();
    const a = join(net, 'a', 4);
    const b = join(net, 'b', 4);
    await settle(net);
    a.s.start();
    await settle(net);
    const c = join(net, 'c', 4);
    await settle(net);
    expect(c.s.state).toMatchObject({ status: 'waiting', queued: true, role: 'guest' });
    expect(a.s.state.waiting).toBe(1);
    b.s.restart();
    await settle(net);
    expect(c.s.state).toMatchObject({ status: 'playing', round: 2, queued: false });
    expect(c.s.game()).toMatchObject({ seat: 2, players: 3 });
  });

  it('geht ein Gast, läuft die Runde weiter und der Host erfährt den Platz', async () => {
    const net = memoryNet();
    const [a, b, c] = ['a', 'b', 'c'].map((id) => join(net, id, 4));
    await settle(net);
    a?.s.start();
    await settle(net);
    const left: unknown[] = [];
    a?.s.game()?.on('$left', (seat) => left.push(seat));
    b?.s.close();
    await settle(net);
    expect(left).toEqual([1]);
    expect(a?.s.state).toMatchObject({ status: 'playing', round: 1, players: 2 });
    expect(c?.s.state).toMatchObject({ status: 'playing', round: 1 });
  });

  it('Pause eines Gasts erreicht Host und alle anderen', async () => {
    const net = memoryNet();
    const [a, b, c] = ['a', 'b', 'c'].map((id) => join(net, id, 3));
    await settle(net);
    b?.s.pause(true);
    await settle(net);
    expect(a?.pauses).toEqual([true]);
    expect(c?.pauses).toEqual([true]);
    expect(b?.pauses).toEqual([]);
  });

  it('geht der Host, landen alle wieder in einer neuen Lobby', async () => {
    const net = memoryNet();
    const [a, b, c] = ['a', 'b', 'c'].map((id) => join(net, id, 4));
    await settle(net);
    a?.s.start();
    await settle(net);
    a?.s.close();
    await settle(net);
    expect(b?.s.state).toMatchObject({
      status: 'waiting',
      role: 'host',
      players: 2,
      peerLeft: true,
    });
    expect(c?.s.state).toMatchObject({ status: 'waiting', role: 'guest', players: 2 });
  });
});
