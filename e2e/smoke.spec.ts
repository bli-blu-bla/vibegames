// Smoke-Test: Galerie, Credits und jedes Spiel laden ohne Fehler.
import { readdirSync } from 'node:fs';
import { expect, type Page, test } from '@playwright/test';

const games = readdirSync('games', { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  return errors;
}

test('Galerie zeigt jedes Spiel', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('./');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.locator('.game-card')).toHaveCount(games.length);
  expect(errors).toEqual([]);
});

test('Credits-Seite lädt', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('./#/credits');
  await expect(page.getByRole('heading', { name: 'Credits' })).toBeVisible();
  expect(errors).toEqual([]);
});

for (const id of games) {
  test(`Spiel ${id} startet, pausiert und startet neu`, async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto(`./#/play/${id}`);
    await expect(page.getByTestId('score')).toBeVisible();
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: 'Pause' }).click();
    await expect(page.getByText('Pause', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Neu starten' }).click();
    await expect(page.getByTestId('score')).toBeVisible();
    expect(errors).toEqual([]);
  });
}
