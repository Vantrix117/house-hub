// Phase 4 GLASS, skeptic 2 for "sheen-restyles-whole-document". Independent of perf.mjs (does not import it).
//
// Part 1 (Chromium, CDP Performance metrics): iPad portrait, eli, light, System theme. Scenes: shell Home (#views),
//   F260 Today (in the viewer iframe), Prayer (in the viewer iframe). A rAF loop scrolls the scroller 10 px a frame for
//   WIN ms, bouncing. Arms, same page state, order A C R A C R:
//     A  as shipped
//     C  --sheen-x writes dropped by an OWN-PROPERTY override on document.documentElement.style (not the prototype)
//     R  the proposed fix, simulated: @property --sheen-x { syntax:'<percentage>'; inherits:false; initial-value:30% }
//        injected in every document, hub.js writes left untouched (does a non-inherited registration stop the cascade?)
//   Metrics: RecalcStyleCount/s, RecalcStyleDuration ms/s, TaskDuration/s, LayoutCount/s, frame p95 and share > 20 ms.
// Part 2 (Chromium AND WebKit): a forced-style micro-benchmark inside each document: 300 x { set --sheen-x on <html>;
//   read getComputedStyle(deepest element).color } vs 300 x { set an unused custom property on one leaf; same read }.
//   The ratio says whether the engine restyles the document or only a subtree. WebKit is the iPad's engine family.
//
//   node audits/tools/phase4/GLASS/verify-sheen-restyles-whole-document-2.mjs [--window 4000]
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const WIN = +arg('window', 4000);
const OUT = path.join(ROOT, 'audits/evidence/p4/GLASS/verify-sheen-restyles-whole-document-2.json');
const SCENES = [
  { id: 'shell-home', app: null, sel: '#views' },
  { id: 'f260-today', app: 'f260', wait: '#todayTitle:not(:empty)' },
  { id: 'prayer', app: 'prayer' },
];
const REG = "@property --sheen-x{syntax:'<percentage>';inherits:false;initial-value:30%}";

async function inAll(page, fn, a) { for (const f of page.frames()) await f.evaluate(fn, a).catch(() => {}); }
const setArm = async (page, arm) => {
  await inAll(page, on => { const st = document.documentElement.style; if (on) { st.setProperty = function (k, v, p) { if (k === '--sheen-x') { window.__v2drop = (window.__v2drop || 0) + 1; return; } return CSSStyleDeclaration.prototype.setProperty.call(this, k, v, p); }; } else delete st.setProperty; }, arm === 'C');
  await inAll(page, ([css, on]) => { let s = document.getElementById('v2-reg'); if (!on) { if (s) s.remove(); return; } if (!s) { s = document.createElement('style'); s.id = 'v2-reg'; document.head.appendChild(s); } s.textContent = css; }, [REG, arm === 'R']);
};

function scrollIn(frame, sel, ms) {
  return frame.evaluate(([sel, ms]) => new Promise(res => {
    let el = sel ? document.querySelector(sel) : null;
    if (!el) { const se = document.scrollingElement; el = se.scrollHeight - se.clientHeight > 40 ? se : [...document.querySelectorAll('*')].filter(e => /auto|scroll/.test(getComputedStyle(e).overflowY) && e.scrollHeight - e.clientHeight > 40).sort((a, b) => b.clientHeight - a.clientHeight)[0]; }
    if (!el) return res(null);
    const range = el.scrollHeight - el.clientHeight; let dir = 1; const ts = []; const t0 = performance.now(); el.scrollTop = 0;
    let sx = new Set();
    const step = now => { ts.push(now); sx.add(document.documentElement.style.getPropertyValue('--sheen-x')); let y = el.scrollTop + dir * 10; if (y >= range) { y = range; dir = -1; } if (y <= 0) { y = 0; dir = 1; } el.scrollTop = y; if (now - t0 < ms) requestAnimationFrame(step); else done(); };
    const done = () => { const iv = ts.slice(1).map((t, i) => t - ts[i]).sort((a, b) => a - b); res({ scroller: el === document.scrollingElement ? 'document' : (el.id ? '#' + el.id : el.tagName), range, fps: +((ts.length - 1) / ((ts.at(-1) - ts[0]) / 1000)).toFixed(1), p95: +iv[Math.floor(.95 * (iv.length - 1))].toFixed(1), over20: +(iv.filter(x => x > 20).length / iv.length).toFixed(3), sheenValues: sx.size, elements: document.querySelectorAll('*').length }); };
    requestAnimationFrame(step);
  }), [sel, ms]);
}

// forced-style micro-benchmark: whole-document custom-property change vs a leaf-only one
const MICRO = () => {
  const all = [...document.body.querySelectorAll('*')]; let deep = all[0], dd = 0;
  for (const e of all) { let n = 0, p = e; while (p) { n++; p = p.parentElement; } if (n > dd) { dd = n; deep = e; } }
  const leaf = all.filter(e => !e.children.length).at(-1) || deep;
  const root = document.documentElement; const N = 300; const setP = CSSStyleDeclaration.prototype.setProperty;
  const users = all.filter(e => /sheen-x/.test(getComputedStyle(e).backgroundImage) || false).length; // computed value has it substituted, so this is 0; kept for honesty
  getComputedStyle(deep).color;
  let t = performance.now(); for (let i = 0; i < N; i++) { setP.call(root.style, '--sheen-x', (20 + i % 50) + '%'); getComputedStyle(deep).color; } const rootMs = performance.now() - t;
  t = performance.now(); for (let i = 0; i < N; i++) { setP.call(leaf.style, '--v2-unused', String(i)); getComputedStyle(deep).color; } const leafMs = performance.now() - t;
  t = performance.now(); for (let i = 0; i < N; i++) { setP.call(root.style, '--v2-unused-root', String(i)); getComputedStyle(deep).color; } const rootUnusedMs = performance.now() - t;
  leaf.style.removeProperty('--v2-unused'); root.style.removeProperty('--v2-unused-root');
  return { elements: all.length, rootSheenUsPerWrite: +(1000 * rootMs / N).toFixed(1), rootUnusedUsPerWrite: +(1000 * rootUnusedMs / N).toFixed(1), leafUsPerWrite: +(1000 * leafMs / N).toFixed(1), ratioRootToLeaf: +(rootMs / Math.max(0.001, leafMs)).toFixed(1), usersNote: users };
};

async function openScene(L, s, engine) {
  const d = await L.device({ device: 'ipad-portrait', mode: 'light', profile: 'eli' });
  await d.goto('#home'); await sleep(1500);
  let frame = d.page.mainFrame();
  if (s.app) { frame = await d.openApp(s.app, { wait: s.wait }); await sleep(2000); }
  const reduced = await frame.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  const glass = await frame.evaluate(() => [...document.querySelectorAll('*')].filter(e => { const r = e.getBoundingClientRect(); if (r.bottom <= 0 || r.top >= innerHeight || r.width < 2) return false; const cs = getComputedStyle(e); return /radial-gradient/.test(cs.backgroundImage) && /linear-gradient/.test(cs.backgroundImage); }).map(e => (e.id ? '#' + e.id : e.tagName.toLowerCase() + '.' + [...e.classList].join('.')) + ' ' + Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height)));
  return { d, frame, reduced, glassRecipeVisibleAtTop: glass };
}

const out = { method: 'see header of audits/tools/phase4/GLASS/verify-sheen-restyles-whole-document-2.mjs', window: WIN, chromium: {}, webkit: {} };
// Part 1 + micro in Chromium
{
  const L = await local({ variant: 'typical', engine: 'chromium' });
  try {
    for (const s of SCENES) {
      await L.reset('typical');
      const { d, frame, reduced, glassRecipeVisibleAtTop } = await openScene(L, s);
      const cdp = await d.ctx.newCDPSession(d.page); await cdp.send('Performance.enable');
      const pm = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(x => [x.name, x.value]));
      const rec = out.chromium[s.id] = { reduced, glassRecipeVisibleAtTop, arms: {} };
      for (const arm of ['A', 'C', 'R', 'A', 'C', 'R']) {
        await setArm(d.page, arm); await sleep(800);
        const m0 = await pm(), w0 = Date.now();
        const fr = await scrollIn(frame, s.sel, WIN);
        const m1 = await pm(), secs = (Date.now() - w0) / 1000;
        const r = { styleRecalcPerSec: +((m1.RecalcStyleCount - m0.RecalcStyleCount) / secs).toFixed(1), styleMsPerSec: +(1000 * (m1.RecalcStyleDuration - m0.RecalcStyleDuration) / secs).toFixed(1), mainTaskPerSec: +((m1.TaskDuration - m0.TaskDuration) / secs).toFixed(3), layoutPerSec: +((m1.LayoutCount - m0.LayoutCount) / secs).toFixed(1), layoutMsPerSec: +(1000 * (m1.LayoutDuration - m0.LayoutDuration) / secs).toFixed(1), frames: fr };
        (rec.arms[arm] ||= []).push(r);
        console.log('chromium', s.id, arm, JSON.stringify(r));
      }
      await setArm(d.page, 'A');
      rec.micro = await frame.evaluate(MICRO);
      console.log('chromium micro', s.id, JSON.stringify(rec.micro));
      await d.close();
    }
  } finally { await L.close(); }
}
// micro in WebKit
{
  const L = await local({ variant: 'typical', engine: 'webkit' });
  try {
    for (const s of SCENES) {
      await L.reset('typical');
      const { d, frame, reduced } = await openScene(L, s);
      const micro = await frame.evaluate(MICRO);
      out.webkit[s.id] = { reduced, micro };
      console.log('webkit micro', s.id, JSON.stringify(micro));
      await d.close();
    }
  } finally { await L.close(); }
}
fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log('wrote', OUT);
