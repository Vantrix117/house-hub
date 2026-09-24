// Skeptic #2 for VIS finding "picker-top-unreachable": is the top of the profile picker (#gate, index.html:29) really
// unreachable on a phone, by any scroll input, in both engines — and does it happen for the real 8-person household
// (no guest) or only with the rig's guest / long-name stress data?
//   node "audits/tools/phase2/VIS/verify-picker-top-unreachable-2.mjs"
// Signed-out picker only (profile: null): nothing is tapped, nothing is written. Evidence → audits/evidence/p2/VIS/verify-picker-top-2*.
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const EVID = path.join(ROOT, 'audits', 'evidence', 'p2', 'VIS');
fs.mkdirSync(EVID, { recursive: true });
const out = [];
const rel = f => path.relative(ROOT, f).replace(/\\/g, '/');

const measure = page => page.evaluate(() => {
  const g = document.querySelector('#gate'), t = document.querySelector('.gate-title').getBoundingClientRect();
  const cards = [...document.querySelectorAll('#profiles .pcard')];
  const c0 = cards[0].getBoundingClientRect();
  const hit = el => { const r = el.getBoundingClientRect(); const y = Math.max(1, Math.min(innerHeight - 1, r.top + r.height / 2)); const x = r.left + r.width / 2; const e = document.elementFromPoint(x, y); return !!(e && el.contains(e)) && r.bottom > 0; };
  return {
    viewport: [innerWidth, innerHeight], cards: cards.length, justify: getComputedStyle(g).justifyContent,
    scrollTop: Math.round(g.scrollTop), scrollHeight: g.scrollHeight, clientHeight: g.clientHeight,
    titleTop: Math.round(t.top), titleBottom: Math.round(t.bottom),
    firstCard: { name: ([...cards[0].children].find(e => e.tagName === 'SPAN' && !e.className) || {}).textContent, top: Math.round(c0.top), bottom: Math.round(c0.bottom), visiblePx: Math.max(0, Math.round(c0.bottom)) - Math.max(0, Math.round(c0.top)), tappableCentre: hit(cards[0]) },
    lastCardBottom: Math.round(cards.at(-1).getBoundingClientRect().bottom),
  };
});

// Every way a user or the browser could bring the top into view: wheel/trackpad up, scroll to the end and all the way
// back, programmatic scrollTo(-9999), focus + scrollIntoView of the title.
async function tryReach(page) {
  const r = {};
  // Mobile WebKit has no wheel input in Playwright; scrollBy is the same clamped user-scroll path. Wheel is tried too.
  try { await page.mouse.move(200, 400); await page.mouse.wheel(0, -4000); await sleep(400); r.wheel = 'ok'; } catch (e) { r.wheel = 'unsupported: ' + e.message.split('\n')[0]; }
  await page.evaluate(() => document.querySelector('#gate').scrollBy(0, -4000)); await sleep(300);
  r.afterWheelUp = await measure(page);
  await page.evaluate(() => document.querySelector('#gate').scrollBy(0, 6000)); await sleep(300);
  r.atBottom = await measure(page);
  await page.evaluate(() => document.querySelector('#gate').scrollBy(0, -8000)); await sleep(300);
  r.afterDownThenUp = await measure(page);
  await page.evaluate(() => { const g = document.querySelector('#gate'); g.tabIndex = -1; g.focus(); }); await page.keyboard.press('Home'); await page.keyboard.press('PageUp'); await sleep(300);
  r.afterHomeKey = await measure(page);
  await page.evaluate(() => document.querySelector('#gate').scrollTo(0, -9999)); await sleep(200);
  r.afterScrollToNegative = await measure(page);
  await page.evaluate(() => document.querySelector('.gate-title').scrollIntoView({ block: 'start' })); await sleep(300);
  r.afterTitleScrollIntoView = await measure(page);
  await page.evaluate(() => { document.querySelector('#gate').scrollTop = 0; document.querySelector('#profiles .pcard').focus(); }); await sleep(300);
  r.afterFocusFirstCard = await measure(page);
  return r;
}

async function run(engine) {
  const L = await local({ variant: 'typical', engine });
  try {
    const cases = [
      { device: 'iphone-pwa', tag: 'rig 430x932 PWA' },
      { device: 'iphone-safari', tag: 'rig 430x740 Safari' },
      { device: 'iphone-pwa', vp: { width: 390, height: 844 }, tag: '390x844 (iPhone 14/15/16 class)' },
      { device: 'iphone-pwa', vp: { width: 390, height: 797 }, tag: '390x797 (≈390x844 PWA minus 47 px opaque status bar)' },
      { device: 'ipad-portrait', tag: 'rig iPad portrait 820x1180' },
      { device: 'ipad-landscape', tag: 'rig iPad landscape 1180x820' },
    ];
    for (const c of cases) {
      const d = await L.device({ device: c.device, mode: 'light', profile: null, fixedTime: false });
      if (c.vp) await d.page.setViewportSize(c.vp);
      await d.goto('');
      await d.page.waitForSelector('#profiles .pcard:not(.skeleton)'); await sleep(900);
      const row = { engine, case: c.tag };
      row.withGuest = { initial: await measure(d.page), ...(await tryReach(d.page)) };
      if (engine === 'webkit' && !c.vp) {
        await d.page.evaluate(() => document.querySelector('#gate').scrollTop = 0);
        const f = path.join(EVID, `verify-picker-top-2-${c.device}-guest.png`);
        await d.page.screenshot({ path: f, scale: 'css', animations: 'disabled', caret: 'hide' }); row.shotWithGuest = rel(f);
      }
      // The real household (worker/seed.sql) has 8 profiles and may have no guest: drop the demo guest card in the page only.
      await d.page.evaluate(() => { document.querySelectorAll('#profiles .pcard').forEach(b => { if (/^guest-/.test(b.dataset.id)) b.remove(); }); document.querySelector('#gate').scrollTop = 0; });
      await sleep(200);
      row.householdOnly = { initial: await measure(d.page), ...(await tryReach(d.page)) };
      if (engine === 'webkit' && c.device !== 'iphone-safari' && c.vp && c.vp.height === 844) {
        await d.page.evaluate(() => document.querySelector('#gate').scrollTop = 0);
        const f = path.join(EVID, `verify-picker-top-2-390x844-household.png`);
        await d.page.screenshot({ path: f, scale: 'css', animations: 'disabled', caret: 'hide' }); row.shotHousehold = rel(f);
      }
      // Control (in-page style only, no app file touched): the same content with top-aligned flex + margin:auto centring.
      if (engine === 'webkit') {
        await d.page.addStyleTag({ content: '#gate{justify-content:flex-start!important}#gate-panel{margin-block:auto}' });
        await d.page.evaluate(() => document.querySelector('#gate').scrollTop = 0); await sleep(200);
        row.controlMarginAuto = await measure(d.page);
      }
      out.push(row);
      const s = x => `scrollTop ${x.scrollTop}/${x.scrollHeight - x.clientHeight}, title ${x.titleTop}..${x.titleBottom}, first card "${x.firstCard.name}" ${x.firstCard.top}..${x.firstCard.bottom} (visible ${x.firstCard.visiblePx}px, tappable ${x.firstCard.tappableCentre})`;
      console.log(`\n[${engine}] ${c.tag}  justify=${row.withGuest.initial.justify}`);
      console.log(`  with guest (${row.withGuest.initial.cards} cards) initial:        ` + s(row.withGuest.initial));
      console.log(`  with guest after scroll down→up:          ` + s(row.withGuest.afterDownThenUp));
      console.log(`  with guest after title.scrollIntoView:   ` + s(row.withGuest.afterTitleScrollIntoView));
      console.log(`  household only (${row.householdOnly.initial.cards} cards) initial:    ` + s(row.householdOnly.initial));
      console.log(`  household only after scroll down→up:      ` + s(row.householdOnly.afterDownThenUp));
      if (row.controlMarginAuto) console.log(`  CONTROL margin:auto (household only):    ` + s(row.controlMarginAuto));
      await d.close();
    }
  } finally { await L.close(); }
}

// Real wheel input (Playwright only supports it in non-mobile contexts): the rig's desktop device resized to a phone
// and to short laptop windows, so the scroll goes through the engine's own user-scroll path rather than scrollBy().
async function wheelRun(engine, variant = 'typical', vps = [{ width: 430, height: 740 }, { width: 1280, height: 650 }, { width: 1366, height: 657 }, { width: 1440, height: 900 }]) {
  const L = await local({ variant, engine });
  try {
    for (const vp of vps) {
      const d = await L.device({ device: 'desktop', mode: 'light', profile: null, fixedTime: false });
      await d.page.setViewportSize(vp);
      await d.goto('');
      await d.page.waitForSelector('#profiles .pcard:not(.skeleton)'); await sleep(900);
      const initial = await measure(d.page);
      await d.page.mouse.move(vp.width / 2, vp.height / 2);
      for (let i = 0; i < 6; i++) { await d.page.mouse.wheel(0, -400); await sleep(150); }
      await sleep(500);
      const afterWheelUp = await measure(d.page);
      const row = { engine, case: `${variant}: desktop context ${vp.width}x${vp.height}, real wheel`, initial, afterWheelUp };
      if (engine === 'webkit' && vp.width === 430 && variant === 'typical') {
        const f = path.join(EVID, 'verify-picker-top-2-webkit-430x740-after-wheel-up.png');
        await d.page.screenshot({ path: f, scale: 'css', animations: 'disabled', caret: 'hide' }); row.shotAfterWheelUp = rel(f);
      }
      out.push(row);
      const s = x => `scrollTop ${x.scrollTop} (range ${x.scrollHeight - x.clientHeight}), title ${x.titleTop}..${x.titleBottom}, first card ${x.firstCard.top}..${x.firstCard.bottom}`;
      console.log(`\n[${engine}] ${row.case} (${initial.cards} cards)\n  initial:        ${s(initial)}\n  after wheel up: ${s(afterWheelUp)}`);
      await d.close();
    }
  } finally { await L.close(); }
}

await run('webkit');
await run('chromium');
await wheelRun('webkit');
await wheelRun('chromium');
await wheelRun('webkit', 'overflow', [{ width: 430, height: 932 }, { width: 430, height: 740 }]);
const f = path.join(EVID, 'verify-picker-top-unreachable-2.json');
fs.writeFileSync(f, JSON.stringify(out, null, 1));
console.log('\nwrote', rel(f));
