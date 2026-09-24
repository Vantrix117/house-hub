// HOME brief (1): glanceability from across the room.
// Measures, on the local instance (typical demo household, demo clock), the computed font-size and rendered size of each
// piece of key information on the adult Home (Eli; Elizabeth for the running timer pill) on the iPad in portrait and
// landscape, the kid Home (Ezra), and the kiosk board on the TV (1920×1080) and on the iPad, then converts cap height to
// millimetres and grades it against two named heuristics (see measure.mjs: H1 = distance/200, H2 = distance/344).
//
//   node "audits/tools/phase2/HOME/glance.mjs"
// Writes audits/evidence/p2/HOME/glance.json and 1× screenshots glance-*.png; prints one table per surface.
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';
import { measureText, MM_PER_PX, verdict } from './measure.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/HOME');
fs.mkdirSync(OUT, { recursive: true });

const ADULT = [
  { name: 'hero date kicker', sel: '#view-home .home-hero .hero-kicker' },
  { name: 'hero greeting', sel: '#view-home .home-hero .hero-title' },
  { name: 'hero summary line', sel: '#view-home .home-hero .hero-sub' },
  { name: 'card titles (h2)', sel: '#view-home .gcard h2', all: true },
  { name: 'F260 ring "2/5"', sel: '#view-home .ringwrap.lg .ring-lbl' },
  { name: 'F260 next ref "Acts 6"', sel: '#view-home .gcard:first-child .gbig' },
  { name: 'F260 sub (week/day/streak)', sel: '#view-home .gcard:first-child .gsub' },
  { name: 'fridge "3 to eat this week"', sel: '#view-home .gcard:nth-child(2) .gbig' },
  { name: 'fridge item name + days', sel: '#view-home .fresh .fl span', all: true },
  { name: 'prayer "6 to pray · 3 done"', sel: '#view-home .prayer-card .gbig' },
  { name: 'kids chip "Ezra ★3"', sel: '#view-home .kid-chip', all: true },
  { name: 'reminder text', sel: '#remlist .rem-text', all: true },
  { name: 'reminder byline', sel: '#remlist .rem-by', all: true },
  { name: 'feed name', sel: '#feed .fwho', all: true },
  { name: 'feed line text', sel: '#feed .ftxt', all: true },
  { name: 'feed time ago', sel: '#feed .fwhen', all: true },
  { name: 'card button label', sel: '#view-home .gcard .btn', all: true },
];
const TIMER = [{ name: 'timer pill time "6:20"', sel: '#timer-pill .tp-time' }];
const KID = [
  { name: 'kid hero greeting', sel: '#view-home .home-hero .hero-title' },
  { name: 'kid hero sub', sel: '#view-home .home-hero .hero-sub' },
  { name: 'kid star count', sel: '#view-home .star-big b' },
  { name: 'kid stars line', sel: '#view-home .stars-card .gbig' },
  { name: 'kid CTA', sel: '#kid-apps' },
  { name: 'reminder text', sel: '#remlist .rem-text', all: true },
];
const TV = [
  { name: 'TV date kicker', sel: '#tv-date' },
  { name: 'TV clock', sel: '#clock' },
  { name: 'TV greeting', sel: '#tv-greet' },
  { name: 'TV pane titles (h2)', sel: '#tv .tv-pane h2', all: true },
  { name: 'TV verse refs', sel: '#tv-refs span', all: true },
  { name: 'TV face labels', sel: '#tv .tv-face > span:last-child', all: true },
  { name: 'TV stars "★3"', sel: '#tv-stars .tv-face b', all: true },
  { name: 'TV feed name', sel: '#tv-feed .who', all: true },
  { name: 'TV feed text', sel: '#tv-feed .txt', all: true },
  { name: 'TV feed time', sel: '#tv-feed .when', all: true },
  { name: 'TV reminder text', sel: '#tv-rem-card .rem-text', all: true },
  { name: 'TV reminder byline', sel: '#tv-rem-card .rem-by', all: true },
];

const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const results = {};
const settleHome = d => d.page.waitForFunction(() => window.hub && hub.sync.lastPull > 0 && document.querySelector('#feed .fline'), null, { timeout: 15000 }).catch(() => {});
const settleTv = d => d.page.waitForFunction(() => window.hub && hub.sync.lastPull > 0 && document.querySelector('#tv-refs span') && document.querySelector('#tv-feed li .txt'), null, { timeout: 15000 }).catch(() => {});

async function run(label, device, profile, specs, settle, mmKey, dists) {
  const d = await L.device({ device, profile });
  await d.goto('#home'); await settle(d); await sleep(600);
  const m = await measureText(d.page, specs);
  const doc = await d.page.evaluate(() => ({ vw: innerWidth, vh: innerHeight, scrollH: document.querySelector('#views').scrollHeight, clientH: document.querySelector('#views').clientHeight }));
  const mm = MM_PER_PX[mmKey];
  const rows = [];
  for (const [name, v] of Object.entries(m)) {
    if (!v) { rows.push({ name, missing: true }); continue; }
    const capMm = +(v.capH * mm).toFixed(1);
    rows.push({ name, text: v.text, fontPx: v.fontSize, weight: v.weight, family: v.family, lineBoxPx: v.lineBox, lines: v.lines, capPx: v.capH, digitPx: v.digitH, capMm, top: v.top, aboveFold: v.aboveFold, count: v.count,
      ...Object.fromEntries(dists.map(x => ['@' + x + 'm', verdict(capMm, x)])) });
  }
  results[label] = { device, profile, mmPerPx: mm, viewport: doc, rows };
  await d.page.screenshot({ path: path.join(OUT, `glance-${label}.png`), scale: 'css', animations: 'disabled', caret: 'hide' });
  console.log(`\n== ${label} (${device}, ${profile}; viewport ${doc.vw}×${doc.vh}, content height ${doc.scrollH}; ${mm} mm/px)`);
  console.table(rows.map(r => r.missing ? { name: r.name, text: 'NOT ON SCREEN' } : { name: r.name, text: (r.text || '').slice(0, 26), px: r.fontPx, capPx: r.capPx, capMm: r.capMm, top: r.top, fold: r.aboveFold ? 'above' : 'BELOW', ...Object.fromEntries(dists.map(x => ['@' + x + 'm', r['@' + x + 'm']])) }));
  await d.close();
}

for (const dev of ['ipad-portrait', 'ipad-landscape']) {
  await run(`adult-${dev}`, dev, 'eli', ADULT, settleHome, 'ipad', [2, 3]);
  await run(`timer-${dev}`, dev, 'mom', TIMER, async d => { await settleHome(d); await d.page.waitForSelector('#timer-pill:not([hidden])', { timeout: 6000 }).catch(() => {}); }, 'ipad', [2, 3]);
  await run(`kid-${dev}`, dev, 'ezra', KID, d => d.page.waitForFunction(() => window.hub && hub.sync.lastPull > 0 && document.querySelector('#remlist .rem-text'), null, { timeout: 15000 }).catch(() => {}), 'ipad', [2, 3]);
  await run(`kiosk-${dev}`, dev, 'tv', TV, settleTv, 'ipad', [2, 3]);
}
await run('kiosk-tv', 'tv', 'tv', TV, settleTv, 'tv55', [3]);
// the same TV board on a 43" and a 65" panel: only the mm/px factor changes
for (const k of ['tv43', 'tv65']) {
  const base = results['kiosk-tv'];
  results['kiosk-' + k] = { ...base, mmPerPx: MM_PER_PX[k], rows: base.rows.map(r => r.missing ? r : { ...r, capMm: +(r.capPx * MM_PER_PX[k]).toFixed(1), '@3m': verdict(r.capPx * MM_PER_PX[k], 3) }) };
  console.log(`\n== kiosk board on a ${k.slice(2)}" 1080p TV at 3 m: ` + base.rows.filter(r => !r.missing).map(r => `${r.name} ${(r.capPx * MM_PER_PX[k]).toFixed(1)} mm ${verdict(r.capPx * MM_PER_PX[k], 3)}`).join(' | '));
}
fs.writeFileSync(path.join(OUT, 'glance.json'), JSON.stringify({ heuristics: { H1: 'cap height >= distance/200 (~17 arcmin): 10 mm @2 m, 15 mm @3 m', H2: 'cap height >= distance/344 (10 arcmin, 20/40 threshold): 5.8 mm @2 m, 8.7 mm @3 m' }, mmPerPx: MM_PER_PX, results }, null, 1));
await L.close();
