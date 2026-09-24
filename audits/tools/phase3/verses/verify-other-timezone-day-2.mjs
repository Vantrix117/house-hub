// Skeptic #2 for finding "other-timezone-day" (apps/verses.html). Independent re-run on a fresh local instance.
//  A. At 20:30 New York on Tue 22 Sep 2026, Eli and Ezra each rate one card on a phone whose time zone is Europe/London
//     (01:30 Wed there). Server rows are read back; the Kitchen iPad (New York) then opens Verses as Eli and as Ezra.
//  B. Control (no time zone involved): on a New York device Ezra rates his card, then taps "Practise again"
//     (apps/verses.html:366-371) and rates the same verse a second time on the same day — i.e. re-rating on one day is
//     already possible by design.
// Prints the key observations and writes audits/evidence/p3/verses/verify-other-timezone-day-2.json (+ one PNG).
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';
const EVID = path.resolve('audits/evidence/p3/verses'); fs.mkdirSync(EVID, { recursive: true });
const VIEW = '#trainer:not([hidden]), #done:not([hidden]), #empty:not([hidden])';
const open = async d => { const f = await d.openApp('verses'); await f.waitForSelector(VIEW, { timeout: 12000 }).catch(() => {}); await sleep(400); return f; };
const look = f => f.evaluate(() => { const q = s => document.querySelector(s), vis = s => !!q(s) && !q(s).hidden;
  const d = new Date(); return { who: q('#who') && q('#who').textContent.trim(), trainer: vis('#trainer'), done: vis('#done'), ref: vis('#trainer') ? q('#ref').textContent : null,
    streak: vis('#stats') ? q('#st-streak').textContent : null, statsSub: vis('#stats') ? q('#stats-sub').textContent : null, again: vis('#again'),
    deviceDay: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'), tz: Intl.DateTimeFormat().resolvedOptions().timeZone }; });
const rate = async (f, k) => { await f.click('#show'); await f.waitForSelector('#act-rate:not([hidden])', { timeout: 4000 }); await f.click(`#act-rate [data-rate="${k}"]`); await sleep(300); };
const flush = async d => { const until = Date.now() + 15000; while (Date.now() < until) { const h = await d.hub(); if (!Object.values(h.queue || {}).some(q => Object.keys(q).length)) return true; await sleep(250); } return false; };
const row = async (L, who, app, key) => { const r = await L.apiAs(who, `/api/data/${app}?scope=person`); const it = (r.body.items || []).find(i => i.key === key); return it ? it.value : null; };

const L = await local({ variant: 'typical', clock: 'demo' });
const out = {};
try {
  const at = Date.parse('2026-09-22T20:30:00-04:00');
  const orig = L.browser.newContext.bind(L.browser);
  L.browser.newContext = o => orig({ ...o, timezoneId: 'Europe/London' });
  const pd = await L.newDevice({ name: 'Phone in London', profiles: ['eli', 'ezra'] });
  const lonEli = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: at, as: pd });
  const lonEzra = await L.device({ device: 'iphone-pwa', profile: 'ezra', installClock: at, as: pd });
  L.browser.newContext = orig;

  const eliBeforeRecall = await row(L, 'eli', 'f260', 'f260.recall');
  const fE = await open(lonEli); const e0 = await look(fE); await rate(fE, 'got'); await flush(lonEli);
  const fK = await open(lonEzra); const k0 = await look(fK); await rate(fK, 'got'); await flush(lonEzra);
  const eliRecall = await row(L, 'eli', 'f260', 'f260.recall'); const eliLog = await row(L, 'eli', 'verses', 'log');
  const changed = Object.keys(eliRecall).filter(id => JSON.stringify(eliRecall[id]) !== JSON.stringify((eliBeforeRecall || {})[id]));
  const ezraRecall = await row(L, 'ezra', 'f260', 'f260.recall');
  out.A = { london: { eliBefore: e0, ezraBefore: k0 }, eliChanged: Object.fromEntries(changed.map(id => [id, eliRecall[id]])), eliLogTail: Object.fromEntries(Object.keys(eliLog).sort().slice(-4).map(k => [k, eliLog[k]])), ezraRecall };
  await lonEli.close(); await lonEzra.close();

  const nyEli = await L.device({ device: 'ipad-portrait', profile: 'eli', installClock: at + 60000 });
  out.A.nyEli = await look(await open(nyEli)); await nyEli.close();
  const nyEzra = await L.device({ device: 'ipad-portrait', profile: 'ezra', installClock: at + 60000 });
  const fNK = await open(nyEzra); out.A.nyEzra = await look(fNK);
  await nyEzra.page.screenshot({ path: path.join(EVID, 'verify-other-timezone-day-2-ny-ezra-ipad.png'), scale: 'css', animations: 'disabled' });
  await nyEzra.close();

  // B. control on a clean instance: same-day re-rating through "Practise again", no time zones
  await L.reset('typical');
  const ny2 = await L.device({ device: 'iphone-pwa', profile: 'ezra', installClock: Date.parse('2026-09-22T17:00:00-04:00') });
  let f = await open(ny2); const b0 = await look(f);
  while ((await look(f)).trainer) await rate(f, 'got');
  const b1 = await look(f);
  await f.click('#again'); await sleep(400); const b2 = await look(f);
  await rate(f, 'got'); await flush(ny2);
  const b3 = await look(f);
  out.B = { before: b0, afterAllRated: b1, afterPractiseAgain: b2, afterSecondRating: b3, ezraRecall: await row(L, 'ezra', 'f260', 'f260.recall'), ezraLog: await row(L, 'ezra', 'verses', 'log') };
  await ny2.close();
  console.log(JSON.stringify(out, null, 1));
  fs.writeFileSync(path.join(EVID, 'verify-other-timezone-day-2.json'), JSON.stringify(out, null, 1));
} finally { await L.close(); }
