// HOME: layout leads from audits/01-leads.md (Shell section), measured rather than eyeballed.
//   hero    the Home hero summary: how wide it may run (padding-right 40%, max-width 34ch) and how many lines it takes
//   grid    the glance-card grid: cards per row, empty cells, the tallest vs shortest card in a row (stretch)
//   chips   the Kids card chips (overflow variant): text clipped at the card edge?
//   tiles   Apps tiles: are the small tiles square (index.html:217 says "squares stay square")?
//   Also: the adult F260 card's sub-line clipped by the 2-line clamp.
//
//   node "audits/tools/phase2/HOME/layout.mjs"      → audits/evidence/p2/HOME/layout.json
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/HOME');
const DEVS = ['iphone-pwa', 'ipad-portrait', 'ipad-landscape', 'desktop'];
const L = await local({ variant: 'typical', clock: 'demo' });
const res = {};
const probe = page => page.evaluate(() => {
  const hero = document.querySelector('#view-home .home-hero'), sub = hero.querySelector('.hero-sub');
  const r = document.createRange(); r.selectNodeContents(sub);
  const lines = new Set([...r.getClientRects()].map(x => Math.round(x.top))).size;
  const hs = getComputedStyle(hero);
  const cards = [...document.querySelectorAll('#view-home .glance > .gcard')].map(c => { const b = c.getBoundingClientRect(); const body = c.querySelector('.gbody').getBoundingClientRect(); return { title: c.querySelector('h2').textContent.trim(), top: Math.round(b.top), left: Math.round(b.left), w: Math.round(b.width), h: Math.round(b.height), bodyH: Math.round(body.height) }; });
  const cols = getComputedStyle(document.querySelector('#view-home .glance')).gridTemplateColumns.split(' ').length;
  const rows = {}; for (const c of cards) (rows[c.top] = rows[c.top] || []).push(c);
  const rowInfo = Object.values(rows).map(rw => ({ cards: rw.map(c => c.title), empty: cols - rw.length }));
  const chips = [...document.querySelectorAll('#view-home .kid-chip')].map(c => { const card = c.closest('.gcard').getBoundingClientRect(); const cr = c.getBoundingClientRect(); return { text: c.textContent.trim(), right: Math.round(cr.right), cardRight: Math.round(card.right - parseFloat(getComputedStyle(c.closest('.gcard')).paddingRight)), clipped: cr.right > card.right - 1 || c.scrollWidth > c.clientWidth + 1 }; });
  const f260sub = document.querySelector('#view-home .gcard .gsub');
  const clipped = f260sub ? f260sub.scrollHeight > f260sub.clientHeight + 1 || f260sub.scrollWidth > f260sub.clientWidth + 1 : null;
  return { hero: { width: Math.round(hero.getBoundingClientRect().width), paddingRight: hs.paddingRight, subWidth: Math.round(sub.getBoundingClientRect().width), subLines: lines, text: sub.textContent }, glance: { columns: cols, rows: rowInfo, cards }, chips, f260Sub: f260sub && { text: f260sub.textContent, clipped } };
});
for (const variant of ['typical', 'overflow']) {
  if (variant !== 'typical') await L.reset(variant);
  for (const dev of DEVS) {
    const d = await L.device({ device: dev, profile: 'eli' });
    await d.goto('#home');
    await d.page.waitForFunction(() => window.hub && hub.sync.lastPull > 0 && document.querySelector('#view-home .gcard'), null, { timeout: 15000 }).catch(() => {});
    await sleep(600);
    const h = await probe(d.page);
    await d.goto('#apps'); await sleep(900);
    const tiles = await d.page.evaluate(() => [...document.querySelectorAll('#grid .tile:not(.wide)')].map(t => { const r = t.getBoundingClientRect(); return { id: t.dataset.id, w: Math.round(r.width), h: Math.round(r.height) }; }));
    const nonSquare = tiles.filter(t => Math.abs(t.w - t.h) > 2);
    res[`${variant}-${dev}`] = { ...h, tiles: { count: tiles.length, nonSquare } };
    console.log(`\n== ${variant} ${dev}: hero ${h.hero.width}px wide, padding-right ${h.hero.paddingRight}, summary ${h.hero.subWidth}px wide in ${h.hero.subLines} line(s): "${h.hero.text}"`);
    console.log(`   glance ${h.glance.columns} col(s): ${h.glance.rows.map(r => '[' + r.cards.join(', ') + (r.empty > 0 ? ` + ${r.empty} empty` : '') + ']').join(' ')}; card heights ${h.glance.cards.map(c => c.title + ' ' + c.h + '/' + c.bodyH).join(', ')}`);
    console.log(`   kids chips: ${h.chips.map(c => `"${c.text}" ${c.clipped ? 'CLIPPED' : 'ok'}`).join(' | ')}; F260 sub "${h.f260Sub && h.f260Sub.text}" clipped: ${h.f260Sub && h.f260Sub.clipped}`);
    console.log(`   small tiles: ${tiles.length}, not square: ${nonSquare.map(t => t.id + ' ' + t.w + '×' + t.h).join(', ') || 'none'}`);
    await d.close();
  }
}
fs.writeFileSync(path.join(OUT, 'layout.json'), JSON.stringify(res, null, 1));
await L.close();
