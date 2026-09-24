// Skeptic #1 for the Verses finding "other-timezone-day": a device in another time zone files reviews under its own date.
// Independent reproduction (own helpers, fresh instance). apps/verses.html:203 dayKey() uses the device's local calendar.
// Steps: server clock and browser clocks at Tue 22 Sep 2026 20:30 New York. Eli and Ezra each rate once on a phone whose
// context is Europe/London (01:30 Wed there). Then New York iPads (Eli, Ezra) open Verses at 20:31 Tue and at 08:00 Wed.
// Control: the same ratings made on a New York phone instead (fresh reset), then the same NY iPad views.
// Run: node "audits/tools/phase3/verses/verify-other-timezone-day-1.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, DEMO } from '../../lib/local.mjs';

const EVID = path.resolve('audits/evidence/p3/verses');
fs.mkdirSync(EVID, { recursive: true });
const P = n => path.join(EVID, 'verify-other-timezone-day-1-' + n);
const VIEW = '#trainer:not([hidden]), #done:not([hidden]), #empty:not([hidden])';
async function open(d) { const f = await d.openApp('verses'); await f.waitForSelector(VIEW, { timeout: 15000 }).catch(() => {}); await sleep(400); return f; }
const view = f => f.evaluate(() => {
  const q = s => document.querySelector(s), vis = s => !!q(s) && !q(s).hidden;
  const d = new Date();
  return {
    deviceDay: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'),
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    who: q('#who') && q('#who').textContent.trim(),
    ref: vis('#trainer') ? q('#ref').textContent.trim() : null,
    done: vis('#done') ? (q('#done-big').textContent + ' | ' + q('#done-sub').textContent) : null,
    streak: vis('#stats') ? q('#st-streak').textContent.trim() : null,
    statsSub: vis('#stats') ? q('#stats-sub').textContent.trim() : null,
  };
});
async function rateGot(f, dbg) {
  if (dbg) { const st = await f.evaluate(() => { const s = document.querySelector("#show"); const r = s.getBoundingClientRect(); return { hidden: s.hidden, disp: getComputedStyle(s).display, vis: getComputedStyle(s).visibility, rect: [r.x, r.y, r.width, r.height], parentHidden: s.closest("[hidden]") ? s.closest("[hidden]").id : null, trainer: document.querySelector("#trainer").hidden }; }); console.log("show state", JSON.stringify(st)); }
  try { await f.click('#show', { timeout: 5000 }); } catch (e) { console.log('click #show failed, falling back to DOM click:', e.message.split('\n')[0]); if (dbg && f.page) await f.page().screenshot({ path: P('debug-kid-show.png'), scale: 'css' }).catch(() => {}); await f.evaluate(() => document.querySelector('#show').click()); }
  for (let i = 0; i < 25; i++) {
    if (await f.evaluate(() => !document.querySelector('#act-rate').hidden)) break;
    if (dbg) console.log('  waiting for the Show handler (hub.ready), sync =', JSON.stringify(await f.evaluate(() => window.hub && hub.sync && hub.sync.state)));
    await sleep(1000); await f.evaluate(() => document.querySelector('#show').click());
  }
  if (!(await f.evaluate(() => !document.querySelector('#act-rate').hidden))) { console.log('rating buttons never appeared; view =', JSON.stringify(await view(f))); return null; }
  const ref = await f.evaluate(() => document.querySelector('#ref').textContent.trim());
  try { await f.click('#act-rate [data-rate="got"]', { timeout: 5000 }); } catch (e) { console.log('click Got it failed, DOM click'); await f.evaluate(() => document.querySelector('#act-rate [data-rate="got"]').click()); }
  await sleep(200); return ref;
}
async function flushed(d, ms = 15000) { const until = Date.now() + ms; while (Date.now() < until) { const h = await d.hub(); if (!Object.values(h.queue || {}).some(q => Object.keys(q).length)) return true; await sleep(250); } return false; }
async function row(L, who, app, key) { const r = await L.apiAs(who, `/api/data/${app}?scope=person`); const it = (r.body.items || []).find(i => i.key === key); return it ? it.value : null; }

const TUE = Date.parse('2026-09-22T20:30:00-04:00');
const WED = Date.parse('2026-09-23T08:00:00-04:00');
const out = {};
const L = await local({ variant: 'typical', clock: 'demo' });
try {
  for (const tz of ['Europe/London', 'America/New_York']) {
    await L.clock(new Date(DEMO).toISOString()); await L.reset('typical');   // seed relative to the demo instant (Tue 08:40 NY)
    await L.clock('2026-09-22T20:30:00-04:00');
    const orig = L.browser.newContext.bind(L.browser);
    L.browser.newContext = o => orig({ ...o, timezoneId: tz });
    const pd = await L.newDevice({ name: 'Travel phone ' + tz, profiles: ['eli', 'ezra'] });
    const eliP = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: TUE, as: pd });
    const ezP = await L.device({ device: 'iphone-pwa', profile: 'ezra', installClock: TUE, as: pd });
    L.browser.newContext = orig;
    const r = { phone: {} };
    let f = await open(eliP); r.phone.eliBefore = await view(f); r.phone.eliRated = await rateGot(f); await flushed(eliP);
    let k = await open(ezP); r.phone.ezraBefore = await view(k); console.log(tz, "eliBefore", JSON.stringify(r.phone.eliBefore), "ezraBefore", JSON.stringify(r.phone.ezraBefore)); if (!r.phone.ezraBefore.ref) await ezP.page.screenshot({ path: P("debug-ezra.png"), scale: "css" }); r.phone.ezraRated = await rateGot(k, 1); await flushed(ezP); r.phone.ezraAfter = await view(k);
    const rc = await row(L, 'eli', 'f260', 'f260.recall'); r.eliStoredRow = rc ? Object.fromEntries(Object.entries(rc).filter(([, v]) => v && v.t && v.t > TUE - 86400000 * 30 && v.last >= '2026-09-22')) : null;
    const lg = await row(L, 'eli', 'verses', 'log'); r.eliLogTail = lg ? Object.fromEntries(Object.entries(lg).sort().slice(-4)) : null;
    const krc = await row(L, 'ezra', 'f260', 'f260.recall'); r.ezraRecall = krc;
    await eliP.close(); await ezP.close();
    // New York iPads, same evening and next morning
    for (const [lab, at] of [['tue2031', TUE + 60000], ['wed0800', WED]]) {
      if (lab === 'wed0800') await L.clock('2026-09-23T08:00:00-04:00');
      const a = await L.device({ device: 'ipad-portrait', profile: 'eli', installClock: at });
      r['nyEli_' + lab] = await view(await open(a));
      const b = await L.device({ device: 'ipad-portrait', profile: 'ezra', installClock: at });
      r['nyEzra_' + lab] = await view(await open(b));
      if (tz === 'Europe/London' && lab === 'tue2031') { await b.page.screenshot({ path: P('ny-ezra-ipad.png'), scale: 'css', animations: 'disabled' }); await a.page.screenshot({ path: P('ny-eli-ipad.png'), scale: 'css', animations: 'disabled' }); }
      await a.close(); await b.close();
    }
    out[tz] = r; console.log('DONE', tz, JSON.stringify(r, null, 1)); fs.writeFileSync(P('result.json'), JSON.stringify(out, null, 1));
  }
  fs.writeFileSync(P('result.json'), JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out, null, 1));
} finally { await L.close(); }
