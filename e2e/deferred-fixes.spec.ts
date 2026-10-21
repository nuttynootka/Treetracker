import { expect, test } from '@playwright/test';
import { submitSynthetic } from './helpers';

test('each cut names the needed row it fills', async ({ page }) => {
  await submitSynthetic(page);
  const items = page.locator('ol.list li');
  expect(await items.count()).toBeGreaterThan(0);
  for (const t of await items.allInnerTexts()) expect(t).toMatch(/fills the \d+ ft · \d+\.\d in around row/);
});

test('a failed export says so', async ({ page }) => {
  await page.goto('/#/sync');
  await expect(page.getByRole('button', { name: 'Export sync file' })).toBeVisible();
  await page.evaluate(() => {
    URL.createObjectURL = () => {
      throw new Error('No space left');
    };
  });
  await page.getByRole('button', { name: 'Export sync file' }).click();
  await expect(page.getByTestId('sync-msg')).toHaveText(/could not be exported.*No space left/i);
});

test('a typed course list must have the largest courses at the bottom', async ({ page }) => {
  await page.goto('/#/wall');
  await page.getByRole('button', { name: 'Build alternative plans' }).click();
  await page.getByTestId('candidate').first().getByRole('button', { name: 'Edit' }).click();
  await page.fill('#ec', '25.2, 28.3, 25.2');
  await page.getByRole('button', { name: 'Compare this plan' }).click();
  await expect(page.getByText(/largest courses at the bottom/i)).toBeVisible();
});

test('a double tap on accept makes only one new version', async ({ page }) => {
  await page.goto('/#/wall');
  await page.getByLabel('28.3 in around').uncheck();
  await page.getByRole('button', { name: 'Build alternative plans' }).click();
  const card = page.getByTestId('candidate').first();
  await card.getByRole('button', { name: 'Accept' }).click();
  await expect(card.getByRole('button', { name: 'Yes, use this plan' })).toBeVisible();
  // Two taps before the screen can redraw, as a fast double tap can do on a phone.
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent === 'Yes, use this plan') as HTMLButtonElement;
    b.click();
    b.click();
  });
  await expect(page.getByRole('status').filter({ hasText: 'Now using the new plan.' })).toBeVisible();
  await page.waitForTimeout(1000); // give a second save time to land if the guard failed
  await page.goto('/#/plans');
  expect(await page.locator('.plan-name').allInnerTexts()).toEqual(['Starting plan', 'Plan 2']);
});
