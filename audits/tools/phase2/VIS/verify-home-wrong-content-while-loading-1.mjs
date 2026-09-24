// Skeptic #1 for VIS finding "home-wrong-content-while-loading": does Home (and the TV board) paint final "empty" wording
// instead of skeletons while the first pull is still in flight, and does the page jump when the data lands?
//
// Independent of cls.mjs: instead of delaying every request by 1.5 s (which stretches the ten sequential /api/data pulls to
// ~15 s), this GATES the data + feed calls: the first /api/data request is held until the "loading" state has been read,
// then everything is released at once. So "loading" = the first pull genuinely pending, "loaded" = the full pull done.
//   A. cold cache (the rig clears localStorage; only device/session/profiles are set): Eli iPad, Eli iPhone, TV (WebKit)
//   B. control, warm cache: the same Eli iPad page reloaded after A with the gate closed again — cached values or empty wording?
//   C. realistic latency: cold Eli iPad, every /api/data + /api/activity call delayed 150 ms (no gate); the Home texts are
//      sampled every 50 ms until hub.sync.lastPull, to see how long the wrong wording stays up
//   D. Chromium (installed Chrome), cold Eli iPad + TV, gated: Layout Instability API CLS across the release
//
//   node "audits/tools/phase2/VIS/verify-home-wrong-content-while-loading-1.mjs"
// Evidence → audits/evidence/p2/VIS/verify-home-wrong-content-while-loading-1{.json,-*.png}
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const EVID = path.join(ROOT, 'audits/evidence/p2/VIS');
fs.mkdirSync(EVID, { recursive: true });
const TAG = 'verify-home-wrong-content-while-loading-1';
const rel = f => path.relative(ROOT, f).replace(/\\/g, '/');
const out = {};

const probe = () => {
  const home = document.querySelector('#view-home');
  const inFeed = e => !!e.closest('#feed');
  const q = s => [...document.querySelectorAll(s)];
  const blocks = q('#view-home .home-hero, #view-home .glance > *, #view-home .two-col > .card, #view-home .kid-cta, #view-home .stack-lg > .card, #tv .tv-pane, #tv')
    .map(e => { const r = e.getBoundingClientRect(); const h2 = e.querySelector('h2'); return { el: (e.id === 'tv' ? '#tv' : h2 ? h2.textContent.replace(/·.*$/, '').trim() : [...e.classList].slice(0, 2).join('.')).slice(0, 30), y: Math.round(r.top), h: Math.round(r.height), hidden: !!e.hidden || r.height === 0 }; });
  const texts = q('#view-home .hero-sub, #view-home .gbig, #view-home .gsub, #view-home #remlist li, #view-home .kids-line, #tv [class*="verse"], #tv .tv-refs, #tv .tv-quiet, #tv .tv-faces, #tv h2')
    .map(e => e.textContent.replace(/\s+/g, ' ').trim().slice(0, 60)).filter(Boolean);
  return {
    sync: { ...hub.sync }, onLine: navigator.onLine,
    skeletonsOutsideFeed: q('#view-home .skeleton').filter(e => !inFeed(e)).length,
    skeletonsInFeed: q('#view-home #feed .skeleton').length,
    texts: [...new Set(texts)], blocks,
  };
};
const WRONG = ['All quiet in the house.', 'Start with Genesis 1-2', 'Week 1 of 52', 'Nothing aging', 'Nothing on the list today', 'Nothing to remember right now.', 'No stars yet', 'Ready to play?', 'Genesis 1:27', 'Hebrews 11:7', 'Nothing has happened yet.', 'Verse of the week · Week 1'];
const wrongIn = texts => WRONG.filter(w => texts.some(t => t.includes(w)));
const moved = (a, b) => b.blocks.map(x => { const y = a.blocks.find(z => z.el === x.el); return y ? { el: x.el, dy: x.y - y.y, dh: x.h - y.h, wasHidden: y.hidden, nowHidden: x.hidden } : { el: x.el, new: true, y: x.y, h: x.h }; }).filter(m => m.new || m.dy || m.dh || m.wasHidden !== m.nowHidden);

async function gated(d, { reload = false } = {}) {
  let open; const gate = new Promise(r => { open = r; }); let pending = 0, seen = 0;
  const h = async r => { if (/\/api\/(data|activity)/.test(r.request().url())) { seen++; pending++; await gate; pending--; } await r.continue().catch(() => {}); };
  await d.ctx.route(d.apiBase + '/api/**', h);
  if (reload) await d.page.reload({ waitUntil: 'load' }); else await d.page.goto(d.site + '/index.html#home', { waitUntil: 'load' });
  await d.page.waitForSelector('#view-home .home-hero, #tv', { timeout: 15000 });
  await sleep(700);
  const loading = await d.page.evaluate(probe); loading.heldRequests = pending; loading.requestsSeen = seen;
  return { loading, release: async () => { open(); await d.page.waitForFunction(() => hub.sync.lastPull > 0 && hub.sync.state === 'synced', null, { timeout: 15000 }).catch(() => {}); await sleep(1500); const loaded = await d.page.evaluate(probe); await d.ctx.unroute(d.apiBase + '/api/**', h); return loaded; } };
}
const report = (k, o) => {
  out[k] = o;
  console.log(`\n== ${k}`);
  if (o.loading) {
    console.log(`  loading: sync.state=${o.loading.sync.state} lastPull=${o.loading.sync.lastPull} onLine=${o.loading.onLine} heldRequests=${o.loading.heldRequests} skeletons(outside feed)=${o.loading.skeletonsOutsideFeed} skeletons(feed)=${o.loading.skeletonsInFeed}`);
    console.log('  loading texts:', JSON.stringify(o.loading.texts));
    console.log('  wrong wording shown while loading:', JSON.stringify(wrongIn(o.loading.texts)));
  }
  if (o.loaded) {
    console.log(`  loaded: sync.state=${o.loaded.sync.state} lastPull>0=${o.loaded.sync.lastPull > 0}`);
    console.log('  loaded texts:', JSON.stringify(o.loaded.texts));
    console.log('  blocks moved/resized:', JSON.stringify(o.moved));
  }
  if (o.cls) console.log(`  CLS total ${o.cls.total.toFixed(4)} over ${o.cls.entries.length} shift(s):`, JSON.stringify(o.cls.entries));
  if (o.timeline) for (const l of o.timeline) console.log('  ', l);
};
const shot = async (d, name) => { const f = path.join(EVID, `${TAG}-${name}.png`); await d.page.screenshot({ path: f, scale: 'css', animations: 'disabled', caret: 'hide' }); return rel(f); };

// ── A + B + C: WebKit ─────────────────────────────────────────────────────────────────────────────────────────────────
{
  const L = await local({ variant: 'typical', engine: 'webkit' });
  try {
    for (const w of [{ id: 'eli', device: 'ipad-portrait' }, { id: 'eli', device: 'iphone-pwa' }, { id: 'tv', device: 'tv' }]) {
      const d = await L.device({ device: w.device, profile: w.id }); d.site = L.site; d.apiBase = L.api;
      const g = await gated(d);
      const s1 = await shot(d, `${w.id}-${w.device}-cold-loading`);
      const loaded = await g.release();
      const s2 = await shot(d, `${w.id}-${w.device}-cold-loaded`);
      report(`A webkit cold ${w.id} ${w.device}`, { loading: g.loading, loaded, moved: moved(g.loading, loaded), shots: [s1, s2] });
      if (w.device === 'ipad-portrait') {        // B: warm cache — same context, reload with the gate closed again
        const g2 = await gated(d, { reload: true });
        const s3 = await shot(d, `${w.id}-${w.device}-warm-loading`);
        const loaded2 = await g2.release();
        report(`B webkit WARM control ${w.id} ${w.device}`, { loading: g2.loading, loaded: loaded2, moved: moved(g2.loading, loaded2), shots: [s3] });
      }
      await d.close();
    }
    // C: realistic latency, cold iPad
    const d = await L.device({ device: 'ipad-portrait', profile: 'eli' });
    await d.ctx.route(L.api + '/api/**', async r => { if (/\/api\/(data|activity)/.test(r.request().url())) await sleep(150); await r.continue().catch(() => {}); });
    const t0 = Date.now(); const tl = []; const seenWrong = {};
    await d.page.goto(L.site + '/index.html#home', { waitUntil: 'commit' });
    while (Date.now() - t0 < 15000) {
      const s = await d.page.evaluate(() => window.hub && document.querySelector('#view-home .home-hero') ? { lp: hub.sync.lastPull, st: hub.sync.state, t: [...document.querySelectorAll('#view-home .hero-sub, #view-home .gbig, #view-home .gsub, #view-home #remlist li')].map(e => e.textContent.replace(/\s+/g, ' ').trim()) } : null).catch(() => null);
      const ms = Date.now() - t0;
      if (s) { for (const w of wrongIn(s.t)) { seenWrong[w] ||= { first: ms, last: ms }; seenWrong[w].last = ms; } if (s.lp) { tl.push(`first pull done at ~${ms} ms (state ${s.st})`); break; } }
      await sleep(50);
    }
    const timeline = [...Object.entries(seenWrong).map(([w, v]) => `"${w}" visible from ~${v.first} ms to ~${v.last} ms after navigation`), ...tl];
    report('C webkit cold eli ipad-portrait, 150 ms per data/feed call (no gate)', { timeline });
    await d.close();
  } finally { await L.close(); }
}

// ── D: Chromium CLS ──────────────────────────────────────────────────────────────────────────────────────────────────
{
  const L = await local({ variant: 'typical', engine: 'chromium' });
  try {
    for (const w of [{ id: 'eli', device: 'ipad-portrait' }, { id: 'eli', device: 'iphone-pwa' }, { id: 'tv', device: 'tv' }]) {
      const d = await L.device({ device: w.device, profile: w.id }); d.site = L.site; d.apiBase = L.api;
      await d.ctx.addInitScript(() => {
        window.__cls = { total: 0, entries: [] };
        try { new PerformanceObserver(l => { for (const e of l.getEntries()) { if (e.hadRecentInput) continue; window.__cls.total += e.value; window.__cls.entries.push({ t: Math.round(e.startTime), v: +e.value.toFixed(4), n: (e.sources || []).map(s => s.node && s.node.nodeType === 1 ? s.node.tagName.toLowerCase() + (s.node.id ? '#' + s.node.id : '') + (typeof s.node.className === 'string' && s.node.className ? '.' + s.node.className.split(' ')[0] : '') : '?').slice(0, 4) }); } }).observe({ type: 'layout-shift', buffered: true }); } catch (e) { window.__cls.err = e.message; }
      });
      const g = await gated(d);
      const before = await d.page.evaluate(() => window.__cls.total);
      const loaded = await g.release();
      const cls = await d.page.evaluate(() => window.__cls);
      report(`D chromium cold ${w.id} ${w.device}`, { loading: g.loading, loaded, moved: moved(g.loading, loaded), cls, clsBeforeRelease: before });
      await d.close();
    }
  } finally { await L.close(); }
}

const f = path.join(EVID, `${TAG}.json`); fs.writeFileSync(f, JSON.stringify(out, null, 1));
console.log('\nwrote', rel(f));
