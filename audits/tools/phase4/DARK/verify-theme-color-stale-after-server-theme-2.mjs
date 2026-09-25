// Phase 4 DARK, skeptic #2: independent re-measure of "theme-color goes stale when the theme comes from the server".
// Differs from theme-color.mjs: waits for the SDK's own 30 s interval pull (no manual hub.pull()), uses a different
// profile (Mae = christian) and themes (Forest / Frost), adds an app-frame-open case and a returning-device control.
//   node audits/tools/phase4/DARK/verify-theme-color-stale-after-server-theme-2.mjs
import fs from 'node:fs';
import path from 'node:path';
import { local, ROOT, sleep } from '../../lib/local.mjs';

const OUTD = path.join(ROOT, 'audits/evidence/p4/DARK');
const P = 'verify-theme-color-stale-after-server-theme-2';
const read = page => page.evaluate(() => ({
  metas: [...document.querySelectorAll('meta[name="theme-color"]')].map(m => m.getAttribute('content')),
  bg: getComputedStyle(document.documentElement).getPropertyValue('--bg').trim(),
  bodyBg: getComputedStyle(document.body).backgroundColor,
  dataTheme: document.documentElement.dataset.theme || null, scheme: document.documentElement.dataset.scheme,
  hubTheme: hub.theme(), lastPull: hub.sync.lastPull,
}));
const match = r => r.metas.every(c => (c || '').toUpperCase() === r.bg.toUpperCase());
const waitTheme = async (page, want, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await page.evaluate(() => hub.theme()) === want) return Date.now() - t0; await sleep(500); } return -1; };
const out = [];
const log = (k, r, extra = {}) => { const o = { case: k, ...r, match: match(r), ...extra }; out.push(o); console.log(k, '| metas', r.metas.join(','), '| --bg', r.bg, '| theme', r.hubTheme, r.scheme, '| match', o.match, JSON.stringify(extra)); };
const L = await local({ variant: 'typical', engine: 'webkit' });
try {
  // A': fresh device, Mae's server row = forest, light OS; no local mirror.
  await L.reset('typical');
  await L.apiAs('christian', '/api/data/hub/theme?scope=person', { method: 'PUT', body: { value: 'forest' } });
  let d = await L.device({ device: 'iphone-pwa', mode: 'light', profile: 'christian' });
  await d.goto('#home'); const tA = await waitTheme(d.page, 'forest', 15000); await sleep(1000);
  log("A' fresh device, server forest, light OS", await read(d.page), { adoptedAfterMs: tA });
  // A'2: navigate between tabs (no reload) — does any tab switch re-sync?
  await d.goto('#me'); await sleep(800); await d.goto('#home'); await sleep(800);
  log("A'2 after Home->Me->Home tab switches", await read(d.page));
  // A'3 control: reload (local mirror now forest, cache adopts before syncThemeColor)
  await d.page.reload({ waitUntil: 'load' }); await sleep(3000);
  log("A'3 after reload (control)", await read(d.page));
  // B': theme changed elsewhere to frost; wait for the SDK's own 30 s interval pull (no manual pull).
  await L.apiAs('christian', '/api/data/hub/theme?scope=person', { method: 'PUT', body: { value: 'frost' } });
  const tB = await waitTheme(d.page, 'frost', 45000); await sleep(800);
  log("B' remote change to frost, natural interval pull", await read(d.page), { adoptedAfterMs: tB });
  // D: an app open in the viewer while the remote change arrives (frost -> forest)
  await d.openApp('tally'); await sleep(1500);
  await L.apiAs('christian', '/api/data/hub/theme?scope=person', { method: 'PUT', body: { value: 'forest' } });
  const tD = await waitTheme(d.page, 'forest', 45000); await sleep(1500);
  log('D app frame open, remote change to forest', await read(d.page), { adoptedAfterMs: tD });
  await d.close();
  // C control: Me theme tap re-syncs.
  d = await L.device({ device: 'iphone-pwa', mode: 'light', profile: 'christian', localStorage: { 'hub.theme': JSON.stringify('forest') } });
  await d.goto('#me'); await sleep(2500);
  await d.page.evaluate(() => document.querySelector('#theme button[data-theme="midnight"]').click()); await sleep(800);
  log('C control: Me tap midnight', await read(d.page));
  await d.close();
} finally { await L.close(); }
fs.writeFileSync(path.join(OUTD, P + '.json'), JSON.stringify({ script: 'audits/tools/phase4/DARK/' + P + '.mjs', out }, null, 1));
