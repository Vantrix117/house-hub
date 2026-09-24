// Skeptic 1 for "midnight-stale-all-done" (apps/verses.html). Independent reproduction.
// Eli (Kitchen iPad) and Ezra (his phone) each clear their Verses queue at 23:58 Tue 22 Sep 2026 (New York), then the
// pages keep running with an installed clock: 8 minutes of page time in 5 s slices so hub.js's real 30 s pulls reach
// the local Worker (whose demo clock is also moved past midnight). Then a synthetic hidden -> visible cycle.
// Observations: what each page shows at ~00:06, what a fresh render would show (window.verses.dueIds()),
// and a control: one remote write in a scope Verses listens to (kidverse family) — does the page then repaint?
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';
const EV = path.resolve('audits/evidence/p3/verses'); fs.mkdirSync(EV, { recursive: true });
const VIEW = '#trainer:not([hidden]), #done:not([hidden]), #empty:not([hidden])';
const look = f => f.evaluate(() => {
  const q = s => document.querySelector(s), vis = s => !!q(s) && !q(s).hidden, d = new Date();
  return { pageDate: d.toString().slice(0, 24), who: q('#who').textContent.trim(), trainer: vis('#trainer'), ref: vis('#trainer') ? q('#ref').textContent : null,
    doneBig: vis('#done') ? q('#done-big').textContent : null, doneSub: vis('#done') ? q('#done-sub').textContent : null,
    stDue: vis('#stats') ? q('#st-due').textContent : null, dueNow: window.verses ? window.verses.dueIds() : null };
});
async function tapRate(f) { await f.click('#show'); await f.waitForSelector('#act-rate:not([hidden])', { timeout: 4000 }); await f.click('#act-rate [data-rate="got"]'); await sleep(250); }
async function clear(f, max = 12) { for (let i = 0; i < max; i++) { if (!(await f.$('#trainer:not([hidden])'))) return i; await tapRate(f); } return max; }
async function run(d, ms) { for (let t = 0; t < ms; t += 5000) { await d.ctx.clock.runFor(5000); await sleep(400); } }
const L = await local({ variant: 'typical', clock: 'demo' });
const out = {};
try {
  await L.clock('2026-09-22T23:57:00-04:00'); await L.reset('typical');
  const t0 = Date.parse('2026-09-22T23:58:00-04:00');
  const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', installClock: t0 });
  const kdev = await L.newDevice({ name: 'Ezra phone (skeptic)', profiles: ['ezra'] });
  const kid = await L.device({ device: 'iphone-pwa', profile: 'ezra', installClock: t0, as: kdev });
  await ipad.goto('#home'); await kid.goto('#home');
  const ef = await ipad.openApp('verses'); await ef.waitForSelector(VIEW, { timeout: 15000 });
  const kf = await kid.openApp('verses'); await kf.waitForSelector(VIEW, { timeout: 15000 });
  out.opened = { eli: await look(ef), ezra: await look(kf) };
  out.ratedEli = await clear(ef); out.ratedEzra = await clear(kf);
  await run(ipad, 20000); await run(kid, 20000); // let the writes flush
  out.beforeMidnight = { eli: await look(ef), ezra: await look(kf) };
  await L.clock('2026-09-23T00:00:20-04:00');
  await Promise.all([run(ipad, 8 * 60000), run(kid, 8 * 60000)]);
  for (const d of [ipad, kid]) for (const fr of d.page.frames()) await fr.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }); Object.defineProperty(document, 'hidden', { value: false, configurable: true }); document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('focus')); window.dispatchEvent(new Event('online'));
  }).catch(() => {});
  await run(ipad, 5000); await run(kid, 5000); await sleep(1000);
  out.afterMidnight = { eli: await look(ef), ezra: await look(kf) };
  await ipad.page.screenshot({ path: path.join(EV, 'verify-midnight-stale-all-done-1-eli-ipad-0006.png'), scale: 'css' });
  await kid.page.screenshot({ path: path.join(EV, 'verify-midnight-stale-all-done-1-ezra-iphone-0006.png'), scale: 'css' });
  // control: a remote change in a listened scope (kidverse family) should make render() run with the new day
  const put = await L.apiAs('mom', '/api/data/kidverse/skeptic%3Aping?scope=family', { method: 'PUT', body: { value: { ping: 1 }, updated_at: Date.parse('2026-09-23T00:07:00-04:00') } }).catch(e => ({ error: String(e) }));
  out.controlPut = put && (put.status || put.error || 'ok');
  await Promise.all([run(ipad, 40000), run(kid, 40000)]); await sleep(800);
  out.afterRemoteChange = { eli: await look(ef), ezra: await look(kf) };
  console.log(JSON.stringify(out, null, 1));
  fs.writeFileSync(path.join(EV, 'verify-midnight-stale-all-done-1.json'), JSON.stringify(out, null, 1));
} finally { await L.close(); }
