// VIS layout shift + loading states: Home (adult, kid) and the TV board, cold cache, with the data and feed API calls
// held for 1.5 s so the loading → loaded transition is observable.
//   - Chromium (the installed Chrome): Cumulative Layout Shift from the Layout Instability API (WebKit has no such API)
//   - WebKit: the rects of the Home blocks at ~0.6 s (loading) and after the first pull; which texts showed while loading
// Writes audits/evidence/p2/VIS/cls.json and 1× PNGs cls-<who>-<engine>-{loading,loaded}.png.
//   node "audits/tools/phase2/VIS/cls.mjs"
import { local, sleep } from '../../lib/local.mjs';
import { save, shotCss } from './lib-vis.mjs';

const HOLD = 1500;
const out = {};
const blocks = () => [...document.querySelectorAll('#view-home .home-hero, #view-home .glance > *, #view-home .two-col > .card, #view-home .kid-cta, #view-home .stack-lg > .card, #tv .tv-pane')]
  .map(e => { const r = e.getBoundingClientRect(); return { el: (e.querySelector('h2') ? e.querySelector('h2').textContent.trim() : e.className).slice(0, 30), y: Math.round(r.top), h: Math.round(r.height) }; });
const texts = () => [...document.querySelectorAll('#view-home .gbig, #view-home .gsub, #view-home .hero-sub, #view-home #remlist li, #view-home .kids-line, #tv .tv-refs, #tv .tv-quiet, #tv .tv-faces')]
  .map(e => (e.querySelector('.skeleton') || e.classList.contains('skeleton') ? '[skeleton]' : '') + e.textContent.replace(/\s+/g, ' ').trim().slice(0, 50));

for (const engine of ['chromium', 'webkit']) {
  const L = await local({ variant: 'typical', engine });
  try {
    for (const who of [{ id: 'eli', device: 'ipad-portrait' }, { id: 'eli', device: 'iphone-pwa' }, { id: 'ezra', device: 'ipad-portrait' }, { id: 'tv', device: 'tv' }]) {
      const d = await L.device({ device: who.device, mode: 'light', profile: who.id });
      if (engine === 'chromium') await d.ctx.addInitScript(() => {
        window.__cls = { total: 0, entries: [] };
        try { new PerformanceObserver(l => { for (const e of l.getEntries()) { if (e.hadRecentInput) continue; window.__cls.total += e.value;
          window.__cls.entries.push({ t: Math.round(e.startTime), v: +e.value.toFixed(4), src: (e.sources || []).slice(0, 3).map(s => { const n = s.node; const lab = n && n.nodeType === 1 ? (n.tagName.toLowerCase() + (n.id ? '#' + n.id : '') + (n.className && typeof n.className === 'string' ? '.' + n.className.split(' ').slice(0, 2).join('.') : '')) : (n ? '#text' : '?'); return { node: lab, from: [Math.round(s.previousRect.y), Math.round(s.previousRect.height)], to: [Math.round(s.currentRect.y), Math.round(s.currentRect.height)] }; }) }); } }).observe({ type: 'layout-shift', buffered: true }); } catch (e) { window.__cls.err = e.message; }
      });
      await d.ctx.route(L.api + '/api/**', async r => { if (/\/api\/(data|activity|chat\/history)/.test(r.request().url())) await sleep(HOLD); await r.continue().catch(() => {}); });
      await d.page.goto(L.site + '/index.html#home', { waitUntil: 'load' });
      await d.page.waitForSelector('#view-home .home-hero, #tv', { timeout: 10000 });
      await sleep(400);
      const loading = { blocks: await d.page.evaluate(blocks), texts: await d.page.evaluate(texts), syncState: await d.page.evaluate(() => hub.sync.state), skeletons: await d.page.evaluate(() => document.querySelectorAll('#view-home .skeleton').length) };
      const tag = `${who.id}-${who.device}-${engine}`;
      if (engine === 'webkit') loading.shot = await shotCss(d.page, `cls-${tag}-loading.png`);
      await d.page.waitForFunction(() => window.hub && hub.sync.lastPull, null, { timeout: 12000 }).catch(() => {});
      await sleep(HOLD + 1200);
      const loaded = { blocks: await d.page.evaluate(blocks), texts: await d.page.evaluate(texts), syncState: await d.page.evaluate(() => hub.sync.state) };
      if (engine === 'webkit') loaded.shot = await shotCss(d.page, `cls-${tag}-loaded.png`);
      const moved = loaded.blocks.map((b, i) => { const a = loading.blocks.find(x => x.el === b.el); return a ? { el: b.el, dy: b.y - a.y, dh: b.h - a.h } : { el: b.el, new: true, y: b.y, h: b.h }; }).filter(m => m.new || m.dy || m.dh);
      const cls = engine === 'chromium' ? await d.page.evaluate(() => window.__cls) : null;
      out[tag] = { loading, loaded, moved, cls };
      console.log(`\n== ${tag}${cls ? `  CLS ${cls.total.toFixed(4)} (${cls.entries.length} shifts)` : ''}`);
      console.log('  while loading (sync ' + loading.syncState + ', ' + loading.skeletons + ' skeletons):', JSON.stringify(loading.texts));
      console.log('  loaded:', JSON.stringify(loaded.texts));
      console.log('  blocks that moved or resized:', JSON.stringify(moved));
      if (cls) for (const e of cls.entries.slice(0, 8)) console.log('   shift', e.t + 'ms', e.v, JSON.stringify(e.src));
      await d.close();
    }
  } finally { await L.close(); }
}
console.log('\nwrote', save('cls.json', out));
