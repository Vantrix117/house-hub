// Phase 6 batch 0b — Verses: no rating before its channels have pulled (P3-VERSES-03 / -07, UX-VERSES-5).
// The phase 3 scripts for these modes (verify-first-open-wipes-log-1 offline + kid, -2 offline + kid, stalled-load kid)
// now time out clicking a disabled Show, which is the fix holding but prints nothing; this prints what they meant to see.
//   A  adult, offline first open on a device whose shell cached f260: loading card, Show disabled, Enter / "3" / a direct
//      verses.rate() write nothing; back online the card enables and a rating adds one day to the server log (13 → 14).
//   B  kid, cold new phone with every GET /api/data/* held 9 s, after rating both week verses on the iPad: loading card
//      until verses + f260 + kidverse/family land, then the real week's state; server f260.recall and log unchanged.
// Usage: node "audits/tools/phase6/0b/verses-first-open.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, DEMO, sleep } from '../../lib/local.mjs';
const EV = path.resolve('audits/evidence/p6/0b'); fs.mkdirSync(EV, { recursive: true });
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const row = async (who, app, key, scope = 'person') => { const r = await L.apiAs(who, `/api/data/${app}?scope=${scope}`); return (r.body.items || []).find(i => i.key === key) || null; };
const view = f => f.evaluate(() => { const q = s => document.querySelector(s); const v = s => !!q(s) && !q(s).hidden;
  return { who: q('#who')?.textContent.trim(), busy: q('#trainer')?.getAttribute('aria-busy'), trainer: v('#trainer'), done: v('#done'), empty: v('#empty'), stats: v('#stats'),
    ref: v('#trainer') ? q('#ref').textContent.trim() : null, kick: v('#trainer') ? q('#kick').textContent : null, hint: v('#trainer') ? q('#hint').textContent : null,
    doneBig: v('#done') ? q('#done-big').textContent : null, doneSub: v('#done') ? q('#done-sub').textContent : null,
    showDisabled: q('#show')?.disabled, rateDisabled: [...document.querySelectorAll('[data-rate]')].every(b => b.disabled) }; });
const drained = async d => { for (let i = 0; i < 80; i++) { const h = await d.hub(); if (!Object.values(h.queue).some(q => Object.keys(q).length)) return true; await sleep(250); } return false; };
const out = {};
try {
  // ── A ──
  const lb = await row('eli', 'verses', 'log'); out.A = { serverLogDaysBefore: Object.keys(lb.value).length };
  const nd = await L.newDevice({ name: 'Eli new phone 0b', profiles: ['eli'] });
  const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: DEMO, as: nd });
  await phone.goto('#home'); await sleep(3000);
  await phone.setOffline(true);
  const f = await phone.openApp('verses'); await sleep(1500);
  out.A.offline = await view(f);
  await phone.page.screenshot({ path: path.join(EV, 'verses-A-offline-loading-iphone.png'), scale: 'css', animations: 'disabled' });
  await f.evaluate(() => { document.querySelector('#show').click(); window.verses && window.verses.rate('got'); });
  await f.focus('body').catch(() => {}); await f.page().keyboard.press('Enter'); await f.page().keyboard.press('3'); await sleep(400);
  out.A.afterTries = { ...(await view(f)), queued: await f.evaluate(() => Object.keys(localStorage).filter(k => /^hub\.queue\.(verses|f260)\./.test(k)).map(k => k + '=' + localStorage.getItem(k))) };
  await phone.setOffline(false);
  const t0 = Date.now(); await f.waitForSelector('#show:not([disabled]), #done:not([hidden])', { timeout: 30000 }); out.A.enabledAfterMs = Date.now() - t0;
  out.A.loaded = await view(f);
  await f.click('#show'); await f.waitForSelector('#act-rate:not([hidden])'); await f.click('#act-rate [data-rate="got"]');
  await drained(phone); await sleep(1500);
  const la = await row('eli', 'verses', 'log'); out.A.serverLogDaysAfter = Object.keys(la.value).length;
  await phone.page.screenshot({ path: path.join(EV, 'verses-A-online-rated-iphone.png'), scale: 'css', animations: 'disabled' });
  // ── B ──
  const ipad = await L.device({ device: 'ipad-portrait', profile: 'ezra', installClock: DEMO });
  await ipad.goto('#home'); const vf = await ipad.openApp('verses');
  await vf.waitForSelector('#show:not([disabled]), #done:not([hidden])', { timeout: 20000 });
  for (let i = 0; i < 2; i++) { if (!(await view(vf)).trainer) break; await vf.click('#show'); await vf.waitForSelector('#act-rate:not([hidden])'); await vf.click('#act-rate [data-rate="got"]'); await sleep(500); }
  await drained(ipad);
  const rb = await row('ezra', 'f260', 'f260.recall'), lgb = await row('ezra', 'verses', 'log');
  out.B = { recallBefore: rb && rb.value, logBefore: lgb && lgb.value, familyWeek: (await row('eli', 'kidverse', 'week', 'family'))?.value };
  const nk = await L.newDevice({ name: 'Ezra new phone 0b', profiles: ['ezra'] });
  const kp = await L.device({ device: 'iphone-pwa', profile: 'ezra', installClock: DEMO, as: nk });
  await kp.ctx.route(u => /\/api\/data\//.test(u.pathname), async r => { if (r.request().method() === 'GET') await sleep(9000); await r.continue(); });
  const t1 = Date.now(); await kp.goto('#home'); const kf = await kp.openApp('verses'); await sleep(7000);
  out.B.at7s = await view(kf);
  await kp.page.screenshot({ path: path.join(EV, 'verses-B-kid-cold-loading-iphone.png'), scale: 'css', animations: 'disabled' });
  await kf.waitForFunction(() => document.querySelector('#trainer').getAttribute('aria-busy') === 'false', null, { timeout: 90000 }); out.B.loadedAfterMs = Date.now() - t1;
  out.B.loaded = await view(kf);
  await kp.page.screenshot({ path: path.join(EV, 'verses-B-kid-cold-loaded-iphone.png'), scale: 'css', animations: 'disabled' });
  await drained(kp); await sleep(1500);
  const ra = await row('ezra', 'f260', 'f260.recall'), lga = await row('ezra', 'verses', 'log');
  out.B.recallUnchanged = JSON.stringify(ra && ra.value) === JSON.stringify(out.B.recallBefore);
  out.B.logUnchanged = JSON.stringify(lga && lga.value) === JSON.stringify(out.B.logBefore);
  out.B.recallBefore = Object.keys(out.B.recallBefore || {}).length + ' keys'; out.B.logBefore = Object.keys(out.B.logBefore || {}).length + ' days';
  console.log(JSON.stringify(out, null, 1));
  fs.writeFileSync(path.join(EV, 'verses-first-open-result.json'), JSON.stringify(out, null, 1));
} finally { await L.close(); }
