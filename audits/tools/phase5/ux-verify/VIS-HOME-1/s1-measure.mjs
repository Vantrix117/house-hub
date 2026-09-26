// Skeptic s1 (G02): independent measurement of the Apps grid tiles (every tile, not just the first) and of the Home
// page layout (cards, reminders, feed rows, page height) for Eli on iPhone PWA / Safari and iPad portrait / landscape.
//   node audits/tools/phase5/ux-verify/VIS-HOME-1/s1-measure.mjs
// Writes audits/evidence/p5/ux-verify/VIS-HOME-1/s1/measure.json (+ UX-HOME-3/s1 copy) and screenshots.
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../../lib/local.mjs';

const OUT1 = path.join(ROOT, 'audits/evidence/p5/ux-verify/VIS-HOME-1/s1');
const OUT3 = path.join(ROOT, 'audits/evidence/p5/ux-verify/UX-HOME-3/s1');
const DEVS = ['iphone-pwa', 'iphone-safari', 'ipad-portrait', 'ipad-landscape'];
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const res = {};
try {
  for (const dev of DEVS) {
    const d = await L.device({ device: dev, profile: 'eli' });
    try {
      await d.goto('#apps');
      await d.page.waitForFunction(() => window.hub && hub.sync.lastPull > 0 && document.querySelectorAll('#grid .tile svg').length > 3, null, { timeout: 15000 }).catch(() => {});
      await sleep(500);
      const apps = await d.page.evaluate(() => [...document.querySelectorAll('#grid .tile')].map(t => {
        const r = t.getBoundingClientRect(), i = t.querySelector('.ticon'), l = t.querySelector('.tlabel');
        const lr = l.getBoundingClientRect(), lh = parseFloat(getComputedStyle(l).lineHeight) || parseFloat(getComputedStyle(l).fontSize) * 1.15;
        const g = i && (i.querySelector('svg') || i);
        return { id: t.dataset.id, x: Math.round(r.left), top: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height),
          icon: i ? Math.round(i.getBoundingClientRect().width) : null, glyph: g ? Math.round(g.getBoundingClientRect().width) : null,
          labelPx: parseFloat(getComputedStyle(l).fontSize), labelLines: Math.round(lr.height / lh) };
      }));
      await d.page.screenshot({ path: path.join(OUT1, `apps-${dev}.png`), scale: 'css', animations: 'disabled' });
      await d.goto('#home');
      await d.page.waitForFunction(() => window.hub && hub.sync.lastPull > 0 && document.querySelector('#view-home .gcard'), null, { timeout: 15000 }).catch(() => {});
      await sleep(600);
      const home = await d.page.evaluate(() => {
        const tb = document.querySelector('#tabbar').getBoundingClientRect();
        const vis = innerWidth >= 1024 ? innerHeight : tb.top;
        const cards = [...document.querySelectorAll('#view-home .gcard')].map(c => { const r = c.getBoundingClientRect(); return { title: c.querySelector('h2').textContent.trim(), w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top), bottom: Math.round(r.bottom) }; });
        const rem = document.querySelector('#remlist'), remCard = rem && rem.closest('.card'), feed = document.querySelector('#feed'), feedCard = feed && feed.closest('.card');
        const box = e => e ? (r => ({ top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height) }))(e.getBoundingClientRect()) : null;
        return { viewport: [innerWidth, innerHeight], visibleBottom: Math.round(vis), cards, cardsFullyVisible: cards.filter(c => c.bottom <= vis).length,
          remindersCard: box(remCard), remlist: box(rem), feedCard: box(feedCard), feed: box(feed),
          feedRows: feed ? feed.querySelectorAll('.fline').length : null, scrollHeight: document.querySelector('#views').scrollHeight,
          docScroll: document.documentElement.scrollHeight };
      });
      await d.page.screenshot({ path: path.join(OUT3, `home-${dev}-full.png`), scale: 'css', animations: 'disabled', fullPage: true }).catch(() => {});
      res[dev] = { apps, home };
      console.log(dev, JSON.stringify({ tiles: apps.map(a => `${a.id}:${a.w}x${a.h}@${a.top} l${a.labelLines}`), home }, null, 0).slice(0, 2000));
    } finally { await d.close(); }
  }
} finally { await L.close(); }
fs.writeFileSync(path.join(OUT1, 'measure.json'), JSON.stringify(res, null, 1));
fs.writeFileSync(path.join(OUT3, 'measure.json'), JSON.stringify(res, null, 1));
