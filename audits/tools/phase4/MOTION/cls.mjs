// Phase 4 MOTION — layout shift and loading states on a cold load of every area, Chromium (Layout Instability API).
// Cold = a paired, signed-in device whose localStorage holds only the hub's device/session keys (no app cache), so the
// first paint comes before the first pull. Two arms:
//   lat150  every Worker request answers 150 ms late (a normal home Wi-Fi first open)
//   held    GET /api/data/* is held 2500 ms (a slow first pull), everything else 150 ms late
// Recorded per surface: CLS (sum of layout-shift values without recent input, as the API reports them), the largest
// single shift and its sources; "landmark moves" — every heading, button, card and list item keyed by tag + text, first
// position seen vs final position, because the API does not count content that is rebuilt with innerHTML (P2-VIS-04);
// and the loading state 1.2 s in: skeleton count, spinner-like infinite rotations, the first 140 characters of text.
//   node "audits/tools/phase4/MOTION/cls.mjs" lat150|held [surfaceFilter…]  → audits/evidence/p4/MOTION/cls-<arm>.json
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';

const EV = path.resolve('audits/evidence/p4/MOTION'); fs.mkdirSync(EV, { recursive: true });
const ARM = process.argv[2] || 'lat150';
const want = process.argv.slice(3);
const SURF = [
  ['shell-home', 'eli', '#home'], ['shell-home-kid', 'ezra', '#home'], ['shell-me', 'eli', '#me'], ['tv-board', 'tv', '#home'],
  ['f260', 'eli', 'apps/f260.html'], ['leftovers', 'eli', 'apps/leftovers.html'], ['prayer', 'eli', 'apps/prayer.html'], ['prayer-kid', 'kiara', 'apps/prayer.html'],
  ['tally', 'eli', 'apps/tally.html'], ['timer', 'eli', 'apps/timer.html'], ['dollywood', 'eli', 'apps/dollywood.html'], ['dollywood-live', 'eli', 'apps/dollywood-live.html'],
  ['kidverse-kid', 'ezra', 'apps/kidverse.html'], ['verses', 'eli', 'apps/verses.html'],
];
const INIT = () => {
  const w = window; w.__cls = { entries: [], samples: [], t0: performance.now() };
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) w.__cls.entries.push({ t: Math.round(e.startTime), v: +e.value.toFixed(4), input: e.hadRecentInput, src: (e.sources || []).slice(0, 3).map(s => { const n = s.node; const d = n && n.nodeType === 1 ? n.tagName.toLowerCase() + (n.id ? '#' + n.id : '') + (n.classList && n.classList.length ? '.' + [...n.classList].slice(0, 2).join('.') : '') : (n ? '#text' : '?'); return `${d} ${Math.round(s.previousRect.y)}→${Math.round(s.currentRect.y)}`; }) }); }).observe({ type: 'layout-shift', buffered: true }); } catch (e) { w.__cls.err = String(e); }
  const key = el => { const t = (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 32); return t ? el.tagName.toLowerCase() + ':' + t : null; };
  const sample = () => {
    if (!document.body) return;
    const m = {}; const seen = {};
    for (const el of document.querySelectorAll('h1,h2,h3,button,.card,li,[class*=hero],label')) {
      const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) continue;
      const k = key(el); if (!k) continue; seen[k] = (seen[k] || 0) + 1;
      m[k] = seen[k] > 1 ? null : Math.round(r.top);   // a key seen twice is ambiguous: never compared
    }
    w.__cls.samples.push({ t: Math.round(performance.now()), m, textLen: (document.body.innerText || '').trim().length });
  };
  const iv = setInterval(sample, 50); setTimeout(() => clearInterval(iv), 7000);
  w.__loadingAt = () => {
    const rot = document.getAnimations().filter(a => a.playState === 'running' && a.effect && a.effect.getComputedTiming().iterations === Infinity).map(a => a.animationName);
    return { skeletons: document.querySelectorAll('.skeleton, [class*=skel]').length, infinite: rot, text: (document.body.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 140), pulled: !!(w.hub && hub.sync && hub.sync.lastPull), state: w.hub && hub.sync && hub.sync.state };
  };
};
const out = {};
const L = await local({ variant: 'typical', engine: 'chromium' });
try {
  for (const device of ['ipad-portrait', 'iphone-pwa']) {
    for (const [name, profile, where] of SURF) {
      if (want.length && !want.some(w => name.includes(w))) continue;
      const dev = name === 'tv-board' ? 'tv' : device;
      if (name === 'tv-board' && device !== 'ipad-portrait') continue;
      const d = await L.device({ device: dev, profile, fixedTime: false });
      await d.ctx.route(L.api + '/api/**', async r => {
        const u = r.request().url(); const hold = ARM === 'held' && r.request().method() === 'GET' && /\/api\/data\//.test(u);
        await sleep(hold ? 2500 : 150); r.continue().catch(() => {});
      });
      await d.ctx.addInitScript(INIT);
      const t0 = Date.now();
      if (where.startsWith('#')) await d.goto(where); else await d.page.goto(L.site + '/' + where, { waitUntil: 'load' });
      const waitTo = t0 + 1200 - Date.now(); if (waitTo > 0) await sleep(waitTo);
      const loading = await d.page.evaluate(() => window.__loadingAt && __loadingAt());
      await sleep(Math.max(0, t0 + 7200 - Date.now()));
      const r = await d.page.evaluate(() => {
        const c = window.__cls; const S = c.samples;
        const firstIdx = S.findIndex(s => s.textLen > 20); const last = S[S.length - 1];
        const moves = [];
        if (firstIdx >= 0 && last) {
          const firstPos = {};
          for (const s of S.slice(firstIdx)) for (const [k, v] of Object.entries(s.m)) if (!(k in firstPos)) firstPos[k] = { v, t: s.t };
          for (const [k, f] of Object.entries(firstPos)) if (f.v != null && last.m[k] != null && f.t <= S[firstIdx].t + 400) { const dlt = last.m[k] - f.v; if (Math.abs(dlt) >= 4) moves.push({ k, from: f.v, to: last.m[k], d: dlt }); }
        }
        moves.sort((a, b) => Math.abs(b.d) - Math.abs(a.d));
        const noInput = c.entries.filter(e => !e.input);
        return { cls: +noInput.reduce((s, e) => s + e.v, 0).toFixed(4), shifts: noInput.length, largest: noInput.sort((a, b) => b.v - a.v)[0] || null, landmarkMoves: moves.length, maxMovePx: moves.length ? Math.abs(moves[0].d) : 0, topMoves: moves.slice(0, 4), err: c.err, pulled: !!(window.hub && hub.sync && hub.sync.lastPull) };
      });
      r.loadingAt1200 = loading;
      out[`${name}@${dev}`] = r;
      console.log(`${(name + '@' + dev).padEnd(30)} CLS ${String(r.cls).padEnd(7)} shifts ${String(r.shifts).padEnd(3)} landmark moves ${String(r.landmarkMoves).padEnd(3)} max ${String(r.maxMovePx).padEnd(4)}px  | 1.2s: skel ${loading && loading.skeletons} inf ${JSON.stringify(loading && loading.infinite)} pulled ${loading && loading.pulled} "${loading && loading.text.slice(0, 70)}"`);
      if (r.topMoves.length) console.log('      ' + r.topMoves.map(m => `${m.k.slice(0, 34)} ${m.from}→${m.to}`).join(' | '));
      if (r.largest) console.log('      largest ' + JSON.stringify(r.largest).slice(0, 220));
      await d.close();
    }
  }
} finally {
  fs.writeFileSync(path.join(EV, `cls-${ARM}${want.length ? '-' + want.join('-') : ''}.json`), JSON.stringify({ engine: 'chromium', arm: ARM, out }, null, 1));
  await L.close();
}
