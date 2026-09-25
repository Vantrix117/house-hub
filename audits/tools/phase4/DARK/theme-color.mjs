// Phase 4 DARK: does the theme-color meta (the iOS/Android status-bar and browser-chrome colour) follow the theme
// when the theme arrives from the server instead of from a tap in Me?
// index.html:656-658 syncThemeColor() copies --bg into both <meta name="theme-color">; it runs at boot (:1702),
// in enterShell (:624), on a Me theme tap (:1283), on a frame's hub:theme message (:767) and on an OS scheme change
// (:1703). hub.js adoptTheme() (apps/hub.js:97-105), which applies the person's server row after a pull, calls
// applyTheme() and tell(); tell() only posts when inFrame (apps/hub.js:35), so in the shell nothing re-syncs the meta.
//   node audits/tools/phase4/DARK/theme-color.mjs
// Writes audits/evidence/p4/DARK/theme-color.json and theme-color-*.png.
import fs from 'node:fs';
import path from 'node:path';
import { local, ROOT, sleep } from '../../lib/local.mjs';

const OUTD = path.join(ROOT, 'audits/evidence/p4/DARK');
const read = page => page.evaluate(() => ({
  metas: [...document.querySelectorAll('meta[name="theme-color"]')].map(m => `${m.getAttribute('media')}=${m.getAttribute('content')}`),
  bg: getComputedStyle(document.documentElement).getPropertyValue('--bg').trim(),
  bodyBg: getComputedStyle(document.body).backgroundColor,
  dataTheme: document.documentElement.dataset.theme || null, dataScheme: document.documentElement.dataset.scheme,
  lsTheme: localStorage.getItem('hub.theme'), statusBar: document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]').content,
}));
const matches = r => r.metas.every(m => m.split('=')[1].toUpperCase() === r.bg.toUpperCase());
const out = [];
const L = await local({ variant: 'typical', engine: 'webkit' });
try {
  // A: new device (no local theme mirror), Eli's server row says midnight, light OS
  await L.reset('typical');
  await L.apiAs('eli', '/api/data/hub/theme?scope=person', { method: 'PUT', body: { value: 'midnight' } });
  let d = await L.device({ device: 'iphone-pwa', mode: 'light', profile: 'eli' });
  await d.goto('#home'); await sleep(5000);
  let r = await read(d.page); out.push({ case: 'A new device, server row midnight, light OS', ...r, metaMatchesBg: matches(r) });
  await d.shot(path.join(OUTD, 'theme-color-A-iphone-server-midnight.png'));
  // A2: same device reloaded (the local mirror is now written) — control
  await d.page.reload({ waitUntil: 'load' }); await sleep(3000);
  r = await read(d.page); out.push({ case: 'A2 same device after reload', ...r, metaMatchesBg: matches(r) });
  await d.close();
  // B: the theme changes on another device while this one is open (Midnight -> Parchment), then a pull
  await L.reset('typical');
  await L.apiAs('eli', '/api/data/hub/theme?scope=person', { method: 'PUT', body: { value: 'midnight' } });
  d = await L.device({ device: 'iphone-pwa', mode: 'light', profile: 'eli', localStorage: { 'hub.theme': JSON.stringify('midnight') } });
  await d.goto('#home'); await sleep(3000);
  r = await read(d.page); out.push({ case: 'B0 open in midnight', ...r, metaMatchesBg: matches(r) });
  await L.apiAs('eli', '/api/data/hub/theme?scope=person', { method: 'PUT', body: { value: 'parchment' } });
  await d.page.evaluate(() => hub.pull()); await sleep(2500);
  r = await read(d.page); out.push({ case: 'B1 after another device picked parchment + pull', ...r, metaMatchesBg: matches(r) });
  await d.shot(path.join(OUTD, 'theme-color-B-iphone-remote-parchment.png'));
  await d.close();
  // C: control: System theme, OS flips light -> dark while open
  await L.reset('typical');
  d = await L.device({ device: 'iphone-pwa', mode: 'light', profile: 'eli' });
  await d.goto('#home'); await sleep(3000);
  await d.page.emulateMedia({ colorScheme: 'dark' }); await sleep(800);
  r = await read(d.page); out.push({ case: 'C system theme, OS flips to dark', ...r, metaMatchesBg: matches(r) });
  await d.close();
} finally { await L.close(); }
for (const o of out) console.log(o.case, '|', o.metas.join(' '), '| --bg', o.bg, '| theme', o.dataTheme, o.dataScheme, '| match', o.metaMatchesBg);
fs.writeFileSync(path.join(OUTD, 'theme-color.json'), JSON.stringify({ note: 'See header of audits/tools/phase4/DARK/theme-color.mjs', out }, null, 1));
