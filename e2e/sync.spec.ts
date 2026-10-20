import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { submitSynthetic, toCutTotal } from './helpers';

async function exportFile(page: Page, dir: string): Promise<string> {
  await page.goto('/#/sync');
  const dl = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export sync file' }).click();
  const d = await dl;
  const path = `${dir}/${d.suggestedFilename()}`;
  await d.saveAs(path);
  return path;
}

async function importFile(page: Page, path: string): Promise<string> {
  await page.goto('/#/sync');
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Import sync file' }).click();
  await (await chooser).setFiles(path);
  return (await page.getByTestId('sync-msg').textContent()) ?? '';
}

test('two phones end with the same totals after syncing both ways', async ({ browser }, info) => {
  const a = await (await browser.newContext()).newPage();
  const b = await (await browser.newContext()).newPage();
  await submitSynthetic(a);
  await a.getByRole('button', { name: 'Done' }).click();
  await b.goto('/#/add-logs');
  await b.fill('#al-len', '4');
  await b.fill('#al-circ', '13');
  await b.fill('#al-qty', '3');
  await b.getByRole('button', { name: 'Add logs' }).click();
  await expect(b.locator('.row-title', { hasText: '3 × 4 ft · 13.0 in around' })).toBeVisible();

  const dir = info.outputDir;
  const fromA = await exportFile(a, dir);
  expect(await importFile(b, fromA)).toMatch(/Imported: \d+ added/);
  const fromB = await exportFile(b, dir);
  await importFile(a, fromB);

  expect(await toCutTotal(a)).toBe(await toCutTotal(b));
  const needA = await a.getByTestId('needed-list').innerText();
  const needB = await b.getByTestId('needed-list').innerText();
  expect(needA).toBe(needB);

  expect(await importFile(b, fromA)).toContain('0 added, 0 updated, 0 deleted');
});
