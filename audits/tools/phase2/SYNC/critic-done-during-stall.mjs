// Completeness-critic probe for SYNC's unresolved item "Tapping Done during the stalled first-pull window" (inferred, not run).
//   node "audits/tools/phase2/SYNC/critic-done-during-stall.mjs"          (claim + control, about 1.5 min)
// Claim:   a new phone (no cache) deep-links #f260; every GET /api/data/f260?… is held 10 s. At ~7 s (after hub.ready's 6 s race,
//          apps/hub.js:337) the phone taps Today's Done on the Week 1 placeholder. Then the hold is released.
// Control: same phone flow with no hold; Done is tapped once F260 has its data.
// Prints the server's f260.done (number of true keys) and f260.log (number of days) before and after, and every f260 batch POST.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep } from '../../lib/local.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const EVID = path.join(ROOT, 'audits', 'evidence', 'p2', 'SYNC');
fs.mkdirSync(EVID, { recursive: true });
const T0 = Date.now();
const log = (...a) => console.log(((Date.now() - T0) / 1000).toFixed(1).padStart(6) + 's', ...a);

async function counts(L) {
  const get = async k => { const r = await L.apiAs('eli', `/api/data/f260?scope=person&key=${encodeURIComponent(k)}`); return r.body && r.body.item; };
  const done = await get('f260.done'), lg = await get('f260.log'), sum = await get('f260.summary');
  return {
    doneTrue: done && done.value ? Object.values(done.value).filter(v => v === true).length : null,
    logDays: lg && lg.value ? Object.keys(lg.value).length : null,
    summary: sum && sum.value ? { week: sum.value.week, weekDone: sum.value.weekDone, total: sum.value.total, streak: sum.value.streak } : null,
  };
}

async function run(name, holdMs) {
  const L = await local({ variant: 'typical', clock: 'real' });
  const out = { name, holdMs };
  try {
    out.before = await counts(L);
    const ph = await L.newDevice({ name: 'Eli new phone ' + name, profiles: ['eli'] });
    const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: ph });
    let hold = holdMs > 0;
    await phone.ctx.route(/\/api\/data\/f260\?/, async route => {
      if (route.request().method() === 'GET' && hold) await sleep(holdMs);
      route.continue().catch(() => {});
    });
    const t0 = Date.now();
    const posts = [];
    phone.page.on('request', r => {
      if (r.method() === 'POST' && /\/api\/data\/f260\/batch/.test(r.url())) {
        try { const b = JSON.parse(r.postData()); posts.push({ ms: Date.now() - t0, keys: b.items.map(i => i.key + (i.key === 'f260.done' && i.value ? ` (${Object.values(i.value).filter(v => v === true).length} true)` : i.key === 'f260.log' && i.value ? ` (${Object.keys(i.value).length} days)` : '')) }); } catch {}
      }
    });
    const f = await phone.openApp('f260', { wait: '#todayDone' });
    if (holdMs > 0) await sleep(Math.max(0, 7000 - (Date.now() - t0)));
    else { for (let i = 0; i < 60; i++) { if (await f.evaluate(() => window.hub && hub.sync.lastPull > 0)) break; await sleep(250); } await sleep(1000); }
    out.beforeTap = { atMs: Date.now() - t0, today: await f.textContent('#todayTitle').catch(() => null), week: await f.textContent('#curWeekLbl').catch(() => null), doneLabel: await f.textContent('#todayDone').catch(() => null) };
    await f.click('#todayDone');
    out.tapAtMs = Date.now() - t0;
    await phone.page.screenshot({ path: path.join(EVID, `critic-done-during-stall-${name}-after-tap.png`), scale: 'css', animations: 'disabled' });
    await sleep(Math.max(holdMs, 2000) + 6000);
    hold = false;
    await sleep(4000);
    out.posts = posts;
    out.after = await counts(L);
    out.phoneAfter = { today: await f.textContent('#todayTitle').catch(() => null), week: await f.textContent('#curWeekLbl').catch(() => null) };
    await phone.close();
  } finally { await L.close(); }
  log(`[${name}] hold ${holdMs} ms | before ${JSON.stringify(out.before)} | UI at tap ${JSON.stringify(out.beforeTap)} (tap at ${out.tapAtMs} ms)`);
  log(`[${name}] POSTs ${JSON.stringify(out.posts)}`);
  log(`[${name}] after ${JSON.stringify(out.after)} | phone after ${JSON.stringify(out.phoneAfter)}`);
  return out;
}

const res = { claim: await run('claim', 10000), control: await run('control', 0) };
fs.writeFileSync(path.join(EVID, 'critic-done-during-stall.json'), JSON.stringify(res, null, 1));
log('wrote audits/evidence/p2/SYNC/critic-done-during-stall.json');
