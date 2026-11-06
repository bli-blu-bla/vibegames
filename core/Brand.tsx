/** VibeGames-Marke: vier Kacheln aus den Tokens. */
export function Brand() {
  return (
    <a href="#/" className="brand">
      <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true">
        <rect width="14" height="14" rx="4" style={{ fill: 'var(--accent)' }} />
        <rect x="18" width="14" height="14" rx="4" style={{ fill: 'var(--highlight)' }} />
        <rect y="18" width="14" height="14" rx="4" style={{ fill: 'var(--game-sky)' }} />
        <rect x="18" y="18" width="14" height="14" rx="4" style={{ fill: 'var(--ink)' }} />
      </svg>
      <span className="t-heading">VibeGames</span>
    </a>
  );
}
