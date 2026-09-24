// Taps from Home to the end of each top job, counted as real clicks on the shell and the app (typical seed, demo clock).
//   J1 adult daily review (Eli, iPhone PWA): #home → Apps → Verses tile → Show → rating, for each due card, until "All done".
//   J2 adult glance "what is due / my streak" (Eli, iPad): #home → Apps → Verses tile; is the stats card on the first screen?
//   J3 kid practises the week's two verses (Ezra, iPad): #home → Apps → Verses tile → Show → Got it ×2.
//   J4 "Practise one anyway" when nothing is due (Elizabeth, iPhone): #home → Apps → Verses → Practise one anyway → Show → Got it.
// Also recorded: is there any Verses card on Home (text search), and where the primary controls sit on the 430×932 phone.
import { local, DEMO, sleep } from '../../lib/local.mjs';
import { save } from './_lib.mjs';
const L = await local({ variant: 'typical', clock: 'demo' });
const out = {};
async function job(name, { device, profile, as }, steps) {
  const d = await L.device({ device, profile, installClock: DEMO, ...(as ? { as } : {}) });
  let taps = 0; const path = []; const tap = async (fr, sel, label) => { await fr.click(sel); taps++; path.push(label); await sleep(250); };
  await d.goto('#home'); await sleep(1500);
  if (!(await d.page.locator('button.tab[data-tab="apps"]').isVisible())) { await d.page.screenshot({ path: 'C:/Users/ex_bo/AppData/Local/Temp/claude/C--Users-ex-bo-OneDrive-Claude-Related-App-Hub/ead87424-01af-4f71-ad5e-f00aad581d0b/scratchpad/p3/taps-fail-' + name + '.png' }); throw new Error('tab bar hidden in ' + name); }
  const homeText = await d.page.evaluate(() => document.getElementById('view-home') ? document.getElementById('view-home').innerText : '');
  const homeHasVersesCard = /\bVerses\b|memory verse|due today|to review/i.test(homeText);
  await tap(d.page, 'button.tab[data-tab="apps"]', 'Apps tab');
  await tap(d.page, '.tile[data-id="verses"]', 'Verses tile');
  let f; for (let i = 0; i < 50 && !f; i++) { f = d.frame('verses'); await sleep(100); }
  await f.waitForSelector('#trainer:not([hidden]), #done:not([hidden]), #empty:not([hidden])', { timeout: 10000 });
  await sleep(300);
  const r = await steps(f, tap, d);
  out[name] = { device, profile, taps, path, homeHasVersesCard, homeSample: homeText.replace(/\s+/g, ' ').slice(0, 160), ...r };
  await d.close();
}
try {
  const ph = await L.newDevice({ name: 'Eli phone', profiles: ['eli', 'mom'] });
  await job('J1', { device: 'iphone-pwa', profile: 'eli', as: ph }, async (f, tap) => {
    const pos = await f.evaluate(() => Object.fromEntries(['#say', '#show'].map(s => { const r = document.querySelector(s).getBoundingClientRect(); return [s, [Math.round(r.top), Math.round(r.bottom)]]; })));
    let cards = 0, ratePos;
    while (await f.locator('#trainer').isVisible()) {
      await tap(f, '#show', 'Show');
      if (!ratePos) ratePos = await f.evaluate(() => Object.fromEntries([...document.querySelectorAll('#act-rate [data-rate]')].map(b => { const r = b.getBoundingClientRect(); return [b.dataset.rate, [Math.round(r.top), Math.round(r.bottom)]]; })));
      await tap(f, '#act-rate [data-rate="got"]', 'Got it'); cards++;
    }
    return { cards, controlsY: pos, ratingY: ratePos, frameTopInPage: 48, viewport: '430x932', doneText: await f.evaluate(() => document.getElementById('done-big').textContent) };
  });
  await L.reset('typical');
  await job('J2', { device: 'ipad-portrait', profile: 'eli' }, async (f) => {
    const st = await f.evaluate(() => { const r = document.getElementById('stats').getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), innerHeight }; });
    return { statsCard: st, statsFullyOnFirstScreen: st.bottom <= st.innerHeight };
  });
  await L.reset('typical');
  await job('J3', { device: 'ipad-portrait', profile: 'ezra' }, async (f, tap) => { let n = 0; while (await f.locator('#trainer').isVisible() && n < 4) { await tap(f, '#show', 'Show'); await tap(f, '#act-rate [data-rate="got"]', 'Got it'); n++; } return { cards: n }; });
  await L.reset('typical');
  const ph2 = await L.newDevice({ name: 'Mom phone', profiles: ['mom'] });
  await job('J4', { device: 'iphone-pwa', profile: 'mom', as: ph2 }, async (f, tap) => {
    const before = await f.evaluate(() => document.getElementById('done-big').textContent);
    const againY = await f.evaluate(() => { const r = document.getElementById('again').getBoundingClientRect(); return [Math.round(r.top), Math.round(r.bottom)]; });
    await tap(f, '#again', 'Practise one anyway'); await tap(f, '#show', 'Show'); await tap(f, '#act-rate [data-rate="got"]', 'Got it');
    return { before, againY, after: await f.evaluate(() => document.getElementById('done-big').textContent) };
  });
  console.log(JSON.stringify(out, null, 1));
  save('taps.json', out);
} finally { await L.close(); }
