import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

async function addLogs(page: Page, len: string, circ: string, qty: string) {
  await page.goto('/#/add-logs');
  await page.fill('#al-len', len);
  await page.fill('#al-circ', circ);
  await page.fill('#al-qty', qty);
  await page.getByRole('button', { name: 'Add logs' }).click();
  await expect(page.getByRole('status').filter({ hasText: `Added ${qty} ×` })).toBeVisible();
}

async function saveLogsPlan(page: Page, name: string) {
  await addLogs(page, '10', '29', '20');
  await addLogs(page, '4', '15', '21');
  await page.goto('/#/plans');
  await page.getByRole('button', { name: 'Plan from my logs' }).click();
  const preview = page.getByTestId('logs-plan');
  await expect(preview).toContainText('9 courses stack to 83.1 in');
  await expect(preview).toContainText('18 courses stack to 85.9 in');
  await expect(preview).toContainText('at least 18.9 in around');
  await expect(preview).toContainText('at least 12.6 in around');
  await preview.getByRole('button', { name: 'Save as plan' }).click();
  await page.fill('#plan-name', name);
  await page.getByRole('button', { name: 'Save plan' }).click();
  await expect(page.getByTestId('plans-msg')).toContainText(`Saved "${name}"`);
}

const card = (page: Page, name: string) => page.getByTestId('plan-card').filter({ has: page.locator('.plan-name', { hasText: name }) });

test('plan from my logs needs more than 40 logs', async ({ page }) => {
  await page.goto('/#/plans');
  await expect(page.getByRole('button', { name: 'Plan from my logs' })).toBeDisabled();
  await expect(page.getByText('Needs more than 40 logs recorded. You have 0.')).toBeVisible();
});

test('save the plan from my logs, use it, and switch back', async ({ page }) => {
  await saveLogsPlan(page, 'Big and small');
  await expect(card(page, 'Big and small')).not.toContainText('In use');
  await card(page, 'Big and small').getByRole('button', { name: 'Use this plan' }).click();
  await expect(card(page, 'Big and small')).toContainText('In use');
  await page.goto('/#/needed');
  await expect(page.getByText('Wall plan: Big and small.')).toBeVisible();
  await expect(page.getByRole('button', { name: /16 ft · 18\.9 in around/ })).toBeVisible();
  await page.goto('/#/plans');
  await page.getByRole('button', { name: 'Switch back to "Starting plan"' }).click();
  await expect(card(page, 'Starting plan')).toContainText('In use');
});

test('rename, archive, unarchive and delete; the plan in use is protected', async ({ page }) => {
  await saveLogsPlan(page, 'Draft');
  await expect(card(page, 'Starting plan').getByRole('button', { name: 'Archive' })).toHaveCount(0);
  await expect(card(page, 'Starting plan').getByRole('button', { name: 'Delete…' })).toHaveCount(0);
  await card(page, 'Draft').getByRole('button', { name: 'Rename' }).click();
  await page.fill('#plan-name', 'Draft 2');
  await page.getByRole('button', { name: 'Save name' }).click();
  await card(page, 'Draft 2').getByRole('button', { name: 'Archive' }).click();
  await expect(page.getByText('Archived (1)')).toBeVisible();
  await page.getByText('Archived (1)').click();
  await card(page, 'Draft 2').getByRole('button', { name: 'Unarchive' }).click();
  await expect(page.getByText(/Archived \(/)).toHaveCount(0);
  await card(page, 'Draft 2').getByRole('button', { name: 'Delete…' }).click();
  await card(page, 'Draft 2').getByRole('button', { name: 'Yes, delete' }).click();
  await expect(page.locator('.plan-name')).toHaveText(['Starting plan']);
});

test('export a plan file and import it on another phone, once', async ({ browser }, info) => {
  const a = await (await browser.newContext()).newPage();
  await saveLogsPlan(a, 'Shared plan');
  const dl = a.waitForEvent('download');
  await card(a, 'Shared plan').getByRole('button', { name: 'Export file' }).click();
  const file = `${info.outputDir}/${(await dl).suggestedFilename()}`;
  await (await dl).saveAs(file);

  const b = await (await browser.newContext()).newPage();
  const importIt = async () => {
    await b.goto('/#/plans');
    const chooser = b.waitForEvent('filechooser');
    await b.getByRole('button', { name: 'Import plan file' }).click();
    await (await chooser).setFiles(file);
  };
  await importIt();
  await expect(b.getByTestId('plans-msg')).toContainText('Imported "Shared plan"');
  await expect(card(b, 'Shared plan')).not.toContainText('In use');
  await importIt();
  await expect(b.getByTestId('plans-msg')).toContainText('already in your list as "Shared plan"');
  await expect(b.locator('.plan-name')).toHaveText(['Starting plan', 'Shared plan']);
});
