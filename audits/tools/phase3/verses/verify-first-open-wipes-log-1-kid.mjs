// Skeptic #1, kid variant of "first-open-wipes-log": a brand-new device for Ezra, every /api/data GET delayed 9 s (cold,
// slow first load). hub.ready gives up after 6 s (apps/hub.js:337); Verses renders with no kidverse/family week, so
// familyWeek() = 1 (apps/verses.html:217). One "Got it" then writes f260.recall and log whole.
// Usage: node "audits/tools/phase3/verses/verify-first-open-wipes-log-1-kid.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, DEMO, sleep } from '../../lib/local.mjs';
const EV = path.resolve('audits/evidence/p3/verses');
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const row = async (who, app, key, scope = 'person') => { const r = await L.apiAs(who, `/api/data/${app}?scope=${scope}`); return (r.body.items || []).find(i => i.key === key) || null; };
const view = f => f.evaluate(() => { const q = s => document.querySelector(s); const v = s => q(s) && !q(s).hidden;
  return { who: q('#who')?.textContent.trim(), trainer: v('#trainer'), ref: v('#trainer') ? q('#ref').textContent : null, kick: q('#kick')?.textContent }; });
const out = {};
try {
  // Make sure Ezra has rated this week's verses today on the Kitchen iPad first (as in the claim)
  const ipad = await L.device({ device: 'ipad-portrait', profile: 'ezra', installClock: DEMO });
  await ipad.goto('#home'); let vf = await ipad.openApp('verses');
  await vf.waitForSelector('#trainer:not([hidden]), #done:not([hidden])', { timeout: 12000 }); await sleep(1500);
  out.ipadFirst = await view(vf);
  for (let i = 0; i < 2; i++) { if (!(await view(vf)).trainer) break; await vf.click('#show'); await vf.waitForSelector('#act-rate:not([hidden])'); await vf.click('#act-rate [data-rate="got"]'); await sleep(500); }
  for (let i = 0; i < 40; i++) { const h = await ipad.hub(); if (!Object.values(h.queue).some(q => Object.keys(q).length)) break; await sleep(250); }
  const rb = await row('ezra', 'f260', 'f260.recall'); const lb = await row('ezra', 'verses', 'log');
  out.recallBefore = rb && Object.keys(rb.value); out.logBefore = lb && lb.value;
  out.familyWeek = (await row('eli', 'kidverse', 'week', 'family'))?.value;
  const ph = await L.newDevice({ name: 'Ezra new phone', profiles: ['ezra'] });
  const phone = await L.device({ device: 'iphone-pwa', profile: 'ezra', installClock: DEMO, as: ph });
  await phone.ctx.route(u => /\/api\/data\//.test(u.pathname), async r => { if (r.request().method() === 'GET') await sleep(9000); await r.continue(); });
  const t0 = Date.now();
  await phone.goto('#home');
  const f = await phone.openApp('verses');
  await f.waitForSelector('#trainer:not([hidden]), #done:not([hidden]), #empty:not([hidden])', { timeout: 15000 }).catch(() => {});
  out.phonePaintMs = Date.now() - t0; out.phoneView = await view(f);
  await phone.page.screenshot({ path: path.join(EV, 'verify-first-open-wipes-log-1-kid-phone-stalled.png'), scale: 'css', animations: 'disabled' });
  if (out.phoneView.trainer) { await f.click('#show'); await f.waitForSelector('#act-rate:not([hidden])'); await f.click('#act-rate [data-rate="got"]'); out.ratedAtMs = Date.now() - t0; }
  await sleep(1000);
  for (let i = 0; i < 80; i++) { const h = await phone.hub(); if (!Object.values(h.queue).some(q => Object.keys(q).length)) break; await sleep(250); }
  await sleep(2000);
  const ra = await row('ezra', 'f260', 'f260.recall'); const la = await row('ezra', 'verses', 'log');
  out.recallAfter = ra && ra.value; out.logAfter = la && la.value;
  await ipad.page.reload(); await ipad.goto('#home'); vf = await ipad.openApp('verses');
  await vf.waitForSelector('#trainer:not([hidden]), #done:not([hidden])', { timeout: 12000 }).catch(() => {}); await sleep(2500);
  out.ipadAfter = await view(vf);
  out.ipadAfterRecallKeys = await vf.evaluate(() => Object.keys(hub.get("f260.recall", { app: "f260", scope: "person" }) || {}));
  await sleep(8000); out.ipadAfter10s = await view(vf); out.ipadAfter10sRecallKeys = await vf.evaluate(() => Object.keys(hub.get("f260.recall", { app: "f260", scope: "person" }) || {}));
  await ipad.page.reload(); await ipad.goto("#home"); vf = await ipad.openApp("verses"); await sleep(4000); out.ipadReopen = await view(vf);
  await ipad.page.screenshot({ path: path.join(EV, 'verify-first-open-wipes-log-1-kid-ipad-after.png'), scale: 'css', animations: 'disabled' });
  console.log(JSON.stringify(out, null, 1));
  fs.writeFileSync(path.join(EV, 'verify-first-open-wipes-log-1-kid-result.json'), JSON.stringify(out, null, 1));
} finally { await L.close(); }
