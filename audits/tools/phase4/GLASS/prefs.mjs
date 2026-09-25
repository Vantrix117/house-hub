// Phase 4 GLASS — do any glass surfaces respond to the accessibility preferences the house style requires?
// (prefers-reduced-transparency: reduce, prefers-contrast: more; plus forced-colors: active for completeness.)
// For one typical screen per area (Chromium, which implements all three media features): list every visible element
// with a computed backdrop-filter or a shared recipe class, with its backdrop-filter, background-color and
// background-image; then emulate each preference (CDP Emulation.setEmulatedMedia features) and diff. Also asks both
// engines whether they understand the media feature at all (matchMedia(...).media !== 'not all').
//   node audits/tools/phase4/GLASS/prefs.mjs
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { local, sleep, ROOT } from '../../lib/local.mjs';
import { DEVICES } from '../../lib/devices.mjs';
const OUTF = path.join(ROOT, 'audits/evidence/p4/GLASS/prefs.json');
const SCREENS = [
  ['shell', 'home'], ['shell-me', 'chat'], ['shell', 'picker'], ['tv', 'board'], ['f260', 'today'], ['leftovers', 'main'], ['prayer', 'today'], ['tally', 'main'],
  ['timer', 'running'], ['dollywood', 'listing'], ['dollywood-live', 'map'], ['kidverse', 'kid'], ['verses', 'trainer'],
];
const PREFS = [
  ['reduced-transparency', [{ name: 'prefers-reduced-transparency', value: 'reduce' }]],
  ['contrast-more', [{ name: 'prefers-contrast', value: 'more' }]],
];
const snap = () => { const G = ['glass', 'glass-strong', 'btn-glass', 'pill', 'topbar', 'tabbar', 'sheet'];
  return [...document.querySelectorAll('*')].map(e => { const s = getComputedStyle(e); const bf = (s.backdropFilter && s.backdropFilter !== 'none') ? s.backdropFilter : (s.webkitBackdropFilter && s.webkitBackdropFilter !== 'none' ? s.webkitBackdropFilter : null);
    if (!bf && !G.some(c => e.classList.contains(c))) return null; const r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2 || s.display === 'none') return null;
    return { sel: (e.id ? '#' + e.id : e.tagName.toLowerCase()) + (typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\s+/).join('.') : ''), bf, bgc: s.backgroundColor, bgi: s.backgroundImage.slice(0, 120), border: s.borderTopColor, shadow: s.boxShadow.slice(0, 60) }; }).filter(Boolean); };
const understood = () => Object.fromEntries(['(prefers-reduced-transparency: reduce)', '(prefers-reduced-transparency: no-preference)', '(prefers-contrast: more)', '(prefers-contrast: no-preference)', '(forced-colors: active)'].map(q => [q, matchMedia(q).media !== 'not all']));

function mkT(Lx, d, dev) { const page = d.page, ctx = d.ctx; const t = { page, ctx, state: 'typical', device: d.device, mode: 'light', variant: 'typical', profile: d.profile, site: Lx.site, api: Lx.api, dev, loading: false, offline: false, error: false, reopened: false, touch: dev.hasTouch, sleep, async settle() { await sleep(1200); }, frame: () => page.frameLocator('#frame'), async goto(h = '') { await page.goto(Lx.site + '/index.html' + h, { waitUntil: 'load' }); }, async openApp(id, { wait } = {}) { await t.goto('#' + id); await page.waitForSelector('#viewer.on', { timeout: 10000 }).catch(() => {}); const until = Date.now() + 10000; let f; while (Date.now() < until && !(f = page.frames().find(f => f.url().includes(`/apps/${id}.html`)))) await sleep(100); if (f) { await f.waitForLoadState('domcontentloaded').catch(() => {}); if (wait) await f.waitForSelector(wait, { timeout: 10000 }).catch(() => {}); } return f; }, appFrame: id => page.frames().find(f => f.url().includes(`/apps/${id}.html`)), async tap(x, o = {}) { const l = typeof x === 'string' ? page.locator(x).first() : x; if (dev.hasTouch) await l.tap(o); else await l.click(o); }, async tapIn(fl, s, o = {}) { const l = s ? fl.locator(s).first() : fl; if (dev.hasTouch) await l.tap(o); else await l.click(o); }, async hold() {}, async answer() {}, async failApi() {}, async clockTo(w) { await ctx.clock.setFixedTime(new Date(w)); }, async scroll(sel = '#views', y = 'bottom', where = page) { await where.evaluate(([s, y]) => { const el = document.querySelector(s) || document.scrollingElement; el.scrollTop = y === 'bottom' ? el.scrollHeight : y; }, [sel, y]); await sleep(250); } }; return t; }

const out = { note: 'Per area: glass elements (computed backdrop-filter or a shared recipe class) and how many of them change any of backdrop-filter / background-color / background-image / border / box-shadow when each preference is emulated in Chromium. understood = the engine parses the media feature (matchMedia(q).media !== "not all").', engines: {}, areas: {} };
for (const engine of ['webkit', 'chromium']) {
  const Lx = await local({ variant: 'typical', engine });
  try {
    const d = await Lx.device({ device: 'ipad-portrait', profile: 'eli' }); await d.goto('#home'); await sleep(1500);
    out.engines[engine] = await d.page.evaluate(understood); await d.close();
    if (engine === 'webkit') continue;
    for (const [m, screen] of SCREENS) {
      const mod = await import(pathToFileURL(path.join(ROOT, 'audits/tools/areas', m + '.mjs')));
      const scr = mod.screens.find(x => x.screen === screen); const variant = typeof scr.variant === 'object' ? scr.variant.typical : (scr.variant || 'typical');
      await Lx.reset(variant);
      const devName = scr.devices ? scr.devices[0] : 'ipad-portrait';
      const dd = await Lx.device({ device: devName, profile: scr.profile === undefined ? 'eli' : scr.profile });
      try { await scr.go(mkT(Lx, dd, DEVICES[devName])); } catch (e) {}
      await sleep(2000);
      const cdp = await dd.ctx.newCDPSession(dd.page);
      const all = async () => { const r = []; for (const f of dd.page.frames()) r.push(...(await f.evaluate(snap).catch(() => [])).map(x => ({ doc: f === dd.page.mainFrame() ? 'page' : 'frame', ...x }))); return r; };
      const base = await all();
      const rec = { screen: m + '/' + screen, device: devName, glassElements: base.length, liveBlur: base.filter(x => x.bf).length, changed: {} };
      for (const [name, features] of PREFS) {
        await cdp.send('Emulation.setEmulatedMedia', { features }); await sleep(600);
        const now = await all();
        const diff = base.filter((b, i) => { const n = now[i]; return !n || n.bf !== b.bf || n.bgc !== b.bgc || n.bgi !== b.bgi || n.border !== b.border || n.shadow !== b.shadow; });
        const mq = await dd.page.evaluate(q => matchMedia(q).matches, features[0].name === 'forced-colors' ? '(forced-colors: active)' : `(${features[0].name}: ${features[0].value})`);
        rec.changed[name] = { matches: mq, changed: diff.length, examples: diff.slice(0, 3).map(x => x.sel) };
        await cdp.send('Emulation.setEmulatedMedia', { features: [] }); await sleep(300);
      }
      out.areas[mod.area + ':' + screen] = rec;
      console.log(mod.area, screen, JSON.stringify(rec));
      await dd.close();
    }
  } finally { await Lx.close(); }
}
fs.writeFileSync(OUTF, JSON.stringify(out, null, 1));
console.log(JSON.stringify(out.engines));
