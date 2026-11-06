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
