// TELL / loading: "layout shift as data loads" and "spinners where skeletons belong", the same cold open in all 11 areas,
// INSIDE the shell viewer (MOTION/cls.mjs loads the apps standalone; this is the path the family takes).
//   node audits/tools/phase4/TELL/loading.mjs [area…]   → audits/evidence/p4/TELL/loading.json (merged) + loading-<area>.png
// Chromium, iPad portrait, light, System theme, real clock. Cold = signed-in device with no hub cache. Network arm = MOTION's
// "held": GET /api/data/* answers 2500 ms late, every other Worker request 150 ms late. Shell/TV: index.html#home;
// apps: index.html#<id> (the shell opens the viewer itself).
// Recorded in the area's document: CLS (Layout Instability API, entries without recent input), landmark moves (headings,
// buttons, cards, list items keyed by tag + text: first position vs final, as MOTION measures them), and the loading state
// 900 ms after the document's DOMContentLoaded: skeleton elements, running infinite animations (spinners), elements whose
// class says spin/loading/busy, "Loading…"/"…" text, visible text length; a 1x screenshot of that moment.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep } from '../../lib/local.mjs';
import { AREAS, profileFor, deviceFor } from './areas.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const EV = path.join(ROOT, 'audits/evidence/p4/TELL');
const OUT = path.join(EV, 'loading.json');
const want = process.argv.slice(2).length ? process.argv.slice(2) : AREAS;
const prev = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : { areas: {} };
const out = { note: 'See the header of audits/tools/phase4/TELL/loading.mjs.', engine: 'chromium', arm: 'held', areas: prev.areas || {} };
const INIT = () => {
  const w = window; w.__cls = { entries: [], samples: [], dcl: null };
  document.addEventListener('DOMContentLoaded', () => { w.__cls.dcl = performance.now(); });
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) w.__cls.entries.push({ t: Math.round(e.startTime), v: +e.value.toFixed(4), input: e.hadRecentInput, src: (e.sources || []).slice(0, 3).map(s => { const n = s.node; const d = n && n.nodeType === 1 ? n.tagName.toLowerCase() + (n.id ? '#' + n.id : '') + (n.classList && n.classList.length ? '.' + [...n.classList].slice(0, 2).join('.') : '') : (n ? '#text' : '?'); return `${d} ${Math.round(s.previousRect.y)}→${Math.round(s.currentRect.y)}`; }) }); }).observe({ type: 'layout-shift', buffered: true }); } catch (e) { w.__cls.err = String(e); }
  const key = el => { const t = (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 32); return t ? el.tagName.toLowerCase() + ':' + t : null; };
  const sample = () => {
    if (!document.body) return;
    const m = {}; const seen = {};
    for (const el of document.querySelectorAll('h1,h2,h3,button,.card,li,[class*=hero],label')) {
      const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) continue;
      const k = key(el); if (!k) continue; seen[k] = (seen[k] || 0) + 1; m[k] = seen[k] > 1 ? null : Math.round(r.top);
    }
    w.__cls.samples.push({ t: Math.round(performance.now()), m, textLen: (document.body.innerText || '').trim().length });
  };
  const iv = setInterval(sample, 50); setTimeout(() => clearInterval(iv), 9000);
  w.__loadingState = () => {
    const shown = e => { const r = e.getBoundingClientRect(); return r.width > 1 && r.height > 1 && getComputedStyle(e).visibility !== 'hidden'; };
    const inf = document.getAnimations().filter(a => a.playState === 'running' && a.effect && a.effect.getComputedTiming().iterations === Infinity).map(a => a.animationName || a.constructor.name);
    const txt = (document.body.innerText || '').replace(/\s+/g, ' ').trim();
    return { skeletons: [...document.querySelectorAll('.skeleton, [class*=skel], [class*=shimmer]')].filter(shown).length,
      spinnerClass: [...document.querySelectorAll('[class*=spin], [class*=loading], [aria-busy=true], progress')].filter(shown).length,
      infinite: inf, loadingText: (txt.match(/Loading[^.]{0,20}|…/g) || []).slice(0, 5), textLen: txt.length, text: txt.slice(0, 160) };
  };
  w.__clsReport = () => {
    const c = w.__cls; const S = c.samples;
    const firstIdx = S.findIndex(s => s.textLen > 20); const last = S[S.length - 1];
    const moves = [];
    if (firstIdx >= 0 && last) {
      const firstPos = {};
      for (const s of S.slice(firstIdx)) for (const [k, v] of Object.entries(s.m)) if (!(k in firstPos)) firstPos[k] = { v, t: s.t };
      for (const [k, f] of Object.entries(firstPos)) if (f.v != null && last.m[k] != null && f.t <= S[firstIdx].t + 400) { const dlt = last.m[k] - f.v; if (Math.abs(dlt) >= 4) moves.push({ k, from: f.v, to: last.m[k], d: dlt }); }
    }
    moves.sort((a, b) => Math.abs(b.d) - Math.abs(a.d));
    const noInput = c.entries.filter(e => !e.input);
    return { cls: +noInput.reduce((s, e) => s + e.v, 0).toFixed(4), shifts: noInput.length, largest: noInput.sort((a, b) => b.v - a.v)[0] || null, maxMovePx: moves.length ? Math.abs(moves[0].d) : 0, topMoves: moves.slice(0, 4), err: c.err };
  };
};
const L = await local({ variant: 'typical', engine: 'chromium' });
try {
  for (const area of want) {
    const R = { area };
    try {
      const d = await L.device({ device: deviceFor(area, 'ipad-portrait'), profile: profileFor(area), fixedTime: false });
      await d.ctx.route(L.api + '/api/**', async r => { const u = r.request().url(); const hold = r.request().method() === 'GET' && /\/api\/data\//.test(u); await sleep(hold ? 2500 : 150); r.continue().catch(() => {}); });
      await d.ctx.addInitScript(INIT);
      const shellArea = area === 'shell' || area === 'tv';
      await d.page.goto(L.site + '/index.html#' + (shellArea ? 'home' : area), { waitUntil: 'commit' });
      let doc = null; const until = Date.now() + 10000;
      while (Date.now() < until) { doc = shellArea ? d.page.mainFrame() : d.page.frames().find(f => f.url().includes(`/apps/${area}.html`)); if (doc) { const dcl = await doc.evaluate(() => window.__cls && window.__cls.dcl).catch(() => null); if (dcl != null) break; } await sleep(40); }
      await sleep(900);
      R.loadingAt900 = await doc.evaluate(() => window.__loadingState()).catch(e => ({ err: e.message.slice(0, 80) }));
      const f = path.join(EV, `loading-${area}.png`); await d.page.screenshot({ path: f, scale: 'css' }); R.shot = path.relative(ROOT, f).replace(/\\/g, '/');
      await sleep(/dollywood/.test(area) ? 7000 : 5500);
      R.settled = await doc.evaluate(() => ({ ...window.__loadingState(), pulled: !!(window.hub && hub.sync && hub.sync.lastPull) })).catch(e => ({ err: e.message.slice(0, 80) }));
      R.cls = await doc.evaluate(() => window.__clsReport()).catch(e => ({ err: e.message.slice(0, 80) }));
      await d.close();
    } catch (e) { R.error = String(e.message || e).split('\n')[0]; }
    out.areas[area] = R;
    console.log(area, JSON.stringify({ cls: R.cls && R.cls.cls, move: R.cls && R.cls.maxMovePx, top: R.cls && R.cls.topMoves && R.cls.topMoves.slice(0, 2).map(m => m.k + ' ' + m.d), load: R.loadingAt900 && { sk: R.loadingAt900.skeletons, sp: R.loadingAt900.spinnerClass, inf: R.loadingAt900.infinite, lt: R.loadingAt900.loadingText, len: R.loadingAt900.textLen }, err: R.error }));
    fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
  }
} finally { await L.close(); }
