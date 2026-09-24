// Skeptic #2 for KV finding "device-local-day": Kid Verse keys the one-star-a-day rule on the device's own calendar day
// (apps/kidverse.html:259 dayKey, 327-329 award). Independent re-run on a fresh local instance (typical, real server clock).
//   node "audits/tools/phase3/kidverse/verify-device-local-day-2.mjs"
// A  the claim: Ezra's phone in America/Los_Angeles at Thu 24 Sep 01:30 New York (= Wed 22:30 PT) taps Done ★, then one
//    minute later the New York iPad (default rig zone) taps Done ★.
// B  control: the same two taps, both devices in New York -> the second must be refused (the rule itself works).
// C  one travelling device only (the phone in LA): Wed 22:30 PT Done ★, then Thu 06:00 PT (09:00 NY) Done ★ -> shows what
//    "one per day" means for a kid who is actually in LA (local days vs the household's New York day).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep } from '../../lib/local.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const EVID = path.join(ROOT, 'audits', 'evidence', 'p3', 'kidverse');
fs.mkdirSync(EVID, { recursive: true });
const log = (...a) => console.log(...a);

const T = Date.parse('2026-09-24T01:30:00-04:00');
const days = async L => { const r = await L.apiAs('ezra', '/api/data/kidverse?scope=person&key=stars'); const v = r.body && r.body.item && r.body.item.value; return v ? { week: v.week, count: v.count, total: v.total, days: v.days } : null; };
const mirror = async L => { const r = await L.apiAs('eli', '/api/data/kidverse?scope=family&key=stars%3Aezra'); const v = r.body && r.body.item && r.body.item.value; return v ? { count: v.count, total: v.total, days: v.days } : null; };

async function dev(L, { device, at, tz, as }) {
  let restore = null;
  if (tz) { const orig = L.browser.newContext.bind(L.browser); L.browser.newContext = o => orig({ ...o, timezoneId: tz }); restore = () => { L.browser.newContext = orig; }; }
  try { return await L.device({ device, profile: 'ezra', installClock: at, as }); } finally { if (restore) restore(); }
}
async function openKV(d) {
  const f = await d.openApp('kidverse', { wait: '#done:not([hidden])' });
  const until = Date.now() + 15000;
  while (Date.now() < until && !(await f.evaluate(() => !!(window.hub && hub.sync && hub.sync.lastPull)).catch(() => false))) await sleep(150);
  await sleep(1200);
  await f.evaluate(() => { window.__t = []; const o = hub.toast; hub.toast = (m, ms) => { window.__t.push(String(m)); return o.call(hub, m, ms); }; });
  return f;
}
async function tap(f) {
  const before = await f.evaluate(() => ({ now: new Date().toString(), dayKey: (d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'))(new Date()), done: document.querySelector('#done').textContent.trim() }));
  await f.click('#done'); await sleep(700);
  const until = Date.now() + 15000;
  while (Date.now() < until && !(await f.evaluate(() => hub.sync.state === 'synced' && !Object.keys(localStorage).some(k => k.startsWith('hub.queue.') && Object.keys(JSON.parse(localStorage.getItem(k) || '{}')).length)).catch(() => false))) await sleep(150);
  const toasts = await f.evaluate(() => window.__t);
  return { ...before, toasts };
}

const out = {};
const L = await local({ variant: 'typical', clock: 'real' });
try {
  // A
  out.A_start = await days(L);
  let ph = await L.newDevice({ name: 'Ezra phone (LA)', profiles: ['ezra'] });
  let la = await dev(L, { device: 'iphone-pwa', at: T, tz: 'America/Los_Angeles', as: ph });
  out.A_la = await tap(await openKV(la)); out.A_afterLA = await days(L); await la.close();
  let ny = await dev(L, { device: 'ipad-portrait', at: T + 60000 });
  const fny = await openKV(ny); out.A_ny = await tap(fny); out.A_afterNY = await days(L); out.A_mirror = await mirror(L);
  await ny.page.screenshot({ path: path.join(EVID, 'verify-device-local-day-2-A-ny-ipad-after.png'), scale: 'css', animations: 'disabled' });
  await ny.close();

  // B
  await L.reset('typical');
  out.B_start = await days(L);
  ph = await L.newDevice({ name: 'Ezra phone (NY)', profiles: ['ezra'] });
  let p2 = await dev(L, { device: 'iphone-pwa', at: T, as: ph });
  out.B_phone = await tap(await openKV(p2)); out.B_afterPhone = await days(L); await p2.close();
  ny = await dev(L, { device: 'ipad-portrait', at: T + 60000 });
  out.B_ny = await tap(await openKV(ny)); out.B_afterNY = await days(L); await ny.close();

  // C
  await L.reset('typical');
  out.C_start = await days(L);
  ph = await L.newDevice({ name: 'Ezra phone (LA trip)', profiles: ['ezra'] });
  la = await dev(L, { device: 'iphone-pwa', at: T, tz: 'America/Los_Angeles', as: ph });
  out.C_night = await tap(await openKV(la)); out.C_afterNight = await days(L); await la.close();
  la = await dev(L, { device: 'iphone-pwa', at: Date.parse('2026-09-24T06:00:00-07:00'), tz: 'America/Los_Angeles', as: ph });
  out.C_morning = await tap(await openKV(la)); out.C_afterMorning = await days(L); await la.close();
} finally { await L.close(); }

for (const [k, v] of Object.entries(out)) log(k.padEnd(14), JSON.stringify(v));
fs.writeFileSync(path.join(EVID, 'verify-device-local-day-2.json'), JSON.stringify(out, null, 1));
log('wrote audits/evidence/p3/kidverse/verify-device-local-day-2.json');
