import { expect, test } from '@playwright/test';

test('accept 11 courses of 25.2 in, then undo', async ({ page }) => {
  await page.goto('/#/wall');
  await page.getByLabel('28.3 in around').uncheck();
  await page.getByRole('button', { name: 'Build alternative plans' }).click();
  const card = page.getByTestId('candidate').filter({ hasText: 'Exterior: 11 × 25.2 in' });
  await expect(card).toBeVisible({ timeout: 60_000 });
  await card.getByRole('button', { name: 'Accept' }).click();
  await card.getByRole('button', { name: 'Yes, use this plan' }).click();

  await page.goto('/#/needed');
  await expect(page.getByRole('button', { name: /16 ft · 25\.2 in around.*need 22/ })).toBeVisible();
  await expect(page.getByText('Wall plan version 2')).toBeVisible();

  await page.goto('/#/wall');
  await page.getByRole('button', { name: /Undo: go back to version 1/ }).click();
  await page.goto('/#/needed');
  await expect(page.getByRole('button', { name: /16 ft · 28\.3 in around.*need 8/ })).toBeVisible();
});
