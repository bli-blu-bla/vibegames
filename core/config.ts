/** GitHub-Repo, z. B. https://github.com/user/vibegames. Im Pages-Build per VITE_REPO_URL gesetzt. */
export const REPO_URL: string | undefined = import.meta.env.VITE_REPO_URL || undefined;

export const issueUrl = (template: string) =>
  REPO_URL ? `${REPO_URL}/issues/new?template=${template}` : undefined;

/**
 * Nostr-Relays, über die sich zwei Browser für ein Online-Spiel finden (nur zum Verbindungsaufbau).
 * Kommagetrennt per VITE_NOSTR_RELAYS. Leer: die Standard-Relays von Trystero.
 */
export const NOSTR_RELAYS: string[] = (import.meta.env.VITE_NOSTR_RELAYS ?? '')
  .split(',')
  .map((url: string) => url.trim())
  .filter((url: string) => url.startsWith('wss://'));

/**
 * TURN-Server für Netze, in denen keine direkte Verbindung klappt (Firewall, Router ohne Hairpinning).
 * VITE_TURN_URLS kommagetrennt (turn:… oder turns:…), dazu VITE_TURN_USERNAME und VITE_TURN_CREDENTIAL.
 * Achtung: Die Zugangsdaten landen im ausgelieferten JavaScript, also nur Free-Tier oder eigene,
 * begrenzte Zugänge verwenden.
 */
const turnUrls = (import.meta.env.VITE_TURN_URLS ?? '')
  .split(',')
  .map((url: string) => url.trim())
  .filter((url: string) => /^turns?:/.test(url));

export const TURN_SERVERS = turnUrls.length
  ? [
      {
        urls: turnUrls,
        username: import.meta.env.VITE_TURN_USERNAME || undefined,
        credential: import.meta.env.VITE_TURN_CREDENTIAL || undefined,
      },
    ]
  : [];
