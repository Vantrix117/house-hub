// Skeptic #1 for VIS finding "picker-top-unreachable": is the top of the profile picker (#gate, index.html:29) really
// out of reach on an iPhone? Independent of leads.mjs. For each scenario it signs out to the picker, then:
//   - reads the natural scrollTop after load (showPicker focuses a card), scrollHeight / clientHeight;
//   - tries every way up: scrollTop = -9999, a big wheel-up, title.scrollIntoView() — and reads where the title ends up;
//   - at the minimum scroll position measures the title, the first card, its avatar and its name;
//   - control: same page with the centring made "safe" (#gate justify-content:flex-start + .gate-panel margin-block:auto,
//     injected in the test page only) to show the centring is the cause.
// Scenarios: typical (8 household profiles + guest Grandma Jo = 9 cards), typical with the guest card removed from the DOM
// (the 8 profiles in CLAUDE.md), overflow (12 cards); iPhone PWA 430×932 and Safari 430×740 (rig devices), plus a 6.1"
// iPhone 393×852 PWA / 393×659 Safari; optional real-device safe-area (bottom 34 px home indicator) via --safe-bottom.
//   node "audits/tools/phase2/VIS/verify-picker-top-unreachable-1.mjs"            (WebKit)
//   node "audits/tools/phase2/VIS/verify-picker-top-unreachable-1.mjs" chromium   (engine cross-check)
// Key output per scenario: minScrollTop (what scrollTop = -9999 clamps to), h1 at that position, wheelUp, scrollIntoViewTitle.
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const engine = process.argv[2] === 'chromium' ? 'chromium' : 'webkit';
const EV = path.join(ROOT, 'audits/evidence/p2/VIS');
fs.mkdirSync(EV, { recursive: true });
const results = [];

const measure = page => page.evaluate(async () => {
  const g = document.querySelector('#gate');
  const r = el => { if (!el) return null; const b = el.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom) }; };
  const naturalScrollTop = g.scrollTop; const h1TopAtNatural = Math.round(document.querySelector('.gate-title h1').getBoundingClientRect().top);
  g.scrollTop = 0; const h1TopAtZero = Math.round(document.querySelector('.gate-title h1').getBoundingClientRect().top);
  g.scrollTop = -9999; const afterNegative = g.scrollTop;
  const card = document.querySelector('#profiles .pcard');
  const cards = [...document.querySelectorAll('#profiles .pcard')];
  return {
    cards: cards.length, rows: new Set(cards.map(c => Math.round(c.getBoundingClientRect().top))).size,
    naturalScrollTop, h1TopAtNatural, h1TopAtZero, minScrollTop: afterNegative, scrollHeight: g.scrollHeight, clientHeight: g.clientHeight,
    padTop: getComputedStyle(g).paddingTop, padBottom: getComputedStyle(g).paddingBottom,
    h1: r(document.querySelector('.gate-title h1')), whoIsThis: r(document.querySelector('.gate-title p')),
    firstCard: card && { id: card.dataset.id, ...r(card), avatar: r(card.querySelector('.avatar')), name: r(card.querySelector(':scope > span:not(.avatar):not(.psub)')), sub: r(card.querySelector('.psub')) },
    secondCard: cards[1] && { id: cards[1].dataset.id, ...r(cards[1]), avatar: r(cards[1].querySelector('.avatar')), name: r(cards[1].querySelector(':scope > span:not(.avatar):not(.psub)')) },
    lastCardBottomAtMaxScroll: (() => { g.scrollTop = 1e6; const b = r(cards[cards.length - 1]).bottom; const max = g.scrollTop; g.scrollTop = 0; return { maxScrollTop: max, lastCardBottom: b, viewportH: innerHeight }; })(),
  };
});

async function scenario(L, { label, device, size, dropGuest, safeBottom }) {
  const d = await L.device({ device, profile: null, mode: 'light' });
  if (size) await d.page.setViewportSize(size);
  await d.goto('');
  await d.page.waitForSelector('#profiles .pcard:not(.skeleton)');
  await sleep(800);
  if (dropGuest) await d.page.evaluate(() => document.querySelectorAll('#profiles .pcard[data-id^="guest-"]').forEach(e => e.remove()));
  if (safeBottom) await d.page.addStyleTag({ content: `:root{--safe-bottom:${safeBottom}px !important}` });
  await sleep(100);
  const m = await measure(d.page);
  // wheel up hard from the middle of the gate, then scrollIntoView the title
  await d.page.evaluate(() => { document.querySelector('#gate').scrollTop = 200; });
  await d.page.mouse.move(200, 400).catch(() => {});
  let wheel = null;
  try { await d.page.mouse.wheel(0, -3000); await sleep(400); wheel = await d.page.evaluate(() => ({ scrollTop: document.querySelector('#gate').scrollTop, h1Top: Math.round(document.querySelector('.gate-title h1').getBoundingClientRect().top) })); } catch (e) { wheel = 'wheel unsupported: ' + e.message.slice(0, 80); }
  const siv = await d.page.evaluate(() => { const h = document.querySelector('.gate-title h1'); h.scrollIntoView({ block: 'start' }); return { scrollTop: document.querySelector('#gate').scrollTop, h1Top: Math.round(h.getBoundingClientRect().top) }; });
  const vp = d.page.viewportSize();
  // two 1x shots: as the picker opens (its own initial scroll position) and scrolled all the way up
  const png = path.join(EV, `verify-picker-top-unreachable-1-${engine}-${label}-opens.png`);
  await d.page.evaluate(t => { document.querySelector('#gate').scrollTop = t; }, m.naturalScrollTop);
  await d.page.screenshot({ path: png, scale: 'css', animations: 'disabled', caret: 'hide' });
  const pngTop = path.join(EV, `verify-picker-top-unreachable-1-${engine}-${label}-scrolled-up.png`);
  await d.page.evaluate(() => { document.querySelector('#gate').scrollTop = -9999; });
  await d.page.screenshot({ path: pngTop, scale: 'css', animations: 'disabled', caret: 'hide' });
  // control: safe centring (test page only)
  await d.page.addStyleTag({ content: '#gate{justify-content:flex-start !important} .gate-panel{margin-block:auto !important}' });
  await sleep(100);
  const ctl = await d.page.evaluate(() => { const g = document.querySelector('#gate'); g.scrollTop = 0; const h = document.querySelector('.gate-title h1').getBoundingClientRect(); const c = document.querySelector('#profiles .pcard').getBoundingClientRect(); return { h1Top: Math.round(h.top), firstCardTop: Math.round(c.top), scrollHeight: g.scrollHeight, clientHeight: g.clientHeight }; });
  const res = { engine, label, viewport: vp, dropGuest: !!dropGuest, safeBottom: safeBottom || 0, ...m, wheelUp: wheel, scrollIntoViewTitle: siv, controlSafeCentre: ctl, shot: path.relative(ROOT, png).replace(/\\/g, '/'), shotScrolledUp: path.relative(ROOT, pngTop).replace(/\\/g, '/') };
  results.push(res);
  const verdict = (m.h1.top < 0 ? `TITLE CUT at min scroll (h1 top ${m.h1.top})` : `title reachable at min scroll (h1 top ${m.h1.top})`) + `; scroll range [${m.minScrollTop}, ${m.lastCardBottomAtMaxScroll.maxScrollTop}], opens at scrollTop ${m.naturalScrollTop} with h1 top ${m.h1TopAtNatural} (h1 top at scrollTop 0: ${m.h1TopAtZero}); wheel-up ${JSON.stringify(wheel)}; scrollIntoView ${JSON.stringify(siv)}`;
  console.log(`\n## ${label} [${engine}] ${vp.width}x${vp.height} cards=${m.cards} rows=${m.rows} → ${verdict}; first card ${m.firstCard.id} top ${m.firstCard.top} (avatar ${JSON.stringify(m.firstCard.avatar)}, name ${JSON.stringify(m.firstCard.name)})`);
  console.log(JSON.stringify(res));
  await d.close();
}

for (const variant of ['typical', 'overflow']) {
  const L = await local({ variant, engine });
  try {
    await scenario(L, { label: `${variant}-iphone-pwa-430x932`, device: 'iphone-pwa' });
    await scenario(L, { label: `${variant}-iphone-safari-430x740`, device: 'iphone-safari' });
    // non-mobile context at iPhone size so a real wheel gesture can be sent (mobile WebKit refuses mouse.wheel)
    await scenario(L, { label: `${variant}-wheel-desktopctx-430x740`, device: 'desktop', size: { width: 430, height: 740 } });
    // desktop target: the rig's 1440×900 and a short laptop browser viewport
    await scenario(L, { label: `${variant}-desktop-1440x900`, device: 'desktop' });
    await scenario(L, { label: `${variant}-desktop-1280x633`, device: 'desktop', size: { width: 1280, height: 633 } });
    if (variant === 'typical') {
      await scenario(L, { label: 'typical-noguest-iphone-pwa-430x932', device: 'iphone-pwa', dropGuest: true });
      await scenario(L, { label: 'typical-noguest-iphone-safari-430x740', device: 'iphone-safari', dropGuest: true });
      await scenario(L, { label: 'typical-noguest-iphone-pwa-393x852', device: 'iphone-pwa', size: { width: 393, height: 852 }, dropGuest: true });
      await scenario(L, { label: 'typical-noguest-iphone-pwa-393x793-safe34', device: 'iphone-pwa', size: { width: 393, height: 793 }, dropGuest: true, safeBottom: 34 });
      await scenario(L, { label: 'typical-noguest-iphone-safari-393x659', device: 'iphone-safari', size: { width: 393, height: 659 }, dropGuest: true });
      await scenario(L, { label: 'typical-noguest-ipad-portrait', device: 'ipad-portrait', dropGuest: true });
    }
  } finally { await L.close(); }
}
fs.writeFileSync(path.join(EV, `verify-picker-top-unreachable-1-${engine}.json`), JSON.stringify(results, null, 1));
console.log('\nwrote', `audits/evidence/p2/VIS/verify-picker-top-unreachable-1-${engine}.json`);
