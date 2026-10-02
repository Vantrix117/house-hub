// Batch 5 (the Home Verses card's review): three checks on every Home card (.gcard), measured in the page.
//   1. art: the spot art's box (.spot, clipped to the card) against the box of every text node in the card (headings,
//      numbers, lines, button labels, skeleton placeholders); any intersection over half a pixel each way is an overlap.
//   2. wrap (review round 6): the button's label stays on one line wherever one line physically fits in the card's footer
//      (its one-line width ≤ the footer's width). A label wider than the whole card may wrap; it is listed, not failed.
//   3. cut (review round 6): no name or number is cut off — a kid's name, star count or badges, a park name or time, a
//      fridge line. Failed at the default text size; at XXL it is listed (the report compares it with batch 4). A phone's
//      one-line .gbig / .gsub ellipsised (the pager's one-line design since batch 2a) is counted and listed, not failed.
//   4. round 7: no visible art narrower than 48 px (a speck); the kid's Stars headline on one line and a week's seven
//      stars on one row inside the card, at the default size.
// Swept: the typical day and a park day; Eli, a guest (given two memorised verses so the Verses card shows), Mom and Ezra (a kid);
// 390 / 820 / 1180 / 1440 (iPhone PWA, iPad portrait, iPad landscape, desktop); light and dark; the default text size and
// XXL; three states — first visit (a fresh device, Home after its first pull), loading (the data requests held, skeletons)
// and offline (a warm device reopened with the house unreachable). Run from the repo root on the rig (no Worker needed):
//   node audits/tools/phase6/5/home-art-5.mjs [--overlay <folder under audits/ served over the repo>] [--label <name>]
//        [--quick (light only)] [--variants typical,park]
// Exit 0 only when there is no art overlap, no wrapped label that fits and no cut text at the default size.
// Evidence: audits/evidence/p6/5/home-art/<label>.json (+ a PNG per failing load).
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const ROOT = process.cwd();
const { local, sleep } = await import(pathToFileURL(path.join(ROOT, 'audits/tools/lib/local.mjs')).href);
const arg = n => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : null; };
const overlay = arg('overlay'), quick = process.argv.includes('--quick');
const label = arg('label') || (overlay ? 'overlay-' + path.basename(overlay) : 'current');
const VARIANTS = (arg('variants') || 'typical,park').split(',');
const OUT = path.join(ROOT, 'audits/evidence/p6/5/home-art'); fs.mkdirSync(OUT, { recursive: true });
const HOLD = /\/api\/(data|activity|profiles)/;
const DEVS = { 390: 'iphone-pwa', 820: 'ipad-portrait', 1180: 'ipad-landscape', 1440: 'desktop' };

function measure() {
  const textBoxes = (root, skip) => { const out = []; const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode(); n; n = walk.nextNode()) { if (!n.textContent.trim() || (skip && skip.contains(n))) continue; const range = document.createRange(); range.selectNodeContents(n); for (const r of range.getClientRects()) out.push({ text: n.textContent.trim().slice(0, 40), r }); } return out; };
  return [...document.querySelectorAll('#view-home .gcard')].filter(card => card.getClientRects().length).map(card => {   // a card taking no place (a loading Verses card below 1024 px) is not on screen
    const c = card.getBoundingClientRect(), img = card.querySelector('.spot');
    const name = (card.querySelector('h2') || {}).textContent?.trim() || card.className;
    // 1. art against text
    const hits = []; let art = null;
    if (img && getComputedStyle(img).display !== 'none' && getComputedStyle(img).visibility !== 'hidden' && +getComputedStyle(img).opacity > 0) {
      const a0 = img.getBoundingClientRect();
      const a = { l: Math.max(a0.left, c.left), t: Math.max(a0.top, c.top), r: Math.min(a0.right, c.right), b: Math.min(a0.bottom, c.bottom) };
      art = { w: Math.round(a.r - a.l), h: Math.round(a.b - a.t) };
      for (const { text, r } of textBoxes(card)) {
        const w = Math.min(r.right, a.r) - Math.max(r.left, a.l), h = Math.min(r.bottom, a.b) - Math.max(r.top, a.t);
        if (w > 0.5 && h > 0.5) hits.push({ text, w: Math.round(w), h: Math.round(h) });
      }
    }
    // 2. the button's label on one line where it fits
    const btn = card.querySelector('.gfoot > .btn, :scope > .btn'), foot = card.querySelector('.gfoot') || card;
    let wrap = null;
    if (btn) {
      const range = document.createRange(); range.selectNodeContents(btn);
      const tops = new Set([...range.getClientRects()].filter(r => r.width > 0.5).map(r => Math.round(r.top / 4)));
      const probe = btn.cloneNode(true); probe.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;max-width:none;width:max-content;flex:none;left:0;top:0';
      card.appendChild(probe); const one = probe.getBoundingClientRect().width; probe.remove();
      const room = foot.clientWidth;
      wrap = { label: btn.textContent.trim(), lines: tops.size, w: Math.round(btn.getBoundingClientRect().width), oneLine: Math.round(one), room: Math.round(room), fits: one <= room + 0.5 };
    }
    // 3. cut names and numbers (a kid's name, stars and badges; a park name and time; a fridge line)
    const cut = [...card.querySelectorAll('.kn, .pn, .pt, .kid-chip, .kid-chip b, .kb, .fl span')].filter(e => {
      if (getComputedStyle(e).display === 'none') return false;
      const r = e.getBoundingClientRect();
      return e.scrollWidth > e.clientWidth + 1 && !e.matches('.kid-chip') || r.right > c.right - 0.5 || r.left < c.left + 0.5;
    }).map(e => (e.classList[0] || e.tagName.toLowerCase()) + ': ' + e.textContent.trim().slice(0, 30));
    // listed only: a phone's one-line .gbig / .gsub ellipsised (the pager's one-line design since batch 2a; not names)
    const lines = [...card.querySelectorAll('.gbig, .gsub')].filter(e => getComputedStyle(e).textOverflow === 'ellipsis' && e.scrollWidth > e.clientWidth + 1).map(e => e.textContent.trim().slice(0, 30));
    // round 7: no speck of art (visible and narrower than 48 px); the kid's Stars headline on one line; a week's seven
    // stars on one row
    const speck = art && art.w < 48 ? art.w : null;
    const lineCount = e => { if (!e) return 0; const r = document.createRange(); r.selectNodeContents(e); return new Set([...r.getClientRects()].filter(x => x.width > 0.5).map(x => Math.round(x.top / 4))).size; };
    const title = card.classList.contains('stars-card') ? card.querySelector('.gbig.one') : null;
    const titleLines = title ? lineCount(title) : 0;
    const stars = [...card.querySelectorAll('.star-row > span')].slice(0, 7);
    const starRows = stars.length ? new Set(stars.map(s => Math.round(s.getBoundingClientRect().top))).size : 0;
    const starsOut = stars.some(s => s.getBoundingClientRect().right > c.right - 0.5);
    return { name, art, card: { w: Math.round(c.width), h: Math.round(c.height) }, hits, wrap, cut, lines, speck, titleLines, starRows, starsOut };
  });
}

const rows = []; const tot = { loads: 0, cards: 0, overlaps: 0, wrapsThatFit: 0, wrapsNoRoom: 0, cutDefault: 0, cutXxl: 0, phoneLinesEllipsised: 0, specks: 0, starsTitleWrapDefault: 0, starRowsBrokenDefault: 0 };
const cutXxl = {};
for (const variant of VARIANTS) {
  const L = await local({ variant, engine: 'chromium', overlay: overlay || undefined });
  const guest = Object.keys(L.S.sessions).find(id => /^guest-/.test(id));
  if (guest) for (const k of ['mem:1-0', 'mem:2-1']) await L.apiAs(guest, `/api/data/f260/${k}?scope=person`, { method: 'PUT', body: { value: true, updated_at: Date.now() } });
  const PROFILES = ['eli', guest, 'mom', 'ezra'].filter(Boolean);   // round 7: a kid's Home (the Stars card) too
  for (const prof of PROFILES) for (const [w, dev] of Object.entries(DEVS)) for (const mode of (quick ? ['light'] : ['light', 'dark'])) for (const size of ['m', 'xxl']) for (const state of ['first-visit', 'loading', 'offline']) {
    await L.apiAs(prof, '/api/data/hub/textSize?scope=person', { method: 'PUT', body: { value: size, updated_at: Date.now() } });
    const d = await L.device({ device: dev, mode, profile: prof, localStorage: { 'hub.prefs': { textSize: size }, ['hub.prefs.' + prof]: { textSize: size } } });
    try {
      if (state === 'loading') await d.ctx.route(u => HOLD.test(u.href) && u.href.startsWith(L.api), () => {});   // never answered
      await d.goto();
      if (state === 'loading') await sleep(1500);
      else await d.page.waitForFunction(() => window.hub && hub.sync && hub.sync.lastPull > 0, null, { timeout: 15000 }).catch(() => {});
      if (state === 'offline') { await sleep(500); await d.setOffline(true); await d.goto(); await sleep(1500); }
      await d.page.waitForSelector('#view-home .gcard', { timeout: 10000 }).catch(() => {});
      await d.page.evaluate(() => document.fonts && document.fonts.ready); await sleep(400);
      const m = await d.page.evaluate(measure);
      const tag = `${variant}-${prof === guest ? 'guest' : prof}-${w}-${mode}-${size}-${state}`;
      const art = m.filter(x => x.hits.length), wrapFit = m.filter(x => x.wrap && x.wrap.lines > 1 && x.wrap.fits), wrapNo = m.filter(x => x.wrap && x.wrap.lines > 1 && !x.wrap.fits), cut = m.filter(x => x.cut.length);
      tot.loads++; tot.cards += m.length; tot.overlaps += art.reduce((s, x) => s + x.hits.length, 0); tot.wrapsThatFit += wrapFit.length; tot.wrapsNoRoom += wrapNo.length; tot.phoneLinesEllipsised += m.reduce((s, x) => s + x.lines.length, 0);
      if (size === 'xxl') { tot.cutXxl += cut.length; for (const x of cut) for (const t of x.cut) (cutXxl[`${x.name} — ${t} @${w}`] ||= []).push(tag); } else tot.cutDefault += cut.length;
      const speck = m.filter(x => x.speck != null), tWrap = size !== 'xxl' ? m.filter(x => x.titleLines > 1) : [], sRow = size !== 'xxl' ? m.filter(x => x.starRows > 1 || x.starsOut) : [];
      tot.specks += speck.length; tot.starsTitleWrapDefault += tWrap.length; tot.starRowsBrokenDefault += sRow.length;
      const failed = art.length || wrapFit.length || (size !== 'xxl' && cut.length) || speck.length || tWrap.length || sRow.length;
      if (speck.length || tWrap.length || sRow.length) console.log(`  round 7 ${tag}: ` + [...speck.map(x => `speck ${x.name} ${x.speck}px`), ...tWrap.map(x => `${x.name} title on ${x.titleLines} lines`), ...sRow.map(x => `${x.name} stars on ${x.starRows} rows${x.starsOut ? ', past the card' : ''}`)].join(' · '));
      rows.push({ tag, cards: m.length, art: art.map(x => ({ card: x.name, art: x.art, hits: x.hits })), wrapsThatFit: wrapFit.map(x => ({ card: x.name, ...x.wrap })), wrapsNoRoom: wrapNo.map(x => ({ card: x.name, ...x.wrap })), cut: cut.map(x => ({ card: x.name, cut: x.cut })), heights: m.map(x => [x.name, x.card.h]) });
      if (failed) { await d.page.evaluate(n => { const c = [...document.querySelectorAll('#view-home .gcard')].find(x => (x.querySelector('h2') || {}).textContent?.trim() === n); if (c) c.scrollIntoView({ block: 'center', inline: 'center' }); }, (art[0] || wrapFit[0] || cut[0] || speck[0] || tWrap[0] || sRow[0]).name); await sleep(150); await d.shot(path.join(OUT, `${label}-${tag}.png`)); }
      const bits = [art.length ? 'art: ' + art.map(x => `${x.name}: ${x.hits.map(h => '"' + h.text + '"').join(', ')}`).join(' | ') : '', wrapFit.length ? 'wraps: ' + wrapFit.map(x => `${x.name} "${x.wrap.label}" (${x.wrap.oneLine}/${x.wrap.room})`).join(', ') : '', cut.length ? 'cut' + (size === 'xxl' ? ' (xxl, listed)' : '') + ': ' + cut.map(x => `${x.name}: ${x.cut.join(', ')}`).join(' | ') : ''].filter(Boolean);
      console.log(`${failed ? '✗' : '✓'} ${tag}: ${m.length} cards${bits.length ? ' — ' + bits.join(' · ') : ''}`);
    } finally { await d.close(); }
  }
  await L.close();
}
fs.writeFileSync(path.join(OUT, label + '.json'), JSON.stringify({ label, overlay, ...tot, cutXxl, rows }, null, 1));
console.log(`\n${label}: ${tot.loads} page loads, ${tot.cards} cards; art overlaps ${tot.overlaps}; labels wrapped where one line fits ${tot.wrapsThatFit} (wider than the card: ${tot.wrapsNoRoom}); names/numbers cut at the default size ${tot.cutDefault}, at XXL ${tot.cutXxl}; one-line phone lines ellipsised (listed, by design) ${tot.phoneLinesEllipsised}; round 7: art specks under 48 px ${tot.specks}, kid Stars headline wrapped (default size) ${tot.starsTitleWrapDefault}, a week's stars off one row (default size) ${tot.starRowsBrokenDefault}`);
if (Object.keys(cutXxl).length) { console.log('XXL cut (listed):'); for (const [k, v] of Object.entries(cutXxl)) console.log(`  ${k}  ×${v.length}`); }
process.exit(tot.overlaps || tot.wrapsThatFit || tot.cutDefault || tot.specks || tot.starsTitleWrapDefault || tot.starRowsBrokenDefault ? 1 : 0);
