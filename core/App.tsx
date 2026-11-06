import { CreditsPage } from './credits/CreditsPage.tsx';
import { GamePage } from './GamePage.tsx';
import { Gallery } from './gallery/Gallery.tsx';
import { parseRoute, useHash } from './router.ts';
import { useApplyTheme } from './sdk/theme.ts';

export function App() {
  useApplyTheme();
  const route = parseRoute(useHash());
  switch (route.page) {
    case 'game':
      return <GamePage key={route.id} id={route.id} room={route.room} localNet={route.localNet} />;
    case 'credits':
      return <CreditsPage game={route.game} />;
    default:
      return <Gallery />;
  }
}
