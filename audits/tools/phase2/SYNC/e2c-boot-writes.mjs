// SYNC e2c — what does F260 write by itself when it opens (no tap)? Warm cache, then a stale cache.
//   node "audits/tools/phase2/SYNC/e2c-boot-writes.mjs"
// Boot/render saves in F260: weekStart when the current week has none (apps/f260.html:938), f260.summary when it differs
// (:1509), best when the streak beats it (:1503), miles when a milestone is newly met (:1245), and the one-time f260.view tidy (:2067).
// 1. Phone opens F260 with a warm cache: which keys are POSTed in the first 10 s?
// 2. Phone is left hidden (no polls) while the iPad ticks Acts 6 and marks a memory verse; the phone PWA is then relaunched
//    (reload) straight into F260 from its now-stale cache. Does anything it POSTs before or after the pull undo the iPad's work?
import { local, sleep } from '../../lib/local.mjs';
import { log, waitFor, serverRow, writeEvidence, setHidden } from './_util.mjs';

const out = {};
const L = await local({ variant: 'typical', clock: 'real' });
try {
  const ph = await L.newDevice({ name: 'Eli phone', profiles: ['eli'] });
  const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: ph });
  const posts = [];
  phone.page.on('request', r => { if (r.method() === 'POST' && /\/api\/data\/f260\/batch/.test(r.url())) { try { posts.push({ t: Date.now(), frame: r.frame().url().replace(/^https?:\/\/[^/]+/, ''), keys: JSON.parse(r.postData()).items.map(i => i.key) }); } catch {} } });
  let tOpen = Date.now();
  let f = await phone.openApp('f260', { wait: '#todayDone' });
  await sleep(10000);
  out.warm = posts.filter(p => p.t >= tOpen).map(p => ({ dt: p.t - tOpen, keys: p.keys }));
  log('1: keys POSTed in 10 s after a warm open (no tap):', JSON.stringify(out.warm));

  // 2
  await phone.goto('#home'); await sleep(500);
  await setHidden(phone.page, true);
  const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  const fi = await ipad.openApp('f260', { wait: '#todayDone' });
  await waitFor(() => fi.evaluate(() => hub.sync.lastPull > 0), { timeout: 15000 }); await sleep(800);
  await fi.click('#todayDone');
  await fi.evaluate(() => document.querySelector('[data-mem="38-0"] .mkm').click());
  await sleep(2500);
  out.serverAfterIpad = { done382: !!(await serverRow(L, 'eli', 'f260', 'f260.done')).value['38-2'], mem380: !!(await serverRow(L, 'eli', 'f260', 'f260.mem')).value['38-0'] };
  out.phoneCacheStale = await phone.page.evaluate(() => { const c = JSON.parse(localStorage.getItem('hub.cache.f260.person.eli')); return !(c.items['f260.done'].v['38-2']); });
  tOpen = Date.now();
  await phone.page.goto(phone.page.url().replace(/#.*$/, '') + '#f260', { waitUntil: 'load' });
  f = await (async () => { const until = Date.now() + 10000; while (Date.now() < until) { const fr = phone.frame('f260'); if (fr) return fr; await sleep(50); } })();
  await f.waitForSelector('#todayDone', { timeout: 10000 });
  out.firstPaint = await f.textContent('#todayTitle');
  await sleep(10000);
  out.stale = posts.filter(p => p.t >= tOpen).map(p => ({ dt: p.t - tOpen, frame: p.frame, keys: p.keys }));
  out.serverAfterPhoneRelaunch = { done382: !!(await serverRow(L, 'eli', 'f260', 'f260.done')).value['38-2'], mem380: !!(await serverRow(L, 'eli', 'f260', 'f260.mem')).value['38-0'], summary: (await serverRow(L, 'eli', 'f260', 'f260.summary')).value };
  out.phoneNow = await f.textContent('#todayTitle');
  log(`2: iPad ticked Acts 6 + memory verse → server ${JSON.stringify(out.serverAfterIpad)}; phone cache stale: ${out.phoneCacheStale}`);
  log(`2: phone relaunch paints "${out.firstPaint}" first, then "${out.phoneNow}"; keys it POSTed in 10 s: ${JSON.stringify(out.stale)}`);
  log(`2: server after the phone relaunch: ${JSON.stringify(out.serverAfterPhoneRelaunch)}`);
  log('evidence', writeEvidence('e2c-boot-writes.json', out));
} finally { await L.close(); }
