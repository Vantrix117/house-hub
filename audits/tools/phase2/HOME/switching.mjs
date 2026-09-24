// HOME brief (3): taps and time to switch apps.
// Part A (taps): for Eli (adult), Ezra (kid) and Grandma Jo (guest) on the iPad, lists which apps Home opens in one tap
// (a [data-open] card button), which need Apps → tile (2 taps), and performs the viewer's routes for real: "Hub"
// (where does it land?), the app name → Switch app sheet → another app, and the sheet's Home button.
// Part B (time): WebKit, ipad-portrait, real clock, site files served with GitHub Pages' Cache-Control (max-age=600).
// For every app: tap its tile on the Apps tab and time tap → the app document's navigation start → DOMContentLoaded →
// hub.ready() resolved → first meaningful content (a per-app, data-driven selector, the same ones the Phase 1 rig waits
// for). "cold" = first open in a fresh browser context; "warm" = the second open in the same context (Hub → tile again).
// Also times an app → app switch through the Switch app sheet. Relative numbers only (Playwright WebKit on Windows,
// local server, no network latency).
//
//   node "audits/tools/phase2/HOME/switching.mjs" [runs=3]
// Writes audits/evidence/p2/HOME/switching.json.
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/HOME');
const RUNS = Number(process.argv[2] || 3);
const APPS = ['f260', 'leftovers', 'prayer', 'tally', 'timer', 'dollywood', 'dollywood-live', 'kidverse', 'verses'];

// Runs in every document. In the shell it stamps each tap; in an app frame it stamps hub.ready() and the first frame
// where that app's meaningful content is on screen.
const INSTRUMENT = () => {
  const now = () => performance.timeOrigin + performance.now();
  if (!/\/apps\//.test(location.pathname)) { addEventListener('click', () => { window.__tap = now(); }, true); return; }
  window.__nav = performance.timeOrigin;
  document.addEventListener('DOMContentLoaded', () => { window.__dcl = now(); });
  let h;
  Object.defineProperty(window, 'hub', { configurable: true, get() { return h; }, set(v) {
    h = v; const orig = v.ready;
    v.ready = function (o) { const p = orig.call(v, o); p.then(() => { if (!window.__ready) window.__ready = now(); }); return p; };
  } });
  const txt = s => { const e = document.querySelector(s); return e && e.getBoundingClientRect().height > 0 ? (e.textContent || '').trim() : ''; };
  const vis = s => { const e = document.querySelector(s); return !!e && e.getBoundingClientRect().height > 0; };
  const id = (location.pathname.match(/apps\/([\w-]+)\.html/) || [])[1];
  const READY = {
    f260: () => !!txt('#todayTitle'),
    leftovers: () => !!txt('#tally'),
    prayer: () => !!txt('#todayLine'),
    tally: () => !!window.__ready && vis('#n'),
    timer: () => !!window.__ready && vis('#t'),
    dollywood: () => vis('#chips button'),
    'dollywood-live': () => !!document.querySelector('#lv-pill[data-state]'),
    kidverse: () => { const t = txt('#ref'); return !!t && t !== '…'; },
    verses: () => vis('#trainer:not([hidden])') || vis('#done:not([hidden])') || vis('#empty:not([hidden])'),
  }[id];
  const poll = () => { try { if (READY && READY()) { window.__fmc = now(); return; } } catch {} requestAnimationFrame(poll); };
  requestAnimationFrame(poll);
};

const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit', siteCacheControl: 'max-age=600' });
const out = { taps: {}, time: {}, switch: [] };

async function stamps(d, id, timeout = 20000) {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    const f = d.frame(id);
    if (f) { const s = await f.evaluate(() => ({ nav: window.__nav, dcl: window.__dcl, ready: window.__ready, fmc: window.__fmc })).catch(() => null); if (s && s.fmc) { const tap = await d.page.evaluate(() => window.__tap); return { tap, ...s }; } }
    await sleep(25);
  }
  return null;
}
const rel = s => s && { navStart: Math.round(s.nav - s.tap), dcl: Math.round(s.dcl - s.tap), hubReady: s.ready ? Math.round(s.ready - s.tap) : null, content: Math.round(s.fmc - s.tap) };
const settle = d => d.page.waitForFunction(() => window.hub && hub.sync.lastPull > 0 && document.querySelectorAll('#grid .tile').length > 0, null, { timeout: 15000 }).catch(() => {});

// ── Part A: taps ──
for (const who of ['eli', 'ezra', 'guest-grandmajo']) {
  const d = await L.device({ device: 'ipad-portrait', profile: who, fixedTime: false });
  await d.ctx.addInitScript(INSTRUMENT);
  await d.goto('#home');
  await d.page.waitForFunction(() => window.hub && hub.sync.lastPull > 0 && document.querySelector('#view-home .card'), null, { timeout: 15000 }).catch(() => {});
  await sleep(500);
  const home = await d.page.evaluate(() => ({ oneTap: [...new Set([...document.querySelectorAll('#view-home [data-open]')].map(b => b.dataset.open))], kidCta: !!document.querySelector('#kid-apps') }));
  await d.page.click('#tabbar .tab[data-tab="apps"]'); await sleep(400);
  const grid = await d.page.evaluate(() => [...document.querySelectorAll('#grid .tile')].map(t => t.dataset.id));
  const first = grid[0], second = grid[1];
  await d.page.click(`#grid .tile[data-id="${first}"]`); await stamps(d, first);
  // "Hub" in the viewer bar: where does it go?
  await d.page.click('#pill-home'); await sleep(400);
  const hubGoesTo = await d.page.evaluate(() => ({ hash: location.hash, tab: document.documentElement.dataset.tab, viewerOpen: document.querySelector('#viewer').classList.contains('on') }));
  // app → app through the sheet (2 taps) and the sheet's Home button (2 taps)
  await d.page.click(`#grid .tile[data-id="${first}"]`); await stamps(d, first);
  await d.page.click('#pill-name'); await sleep(300);
  const sheet = await d.page.evaluate(() => { const s = document.querySelector('.sheet'); return { items: [...s.querySelectorAll('[data-open]')].map(b => ({ id: b.dataset.open, text: b.textContent.trim(), hasIcon: !!b.querySelector('svg,img,.app-icon') })), tabs: [...s.querySelectorAll('[data-open-tab]')].map(b => b.dataset.openTab) }; });
  await d.page.click(`.sheet [data-open="${second}"]`); const sw = await stamps(d, second);
  await d.page.click('#pill-name'); await sleep(300); await d.page.click('.sheet [data-open-tab="home"]'); await sleep(400);
  const sheetHome = await d.page.evaluate(() => ({ hash: location.hash, tab: document.documentElement.dataset.tab }));
  // Escape inside the viewer (desktop keyboard, iPad Magic Keyboard)
  await d.page.click('#tabbar .tab[data-tab="apps"]'); await sleep(300); await d.page.click(`#grid .tile[data-id="${first}"]`); await stamps(d, first);
  await d.page.keyboard.press('Escape'); await sleep(400);
  const esc = await d.page.evaluate(() => document.querySelector('#viewer').classList.contains('on'));
  const tabbarUnderViewer = await d.page.evaluate(() => { const r = document.querySelector('#tabbar').getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !document.querySelector('#tabbar').contains(e); });
  out.taps[who] = { homeOneTap: home.oneTap, kidCta: home.kidCta, appsGrid: grid, twoTaps: grid.filter(x => !home.oneTap.includes(x)), hubButtonGoesTo: hubGoesTo, switchSheet: sheet, sheetHomeGoesTo: sheetHome, escapeClosesViewer: !esc, tabBarHiddenByViewer: tabbarUnderViewer, sheetSwitchMs: rel(sw) };
  console.log(`\n[taps] ${who}: Home opens in 1 tap: ${home.oneTap.join(', ') || '(none)'}${home.kidCta ? ' (+ "Let\'s play" → Apps tab)' : ''}; 2 taps (Apps → tile): ${out.taps[who].twoTaps.join(', ')}`);
  console.log(`        viewer "Hub" lands on ${hubGoesTo.hash} (tab ${hubGoesTo.tab}); tab bar covered by the viewer: ${tabbarUnderViewer}; Escape closes viewer: ${!esc}`);
  console.log(`        Switch app sheet: ${sheet.items.length} apps, with icons: ${sheet.items.filter(i => i.hasIcon).length}; tab buttons ${sheet.tabs.join('/')}; sheet Home lands on ${sheetHome.hash}`);
  await d.close();
}

// ── Part B: time ──
const median = a => { const s = a.filter(x => x != null).sort((x, y) => x - y); return s.length ? s[Math.floor((s.length - 1) / 2)] : null; };
for (const id of APPS) {
  const runs = { cold: [], warm: [] };
  for (let i = 0; i < RUNS; i++) {
    const d = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
    await d.ctx.addInitScript(INSTRUMENT);
    await d.goto('#apps'); await settle(d); await sleep(700);
    await d.page.click(`#grid .tile[data-id="${id}"]`);
    runs.cold.push(rel(await stamps(d, id)));
    await sleep(800);
    await d.page.click('#pill-home'); await sleep(700);
    await d.page.click(`#grid .tile[data-id="${id}"]`);
    runs.warm.push(rel(await stamps(d, id)));
    await d.close();
  }
  const sum = k => ({ navStart: median(runs[k].map(r => r && r.navStart)), dcl: median(runs[k].map(r => r && r.dcl)), hubReady: median(runs[k].map(r => r && r.hubReady)), content: median(runs[k].map(r => r && r.content)), all: runs[k].map(r => r && r.content) });
  out.time[id] = { cold: sum('cold'), warm: sum('warm') };
  console.log(`[time] ${id.padEnd(15)} cold: tap→nav ${out.time[id].cold.navStart} ms, DCL ${out.time[id].cold.dcl}, hub.ready ${out.time[id].cold.hubReady}, content ${out.time[id].cold.content} ms (runs ${out.time[id].cold.all.join('/')}) | warm: content ${out.time[id].warm.content} ms (runs ${out.time[id].warm.all.join('/')}), hub.ready ${out.time[id].warm.hubReady}`);
}

// app → app via the Switch app sheet, and the shell's own Home → Apps tab switch
{
  const d = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  await d.ctx.addInitScript(INSTRUMENT);
  await d.goto('#apps'); await settle(d); await sleep(600);
  await d.page.click('#grid .tile[data-id="leftovers"]'); await stamps(d, 'leftovers'); await sleep(500);
  for (const [a, b] of [['leftovers', 'prayer'], ['prayer', 'f260'], ['f260', 'timer'], ['timer', 'leftovers']]) {
    await d.page.click('#pill-name'); await sleep(250);
    await d.page.click(`.sheet [data-open="${b}"]`);
    const r = rel(await stamps(d, b)); out.switch.push({ from: a, to: b, ...r });
    console.log(`[switch] ${a} → ${b} via sheet: content ${r && r.content} ms after the second tap (hub.ready ${r && r.hubReady})`);
    await sleep(500);
  }
  await d.page.click('#pill-home'); await sleep(500);
  const tabMs = await d.page.evaluate(async () => { const t0 = performance.now(); document.querySelector('#tabbar .tab[data-tab="home"]').click(); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); return Math.round(performance.now() - t0); });
  out.shellTab = { appsToHomeTwoFramesMs: tabMs };
  console.log(`[tab] Apps → Home tab: rendered within ${tabMs} ms (two animation frames after the tap)`);
  await d.close();
}
fs.writeFileSync(path.join(OUT, 'switching.json'), JSON.stringify(out, null, 1));
await L.close();
