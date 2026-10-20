import { expect, test } from '@playwright/test';
import { noWideOrBannedText, submitSynthetic, toCutTotal } from './helpers';

test('main screen shows three recommended waist circumferences', async ({ page }) => {
  await page.goto('/#/');
  const tiles = page.locator('.tile .big-num');
  await expect(tiles).toHaveCount(3);
  for (let i = 0; i < 3; i++) await expect(tiles.nth(i)).toHaveText(/^\d+\.\d in$/);
  await expect(page.getByText('around at waist height').first()).toBeVisible();
  await expect(page.getByTestId('trees-needed')).toHaveText(/About \d+ more trees \(\+\d+ spare\)/);
});

test('reading fields follow the tree length', async ({ page }) => {
  await page.goto('/#/');
  await page.fill('#len', '34');
  await expect(page.locator('input[id^="r"]')).toHaveCount(5);
  await page.fill('#len', '36');
  await expect(page.locator('input[id^="r"]')).toHaveCount(5);
  await page.fill('#len', '12.5');
  await expect(page.locator('input[id^="r"]')).toHaveCount(2);
});

test('submit, undo, resubmit, delete, and reload', async ({ page }) => {
  expect(await toCutTotal(page)).toBe(138);
  await submitSynthetic(page);
  const cuts = await page.locator('ol.list li').count();
  expect(cuts).toBeGreaterThanOrEqual(2);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page).toHaveURL(/#\/$/);
  expect(await toCutTotal(page)).toBe(138);

  await submitSynthetic(page);
  const cuts2 = await page.locator('ol.list li').count();
  expect(await toCutTotal(page)).toBe(138 - cuts2);

  await page.goto('/#/trees');
  await page.getByRole('button', { name: 'Edit or delete' }).click();
  await page.getByRole('button', { name: 'Delete…' }).click();
  await page.getByRole('button', { name: 'Yes, delete' }).click();
  await expect(page.getByText('0 trees measured.')).toBeVisible();
  expect(await toCutTotal(page)).toBe(138);

  await page.goto('/#/add-logs');
  await page.fill('#al-len', '9.2');
  await page.fill('#al-circ', '26');
  await page.getByRole('button', { name: 'Add logs' }).click();
  const row = page.locator('.row-title', { hasText: '1 × 10 ft · 26.0 in around' });
  await expect(row).toBeVisible();
  await page.reload();
  await expect(row).toBeVisible();
});

test('every screen fits a 360 px phone and never shows diameters or tree-length advice', async ({ page }) => {
  await submitSynthetic(page);
  for (const path of ['/', '/add-logs', '/needed', '/cut', '/trees', '/reports', '/settings', '/sync', '/wall', '/dev/components']) {
    await page.goto(`/#${path}`);
    await page.waitForTimeout(300);
    await noWideOrBannedText(page);
    if (path === '/' || path === '/reports') {
      const text = await page.evaluate(() => document.body.innerText);
      expect(text).not.toMatch(/\d+(\.\d+)?\s*ft tree|tree.*\d+\s*ft long/i);
    }
  }
});
