// Draws the TreeTracker icon (matte charcoal raised button, three green-foil fir trees) and
// writes every Android launcher icon and splash image. Run: node tools/make-icons.mjs
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const RES = 'android/app/src/main/res';
const BASE = '#E0E5EA';
const FOIL = ['#3f6b5a', '#b9dccb', '#5f8a79', '#e3f3ea', '#355c4d']; // green foil built from the app's green

function tree(cx, base, h, w) {
  const trunkH = h * 0.12;
  const top = base - trunkH - h * 0.88;
  const tiers = [[0, 0.42, 0.55], [0.24, 0.7, 0.8], [0.5, 1, 1]].map(([t0, t1, wf]) => {
    const y0 = top + h * 0.88 * t0, y1 = top + h * 0.88 * t1, hw = (w * wf) / 2;
    return `<path d="M${cx},${y0} L${cx + hw},${y1} L${cx - hw},${y1} Z" fill="url(#foil)"/>`;
  });
  const tw = w * 0.12;
  return tiers.join('') + `<rect x="${cx - tw / 2}" y="${base - trunkH}" width="${tw}" height="${trunkH}" fill="url(#foil)"/>`;
}

/** w×h image; button of radius r (px) centred; bg: 'none' | 'square' | 'rounded' | 'circle'. */
function svg(w, h, r, bg) {
  const cx = w / 2, cy = h / 2, k = r / 150; // tree geometry was drawn for a 150 px button
  const stops = FOIL.map((c, i) => `<stop offset="${(i / (FOIL.length - 1)).toFixed(2)}" stop-color="${c}"/>`).join('');
  const off = Math.max(1, 14 * k), blur = Math.max(1, 14 * k);
  const back = bg === 'square' ? `<rect width="${w}" height="${h}" fill="${BASE}"/>`
    : bg === 'rounded' ? `<rect width="${w}" height="${h}" rx="${w * 0.2}" fill="${BASE}"/>`
    : bg === 'circle' ? `<circle cx="${cx}" cy="${cy}" r="${w / 2}" fill="${BASE}"/>` : '';
  const trees = tree(cx - 52 * k, cy + 62 * k, 104 * k, 66 * k) + tree(cx + 52 * k, cy + 62 * k, 104 * k, 66 * k) + tree(cx, cy + 70 * k, 150 * k, 96 * k);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<defs>
  <linearGradient id="foil" x1="0" y1="0" x2="1" y2="1">${stops}</linearGradient>
  <radialGradient id="matte" cx="0.38" cy="0.32" r="0.85"><stop offset="0" stop-color="#3a4047"/><stop offset="0.6" stop-color="#2b3036"/><stop offset="1" stop-color="#22262b"/></radialGradient>
  <filter id="raise" x="-40%" y="-40%" width="180%" height="180%">
    <feDropShadow dx="${off}" dy="${off}" stdDeviation="${blur}" flood-color="#babec2"/>
    <feDropShadow dx="${-off}" dy="${-off}" stdDeviation="${blur}" flood-color="#f7f8fa"/>
  </filter>
  <filter id="emboss" x="-10%" y="-10%" width="120%" height="120%"><feDropShadow dx="0" dy="${1.5 * k}" stdDeviation="${0.8 * k}" flood-color="#000" flood-opacity="0.45"/></filter>
</defs>${back}
<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#matte)" filter="url(#raise)"/>
<g filter="url(#emboss)">${trees}</g></svg>`;
}

const pngSize = (f) => { const b = readFileSync(f); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
const densities = ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi'];
const jobs = [];
for (const d of densities) {
  const [s] = pngSize(`${RES}/mipmap-${d}/ic_launcher.png`);
  const [fg] = pngSize(`${RES}/mipmap-${d}/ic_launcher_foreground.png`);
  jobs.push([`${RES}/mipmap-${d}/ic_launcher.png`, svg(s, s, s * 0.36, 'rounded'), true]);
  jobs.push([`${RES}/mipmap-${d}/ic_launcher_round.png`, svg(s, s, s * 0.36, 'circle'), true]);
  // Adaptive foreground: keep the button inside the 66/108 safe circle; the launcher supplies the grey background.
  jobs.push([`${RES}/mipmap-${d}/ic_launcher_foreground.png`, svg(fg, fg, fg * 0.3, 'none'), true]);
}
for (const dir of ['drawable', ...['land', 'port'].flatMap((o) => densities.map((d) => `drawable-${o}-${d}`))]) {
  const f = `${RES}/${dir}/splash.png`;
  const [w, h] = pngSize(f);
  jobs.push([f, svg(w, h, Math.min(w, h) * 0.17, 'square'), false]);
}

const browser = await chromium.launch();
const page = await browser.newPage();
for (const [file, s, transparent] of jobs) {
  const [w, h] = [Number(/width="([\d.]+)"/.exec(s)[1]), Number(/height="([\d.]+)"/.exec(s)[1])];
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(`<html><body style="margin:0;background:transparent">${s}</body></html>`);
  await page.screenshot({ path: file, omitBackground: transparent, clip: { x: 0, y: 0, width: w, height: h } });
}
await browser.close();
console.log(`wrote ${jobs.length} images`);
