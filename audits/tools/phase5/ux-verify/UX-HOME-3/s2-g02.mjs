// Skeptic s2, group G02: independent re-measure of UX-HOME-3 (Home height), VIS-HOME-1 (Apps tiles), GAP-HOME-2 (verses.summary).
//   node audits/tools/phase5/ux-verify/UX-HOME-3/s2-g02.mjs
// Local rig only (typical data, demo clock, WebKit). Writes JSON + screenshots under audits/evidence/p5/ux-verify/<ITEM>/s2/.
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../../lib/local.mjs';

const OUT = id => { const p = path.join(ROOT, 'audits/evidence/p5/ux-verify', id, 's2'); fs.mkdirSync(p, { recursive: true }); return p; };
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const res = { home: {}, tiles: {}, verses: {} };
try {
  for (const dev of ['iphone-pwa', 'iphone-safari', 'ipad-portrait', 'ipad-landscape']) {
    const d = await L.device({ device: dev, profile: 'eli' });
    try {
      await d.goto('#home');
      await d.page.waitForFunction(() => window.hub && hub.sync.lastPull > 0 && document.querySelector('#view-home .gcard') && document.querySelector('#feed .fline'), null, { timeout: 20000 }).catch(() => {});
      await sleep(800);
      res.home[dev] = await d.page.evaluate(() => {
        const tb = document.querySelector('#tabbar').getBoundingClientRect();
        const fold = innerWidth >= 1024 ? innerHeight : tb.top;
        const views = document.querySelector('#views');
        const top = el => el ? Math.round(el.getBoundingClientRect().top + views.scrollTop) : null;
        const remCard = document.querySelector('#remlist') && document.querySelector('#remlist').closest('.card');
        const feedCard = document.querySelector('#feed') && document.querySelector('#feed').closest('.card');
        const cards = [...document.querySelectorAll('#view-home .gcard')].map(c => { const r = c.getBoundingClientRect(); return { t: c.querySelector('h2').textContent.trim(), h: Math.round(r.height), top: Math.round(r.top), bottom: Math.round(r.bottom) }; });
        return {
          viewport: [innerWidth, innerHeight], fold: Math.round(fold), scrollHeight: views.scrollHeight,
          screens: +(views.scrollHeight / innerHeight).toFixed(2), screensAboveTabbar: +(views.scrollHeight / fold).toFixed(2),
          cards, cardsFullyVisible: cards.filter(c => c.bottom <= fold).length,
          remCardTop: top(remCard), remListTop: top(document.querySelector('#remlist')), remItems: document.querySelectorAll('#remlist li').length,
          feedCardTop: top(feedCard), feedCardH: feedCard ? Math.round(feedCard.getBoundingClientRect().height) : null,
          feedLines: document.querySelectorAll('#feed .fline').length, feedGroups: document.querySelectorAll('#feed > li:not(.feed-more)').length,
          showMore: !!document.querySelector('#feed-more'),
        };
      });
      if (dev === 'iphone-pwa') await d.page.screenshot({ path: path.join(OUT('UX-HOME-3'), 'home-iphone-pwa-full.png'), fullPage: false, animations: 'disabled' });
      // Apps grid: every tile
      await d.goto('#apps');
      await d.page.waitForFunction(() => window.hub && document.querySelectorAll('#grid .tile svg').length > 3, null, { timeout: 15000 }).catch(() => {});
      await sleep(500);
      res.tiles[dev] = await d.page.evaluate(() => [...document.querySelectorAll('#grid .tile')].map(t => {
        const r = t.getBoundingClientRect(), i = t.querySelector('.ticon').getBoundingClientRect(), l = t.querySelector('.tlabel');
        const g = t.querySelector('.ticon svg');
        return { id: t.dataset.id, wide: t.classList.contains('wide'), w: +r.width.toFixed(1), h: +r.height.toFixed(1), icon: Math.round(i.width), glyph: g ? Math.round(g.getBoundingClientRect().width) : null,
          labelPx: l ? parseFloat(getComputedStyle(l).fontSize) : null, labelLines: l ? Math.round(l.getBoundingClientRect().height / (parseFloat(getComputedStyle(l).fontSize) * 1.15)) : null };
      }));
      if (dev === 'ipad-landscape' || dev === 'iphone-pwa') await d.page.screenshot({ path: path.join(OUT('VIS-HOME-1'), `apps-${dev}.png`), animations: 'disabled' });
    } finally { await d.close(); }
  }
  // GAP-HOME-2: open Verses as Eli so it writes summary, then look for any reader on Home.
  const d = await L.device({ device: 'ipad-portrait', profile: 'eli' });
  try {
    await d.goto('#home');
    await d.page.waitForFunction(() => window.hub && hub.sync.lastPull > 0, null, { timeout: 20000 }).catch(() => {});
    await d.openApp('verses'); await sleep(2500);
    await d.goto('#home');
    await d.page.waitForFunction(() => window.hub && hub.sync.lastPull > 0 && document.querySelector('#view-home .gcard'), null, { timeout: 20000 }).catch(() => {});
    await sleep(1000);
    res.verses.localKeys = await d.page.evaluate(() => Object.keys(localStorage).filter(k => /verses/.test(k)));
    res.verses.summaryLocal = await d.page.evaluate(() => { for (const k of Object.keys(localStorage)) if (/verses/.test(k) && /summary/.test(localStorage.getItem(k) || '')) return { k, v: (localStorage.getItem(k) || '').slice(0, 400) }; return null; });
    res.verses.homeText = await d.page.evaluate(() => { const t = document.querySelector('#view-home').innerText; return { mentionsVerse: /verses? (due|to review)|memory verse/i.test(t), cardTitles: [...document.querySelectorAll('#view-home .card h2')].map(h => h.textContent.trim()) }; });
    res.verses.server = await L.apiAs('eli', '/api/data/verses?scope=person').then(r => ({ status: r.status, keys: r.body && (r.body.rows || r.body.items || r.body.data || []).map ? (r.body.rows || r.body.items || r.body.data || []).map(x => x.key) : Object.keys(r.body || {}) })).catch(e => ({ err: String(e) }));
    await d.page.screenshot({ path: path.join(OUT('GAP-HOME-2'), 'home-after-verses-ipad-portrait.png'), animations: 'disabled' });
  } finally { await d.close(); }
} finally { await L.close(); }
fs.writeFileSync(path.join(OUT('UX-HOME-3'), 'home.json'), JSON.stringify(res.home, null, 1));
fs.writeFileSync(path.join(OUT('VIS-HOME-1'), 'tiles.json'), JSON.stringify(res.tiles, null, 1));
fs.writeFileSync(path.join(OUT('GAP-HOME-2'), 'verses.json'), JSON.stringify(res.verses, null, 1));
console.log(JSON.stringify(res, null, 1));
