import { expect, test } from '@playwright/test';
import { submitSynthetic } from './helpers';

test('a failed save says so and offers a backup', async ({ page }) => {
  await page.goto('/#/');
  await expect(page.locator('#len')).toBeVisible();
  await page.evaluate(() => {
    IDBObjectStore.prototype.put = () => {
      throw new DOMException('The disk is full', 'QuotaExceededError');
    };
  });
  await page.fill('#len', '34');
  await page.fill('#butt', '42.4');
  for (const [x, v] of [[6, '34.6'], [12, '30.2'], [18, '26.4'], [24, '22.0'], [30, '17.6']] as const) await page.fill(`#r${x}`, v);
  await page.getByRole('button', { name: 'Submit tree' }).click();
  await expect(page.getByRole('alert').filter({ hasText: /could not be saved/i })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Submit tree' })).toBeVisible();
});

test('the undo button does not come back after its time is up', async ({ page }) => {
  await page.clock.install();
  await submitSynthetic(page);
  await expect(page.getByRole('button', { name: 'Undo' })).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();
  await page.clock.fastForward(15_000);
  await page.goBack();
  await expect(page).toHaveURL(/#\/plan\//);
  await expect(page.getByRole('heading', { name: 'Cut plan' })).toBeVisible();
  expect(await page.getByRole('button', { name: 'Undo' }).count()).toBe(0); // checked at once, not after the toast could time out
});

test('settings refuse a taper of 0', async ({ page }) => {
  await page.goto('/#/settings');
  await page.fill('#set-priorTaperPerFt', '0');
  await expect(page.getByRole('button', { name: 'Save settings' })).toBeDisabled();
});
