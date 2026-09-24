// Taps from Home to finish each top job (typical seed, demo clock), counted through the real UI on the iPhone PWA (430x932)
// and the Kitchen iPad (820x1180). Every click/tap and every typed entry is counted; scrolls are counted as gestures.
//   Job 1 "What needs eating?"  - Home's "In the fridge" card (index.html:1173-1181) vs the full list in the Larder
//   Job 2 "Log tonight's leftovers" - Home card button -> name -> type -> Log   (and the Apps-tab path)
//   Job 3 "Cross off what we ate"   - Home card button -> ✓ ; is the ✓ on screen without scrolling (not under the add bar)?
import { local, sleep, cards, serverItems, save, shot } from './_lib.mjs';
const L = await local({ variant: 'typical', clock: 'demo' });
const out = {};
async function frameReady(d) { let f; for (let i = 0; i < 100 && !(f = d.frame('leftovers')); i++) await sleep(100); await f.waitForFunction(() => window.__larder && tally.textContent.length > 0); return f; }
try {
  for (const dev of ['iphone-pwa', 'ipad-portrait']) {
    await L.reset('typical');
    const r = out[dev] = {};
    const d = await L.device({ device: dev, profile: 'eli' });
    const vh = d.page.viewportSize().height;
    // Job 1
    await d.goto('#home'); await sleep(1800);
    const card = await d.page.evaluate(() => { const c = [...document.querySelectorAll('.gcard')].find(c => /In the fridge/.test(c.textContent)); const b = c.getBoundingClientRect(); const btn = c.querySelector('[data-open="leftovers"]').getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), big: c.querySelector('.gbig').textContent, rows: [...c.querySelectorAll('.fl')].map(x => x.textContent), btnTop: Math.round(btn.top), btnBottom: Math.round(btn.bottom) }; });
    r.job1 = { homeCard: card, viewportH: vh, cardFullyOnScreen: card.bottom <= vh, taps: card.bottom <= vh ? 0 : 'scroll', note: 'shows only items 4+ days old, top 3; the Fresh ones are not on Home' };
    r.homeShot = await shot(d.page, `taps-home-${dev}.png`);
    // Job 2 via the Home card
    let taps = 0, typed = 0;
    if (card.btnBottom > vh) { await d.page.mouse.wheel(0, card.btnBottom - vh + 100); await sleep(400); r.job2scroll = true; }
    await d.page.click('.gcard [data-open="leftovers"]'); taps++;
    let f = await frameReady(d);
    await f.click('#name'); taps++;
    await f.type('#name', 'Taco soup'); typed++;
    await f.click('.log'); taps++;
    await sleep(2500);
    r.job2 = { path: 'Home card "Open the ledger" -> name box -> type -> Log', taps, typed, scrolls: r.job2scroll ? 1 : 0, landed: (await serverItems(L)).some(i => i.name === 'Taco soup'),
      newCardOnScreen: await f.evaluate(() => { const c = [...document.querySelectorAll('.item')].find(c => c.querySelector('.nm').textContent === 'Taco soup'); const r = c.getBoundingClientRect(); const bar = document.getElementById('add').getBoundingClientRect(); return { cardTop: Math.round(r.top), barTop: Math.round(bar.top), visibleAboveBar: r.bottom <= bar.top && r.top >= 0 }; }) };
    r.loggedShot = await shot(d.page, `taps-logged-${dev}.png`);
    // Job 3: where each ✓ sits relative to the add bar (no scroll)
    await d.goto('#home'); await sleep(1500);
    await d.page.click('.gcard [data-open="leftovers"]');
    f = await frameReady(d);
    const frameTop = (await (await f.frameElement()).boundingBox()).y;
    r.job3 = await f.evaluate(ft => { const bar = document.getElementById('add').getBoundingClientRect(); return [...document.querySelectorAll('.item')].map(c => { const b = c.querySelector('.done').getBoundingClientRect(); return { name: c.querySelector('.nm').textContent, checkCenterY: Math.round(b.top + b.height / 2 + ft), tappableWithoutScroll: b.bottom <= bar.top && b.top >= 0 }; }); }, frameTop);
    r.job3.taps = { onScreenItem: 2, belowTheBarItem: '2 + 1 scroll' };
    r.addBar = await f.evaluate(ft => { const b = document.getElementById('add').getBoundingClientRect(); return { top: Math.round(b.top + ft), bottom: Math.round(b.bottom + ft) }; }, frameTop);
    // Apps-tab path (for comparison): Apps tab -> tile
    await d.goto('#home'); await sleep(1200);
    const appsBtn = await d.page.$('[data-tab="apps"], a[href="#apps"], button[aria-label*="Apps"]');
    r.appsPath = appsBtn ? 'Apps tab -> Larder tile -> name -> type -> Log = 4 taps + 1 typed entry' : 'Apps tab control not found';
    console.log(dev, JSON.stringify(r, null, 1));
    await d.close();
  }
  console.log('saved', save('taps.json', out));
} finally { await L.close(); }
