// Phase 5 UX verify, skeptic s1, items UX-DOLLYWOOD-1/2/3: independent layout measurements of the build guide inside the
// hub viewer (local rig, typical seed, Eli, WebKit). Writes JSON + PNGs under audits/evidence/p5/ux-verify/<item>/s1/.
//   node "audits/tools/phase5/ux-verify/UX-DOLLYWOOD-1/s1-layout.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../../lib/local.mjs';
const EVB = path.resolve('audits/evidence/p5/ux-verify');
const ev = id => { const p = path.join(EVB, id, 's1'); fs.mkdirSync(p, { recursive: true }); return p; };
const out = {};
const log = (k, v) => { out[k] = v; console.log(k, JSON.stringify(v)); };
const shot = async (d, id, name) => { const f = path.join(ev(id), name); await d.page.screenshot({ path: f, scale: 'css', animations: 'disabled', caret: 'hide' }); return path.relative(process.cwd(), f).replace(/\\/g, '/'); };

const geo = () => {
  const R = s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right), h: Math.round(r.height) }; };
  const b = document.getElementById('build');
  return { vw: innerWidth, vh: innerHeight, scrollY: Math.round(scrollY), docH: document.documentElement.scrollHeight,
    map: R('.mapbox'), build: R('#build'), title: R('#b-now h3'), done: R('#b-done'), next: R('#b-next'), show: R('#b-show'), nextun: R('#b-nextun'), side: R('aside.side'),
    step: (document.querySelector('#b-now h3') || {}).textContent, count: (document.getElementById('b-count') || {}).textContent,
    view: (typeof view !== 'undefined' ? view : []).map(Math.round), sheet: b ? b.dataset.state : null };
};
const visMap = g => g.map ? Math.max(0, Math.min(g.map.bottom, g.vh) - Math.max(g.map.top, 0)) : null;

const L = await local({ variant: 'typical', engine: 'webkit' });
try {
  for (const device of ['ipad-portrait', 'ipad-landscape', 'desktop']) {
    const d = await L.device({ device, profile: 'eli', fixedTime: false });
    const f = await d.openApp('dollywood', { wait: '#b-count' });
    await f.waitForFunction(() => /of \d+ done/.test(document.getElementById('b-count').textContent), null, { timeout: 20000 });
    await sleep(800);
    const g0 = await f.evaluate(geo);
    const s0 = await shot(d, 'UX-DOLLYWOOD-1', `${device}-open.png`);
    // the least scroll that brings the whole control row (Prev/Next/Mark done/Show on map) on screen: its bottom at vh-12
    await f.evaluate(() => { const b = document.getElementById('b-done').getBoundingClientRect(); window.scrollTo(0, Math.max(0, scrollY + b.bottom - innerHeight + 12)); });
    await sleep(500);
    const g1 = await f.evaluate(geo);
    const s1 = await shot(d, 'UX-DOLLYWOOD-2', `${device}-min-scroll-to-controls.png`);
    // Next from there: does the page scroll, does the map view change, how much map is on screen
    await f.evaluate(() => document.getElementById('b-next').click()); await sleep(1200);
    const g2 = await f.evaluate(geo);
    const s2 = await shot(d, 'UX-DOLLYWOOD-2', `${device}-after-next.png`);
    await f.evaluate(() => document.getElementById('b-prev').click()); await sleep(1200);
    // Show on map from there
    const v3a = await f.evaluate(() => (typeof view !== 'undefined' ? view : []).map(Math.round));
    await f.evaluate(() => document.getElementById('b-show').click()); await sleep(1200);
    const g3 = await f.evaluate(geo);
    // Mark done twice (steady state within a session): does the control row stay on screen, does the page scroll
    const before = await f.evaluate(geo);
    await f.evaluate(() => document.getElementById('b-done').click()); await sleep(1200);
    const g4 = await f.evaluate(geo);
    await f.evaluate(() => document.getElementById('b-done').click()); await sleep(1200);
    const g5 = await f.evaluate(geo);
    log(device, {
      atOpen: { ...g0, mapVisiblePx: visMap(g0), titleOnScreen: !!(g0.title && g0.title.bottom <= g0.vh), doneOnScreen: !!(g0.done && g0.done.bottom <= g0.vh) },
      minScrollToControls: { ...g1, mapVisiblePx: visMap(g1), mapHeight: g1.map && g1.map.h },
      afterNext: { scrollY: g2.scrollY, step: g2.step, viewBefore: g1.view, viewAfter: g2.view, viewChanged: JSON.stringify(g1.view) !== JSON.stringify(g2.view), mapVisiblePx: visMap(g2) },
      afterShowOnMap: { scrollY: g3.scrollY, viewBefore: v3a, viewAfter: g3.view, mapVisiblePx: visMap(g3) },
      markDoneSteady: { before: { scrollY: before.scrollY, step: before.step, count: before.count }, after1: { scrollY: g4.scrollY, step: g4.step, count: g4.count, doneBottom: g4.done && g4.done.bottom, vh: g4.vh }, after2: { scrollY: g5.scrollY, step: g5.step, count: g5.count, doneBottom: g5.done && g5.done.bottom } },
      shots: [s0, s1, s2],
    });
    await d.close();
  }
  // ---------- iPhone PWA: first screen, then one scroll ----------
  {
    const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
    const f = await d.openApp('dollywood', { wait: '#b-count' });
    await f.waitForFunction(() => /of \d+ done/.test(document.getElementById('b-count').textContent), null, { timeout: 20000 });
    await sleep(800);
    const first = () => {
      const mb = document.querySelector('.mapbox').getBoundingClientRect(), b = document.getElementById('build').getBoundingClientRect();
      const park = [...document.querySelectorAll('#official .mk')].map(m => m.getBoundingClientRect()).filter(r => r.width);
      const cy = r => r.top + r.height / 2;
      const chips = [...document.querySelectorAll('#chips button')].map(c => c.getBoundingClientRect());
      const hdr = document.querySelector('header').getBoundingClientRect();
      return { scrollY: Math.round(scrollY), vh: innerHeight, vw: innerWidth, headerTop: Math.round(hdr.top), headerBottom: Math.round(hdr.bottom), mapTop: Math.round(mb.top), mapBottom: Math.round(mb.bottom), sheetTop: Math.round(b.top), sheet: document.getElementById('build').dataset.state,
        markers: park.length, centreUnderSheet: park.filter(r => cy(r) > b.top).length, centreAboveMapTop: park.filter(r => cy(r) < mb.top).length,
        fullyBetweenMapTopAndSheet: park.filter(r => r.top >= Math.max(mb.top, 0) && r.bottom <= b.top && r.left >= 0 && r.right <= innerWidth).length,
        chipRows: new Set(chips.map(c => Math.round(c.top))).size, chipsFullyVisible: chips.filter(c => c.left >= 0 && c.right <= innerWidth).length, chipsTotal: chips.length,
        mapPxAboveSheet: Math.max(0, Math.round(Math.min(mb.bottom, b.top) - Math.max(mb.top, 0))) };
    };
    const a = await f.evaluate(first);
    const sa = await shot(d, 'UX-DOLLYWOOD-3', 'iphone-pwa-first-screen.png');
    await f.evaluate(() => { const mb = document.querySelector('.mapbox'), tb = document.getElementById('toolbar'); window.scrollTo(0, mb.getBoundingClientRect().top + scrollY - (tb ? tb.offsetHeight : 0) - 6); });
    await sleep(700);
    const b = await f.evaluate(first);
    const sb = await shot(d, 'UX-DOLLYWOOD-3', 'iphone-pwa-after-one-scroll.png');
    // raising the sheet to half for J1 (the report's 4th tap) and ticking
    await f.evaluate(() => window.scrollTo(0, 0)); await sleep(400);
    await f.evaluate(() => document.getElementById('bh-handle').click()); await sleep(700);
    const c = await f.evaluate(() => { const r = document.getElementById('b-done').getBoundingClientRect(); return { sheet: document.getElementById('build').dataset.state, doneTop: Math.round(r.top), doneBottom: Math.round(r.bottom), vh: innerHeight, step: (document.querySelector('#b-now h3') || {}).textContent }; });
    await f.evaluate(() => document.getElementById('b-done').click()); await sleep(1200);
    const c2 = await f.evaluate(() => { const r = document.getElementById('b-done').getBoundingClientRect(); return { sheet: document.getElementById('build').dataset.state, doneTop: Math.round(r.top), doneBottom: Math.round(r.bottom), step: (document.querySelector('#b-now h3') || {}).textContent, count: document.getElementById('b-count').textContent, scrollY: Math.round(scrollY) }; });
    log('iphone-pwa', { firstScreen: a, afterOneScroll: b, halfSheet: c, afterMarkDone: c2, shots: [sa, sb] });
    await d.close();
  }
  // Home: does any Home card open the build guide? (Eli, iPad portrait)
  {
    const d = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
    await d.goto('#home'); await sleep(2500);
    const h = await d.page.evaluate(() => ({ opens: [...document.querySelectorAll('#view-home [data-open]')].map(e => e.dataset.open), mentionsBuildGuide: /Dollywood build|build guide/i.test((document.querySelector('#view-home') || document.body).textContent) }));
    log('home', h);
    await d.close();
  }
} finally {
  for (const id of ['UX-DOLLYWOOD-1', 'UX-DOLLYWOOD-2', 'UX-DOLLYWOOD-3']) fs.writeFileSync(path.join(ev(id), 'layout.json'), JSON.stringify(out, null, 1));
  await L.close();
}
