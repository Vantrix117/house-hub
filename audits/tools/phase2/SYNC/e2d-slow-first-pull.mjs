// SYNC e2d — a new phone whose first F260 pull takes longer than hub.ready's 6 s wait (apps/hub.js:337).
//   node "audits/tools/phase2/SYNC/e2d-slow-first-pull.mjs"
// Eli pairs a new phone (no cache) and opens F260 straight from a link (#f260). GET /api/data/f260 is held for 8 s
// (a slow cellular first load; the request timeout is 12 s). What does F260 write before its data arrives, and what is
// left on the server afterwards?
import { local, sleep } from '../../lib/local.mjs';
import { log, waitFor, serverRow, shot, writeEvidence } from './_util.mjs';

const out = {};
const L = await local({ variant: 'typical', clock: 'real' });
try {
  const keys = ['f260.weekStart', 'f260.summary', 'f260.week', 'f260.done'];
  out.before = {};
  for (const k of keys) { const r = await serverRow(L, 'eli', 'f260', k); out.before[k] = k === 'f260.done' ? Object.keys(r.value).length + ' keys' : r.value; }
  log('server before: weekStart has', Object.keys(out.before['f260.weekStart']).length, 'weeks; summary week', out.before['f260.summary'].week, '; f260.week', out.before['f260.week']);

  // baseline: what the iPad's F260 hero and pace say before the new phone appears
  { const ipad0 = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
    const f0 = await ipad0.openApp('f260', { wait: '#todayDone' }); await waitFor(() => f0.evaluate(() => hub.sync.lastPull > 0), { timeout: 15000 }); await sleep(1200);
    out.ipadBefore = { heroMeta: await f0.textContent('#heroMeta'), pace: await f0.textContent('#heroPace') }; await ipad0.close();
    log('iPad F260 hero before:', out.ipadBefore.heroMeta, '| pace:', out.ipadBefore.pace); }

  const ph = await L.newDevice({ name: 'Eli new phone', profiles: ['eli'] });
  const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: ph });
  let holdUntil = Date.now() + 60000;
  await phone.ctx.route(/\/api\/data\/f260\?/, async route => { if (route.request().method() === 'GET' && Date.now() < holdUntil) await sleep(8000); route.continue().catch(() => {}); });
  const posts = [];
  phone.page.on('request', r => { if (r.method() === 'POST' && /\/api\/data\/f260\/batch/.test(r.url())) { try { posts.push({ t: Date.now(), items: JSON.parse(r.postData()).items.map(i => ({ key: i.key, value: i.key === 'f260.weekStart' || i.key === 'f260.summary' || i.key === 'f260.week' ? i.value : '…' })) }); } catch {} } });
  const tOpen = Date.now();
  const f = await phone.openApp('f260');
  await sleep(6800);
  out.at7s = { today: await f.textContent('#todayTitle').catch(() => null), week: await f.textContent('#curWeekLbl').catch(() => null), queued: Object.keys((await phone.hub(f)).queue['hub.queue.f260.person.eli'] || {}) };
  out.shotAt7s = await shot(phone.page, 'e2d-phone-f260-at-7s.png');
  log(`7 s after opening: Today card "${out.at7s.today}", week label ${out.at7s.week}; queued before any data arrived: ${out.at7s.queued.join(', ')}`);
  holdUntil = 0;
  await sleep(14000);
  out.posts = posts.map(p => ({ dt: p.t - tOpen, items: p.items }));
  out.after = {};
  for (const k of keys) { const r = await serverRow(L, 'eli', 'f260', k); out.after[k] = k === 'f260.done' ? Object.keys(r.value).length + ' keys' : r.value; }
  out.ui = { today: await f.textContent('#todayTitle'), week: await f.textContent('#curWeekLbl'), heroMeta: await f.textContent('#heroMeta') };
  out.shotAfter = await shot(phone.page, 'e2d-phone-f260-after.png');
  log('batches the phone POSTed:', JSON.stringify(out.posts));
  log('server after: weekStart =', JSON.stringify(out.after['f260.weekStart']), '| summary week', out.after['f260.summary'] && out.after['f260.summary'].week, '| f260.week', out.after['f260.week'], '| done', out.after['f260.done']);
  log('phone UI after the data arrived:', JSON.stringify(out.ui));
  // does another device inherit the damage?
  const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  const fi = await ipad.openApp('f260', { wait: '#todayDone' });
  await waitFor(() => fi.evaluate(() => hub.sync.lastPull > 0), { timeout: 15000 }); await sleep(1500);
  out.ipadHeroMeta = await fi.textContent('#heroMeta');
  out.ipadPace = await fi.textContent('#heroPace');
  log('iPad F260 hero afterwards:', out.ipadHeroMeta, '| pace:', out.ipadPace);
  log('evidence', writeEvidence('e2d-slow-first-pull.json', out));
} finally { await L.close(); }
