// Skeptic 2 for "week-stepper-stalled-overwrite": on a new device whose first pull stalls or fails, does Kid Verse show
// the adult "Week 1" with an enabled +, and does one + overwrite the family week row (38) on the server?
//   node "audits/tools/phase3/kidverse/verify-week-stepper-stalled-overwrite-2.mjs"     (about 1.5 min)
// CTRL  new phone, no interference: what week does the stepper show?
// HOLD  new phone, every GET /api/data/* held 10 s: tap + as soon as the stepper paints; release; what does the server hold?
// FAIL  new phone, every GET /api/data/* answered 503 until released: tap + as soon as the stepper paints; release; pull.
// After HOLD and FAIL: does the adult's own screen offer a way back (the F260 "Use week N" hint)? What does Ezra see?
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep } from '../../lib/local.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const EVID = path.join(ROOT, 'audits', 'evidence', 'p3', 'kidverse');
fs.mkdirSync(EVID, { recursive: true });
const PFX = 'verify-week-stepper-stalled-overwrite-2';
const T0 = Date.now();
const log = (...a) => console.log(((Date.now() - T0) / 1000).toFixed(1).padStart(6) + 's', ...a);
const shot = async (page, name) => { const f = path.join(EVID, `${PFX}-${name}.png`); await page.screenshot({ path: f, scale: 'css', animations: 'disabled', caret: 'hide' }); return path.relative(ROOT, f).replace(/\\/g, '/'); };

const L = await local({ variant: 'typical', clock: 'real' });
const weekRow = async () => { const r = await L.apiAs('eli', '/api/data/kidverse?scope=family&key=week'); return r.body && r.body.item ? r.body.item.value : null; };
const setWeek38 = () => L.apiAs('eli', '/api/data/kidverse/week?scope=family', { method: 'PUT', body: { value: { week: 38, by: 'eli', at: Date.now() }, updated_at: Date.now() } });
const view = f => f.evaluate(() => ({
  ref: document.querySelector('#ref').textContent,
  weekNow: (document.querySelector('#week-now') || {}).textContent || null,
  plusEnabled: !!document.querySelector('#week-up:not([disabled])'),
  hint: ((document.querySelector('#grown .hint') || {}).textContent || '').trim() || null,
  useF260: (document.querySelector('#week-f260') || {}).textContent || null,
  sync: { state: hub.sync.state, lastPull: hub.sync.lastPull || 0 },
}));
const out = {};

async function run(tag, mode) {
  await setWeek38();
  out[tag] = { before: await weekRow() };
  const ph = await L.newDevice({ name: 'Eli new phone ' + tag, profiles: ['eli'] });
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: ph });
  let block = mode !== 'ctrl';
  await d.ctx.route(/\/api\/data\/[^/?]+\?/, async r => {
    if (r.request().method() !== 'GET' || !block) return r.continue().catch(() => {});
    if (mode === 'hold') { await sleep(10000); return r.continue().catch(() => {}); }
    return r.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"unavailable"}' }).catch(() => {});
  });
  const t0 = Date.now();
  const f = await d.openApp('kidverse', { wait: '#week-up' });
  out[tag].stepperAtMs = Date.now() - t0;
  out[tag].atStepper = await view(f);
  if (mode === 'ctrl') { await sleep(1500); out[tag].settled = await view(f); await d.close(); return; }
  await f.evaluate(() => document.querySelector('#grown').scrollIntoView({ block: 'center' }));
  out[tag].shotBefore = await shot(d.page, `${tag}-before-tap`);
  await f.click('#week-up'); out[tag].tapMs = Date.now() - t0;
  await sleep(1500);
  out[tag].serverRightAfterTap = await weekRow();
  block = false;
  await sleep(mode === 'hold' ? 11000 : 500);
  await f.evaluate(() => hub.pull()).catch(() => {});
  await sleep(1500);
  out[tag].afterRelease = await view(f);
  out[tag].serverAfter = await weekRow();
  out[tag].shotAfter = await shot(d.page, `${tag}-after-release`);
  await d.close();
  // what a kid sees on the next open
  const k = await L.device({ device: 'iphone-pwa', profile: 'ezra', fixedTime: false });
  const kf = await k.openApp('kidverse', { wait: '#done:not([hidden])' }); await sleep(2500);
  out[tag].ezra = await kf.evaluate(() => ({ ref: document.querySelector('#ref').textContent, who: document.querySelector('#who').textContent.trim(), story: (document.querySelector('#story-title') || {}).textContent }));
  await k.close();
}

try {
  await run('CTRL', 'ctrl');
  await run('HOLD', 'hold');
  await run('FAIL', 'fail');
} finally { await L.close(); }
for (const [k, v] of Object.entries(out)) log(k, JSON.stringify(v));
const f = path.join(EVID, PFX + '.json'); fs.writeFileSync(f, JSON.stringify(out, null, 1)); log('wrote', path.relative(ROOT, f));
