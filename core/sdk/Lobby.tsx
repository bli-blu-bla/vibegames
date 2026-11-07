import { Copy, Play, ShareNetwork, SpinnerGap, Users } from '@phosphor-icons/react';
import { type FormEvent, useState } from 'react';
import { createRoomCode, type NetMode, type NetState, normalizeRoomCode } from './net.ts';

export const MODE_LABEL: Record<NetMode, string> = {
  versus: 'Zu zweit gegeneinander',
  coop: 'Zu zweit miteinander',
};

/** "Zu zweit gegeneinander" bzw. "Bis zu 4 gegeneinander" */
export function modeLabel(mode: NetMode, players = 2) {
  if (players <= 2) return MODE_LABEL[mode];
  return `Bis zu ${players} ${mode === 'versus' ? 'gegeneinander' : 'miteinander'}`;
}

export const roomHash = (gameId: string, room: string | null, localNet = false) =>
  room ? `#/play/${gameId}?room=${room}${localNet ? '&net=local' : ''}` : `#/play/${gameId}`;

const NOTE =
  'Die Verbindung läuft direkt zwischen euren Browsern. Öffentliche Nostr-Relays helfen nur beim Finden.';

/** Dialog im Solo-Spiel: Raum erstellen oder mit Code beitreten. */
export function OnlineDialog({
  gameId,
  mode,
  players = 2,
  localNet,
  onClose,
}: {
  gameId: string;
  mode: NetMode;
  players?: number;
  localNet: boolean;
  onClose(): void;
}) {
  const [code, setCode] = useState('');
  const valid = normalizeRoomCode(code);
  const go = (room: string) => {
    window.location.hash = roomHash(gameId, room, localNet);
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (valid) go(valid);
  };

  return (
    <div className="shell-lobby" role="dialog" aria-labelledby="online-title">
      <p id="online-title" className="t-heading shell-lobby-title">
        <Users size={24} weight="bold" aria-hidden /> Online spielen
      </p>
      <p className="muted">
        {modeLabel(mode, players)}. Du bekommst einen Code für {players > 2 ? 'deine' : 'deinen'}{' '}
        Mitspieler.
      </p>
      <button type="button" className="btn btn-primary" onClick={() => go(createRoomCode())}>
        Raum erstellen
      </button>
      <form className="shell-join" onSubmit={submit}>
        <label className="t-label muted" htmlFor="room-code">
          CODE
        </label>
        <input
          id="room-code"
          className="shell-input t-mono-small"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="ABC234"
          maxLength={8}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
        />
        <button type="submit" className="btn" disabled={!valid}>
          Beitreten
        </button>
      </form>
      <button type="button" className="btn" onClick={onClose}>
        Abbrechen
      </button>
      <p className="t-small muted shell-message">{NOTE}</p>
    </div>
  );
}

/** Platzhalter statt Spielfeld, solange online noch niemand verbunden ist. */
export function Lobby({
  gameId,
  room,
  state,
  localNet,
  onStart,
}: {
  gameId: string;
  room: string;
  state: NetState;
  localNet: boolean;
  /** Host bei mehr als zwei Spielern: Runde mit allen Anwesenden starten */
  onStart?(): void;
}) {
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}${window.location.pathname}${roomHash(gameId, room, localNet)}`;
  const canShare = typeof navigator.share === 'function';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  const share = () => navigator.share({ title: 'VibeGames', url: link }).catch(() => {});
  const solo = (
    <a className="btn" href={roomHash(gameId, null)}>
      Allein spielen
    </a>
  );

  if (state.status === 'error' && state.reason === 'insecure') {
    const https = window.location.href.replace(/^http:/, 'https:');
    return (
      <div className="shell-lobby" role="status">
        <p className="t-heading">Online braucht HTTPS.</p>
        <p className="muted shell-message">
          Diese Seite ist über http geladen. Browser erlauben die verschlüsselte Verbindung nur über
          https oder localhost. Auf GitHub Pages passt das automatisch.
        </p>
        <a className="btn btn-primary" href={https}>
          Mit https öffnen
        </a>
        {solo}
      </div>
    );
  }

  if (state.status === 'error' && state.reason === 'p2p') {
    return (
      <div className="shell-lobby" role="status">
        <p className="t-heading">Mitspieler gefunden, aber keine Verbindung.</p>
        <p className="muted shell-message">
          Euer Netz lässt keine direkte Verbindung zwischen den Browsern zu (Firewall, VPN oder
          Router). Abhilfe schafft ein TURN-Server in der Konfiguration. Ein anderes Netz, z. B. ein
          Handy-Hotspot, klappt oft auch.
        </p>
        <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
          Nochmal versuchen
        </button>
        {solo}
      </div>
    );
  }

  if (state.status === 'full' || state.status === 'error') {
    return (
      <div className="shell-lobby" role="status">
        <p className="t-heading">
          {state.status === 'full' ? 'Der Raum ist schon voll.' : 'Keine Verbindung zum Netz.'}
        </p>
        <p className="muted shell-message">
          {state.status === 'full'
            ? `Hier spielen schon ${state.maxPlayers === 2 ? 'zwei' : state.maxPlayers}. Erstelle einen neuen Raum.`
            : 'Die Nostr-Relays sind gerade nicht erreichbar. Versuch es gleich noch mal.'}
        </p>
        {state.status === 'error' && <ErrorDetail detail={state.detail} />}
        <a className="btn btn-primary" href={roomHash(gameId, createRoomCode(), localNet)}>
          Neuer Raum
        </a>
        {solo}
      </div>
    );
  }

  const paired = state.role !== null;
  const group = state.maxPlayers > 2;
  const canStart = group && state.role === 'host' && state.players >= 2;
  const title =
    state.status === 'connecting'
      ? 'Verbinde …'
      : state.queued
        ? 'Die Runde läuft schon. Du bist ab der nächsten dabei.'
        : group && paired
          ? state.role === 'host'
            ? 'Starte, wenn alle da sind'
            : 'Verbunden, der Host startet …'
          : paired
            ? 'Verbunden, gleich geht es los …'
            : state.peerLeft
              ? 'Dein Mitspieler ist gegangen.'
              : 'Warte auf Mitspieler';

  return (
    <div className="shell-lobby" role="status">
      <p className="t-heading shell-lobby-title">
        <SpinnerGap size={24} className="shell-spin" aria-hidden /> {title}
      </p>
      {group && (
        <p className="t-mono-small muted" data-testid="lobby-players">
          {state.players} von {state.maxPlayers} Spielern
        </p>
      )}
      {canStart && (
        <button type="button" className="btn btn-primary" onClick={onStart}>
          <Play size={20} weight="fill" /> Starten
        </button>
      )}
      <p className="t-label muted">CODE</p>
      <p className="t-score shell-code" data-testid="room-code">
        {room}
      </p>
      <p className="muted shell-message">
        Schick den Link oder den Code weiter. Der Code lässt sich auch unter „Online spielen“
        eingeben.
      </p>
      <div className="shell-lobby-actions">
        <button type="button" className={canStart ? 'btn' : 'btn btn-primary'} onClick={copy}>
          <Copy size={20} /> {copied ? 'Kopiert' : 'Link kopieren'}
        </button>
        {canShare && (
          <button type="button" className="btn" onClick={share}>
            <ShareNetwork size={20} /> Teilen
          </button>
        )}
        {solo}
      </div>
      <p className="t-small muted shell-message">{NOTE}</p>
    </div>
  );
}

/** Technische Ursache klein darunter, zum Weitergeben in einem Bug-Report */
function ErrorDetail({ detail }: { detail?: string }) {
  if (!detail) return null;
  return <p className="t-mono-small muted shell-message shell-detail">Technisch: {detail}</p>;
}
