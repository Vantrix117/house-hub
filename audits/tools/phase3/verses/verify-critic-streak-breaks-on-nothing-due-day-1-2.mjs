// Skeptic #2 for "critic-streak-breaks-on-nothing-due-day-1": does a day with nothing due break the Verses day streak,
// and does the app offer a way to keep it? Two runs on a fresh typical seed (WebKit, demo clock), Elizabeth (mom), iPhone PWA:
//   A  Tue 22 Sep 08:40: open Verses, read what the screen says, rate nothing (nothing is due) -> Wed 23 Sep: streak?
//   B  reset; Tue 22 Sep: tap "Practise one anyway", Show, Got it -> Wed 23 Sep: streak? (the control / the mitigation path)
// dayStreak(): apps/verses.html:235. Stats sub-line: :344. Done card: :333-336. Queue empty line: :351. Practise anyway: :366-371.
// Run: node "audits/tools/phase3/verses/verify-critic-streak-breaks-on-nothing-due-day-1-2.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';

const EVID = path.resolve('audits/evidence/p3/verses');
const NAME = 'verify-critic-streak-breaks-on-nothing-due-day-1-2';
fs.mkdirSync(EVID, { recursive: true });
const TUE = '2026-09-22T08:40:00-04:00', WED = '2026-09-23T08:40:00-04:00';
const VIEW = '#trainer:not([hidden]), #done:not([hidden]), #empty:not([hidden])';

const read = f => f.evaluate(() => {
  const q = s => document.querySelector(s), vis = s => !!q(s) && !q(s).hidden, t = s => q(s) ? q(s).textContent.replace(/\s+/g, ' ').trim() : null;
  return {
    who: t('#who'), trainerVisible: vis('#trainer'), doneVisible: vis('#done'),
    doneBig: vis('#done') ? t('#done-big') : null, doneSub: vis('#done') ? t('#done-sub') : null,
    againButton: vis('#again') ? t('#again') : null,
    streak: t('#st-streak'), due: t('#st-due'), statsSub: t('#stats-sub'),
    queueLine: [...document.querySelectorAll('#queue-list li')].map(li => li.textContent.replace(/\s+/g, ' ').trim())[0] || null,
    dayStreakFn: window.verses ? window.verses.dayStreak() : null,
  };
});

async function open(L, iso) {
  await L.clock(iso);
  const d = await L.device({ device: 'iphone-pwa', profile: 'mom', fixedTime: Date.parse(iso) });
  const f = await d.openApp('verses');
  await f.waitForSelector(VIEW, { timeout: 15000 });
  await sleep(600);
  return { d, f };
}
async function logRow(L) {
  const r = await L.apiAs('mom', '/api/data/verses?scope=person');
  const it = (r.body.items || []).find(i => i.key === 'log');
  return it ? it.value : {};
}

const out = {};
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
try {
  // ── run A: follow the screen, rate nothing on Tuesday ──
  {
    const { d, f } = await open(L, TUE);
    out.A_tue = await read(f);
    await d.page.screenshot({ path: path.join(EVID, NAME + '-A-tue-iphone.png'), scale: 'css' });
    const lg = await logRow(L); out.A_logLastDays = Object.keys(lg).sort().slice(-3);
    await d.close();
    const w = await open(L, WED);
    out.A_wed = await read(w.f);
    await w.d.page.screenshot({ path: path.join(EVID, NAME + '-A-wed-iphone.png'), scale: 'css' });
    await w.d.close();
  }
  // ── run B: same seed, tap "Practise one anyway" and rate on Tuesday ──
  await L.clock(TUE); await L.reset('typical');   // the seed is laid out relative to the server clock, so rewind first
  out.B_seedLogLastDays = Object.keys(await logRow(L)).sort().slice(-3);
  {
    const { d, f } = await open(L, TUE);
    out.B_tue_before = await read(f);
    await f.click('#again'); await sleep(300);
    await f.click('#show'); await f.waitForSelector('#act-rate:not([hidden])', { timeout: 5000 });
    await f.click('#act-rate [data-rate="got"]'); await sleep(400);
    out.B_tue_after = await read(f);
    let lg = {}; const until = Date.now() + 20000;
    while (Date.now() < until) { lg = await logRow(L); if (lg['2026-09-22']) break; await sleep(400); }
    out.B_serverLogTue = lg['2026-09-22'] || null;
    await d.close();
    const w = await open(L, WED);
    out.B_wed = await read(w.f);
    await w.d.close();
  }
  console.log(JSON.stringify(out, null, 1));
  fs.writeFileSync(path.join(EVID, NAME + '.json'), JSON.stringify(out, null, 1));
} finally { await L.close(); }
