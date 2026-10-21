import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const card = (page: Page, name: string) => page.getByTestId('plan-card').filter({ has: page.locator('.plan-name', { hasText: name }) });

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

test('using a plan and switching back both ask first', async ({ page }) => {
  await saveAlternative(page, 'Thin');
  await page.goto('/#/plans');
  await card(page, 'Thin').getByRole('button', { name: 'Use this plan' }).click();
  await expect(card(page, 'Thin')).toContainText('hand edits');
  await expect(card(page, 'Thin')).not.toContainText('In use');
  await card(page, 'Thin').getByRole('button', { name: 'Yes, use it' }).click();
  await expect(card(page, 'Thin')).toContainText('In use');
  await page.getByRole('button', { name: 'Switch back to "Starting plan"' }).click();
  await expect(page.getByText(/Switch back to "Starting plan"\? .*hand edits/)).toBeVisible();
  await page.getByRole('button', { name: 'Yes, switch back' }).click();
  await expect(card(page, 'Starting plan')).toContainText('In use');
});

test('a plan in use that the other phone deleted is kept, with a notice', async ({ browser }, info) => {
  const a = await (await browser.newContext()).newPage();
  const b = await (await browser.newContext()).newPage();
  await saveAlternative(a, 'Shared X');
  await syncFile(a, b, info.outputDir);
  await a.goto('/#/plans');
  await card(a, 'Shared X').getByRole('button', { name: 'Use this plan' }).click();
  await card(a, 'Shared X').getByRole('button', { name: 'Yes, use it' }).click();
  await b.goto('/#/plans');
  await card(b, 'Shared X').getByRole('button', { name: 'Delete…' }).click();
  await card(b, 'Shared X').getByRole('button', { name: 'Yes, delete' }).click();
  await syncFile(b, a, info.outputDir);
  await expect(a.getByRole('alert').filter({ hasText: /"Shared X".*deleted on the other phone/ })).toBeVisible();
  await a.goto('/#/needed');
  await expect(a.getByText('Wall plan: Shared X.')).toBeVisible();
  await expect(a.getByRole('button', { name: /16 ft · 25\.2 in around.*need 22/ })).toBeVisible();
});
