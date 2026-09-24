// Skeptic 2 for "midnight-stale-all-done": Verses left open across midnight keeps its "All done" screen.
// Independent of the investigator's _lib.mjs. Eli (iPad) and Ezra (phone) finish at 23:58 Tue 22 Sep (New York),
// then the page clock runs 7 min in 10 s slices (real hub.js 30 s pulls against the local Worker, whose clock is moved
// past midnight too), then a real Playwright page hide/show via a second tab + bringToFront is not reliable in WebKit,
// so a synthetic visibilitychange is dispatched in every frame (hub.js:339 pulls on it). Then: a control — dispatching
// hub.onChange by a remote write in Eli's person scope — to see whether the app heals.
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';
const EV = path.resolve('audits/evidence/p3/verses'); fs.mkdirSync(EV, { recursive: true });
const P = 'verify-midnight-stale-all-done-2';
const st = f => f.evaluate(() => { const q = s => document.querySelector(s), v = s => q(s) && !q(s).hidden;
  return { who: q('#who').textContent.trim(), trainer: v('#trainer'), done: v('#done'), doneBig: v('#done') ? q('#done-big').textContent : null,
    doneSub: v('#done') ? q('#done-sub').textContent : null, stDue: v('#stats') ? q('#st-due').textContent : null,
    queueSub: v('#queue') ? q('#queue-sub').textContent : null, freshDue: window.verses.dueIds(), now: new Date().toString().slice(0, 24) }; });
async function runFor(d, ms) { for (let t = 0; t < ms; t += 10000) { await d.ctx.clock.runFor(Math.min(10000, ms - t)); await sleep(700); } }
async function finish(f) { for (let i = 0; i < 20; i++) { const has = await f.evaluate(() => !document.querySelector('#trainer').hidden); if (!has) return i;
  await f.click('#show'); await f.waitForSelector('#act-rate:not([hidden])'); await f.click('#act-rate [data-rate="got"]'); await sleep(200); } return -1; }
const L = await local({ variant: 'typical', clock: 'demo' });
const out = {};
try {
  await L.clock('2026-09-22T23:56:00-04:00'); await L.reset('typical');
  const start = Date.parse('2026-09-22T23:57:30-04:00');
  const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', installClock: start });
  const kd = await L.newDevice({ name: 'Ezra phone v2', profiles: ['ezra'] });
  const kid = await L.device({ device: 'iphone-pwa', profile: 'ezra', installClock: start, as: kd });
  await ipad.goto('#home'); await kid.goto('#home');
  const ef = await ipad.openApp('verses'), kf = await kid.openApp('verses');
  await ef.waitForSelector('#trainer:not([hidden]), #done:not([hidden])'); await kf.waitForSelector('#trainer:not([hidden]), #done:not([hidden])');
  out.opened = { eli: await st(ef), ezra: await st(kf) };
  out.rated = { eli: await finish(ef), ezra: await finish(kf) };
  await runFor(ipad, 5000); await runFor(kid, 5000);
  out.before = { eli: await st(ef), ezra: await st(kf) };
  await L.clock('2026-09-23T00:00:10-04:00');
  await Promise.all([runFor(ipad, 7 * 60000), runFor(kid, 7 * 60000)]);
  for (const d of [ipad, kid]) for (const fr of d.page.frames()) await fr.evaluate(() => { Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); Object.defineProperty(document, 'hidden', { value: false, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); }).catch(() => {});
  await runFor(ipad, 3000); await runFor(kid, 3000);
  out.after = { eli: await st(ef), ezra: await st(kf) };
  await ipad.page.screenshot({ path: path.join(EV, P + '-eli-ipad.png'), scale: 'css' });
  await kid.page.screenshot({ path: path.join(EV, P + '-ezra-iphone.png'), scale: 'css' });
  // control: a remote write in Eli's Verses person scope (another device), then pulls -> hub.onChange -> render()
  const put = await L.apiAs('eli', '/api/data/verses/skeptic.poke?scope=person', { method: 'PUT', body: { value: 1 } }).catch(e => ({ err: String(e).slice(0, 200) }));
  out.controlPut = { status: put.status, body: JSON.stringify(put.body || put).slice(0, 200) };
  await runFor(ipad, 40000);
  out.afterRemoteChange = { eli: await st(ef) };
  console.log(JSON.stringify(out, null, 1));
  fs.writeFileSync(path.join(EV, P + '.json'), JSON.stringify(out, null, 1));
} finally { await L.close(); }
