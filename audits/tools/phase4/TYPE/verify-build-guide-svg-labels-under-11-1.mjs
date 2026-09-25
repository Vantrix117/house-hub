// Phase 4 skeptic #1: re-measure the build guide's SVG map annotations (section labels, listing numbers, contour
// labels, profile axis labels) on the local instance. Own probe; navigation reuses areas/dollywood.mjs screens (read-only import).
// Effective px = computed font-size x sqrt|det(getScreenCTM)|, cross-checked against the glyph box height and the app's
// own apply() math (window.MK = metres per CSS px, window.MS = marker scale).
// Usage: node audits/tools/phase4/TYPE/verify-build-guide-svg-labels-under-11-1.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { local, sleep } from '../../lib/local.mjs';
import { DEVICES } from '../../lib/devices.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../../..');
const OUT = path.join(ROOT, 'audits/evidence/p4/TYPE/verify-build-guide-svg-labels-under-11-1.json');
const mod = await import(pathToFileURL(path.join(ROOT, 'audits/tools/areas/dollywood.mjs')).href);
const DEVS = ['iphone-pwa', 'iphone-safari', 'ipad-portrait', 'ipad-landscape', 'desktop'];
const SCREENS = ['map', 'cross-section', 'section'];

function probe() {
  const vw = innerWidth, vh = innerHeight;
  const groups = {};
  for (const t of document.querySelectorAll('svg text')) {
    const txt = (t.textContent || '').trim(); if (!txt) continue;
    const r = t.getBoundingClientRect(); if (!(r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw)) continue;
    let hidden = false; for (let e = t; e && e.nodeType === 1; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) { hidden = true; break; } }
    if (hidden) continue;
    const m = t.getScreenCTM(); if (!m) continue;
    const sc = Math.sqrt(Math.abs(m.a * m.d - m.b * m.c));
    const fs = parseFloat(getComputedStyle(t).fontSize);
    const cls = (t.className && t.className.baseVal) || (t.closest('#prof, .profwrap') ? 'profile-text' : (t.ownerSVGElement && t.ownerSVGElement.id ? 'svg#' + t.ownerSVGElement.id : 'svg'));
    const key = cls + (t.ownerSVGElement && t.ownerSVGElement.id ? ' in #' + t.ownerSVGElement.id : '');
    const g = groups[key] ||= { n: 0, fs: new Set(), eff: [], boxH: [], sample: [] };
    g.n++; g.fs.add(fs); g.eff.push(fs * sc); g.boxH.push(r.height); if (g.sample.length < 4) g.sample.push(txt.slice(0, 20));
  }
  const res = {};
  for (const [k, g] of Object.entries(groups)) res[k] = { n: g.n, fontSize: [...g.fs], effMin: +Math.min(...g.eff).toFixed(2), effMax: +Math.max(...g.eff).toFixed(2), boxHMin: +Math.min(...g.boxH).toFixed(1), sample: g.sample };
  const svg = document.getElementById('map'); const m = svg && svg.getScreenCTM();
  return { url: location.pathname, mapCTM: m ? +m.a.toFixed(4) : null, MK: window.MK ? +window.MK.toFixed(4) : null, MS: window.MS ? +window.MS.toFixed(4) : null, groups: res };
}

const L = await local({ variant: 'typical', engine: 'webkit' });
const out = { note: 'Skeptic re-measure, local instance, WebKit, System theme light, profile eli, variant typical.', runs: [] };
try {
  for (const screen of SCREENS) {
    const s = mod.screens.find(x => x.screen === screen);
    for (const device of DEVS) {
      const dev = DEVICES[device];
      const d = await L.device({ device, mode: 'light', profile: 'eli' });
      const page = d.page;
      const t = {
        page, ctx: d.ctx, state: 'typical', device, mode: 'light', variant: 'typical', profile: 'eli', dev, touch: dev.hasTouch,
        loading: false, offline: false, error: false, sleep, settle: async () => sleep(900),
        frame: () => page.frameLocator('#frame'), goto: h => d.goto(h),
        async openApp(id, o = {}) { const f = await d.openApp(id, o); await sleep(700); return f; },
        appFrame: id => page.frames().find(f => f.url().includes(`/apps/${id}.html`)),
        async tap(target, o = {}) { const loc = typeof target === 'string' ? page.locator(target).first() : target; if (dev.hasTouch) await loc.tap(o); else await loc.click(o); },
        async tapIn(fl, sel, o = {}) { const loc = sel ? fl.locator(sel).first() : fl; if (dev.hasTouch) await loc.tap(o); else await loc.click(o); },
        async scroll(selector = '#views', y = 'bottom', where = page) { await where.evaluate(([sel, y]) => { const el = document.querySelector(sel) || document.scrollingElement; el.scrollTop = y === 'bottom' ? el.scrollHeight : y; }, [selector, y]); await sleep(250); },
        async clockTo(w) { await d.ctx.clock.setFixedTime(new Date(w)); },
      };
      const rec = { screen, device, viewport: dev.viewport };
      try { await s.go(t); await sleep(1500); } catch (e) { rec.goError = String(e.message).split('\n')[0]; }
      const f = d.frame('dollywood');
      try { rec.probe = await f.evaluate(probe); } catch (e) { rec.probeError = String(e.message).slice(0, 200); }
      if (screen === 'map' && (device === 'iphone-pwa' || device === 'ipad-portrait')) {
        const file = path.join(ROOT, `audits/evidence/p4/TYPE/verify-build-guide-svg-labels-under-11-1-${device}.png`);
        await d.page.screenshot({ path: file, animations: 'disabled', caret: 'hide', scale: 'css' }); rec.shot = path.relative(ROOT, file).split(path.sep).join('/');
      }
      out.runs.push(rec);
      const g = rec.probe ? rec.probe.groups : {};
      console.log(screen.padEnd(14), device.padEnd(15), 'CTM', rec.probe && rec.probe.mapCTM, 'MK', rec.probe && rec.probe.MK, 'MS', rec.probe && rec.probe.MS, '|', Object.entries(g).map(([k, v]) => `${k}: fs ${v.fontSize.join('/')} eff ${v.effMin}-${v.effMax} box ${v.boxHMin} n${v.n}`).join(' | '), rec.goError || '');
      await d.close();
    }
  }
} finally { await L.close(); }
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log('->', OUT);
