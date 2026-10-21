import { expect, test } from '@playwright/test';

// Capacitor passes the status bar and navigation bar sizes to the page as --safe-area-inset-* variables.
// Set them as an Android phone would, and check nothing sits under the bars.
test('content stays clear of the status bar and the navigation bar', async ({ page }) => {
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      document.documentElement.style.setProperty('--safe-area-inset-top', '40px');
      document.documentElement.style.setProperty('--safe-area-inset-bottom', '48px');
    });
  });
  await page.goto('/#/');
  const first = page.locator('main.screen > *').first();
  await expect(first).toBeVisible();
  expect((await first.boundingBox())!.y).toBeGreaterThanOrEqual(40);

  const total = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const lastButton = page.getByRole('button', { name: 'Sync', exact: true });
  const box = (await lastButton.boundingBox())!;
  expect(box.y + box.height).toBeLessThanOrEqual(800 - 48);
  expect(total).toBeGreaterThan(0);

  await page.goto('/#/dev/components');
  await page.getByRole('button', { name: 'Show toast' }).click();
  const toast = (await page.locator('.toast').boundingBox())!;
  expect(toast.y + toast.height).toBeLessThanOrEqual(800 - 48);
  await page.getByRole('button', { name: 'Open sheet' }).click();
  const save = (await page.getByRole('button', { name: 'Save' }).boundingBox())!;
  expect(save.y + save.height).toBeLessThanOrEqual(800 - 48);
});
