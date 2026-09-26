// UX-SYNC-a1 skeptic s1: is anyone told when a change did not sync?
//   1. F260 open on the phone, offline, a tick waiting: what covers the tab-bar dot; any sync wording in the app?
//   2. Larder open offline with a write waiting: does its own banner speak up? (the counter-case)
//   3. Larder: 201 writes queued offline, then back online → the batch is refused and dropped. What does the banner /
//      hub.sync / the Me card say over the next 35 s?
//   node "audits/tools/phase5/ux-verify/UX-SYNC-a1/s1-sync-ui.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../../lib/local.mjs';
const OUT = path.join(ROOT, 'audits/evidence/p5/ux-verify/UX-SYNC-a1/s1');
fs.mkdirSync(OUT, { recursive: true });
const res = {};
const shot = (d, n) => d.page.screenshot({ path: path.join(OUT, n), scale: 'css', animations: 'disabled', caret: 'hide' });
const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
try {
  const ph = await L.newDevice({ name: 'Eli phone s1', profiles: ['eli'] });
  const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: ph });
  await phone.goto('#home');
  await phone.page.waitForFunction(() => hub.sync.lastPull > 0, null, { timeout: 15000 });
  // 1
  const f = await phone.openApp('f260', { wait: '#todayDone' }); await sleep(1500);
  await phone.setOffline(true); await sleep(300);
  await f.click('#todayDone'); await sleep(1000);
  res.f260 = await phone.page.evaluate(() => { const d = document.getElementById('syncdot'); const r = d.getBoundingClientRect(); const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); const v = getComputedStyle(document.getElementById('viewer'));
    return { dotClass: d.className, dotRect: [r.x, r.y, r.width, r.height].map(Math.round), onTop: top ? (top.id || top.tagName) : null, viewer: { position: v.position, zIndex: v.zIndex, display: v.display }, tabbarZ: getComputedStyle(document.querySelector('.tabbar')).zIndex }; });
  res.f260.sync = await f.evaluate(() => ({ ...hub.sync }));
  res.f260.wording = await f.evaluate(() => { const m = document.body.innerText.match(/.{0,40}(offline|not sent|unsent|waiting to send|not synced|sync).{0,40}/i); return m ? m[0] : null; });
  res.f260.shellWording = await phone.page.evaluate(() => { const t = [...document.querySelectorAll('#viewer #pill')].map(e => e.innerText).join(' '); return t; });
  await shot(phone, '1-f260-offline-pending.png');
  await phone.setOffline(false); await sleep(2500);
  // 2
  const lf = await phone.openApp('leftovers'); await sleep(2000);
  await phone.setOffline(true); await sleep(500);
  await lf.evaluate(() => hub.set('zz:one', { t: 1 })); await sleep(500);
  res.larderOffline = await lf.evaluate(() => { const m = document.getElementById('mode'); return { banner: m && !m.hidden ? m.textContent : null, sync: { ...hub.sync } }; });
  await shot(phone, '2-larder-offline-pending.png');
  // 3
  await lf.evaluate(() => { for (let i = 0; i < 201; i++) hub.set('zz:' + i, { i }); });
  await sleep(300);
  res.dropped = { before: await lf.evaluate(() => ({ ...hub.sync })), timeline: [] };
  await phone.setOffline(false);
  const t0 = Date.now();
  let shotErr = false;
  while (Date.now() - t0 < 36000) {
    const s = await lf.evaluate(() => { const m = document.getElementById('mode'); return { banner: m && !m.hidden ? m.textContent : null, state: hub.sync.state, pending: hub.sync.pending, err: hub.sync.lastError }; });
    const last = res.dropped.timeline[res.dropped.timeline.length - 1];
    if (!last || last.banner !== s.banner || last.state !== s.state || last.pending !== s.pending) res.dropped.timeline.push({ ms: Date.now() - t0, ...s });
    if (s.state === 'error' && !shotErr) { shotErr = true; await shot(phone, '3-larder-drop-error.png'); }
    await sleep(250);
  }
  const srv = await L.apiAs('eli', '/api/data/leftovers?scope=family');
  res.dropped.onServer = (srv.body.items || []).filter(i => /^zz:/.test(i.key)).length;
  res.dropped.onDevice = await lf.evaluate(() => hub.list('zz:').length);
  await shot(phone, '3-larder-36s-after-drop.png');
  await phone.page.evaluate(() => { document.getElementById('pill-home').click(); }); await sleep(800);
  await phone.page.evaluate(() => { location.hash = '#me'; }); await sleep(1000);
  res.dropped.meCard = await phone.page.evaluate(() => { const c = [...document.querySelectorAll('#view-me .card')].find(c => /^Sync/.test((c.querySelector('h2') || {}).textContent || '')); return c ? c.innerText.replace(/\s+/g, ' ').slice(0, 160) : null; });
  res.dropped.dot = await phone.page.evaluate(() => document.getElementById('syncdot').className);
  await shot(phone, '3-me-after-drop.png');
  fs.writeFileSync(path.join(OUT, 'sync-ui.json'), JSON.stringify(res, null, 1));
  console.log(JSON.stringify(res, null, 1));
} finally { await L.close(); }
