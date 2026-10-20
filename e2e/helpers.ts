import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

export const SYNTH = { length: '34', butt: '42.4', readings: ['34.6', '30.2', '26.4', '22.0', '17.6'] };

export async function submitSynthetic(page: Page) {
  await page.goto('/#/');
  await page.fill('#len', SYNTH.length);
  await page.fill('#butt', SYNTH.butt);
  const stations = [6, 12, 18, 24, 30];
  for (let i = 0; i < stations.length; i++) await page.fill(`#r${stations[i]}`, SYNTH.readings[i]);
  await page.getByRole('button', { name: 'Submit tree' }).click();
  await expect(page).toHaveURL(/#\/plan\//);
}

export async function toCutTotal(page: Page): Promise<number> {
  await page.goto('/#/needed');
  const label = await page.getByText(/logs done · \d+ to cut/).textContent();
  return Number(/· (\d+) to cut/.exec(label ?? '')![1]);
}

export async function noWideOrBannedText(page: Page) {
  const { width, text, wide } = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    text: document.body.innerText,
    wide: [...document.querySelectorAll('body *')]
      .filter((el) => el.getBoundingClientRect().right > 361)
      .slice(0, 3)
      .map((el) => `${el.tagName}.${el.className}: ${(el.textContent ?? '').slice(0, 40)}`),
  }));
  expect(width, `${page.url()} too wide: ${wide.join(' | ')}`).toBeLessThanOrEqual(360);
  expect(text).not.toMatch(/diameter|across/i);
}
