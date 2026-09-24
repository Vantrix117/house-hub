// Phase 3 / dollywood: taps from Home to finish each top job, driven with real pointer clicks at element centres
// (page.mouse through the shell viewer's iframe), as Eli, typical seed, WebKit. Every tap and every typed entry counts.
//   J1 tick the step just built ("Mark done")                  — iPhone PWA, iPad portrait, desktop
//   J2 read what to build next (the current step's text on screen) — iPhone PWA, iPad portrait
//   J3 look up one listing's card (Thunderhead)                 — iPhone PWA, iPad portrait
//   J4 cut a cross-section and see the profile                  — iPad portrait
// Home has no build-guide card (index.html renderHome; no data-open="dollywood"), so every path starts Apps -> tile.
//   node "audits/tools/phase3/dollywood/taps.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';
const EV = path.resolve('audits/evidence/p3/dollywood');
const out = [];
const L = await local({ variant: 'typical', engine: 'webkit' });
async function run(device, job, steps, check) {
  await L.reset('typical');
  const d = await L.device({ device, profile: 'eli', fixedTime: false });
  await d.goto('#home'); await sleep(1500);
  const homeCard = await d.page.evaluate(() => !!document.querySelector('[data-open="dollywood"]'));
  let taps = 0, typed = 0; const trail = [];
  const frame = () => d.frame('dollywood');
  const centre = async (sel, inFrame) => {
    const f = inFrame ? frame() : d.page;
    const el = await f.waitForSelector(sel, { state: 'attached', timeout: 15000 });
    await el.evaluate(e => e.scrollIntoView({ block: 'center', inline: 'center' })).catch(() => {});
    await sleep(250);
    const b = await el.boundingBox();   // page coordinates (Playwright maps frame elements to the page)
    return { x: b.x + b.width / 2, y: b.y + b.height / 2, vis: await el.isVisible() };
  };
  for (const s of steps) {
    if (s.wait) { await s.wait(frame, d); continue; }
    if (s.type) { const f = frame(); await f.fill(s.sel, s.type); typed++; trail.push(`type "${s.type}"`); await sleep(s.after || 900); continue; }
    if (s.mapAt) { const f = frame(); const r = await (await f.$('svg#map')).boundingBox(); await d.page.mouse.click(r.x + r.width * s.mapAt[0], r.y + Math.min(r.height * s.mapAt[1], 1100 - r.y)); taps++; trail.push('map point'); await sleep(500); continue; }
    const c = await centre(s.sel, s.frame);
    await d.page.mouse.click(c.x, c.y); taps++; trail.push(s.label + (c.vis ? '' : ' (was hidden)')); await sleep(s.after || 700);
    if (s.afterFrameLoad) { const until = Date.now() + 15000; while (!frame() && Date.now() < until) await sleep(100); await frame().waitForFunction(() => /of \d+ done/.test((document.getElementById('b-count') || {}).textContent || ''), null, { timeout: 20000 }); await sleep(800); }
  }
  const done = await check(frame(), d);
  const res = { device, job, homeCard, taps, typed, total: taps + typed, path: trail.join(' → '), done };
  out.push(res); console.log(JSON.stringify(res));
  await d.close();
}
const OPEN = [{ sel: '#tabbar .tab[data-tab="apps"]', label: 'Apps tab' }, { sel: '.tile[data-id="dollywood"]', label: 'Build guide tile', afterFrameLoad: true }];
const serverTicks = async () => { const r = await L.apiAs('eli', '/api/data/dollywood?scope=person&since=0'); const it = r.body.items.find(i => i.key === 'progress'); return it ? Object.keys(it.value).length : 0; };
try {
  // J1 Mark done
  await run('iphone-pwa', 'J1 tick the step', [...OPEN, { sel: '#bh-handle', label: 'sheet handle (peek → half)', frame: true }, { sel: '#b-done', label: 'Mark done', frame: true, after: 2000 }], async () => ({ serverTicks: await serverTicks(), expect: 25 }));
  await run('ipad-portrait', 'J1 tick the step', [...OPEN, { sel: '#b-done', label: 'Mark done (scrolled to; below the fold)', frame: true, after: 2000 }], async f => ({ serverTicks: await serverTicks(), expect: 25, cardTopBeforeScroll: null }));
  await run('desktop', 'J1 tick the step', [...OPEN, { sel: '#b-done', label: 'Mark done (scrolled to; below the fold)', frame: true, after: 2000 }], async () => ({ serverTicks: await serverTicks(), expect: 25 }));
  // J2 read what to build next
  await run('iphone-pwa', 'J2 read the current step', [...OPEN, { sel: '#bh-handle', label: 'sheet handle (peek → half)', frame: true }], async f => f.evaluate(() => { const h = document.querySelector('#b-now h3').getBoundingClientRect(), p = document.querySelector('#b-now p').getBoundingClientRect(); return { titleOnScreen: h.top >= 0 && h.bottom <= innerHeight, bodyOnScreen: p.top >= 0 && p.bottom <= innerHeight }; }));
  await run('ipad-portrait', 'J2 read the current step', [...OPEN], async f => f.evaluate(() => { const h = document.querySelector('#b-now h3').getBoundingClientRect(); return { titleTopPx: Math.round(h.top), viewportH: innerHeight, onScreenWithoutScrolling: h.bottom <= innerHeight }; }));
  // J3 one listing's card
  await run('iphone-pwa', 'J3 look up Thunderhead', [...OPEN, { sel: '#more-btn', label: 'More', frame: true }, { sel: '#q', type: 'thunder' }], async f => f.evaluate(() => ({ cardOpen: document.getElementById('pop').classList.contains('show'), title: (document.querySelector('#pop h2') || {}).textContent })));
  await run('ipad-portrait', 'J3 look up Thunderhead', [...OPEN, { sel: '#q', type: 'thunder' }], async f => f.evaluate(() => ({ cardOpen: document.getElementById('pop').classList.contains('show'), title: (document.querySelector('#pop h2') || {}).textContent })));
  // J4 cross-section
  await run('ipad-portrait', 'J4 cross-section', [...OPEN, { sel: '#t-sec', label: 'Cross-section', frame: true }, { mapAt: [0.3, 0.5] }, { mapAt: [0.7, 0.55] }], async f => f.evaluate(() => { const p = document.getElementById('prof').getBoundingClientRect(); return { title: document.getElementById('ptitle').textContent, profileTopPx: Math.round(p.top), viewportH: innerHeight, profileOnScreen: p.top < innerHeight }; }));
} finally {
  fs.writeFileSync(path.join(EV, 'taps.json'), JSON.stringify(out, null, 1));
  await L.close();
}
