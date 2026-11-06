// Echter Verbindungsaufbau über öffentliche Nostr-Relays. Braucht Internet, darum nur auf Wunsch:
//   NOSTR_E2E=1 npx playwright test e2e/nostr.spec.ts
import { expect, test } from '@playwright/test';

test.skip(!process.env.NOSTR_E2E, 'nur mit NOSTR_E2E=1');

test('Pinguin-Schach verbindet zwei Browser über Nostr', async ({ browser }) => {
  test.setTimeout(90_000);
  const room = `#/play/pinguin-schach?room=N${Date.now()
    .toString(36)
    .slice(-5)
    .toUpperCase()
    .replace(/[01ILO]/g, 'X')}`;
  const a = await (await browser.newContext()).newPage();
  const b = await (await browser.newContext()).newPage();
  await a.goto(`./${room}`);
  await b.goto(`./${room}`);
  for (const p of [a, b]) {
    await expect(p.getByTestId('room-code')).toBeHidden({ timeout: 60_000 });
    await expect(p.getByRole('region', { name: 'Schachbrett' })).toBeVisible();
  }
  const [white, black] = (await a.getByText(/Du spielst Weiß/).isVisible()) ? [a, b] : [b, a];
  await white.getByRole('button', { name: /^e2/ }).click();
  await white.getByRole('button', { name: /^e4.*Ziel/ }).click();
  await expect(black.getByRole('button', { name: /^e4, Gegner Bauer/ })).toBeVisible();
});
