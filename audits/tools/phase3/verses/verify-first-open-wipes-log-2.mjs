// Skeptic 2 for "first-open-wipes-log" (Verses). Independent reproduction, own helpers.
// Claim: on a device whose shell has cached f260|person but never pulled verses|person, hub.ready does not wait
// (apps/hub.js:334-337), Verses paints with an empty log, and one rating writes log={today:1} stamped now
// (apps/verses.html:297-298), which outranks the server's whole log (apps/hub.js:295; worker LWW).
//   node "audits/tools/phase3/verses/verify-first-open-wipes-log-2.mjs" offline   -> phone offline for its first Verses open
//   node "audits/tools/phase3/verses/verify-first-open-wipes-log-2.mjs" latency   -> every API request delayed 2.5 s (uniform slow network, not a GET-only hold)
//   node "audits/tools/phase3/verses/verify-first-open-wipes-log-2.mjs" kid       -> Ezra rates on the iPad, then a brand-new phone with every data GET held 9 s (cold, >6 s)
//   node "audits/tools/phase3/verses/verify-first-open-wipes-log-2.mjs" control   -> normal network, rating ~1.5 s after the card paints
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, DEMO } from '../../lib/local.mjs';
const MODE = process.argv[2] || 'offline';
const EV = path.resolve('audits/evidence/p3/verses'); fs.mkdirSync(EV, { recursive: true });
const tag = `verify-first-open-wipes-log-2-${MODE}`;
const L = await local({ variant: 'typical', clock: 'demo' });
const out = { mode: MODE };
const row = async (app, key) => { const r = await L.apiAs('eli', `/api/data/${app}?scope=person`); const it = (r.body.items || []).find(i => i.key === key); return it ? { value: it.value, updated_at: it.updated_at } : null; };
const view = f => f.evaluate(() => { const q = s => document.querySelector(s); const vis = s => { const e = q(s); return !!e && !e.hidden; };
  return { who: q('#who') && q('#who').textContent.trim(), ref: vis('#trainer') ? q('#ref').textContent : null,
    streak: vis('#stats') ? q('#st-streak').textContent : null, due: vis('#stats') ? q('#st-due').textContent : null,
    sync: window.hub && hub.sync.state, lastPull: window.hub && hub.sync.lastPull,
    versesCacheSince: (() => { try { return JSON.parse(localStorage.getItem('hub.cache.verses.person.eli')).since; } catch { return 'none'; } })() }; });
try {
  if (MODE === 'kid') { await kid(); process.exitCode = 0; } else {
  const lb = await row('verses', 'log'); const rb = await row('f260', 'f260.recall');
  out.before = { logDays: Object.keys(lb.value).length, logUpdatedAt: lb.updated_at, recallKeys: Object.keys(rb.value).length };
  const nd = await L.newDevice({ name: 'Skeptic phone', profiles: ['eli'] });
  const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: DEMO, as: nd });
  await phone.goto('#home'); await sleep(3000);
  out.cachesAfterHome = await phone.page.evaluate(() => Object.keys(localStorage).filter(k => /^hub\.cache\.(verses|f260)\./.test(k)));
  const reqLog = [];
  phone.page.on('request', r => { if (/\/api\/(data|batch|sync)/.test(r.url())) reqLog.push({ t: Date.now(), m: r.method(), u: r.url().replace(L.api, '').slice(0, 90) }); });
  if (MODE === 'offline') await phone.setOffline(true);
  if (MODE === 'latency') await phone.ctx.route(u => u.href.startsWith(L.api), async r => { await sleep(2500); await r.continue().catch(() => {}); });
  const t0 = Date.now();
  const f = await phone.openApp('verses');
  await f.waitForSelector('#trainer:not([hidden]), #done:not([hidden]), #empty:not([hidden])', { timeout: 15000 });
  out.paintMs = Date.now() - t0; out.atPaint = await view(f);
  await phone.page.screenshot({ path: path.join(EV, tag + '-at-paint.png'), scale: 'css', animations: 'disabled' });
  if (MODE === 'control') await sleep(1500);
  await f.click('#show'); await f.waitForSelector('#act-rate:not([hidden])', { timeout: 3000 });
  await f.click('#act-rate [data-rate="got"]');
  out.ratedMs = Date.now() - t0; out.afterTap = await view(f);
  if (MODE === 'offline') { await sleep(800); await phone.setOffline(false); }
  // let the queue drain and a later pull run
  const until = Date.now() + 20000;
  while (Date.now() < until) { const q = await phone.page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('hub.queue.')).some(k => Object.keys(JSON.parse(localStorage.getItem(k) || '{}')).length)); if (!q) break; await sleep(300); }
  await sleep(MODE === 'latency' ? 7000 : 3000);
  out.phoneLater = await view(f);
  const la = await row('verses', 'log'); const ra = await row('f260', 'f260.recall');
  out.after = { logDays: Object.keys(la.value).length, log: la.value, logUpdatedAt: la.updated_at, recallKeys: Object.keys(ra.value).length };
  out.requests = reqLog.map(r => ({ ms: r.t - t0, m: r.m, u: r.u })).slice(0, 14);
  const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', installClock: DEMO });
  const vf = await ipad.openApp('verses');
  await vf.waitForSelector('#trainer:not([hidden]), #done:not([hidden])', { timeout: 15000 }); await sleep(800);
  out.ipad = await view(vf);
  await ipad.page.screenshot({ path: path.join(EV, tag + '-ipad-after.png'), scale: 'css', animations: 'disabled' });
  out.verdictLine = `log days ${out.before.logDays} -> ${out.after.logDays}; recall keys ${out.before.recallKeys} -> ${out.after.recallKeys}; iPad streak ${out.ipad.streak}`;
  console.log(JSON.stringify(out, null, 1));
  fs.writeFileSync(path.join(EV, tag + '.json'), JSON.stringify(out, null, 1));
  }
} finally { await L.close(); }

// kid: the family week is 38 on the server; Ezra rates both on the Kitchen iPad (warm), then opens Verses on a brand-new phone
// whose data GETs are held 9 s. hub.ready gives up after 6 s (apps/hub.js:336) and familyWeek() falls back to 1 (verses.html:217).
async function kid() {
  const krow = async (app, key, scope = 'person') => { const r = await L.apiAs('ezra', `/api/data/${app}?scope=${scope}`); const it = (r.body.items || []).find(i => i.key === key); return it ? it.value : null; };
  out.familyWeek = await krow('kidverse', 'week', 'family');
  const ipad = await L.device({ device: 'ipad-portrait', profile: 'ezra', installClock: DEMO });
  let f = await ipad.openApp('verses');
  for (let i = 0; i < 2; i++) { await f.waitForSelector('#trainer:not([hidden])', { timeout: 15000 }); await f.click('#show'); await f.waitForSelector('#act-rate:not([hidden])'); await f.click('#act-rate [data-rate="got"]'); await sleep(400); }
  await sleep(3000);
  out.before = { recall: Object.keys((await krow('f260', 'f260.recall')) || {}), log: await krow('verses', 'log') };
  const nd = await L.newDevice({ name: 'Ezra new phone', profiles: ['ezra'] });
  const phone = await L.device({ device: 'iphone-pwa', profile: 'ezra', installClock: DEMO, as: nd });
  let slow = true;
  await phone.ctx.route(u => u.href.startsWith(L.api) && /\/api\/data\/[^/]+$/.test(new URL(u.href).pathname), async r => { if (slow && r.request().method() === 'GET') await sleep(9000); await r.continue().catch(() => {}); });
  const t0 = Date.now();
  f = await phone.openApp('verses');
  await f.waitForSelector('#trainer:not([hidden]), #done:not([hidden]), #empty:not([hidden])', { timeout: 20000 });
  out.paintMs = Date.now() - t0;
  out.atPaint = await f.evaluate(() => ({ who: document.querySelector('#who').textContent.trim(), ref: document.querySelector('#ref').textContent, kick: document.querySelector('#kick').textContent }));
  await phone.page.screenshot({ path: path.join(EV, tag + '-phone-at-paint.png'), scale: 'css', animations: 'disabled' });
  await f.click('#show'); await f.waitForSelector('#act-rate:not([hidden])'); await f.click('#act-rate [data-rate="got"]');
  out.ratedMs = Date.now() - t0;
  slow = false; await sleep(30000);
  out.after = { recall: Object.keys((await krow('f260', 'f260.recall')) || {}), log: await krow('verses', 'log') };
  const ipad2 = await L.device({ device: 'ipad-portrait', profile: 'ezra', installClock: DEMO });
  f = await ipad2.openApp('verses'); await f.waitForSelector('#trainer:not([hidden]), #done:not([hidden])', { timeout: 15000 }); await sleep(800);
  out.ipadAfter = await f.evaluate(() => ({ who: document.querySelector('#who').textContent.trim(), ref: document.querySelector('#trainer').hidden ? null : document.querySelector('#ref').textContent }));
  await ipad2.page.screenshot({ path: path.join(EV, tag + '-ipad-after.png'), scale: 'css', animations: 'disabled' });
  console.log(JSON.stringify(out, null, 1));
  fs.writeFileSync(path.join(EV, tag + '.json'), JSON.stringify(out, null, 1));
}
