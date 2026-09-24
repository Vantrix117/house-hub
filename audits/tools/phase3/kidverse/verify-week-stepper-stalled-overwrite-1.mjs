// Skeptic #1 for "week-stepper-stalled-overwrite": on a stalled first load an adult sees Week 1 and + writes week 2.
//   node "audits/tools/phase3/kidverse/verify-week-stepper-stalled-overwrite-1.mjs"     (about 1.5 min)
// Independent of adult-week.mjs / _kv.mjs. Fresh local instance, real clock.
//  V0 control: Eli on a new phone, no hold, deep link #kidverse, taps + once.         expect 38 -> 39
//  V1 held:    Eli on a new phone, every GET /api/data/* held 9 s, taps + as soon as the stepper paints.
//  V2 blip:    Eli on a new phone, every GET /api/data/* answered 503 for 8 s, taps + at ~7 s.
//  After each: the server's family week row, and what Ezra's Kid Verse shows on the kitchen iPad.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep } from '../../lib/local.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const EVID = path.join(ROOT, 'audits', 'evidence', 'p3', 'kidverse');
fs.mkdirSync(EVID, { recursive: true });
const P = 'verify-week-stepper-stalled-overwrite-1';
const T0 = Date.now();
const log = (...a) => console.log(((Date.now() - T0) / 1000).toFixed(1).padStart(6) + 's', ...a);

const L = await local({ variant: 'typical', clock: 'real' });
const out = {};
const weekRow = async () => { const r = await L.apiAs('eli', '/api/data/kidverse?scope=family&key=week'); return r.body && r.body.item ? r.body.item.value : r.body; };
const setWeek38 = () => L.apiAs('eli', '/api/data/kidverse/week?scope=family', { method: 'PUT', body: { value: { week: 38, by: 'eli', at: Date.now() }, updated_at: Date.now() } });
const view = f => f.evaluate(() => ({
  ref: document.querySelector('#ref').textContent,
  weekNow: (document.querySelector('#week-now') || {}).textContent || null,
  upDisabled: document.querySelector('#week-up') ? document.querySelector('#week-up').disabled : null,
  kvFamilyCacheSince: (() => { try { return (JSON.parse(localStorage.getItem('hub.cache.kidverse.family')) || {}).since || 0; } catch { return 'err'; } })(),
  lastPull: window.hub && hub.sync ? hub.sync.lastPull || 0 : null, syncState: window.hub && hub.sync ? hub.sync.state : null,
}));
async function waitSynced(f, ms = 15000) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    const ok = await f.evaluate(() => hub.sync.state === 'synced' && !Object.keys(localStorage).some(k => k.startsWith('hub.queue.') && Object.keys(JSON.parse(localStorage.getItem(k) || '{}')).length)).catch(() => false);
    if (ok) return true; await sleep(200);
  }
  return false;
}
async function kidSees() {
  const d = await L.device({ device: 'ipad-portrait', profile: 'ezra', fixedTime: false });
  const f = await d.openApp('kidverse', { wait: '#ref' });
  await sleep(4000);
  const v = await f.evaluate(() => ({ ref: document.querySelector('#ref').textContent, who: document.querySelector('#who').textContent.trim(), story: (document.querySelector('#story-span') || {}).textContent || null }));
  await d.close();
  return v;
}
async function scenario(name, mode, tapAtMs) {
  await setWeek38();
  const before = await weekRow();
  const ph = await L.newDevice({ name: 'Eli new phone ' + name, profiles: ['eli'] });
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: ph });
  let hold = mode !== 'none'; const held = [];
  const t0 = Date.now();
  await d.ctx.route(/\/api\/data\/[^/?]+\?/, async r => {
    if (r.request().method() !== 'GET' || !hold) return r.continue().catch(() => {});
    held.push(Math.round(Date.now() - t0) + 'ms ' + r.request().url().replace(/^https?:\/\/[^/]+/, '').slice(0, 90));
    if (mode === 'hold') { await sleep(9000); return r.continue().catch(() => {}); }
    return r.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"unavailable"}' }).catch(() => {});
  });
  if (mode === 'blip') setTimeout(() => { hold = false; }, 8000);
  const f = await d.openApp('kidverse', { wait: '#week-up' });
  const paintedMs = Date.now() - t0;
  if (tapAtMs) await sleep(Math.max(0, tapAtMs - (Date.now() - t0)));
  else await sleep(1500);
  const atTap = { ms: Date.now() - t0, ...(await view(f)) };
  await f.evaluate(() => document.querySelector('#grown').scrollIntoView({ block: 'center' }));
  await d.page.screenshot({ path: path.join(EVID, `${P}-${name}-at-tap.png`), scale: 'css', animations: 'disabled', caret: 'hide' });
  await f.click('#week-up');
  const tapMs = Date.now() - t0;
  if (mode === 'hold') { await sleep(1000); hold = false; }
  await sleep(11000); const synced = await waitSynced(f);
  const after = await weekRow();
  const phoneAfter = await view(f);
  await d.close();
  const kid = await kidSees();
  const r = { mode, paintedMs, atTap, tapMs, heldRequests: held.slice(0, 12), heldCount: held.length, synced, serverBefore: before, serverAfter: after, phoneAfter, ezraIpadSees: kid };
  out[name] = r;
  log(name, 'server before', JSON.stringify(before));
  log(name, 'at tap', JSON.stringify(atTap));
  log(name, 'server after', JSON.stringify(after), 'synced', synced);
  log(name, 'phone after', JSON.stringify(phoneAfter));
  log(name, 'Ezra iPad sees', JSON.stringify(kid));
  log(name, 'held GETs', held.length, JSON.stringify(held.slice(0, 4)));
}
try {
  await scenario('V0-control', 'none', 0);
  await scenario('V1-held-9s', 'hold', 7000);
  await scenario('V2-503-8s', 'blip', 7000);
} finally { await L.close(); }
fs.writeFileSync(path.join(EVID, P + '.json'), JSON.stringify(out, null, 1));
log('wrote', `audits/evidence/p3/kidverse/${P}.json`);
