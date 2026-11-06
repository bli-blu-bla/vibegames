import { useSyncExternalStore } from 'react';
import { normalizeRoomCode } from './sdk/net.ts';

export type Route =
  | { page: 'gallery' }
  | { page: 'game'; id: string; room: string | null; localNet: boolean }
  | { page: 'credits'; game: string | null };

/**
 * Hash-Routing (#/play/snake), damit GitHub Pages ohne 404-Tricks funktioniert.
 * Online: #/play/<id>?room=ABC234, zum Testen mit zwei Tabs zusätzlich &net=local.
 */
export function parseRoute(hash: string): Route {
  const [path = '', query = ''] = hash.replace(/^#/, '').split('?');
  const parts = path.split('/').filter(Boolean);
  const params = new URLSearchParams(query);
  if (parts[0] === 'play' && parts[1]) {
    return {
      page: 'game',
      id: parts[1],
      room: normalizeRoomCode(params.get('room') ?? ''),
      localNet: params.get('net') === 'local',
    };
  }
  if (parts[0] === 'credits') return { page: 'credits', game: params.get('game') };
  return { page: 'gallery' };
}

const subscribe = (cb: () => void) => {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
};

export function useHash(): string {
  return useSyncExternalStore(subscribe, () => window.location.hash);
}
