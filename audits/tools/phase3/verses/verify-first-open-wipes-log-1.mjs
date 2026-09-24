// Skeptic #1 for finding "first-open-wipes-log" (Verses). Independent reproduction, own helpers.
// Claim: on a device whose shell already cached f260/person, the first Verses open does not wait for its verses/person pull
// (apps/hub.js:334-337), so a rating writes log = {today:1} (apps/verses.html:297-298) which then beats the server's log (LWW,
// worker/src/data.js:60; client pull skips older rows, apps/hub.js:295).
// Modes: offline (phone goes offline after Home, first Verses open, one rating, reconnect)
//        slow    (verses person GET delayed 4 s, rating inside the window)
//        control (no delay: wait 3 s for the pull before rating — the log must be kept and incremented)
// Usage: node "audits/tools/phase3/verses/verify-first-open-wipes-log-1.mjs" offline|slow|control
import fs from 'node:fs';
import path from 'node:path';
import { local, DEMO, sleep } from '../../lib/local.mjs';
const MODE = process.argv[2] || 'offline';
const EV = path.resolve('audits/evidence/p3/verses');
const P = n => 'verify-first-open-wipes-log-1-' + MODE + '-' + n;
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const row = async (who, app, key) => { const r = await L.apiAs(who, `/api/data/${app}?scope=person`); const it = (r.body.items || []).find(i => i.key === key); return it || null; };
const view = f => f.evaluate(() => { const q = s => document.querySelector(s); const v = s => q(s) && !q(s).hidden;
  return { who: q('#who')?.textContent.trim(), trainer: v('#trainer'), ref: v('#trainer') ? q('#ref').textContent : null,
    streak: q('#st-streak')?.textContent, statsVisible: v('#stats'), logLocal: hub.get('log'), sync: hub.sync.state }; });
const out = { mode: MODE };
try {
  const before = await row('eli', 'verses', 'log');
  out.serverLogBefore = { days: Object.keys(before.value).length, updated_at: before.updated_at, keys: Object.keys(before.value).sort() };
  const ph = await L.newDevice({ name: 'Eli new phone', profiles: ['eli'] });
  const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: DEMO, as: ph });
  await phone.goto('#home'); await sleep(3000);
  out.cachesAfterHome = await phone.page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('hub.cache.')).map(k => k + ' since>0=' + (JSON.parse(localStorage.getItem(k)).since > 0)));
  if (MODE === 'offline') await phone.setOffline(true);
  if (MODE === 'slow') await phone.ctx.route(u => /\/api\/data\/verses$/.test(u.pathname) && u.searchParams.get('scope') === 'person', async r => { await sleep(4000); await r.continue(); });
  const t0 = Date.now();
  const f = await phone.openApp('verses');
  await f.waitForSelector('#trainer:not([hidden]), #done:not([hidden]), #empty:not([hidden])', { timeout: 12000 }).catch(() => {});
  out.paintMs = Date.now() - t0;
  if (MODE === 'control') await sleep(3000);
  out.beforeRating = await view(f);
  await phone.page.screenshot({ path: path.join(EV, P('phone-before.png')), scale: 'css', animations: 'disabled' });
  await f.click('#show'); await f.waitForSelector('#act-rate:not([hidden])', { timeout: 3000 });
  await f.click('#act-rate [data-rate="got"]');
  out.ratedAtMs = Date.now() - t0;
  await sleep(300);
  out.afterRating = await view(f);
  if (MODE === 'offline') { await sleep(500); await phone.setOffline(false); }
  // wait for the queue to drain and the delayed pull to land
  for (let i = 0; i < 60; i++) { const h = await phone.hub(); if (!Object.values(h.queue).some(q => Object.keys(q).length)) break; await sleep(250); }
  await sleep(6000);
  out.phoneAfterSync = await view(f);
  const after = await row('eli', 'verses', 'log');
  out.serverLogAfter = { days: Object.keys(after.value).length, updated_at: after.updated_at, value: after.value };
  const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', installClock: DEMO });
  await ipad.goto('#home'); const vf = await ipad.openApp('verses');
  await vf.waitForSelector('#trainer:not([hidden]), #done:not([hidden]), #empty:not([hidden])', { timeout: 12000 }).catch(() => {});
  await sleep(2500);
  out.ipad = await view(vf);
  await ipad.page.screenshot({ path: path.join(EV, P('ipad-after.png')), scale: 'css', animations: 'disabled' });
  console.log(JSON.stringify(out, null, 1));
  fs.writeFileSync(path.join(EV, P('result.json')), JSON.stringify(out, null, 1));
} finally { await L.close(); }
