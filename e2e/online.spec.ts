// Online zu zweit: zwei Tabs im selben Browser, lokaler Transport (net=local), ohne Netz.
import { expect, type Page, test } from '@playwright/test';

async function pair(page: Page, second: Page, game: string) {
  const url = `./#/play/${game}?room=TEST23&net=local`;
  await page.goto(url);
  await expect(page.getByTestId('room-code')).toHaveText('TEST23');
  await second.goto(url);
  await expect(page.getByText('Online', { exact: true })).toBeVisible();
  await expect(page.getByTestId('room-code')).toBeHidden();
  await expect(second.getByTestId('room-code')).toBeHidden();
}

test('Pinguin-Schach: Züge kommen beim Gegner an', async ({ context }) => {
  const a = await context.newPage();
  const b = await context.newPage();
  await pair(a, b, 'pinguin-schach');
  const [white, black] = (await a.getByText(/Du spielst Weiß/).isVisible()) ? [a, b] : [b, a];
  await expect(black.getByText('Dein Gegner ist am Zug')).toBeVisible();
  await white.getByRole('button', { name: /^e2/ }).click();
  await white.getByRole('button', { name: /^e4.*Ziel/ }).click();
  await expect(black.getByRole('button', { name: /^e4, Gegner Bauer/ })).toBeVisible();
  await expect(black.getByText('Dein Zug.')).toBeVisible();
});

test('Stellwerk: Pause und Neustart gelten für beide', async ({ context }) => {
  const a = await context.newPage();
  const b = await context.newPage();
  await pair(a, b, 'stellwerk');
  await a.getByRole('button', { name: 'Pause' }).click();
  await expect(b.getByText('Pause', { exact: true })).toBeVisible();
  await b.getByRole('button', { name: 'Weiter' }).first().click();
  await expect(a.getByText('Pause', { exact: true })).toBeHidden();
  await b.getByRole('button', { name: 'Neu starten' }).click();
  await expect(a.getByRole('img', { name: /Gleisnetz/ })).toBeVisible();
  await expect(b.getByRole('img', { name: /Gleisnetz/ })).toBeVisible();
});

test('Zündschnur: drei Spieler in einem Raum, der Host startet', async ({ context }) => {
  const url = './#/play/zuendschnur?room=BMBX23&net=local';
  const pages = [await context.newPage(), await context.newPage(), await context.newPage()];
  for (const p of pages) await p.goto(url);
  for (const p of pages)
    await expect(p.getByTestId('lobby-players')).toHaveText('3 von 4 Spielern');
  const hosts = [];
  for (const p of pages)
    if (await p.getByRole('button', { name: 'Starten', exact: true }).isVisible()) hosts.push(p);
  expect(hosts).toHaveLength(1);
  await hosts[0]?.getByRole('button', { name: 'Starten', exact: true }).click();
  const seats = new Set<string>();
  for (const p of pages) {
    await expect(p.getByRole('img', { name: /Duell · 3 von 3 übrig/ })).toBeVisible();
    seats.add((await p.getByText(/Du bist Spieler \d/).textContent()) ?? '');
  }
  expect(seats.size).toBe(3);
});
