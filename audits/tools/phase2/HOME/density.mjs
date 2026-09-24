// HOME brief (2): tile density per device.
// Measures the Apps grid (columns, tile size, icon size, gaps, label size, rows, how many tiles are visible without
// scrolling) for an adult (Eli, 9 apps) and a kid (Ezra, 6 apps) on every device of the matrix, plus the Home glance
// cards (count, size, how many sit above the fold), on the local instance (typical data, demo clock).
//
//   node "audits/tools/phase2/HOME/density.mjs"
// Writes audits/evidence/p2/HOME/density.json and 1× screenshots density-apps-<device>.png.
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/HOME');
fs.mkdirSync(OUT, { recursive: true });
const DEVS = ['iphone-pwa', 'iphone-safari', 'ipad-portrait', 'ipad-landscape', 'desktop'];
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const res = {};

const gridMetrics = page => page.evaluate(() => {
  const g = document.querySelector('#grid'); const cs = getComputedStyle(g);
  const views = document.querySelector('#views').getBoundingClientRect();
  const tabbar = document.querySelector('#tabbar').getBoundingClientRect();
  const visBottom = innerWidth >= 1024 ? innerHeight : tabbar.top;          // phone/tablet: the tab bar covers the bottom
  const tiles = [...g.querySelectorAll('.tile')].map(t => { const r = t.getBoundingClientRect(); const i = t.querySelector('.ticon').getBoundingClientRect(); const l = t.querySelector('.tlabel'); return { id: t.dataset.id, wide: t.classList.contains('wide'), w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top), bottom: Math.round(r.bottom), icon: Math.round(i.width), glyph: Math.round((t.querySelector('.ticon svg') || t.querySelector('.ticon')).getBoundingClientRect().width), label: l ? parseFloat(getComputedStyle(l).fontSize) : null }; });
  const small = tiles.filter(t => !t.wide);
  const rows = new Set(tiles.map(t => t.top)).size;
  const gr = g.getBoundingClientRect();
  return {
    viewport: [innerWidth, innerHeight], columns: cs.gridTemplateColumns.split(' ').length, colGap: parseFloat(cs.columnGap), rowGap: parseFloat(cs.rowGap),
    gridWidth: Math.round(gr.width), gridTop: Math.round(gr.top), gridHeight: Math.round(gr.height), rows,
    tile: small[0] ? { w: small[0].w, h: small[0].h, icon: small[0].icon, glyph: small[0].glyph, label: small[0].label } : null,
    wide: tiles.find(t => t.wide) || null,
    pitch: small.length > 1 ? Math.round(small[1].w + parseFloat(cs.columnGap)) : null,
    tileAreaShare: +(small.reduce((s, t) => s + t.w * t.h, 0) / (innerWidth * innerHeight)).toFixed(3),
    count: tiles.length, fullyVisible: tiles.filter(t => t.bottom <= visBottom && t.top >= 0).length,
    iconShareOfTile: small[0] ? +(small[0].icon / small[0].w).toFixed(2) : null,
  };
});
const homeMetrics = page => page.evaluate(() => {
  const tabbar = document.querySelector('#tabbar').getBoundingClientRect();
  const visBottom = innerWidth >= 1024 ? innerHeight : tabbar.top;
  const cards = [...document.querySelectorAll('#view-home .gcard')].map(c => { const r = c.getBoundingClientRect(); return { title: c.querySelector('h2').textContent.trim(), w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top), bottom: Math.round(r.bottom) }; });
  const hero = document.querySelector('#view-home .home-hero').getBoundingClientRect();
  const rem = document.querySelector('#remlist'); const feed = document.querySelector('#feed');
  return { hero: { h: Math.round(hero.height) }, cards, cardsFullyVisible: cards.filter(c => c.bottom <= visBottom).length, visibleBottom: Math.round(visBottom),
    remindersTop: rem ? Math.round(rem.getBoundingClientRect().top) : null, feedTop: feed ? Math.round(feed.getBoundingClientRect().top) : null,
    contentHeight: document.querySelector('#views').scrollHeight };
});

for (const dev of DEVS) {
  for (const who of ['eli', 'ezra']) {
    const d = await L.device({ device: dev, profile: who });
    await d.goto('#apps');
    await d.page.waitForFunction(() => window.hub && hub.sync.lastPull > 0 && document.querySelectorAll('#grid .tile svg').length > 3, null, { timeout: 15000 }).catch(() => {});
    await sleep(500);
    const g = await gridMetrics(d.page);
    if (who === 'eli') await d.page.screenshot({ path: path.join(OUT, `density-apps-${dev}.png`), scale: 'css', animations: 'disabled' });
    await d.goto('#home');
    await d.page.waitForFunction(() => window.hub && hub.sync.lastPull > 0 && document.querySelector('#view-home .gcard'), null, { timeout: 15000 }).catch(() => {});
    await sleep(400);
    const h = await homeMetrics(d.page);
    res[`${who}-${dev}`] = { apps: g, home: h };
    console.log(`${who.padEnd(4)} ${dev.padEnd(15)} Apps: ${g.columns} cols, tile ${g.tile && g.tile.w}×${g.tile && g.tile.h} px, icon ${g.tile && g.tile.icon} px (glyph ${g.tile && g.tile.glyph}), gap ${g.colGap}/${g.rowGap}, pitch ${g.pitch}, label ${g.tile && g.tile.label}px, ${g.count} tiles in ${g.rows} rows, ${g.fullyVisible}/${g.count} fully visible, tiles cover ${(g.tileAreaShare * 100).toFixed(0)}% of the screen` +
      (g.wide ? `, wide tile ${g.wide.w}×${g.wide.h}` : '') +
      `\n     Home: hero ${h.hero.h}px, ${h.cards.length} cards (${h.cards.map(c => c.title + ' ' + c.w + '×' + c.h).join(', ')}), ${h.cardsFullyVisible} fully above the fold (visible bottom ${h.visibleBottom}), reminders list top ${h.remindersTop}, feed top ${h.feedTop}, content ${h.contentHeight}px`);
    await d.close();
  }
}
fs.writeFileSync(path.join(OUT, 'density.json'), JSON.stringify(res, null, 1));
await L.close();
