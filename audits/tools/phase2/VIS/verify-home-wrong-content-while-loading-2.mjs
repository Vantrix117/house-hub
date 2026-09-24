// Skeptic #2 for VIS finding "home-wrong-content-while-loading": does Home (adult) and the TV board paint final
// "empty" facts while the first pull is still in flight, and is that only a rig artefact (the 1.5 s hold)?
//
// Independent of cls.mjs. An in-page MutationObserver records every distinct paint of the Home/TV texts with
// performance.now(), hub.sync.state, hub.sync.lastPull and navigator.onLine, so the timeline is exact rather than a
// single sample. Scenarios (WebKit, demo household 'typical', demo clock):
//   A  cold cache, REALISTIC latency: every /api/data and /api/activity request delayed 200 ms (10 sequential scopes)
//   B  warm cache (reload of A's context, same latency): calibration — the normal daily open
//   C  cold cache, counterfactual: an init script sets hub.sync.state = 'pending' the moment hub.js publishes window.hub,
//      i.e. what the shell's own skeleton branch (index.html:1158 `pulled`) would show if the SDK did not start 'offline'
//   D  TV kiosk, cold cache, 200 ms latency
//   E  cold cache, 1500 ms hold on /api/data (the investigator's setting) — screenshot at ~0.6 s
//   node "audits/tools/phase2/VIS/verify-home-wrong-content-while-loading-2.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const EVID = path.join(ROOT, 'audits/evidence/p2/VIS');
fs.mkdirSync(EVID, { recursive: true });

const RECORDER = () => {
  window.__rec = [];
  const t0 = performance.now();
  const snap = () => {
    const q = s => document.querySelector(s), qa = s => [...document.querySelectorAll(s)];
    const txt = e => (e ? e.textContent.replace(/\s+/g, ' ').trim().slice(0, 60) : null);
    const h = window.hub;
    const home = q('#view-home');
    const s = {
      state: h && h.sync ? h.sync.state : null, lastPull: h && h.sync ? h.sync.lastPull : null, onLine: navigator.onLine,
      hero: txt(q('#view-home .hero-sub')),
      gbig: qa('#view-home .gcard .gbig').map(txt),
      kids: txt(q('#view-home .kids-line')),
      rem0: txt(q('#remlist li')),
      cardSk: qa('#view-home .gcard .skeleton').length, remSk: qa('#remlist .skeleton').length, feedSk: qa('#feed .skeleton').length,
      tvVerse: txt(q('#tv-verse-hd')), tvRefs: txt(q('#tv-refs')), tvStars: txt(q('#tv-stars')), tvFeed0: txt(q('#tv-feed li')),
    };
    if (!home || (!s.gbig.length && !s.tvVerse && !s.kids)) return;
    const key = JSON.stringify({ ...s, lastPull: !!s.lastPull });
    const last = window.__rec[window.__rec.length - 1];
    if (last && last.key === key) return;
    const blocks = qa('#view-home .home-hero, #view-home .glance > *, #view-home .two-col > .card, #tv .tv-pane')
      .map(e => { const r = e.getBoundingClientRect(); const hd = e.querySelector('h2'); return [(hd ? hd.textContent.trim() : e.className).slice(0, 22), Math.round(r.top), Math.round(r.height)]; });
    window.__rec.push({ t: Math.round(performance.now() - t0), key, ...s, blocks });
  };
  let pend = false;
  const kick = () => { if (pend) return; pend = true; requestAnimationFrame(() => { pend = false; try { snap(); } catch (e) {} }); };
  document.addEventListener('DOMContentLoaded', () => { new MutationObserver(kick).observe(document.body, { subtree: true, childList: true, characterData: true }); kick(); });
};

const PENDING_TRAP = () => {
  if (window.top !== window) return;
  let h;
  Object.defineProperty(window, 'hub', { configurable: true, get() { return h; }, set(v) { h = v; try { if (v && v.sync && !v.sync.lastPull) v.sync.state = 'pending'; } catch (e) {} } });
};

async function run(L, { device, profile, delay, trap = false, shot, label }) {
  const d = await L.device({ device, mode: 'light', profile });
  await d.ctx.addInitScript(RECORDER);
  if (trap) await d.ctx.addInitScript(PENDING_TRAP);
  await d.ctx.route(L.api + '/api/**', async r => { if (/\/api\/(data|activity)/.test(r.request().url())) await sleep(delay); await r.continue().catch(() => {}); });
  const go = Date.now();
  await d.page.goto(L.site + '/index.html#home', { waitUntil: 'load' });
  if (shot) { await d.page.waitForSelector('#view-home .gcard, #tv', { timeout: 10000 }); await sleep(600); await d.page.screenshot({ path: path.join(EVID, shot), scale: 'css', animations: 'disabled', caret: 'hide' }); }
  await d.page.waitForFunction(() => window.hub && hub.sync.lastPull > 0, null, { timeout: 40000 }).catch(() => {});
  await sleep(Math.max(1200, delay * 2));
  const rec = await d.page.evaluate(() => window.__rec.map(({ key, ...r }) => r));
  report(label, rec, Date.now() - go);
  return { d, rec };
}

function report(label, rec, ms) {
  console.log(`\n== ${label}  (${rec.length} distinct paints, run ${ms} ms)`);
  for (const r of rec) {
    const bits = [`t=${r.t}ms`, `state=${r.state}`, `lastPull=${r.lastPull ? 'set' : 0}`, `onLine=${r.onLine}`, `cardSk=${r.cardSk} remSk=${r.remSk} feedSk=${r.feedSk}`];
    const body = r.tvVerse ? { tvVerse: r.tvVerse, tvRefs: r.tvRefs, tvStars: r.tvStars, tvFeed0: r.tvFeed0 } : { hero: r.hero, gbig: r.gbig, kids: r.kids, rem0: r.rem0 };
    console.log('  ' + bits.join(' ') + '  ' + JSON.stringify(body));
  }
}

const out = {};
const L = await local({ variant: 'typical', engine: 'webkit' });
try {
  const A = await run(L, { device: 'ipad-portrait', profile: 'eli', delay: 200, label: 'A cold cache, 200 ms/request (Eli, iPad portrait)' });
  out.A = A.rec;
  // B: same context (localStorage now holds every cache), reload = the normal daily cold start of the page
  {
    await A.d.page.reload({ waitUntil: 'load' });
    await A.d.page.waitForFunction(() => window.hub && hub.sync.lastPull > 0, null, { timeout: 40000 }).catch(() => {});
    await sleep(1200);
    const rec = await A.d.page.evaluate(() => window.__rec.map(({ key, ...r }) => r));
    report('B warm cache, same 200 ms/request (reload of A)', rec, 0);
    out.B = rec;
    await A.d.close();
  }
  const C = await run(L, { device: 'ipad-portrait', profile: 'eli', delay: 200, trap: true, label: "C cold cache, 200 ms/request, counterfactual hub.sync.state='pending' before first render" });
  out.C = C.rec; await C.d.close();
  const D = await run(L, { device: 'tv', profile: 'tv', delay: 200, label: 'D TV kiosk, cold cache, 200 ms/request' });
  out.D = D.rec; await D.d.close();
  const E = await run(L, { device: 'ipad-portrait', profile: 'eli', delay: 1500, shot: 'verify2-home-cold-hold1500-ipad-portrait-webkit.png', label: 'E cold cache, 1500 ms/request (investigator setting)' });
  out.E = E.rec; await E.d.close();

  // summary: how long wrong "final" wording stayed up in the realistic run A, and the layout movement first → last
  const wrong = /Start with Genesis|Nothing aging|Nothing on the list today|All quiet in the house|Nothing to remember|★0/;
  const summarise = rec => {
    const bad = rec.filter(r => wrong.test(JSON.stringify([r.hero, r.gbig, r.kids, r.rem0, r.tvStars, r.tvRefs])) && !r.lastPull);
    const first = rec[0], last = rec[rec.length - 1];
    const moves = last ? last.blocks.map(b => { const a = first.blocks.find(x => x[0] === b[0]); return a ? [b[0], b[1] - a[1], b[2] - a[2]] : [b[0], 'new']; }).filter(m => m[1] === 'new' || m[1] || m[2]) : [];
    return { firstPaint: first && first.t, wrongPaints: bad.length, wrongFrom: bad[0] && bad[0].t, wrongUntil: bad.length ? bad[bad.length - 1].t : null, lastPullAt: (rec.find(r => r.lastPull) || {}).t, cardSkeletonEver: rec.some(r => r.cardSk > 0), movesFirstToLast: moves };
  };
  out.summary = { A: summarise(out.A), B: summarise(out.B), C: summarise(out.C), D: summarise(out.D), E: summarise(out.E) };
  console.log('\n== summary'); for (const [k, v] of Object.entries(out.summary)) console.log(' ', k, JSON.stringify(v));
} finally { await L.close(); }
const f = path.join(EVID, 'verify2-home-wrong-content-while-loading.json');
fs.writeFileSync(f, JSON.stringify(out, null, 1));
console.log('\nwrote', path.relative(ROOT, f));
