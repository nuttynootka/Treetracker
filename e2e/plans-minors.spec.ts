import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const card = (page: Page, name: string) => page.getByTestId('plan-card').filter({ has: page.locator('.plan-name', { hasText: name }) });

async function addLogs(page: Page, len: string, circ: string, qty: string) {
  await page.goto('/#/add-logs');
  await page.fill('#al-len', len);
  await page.fill('#al-circ', circ);
  await page.fill('#al-qty', qty);
  await page.getByRole('button', { name: 'Add logs' }).click();
  await expect(page.getByRole('status').filter({ hasText: `Added ${qty} ×` })).toBeVisible();
}

async function saveAlternative(page: Page, name: string) {
  await page.goto('/#/wall');
  await page.getByLabel('28.3 in around').uncheck();
  await page.getByRole('button', { name: 'Build alternative plans' }).click();
  await page.getByTestId('candidate').first().getByRole('button', { name: 'Save as plan' }).click();
  await page.fill('#plan-name', name);
  await page.getByRole('button', { name: 'Save plan' }).click();
  await expect(page.getByRole('status').filter({ hasText: `Saved "${name}"` })).toBeVisible();
}

async function syncFile(from: Page, to: Page, dir: string) {
  await from.goto('/#/sync');
  const dl = from.waitForEvent('download');
  await from.getByRole('button', { name: 'Export sync file' }).click();
  const d = await dl;
  const path = `${dir}/${Date.now()}-${d.suggestedFilename()}`;
  await d.saveAs(path);
  await to.goto('/#/sync');
  const chooser = to.waitForEvent('filechooser');
  await to.getByRole('button', { name: 'Import sync file' }).click();
  await (await chooser).setFiles(path);
  await expect(to.getByTestId('sync-msg')).toHaveText(/^Imported:/);
}

test('the preview uses the allowed height you set and warns about small averages', async ({ page }) => {
  await page.goto('/#/wall');
  await page.getByRole('button', { name: 'Edit walls' }).click();
  await page.fill('#wbelow', '3');
  await page.getByRole('button', { name: 'Save walls' }).click();
  await addLogs(page, '10', '36.13', '20');
  await addLogs(page, '4', '11', '21');
  await page.goto('/#/plans');
  await page.getByRole('button', { name: 'Plan from my logs' }).click();
  const preview = page.getByTestId('logs-plan');
  await expect(preview).toContainText('One course was added so the wall reaches at least 81.0 in.');
  await expect(preview).toContainText(/interior logs average 11\.0 in around, smaller than the 12\.6 in/i);
});

test('a plan archived on the other phone while in use here can be unarchived', async ({ browser }, info) => {
  const a = await (await browser.newContext()).newPage();
  const b = await (await browser.newContext()).newPage();
  await saveAlternative(a, 'Shared X');
  await syncFile(a, b, info.outputDir);
  await a.goto('/#/plans');
  await card(a, 'Shared X').getByRole('button', { name: 'Use this plan' }).click();
  await card(a, 'Shared X').getByRole('button', { name: 'Yes, use it' }).click();
  await b.goto('/#/plans');
  await card(b, 'Shared X').getByRole('button', { name: 'Archive' }).click();
  await syncFile(b, a, info.outputDir);
  await a.goto('/#/plans');
  await expect(card(a, 'Shared X')).toContainText('Archived on the other phone');
  await card(a, 'Shared X').getByRole('button', { name: 'Unarchive' }).click();
  await expect(card(a, 'Shared X')).not.toContainText('Archived on the other phone');
});

test('the duplicate message says when the matching plan is archived', async ({ page }, info) => {
  await saveAlternative(page, 'Old idea');
  await page.goto('/#/plans');
  const dl = page.waitForEvent('download');
  await card(page, 'Old idea').getByRole('button', { name: 'Export file' }).click();
  const file = `${info.outputDir}/${(await dl).suggestedFilename()}`;
  await (await dl).saveAs(file);
  await card(page, 'Old idea').getByRole('button', { name: 'Archive' }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Import plan file' }).click();
  await (await chooser).setFiles(file);
  await expect(page.getByTestId('plans-msg')).toContainText('in the Archived section');
});
