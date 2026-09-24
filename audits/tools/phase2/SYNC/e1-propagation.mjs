// SYNC e1 — persistence and propagation between Eli's phone and the Kitchen iPad (both signed in as Eli).
//   node "audits/tools/phase2/SYNC/e1-propagation.mjs"
// A. Phone ticks today's F260 reading (Today card "Done"). How fast does the server have it, and the iPad's Home card?
// B. iPad has F260 open. Phone ticks the next reading. How fast does the iPad's open F260 show it, and which window fetched it?
// C. iPad hidden (screen off / other app). Phone ticks again. Does the iPad pull while hidden? What happens on becoming visible?
// (The in-page profile switch test is e1d-switch-poll.mjs.)
import { local, sleep } from '../../lib/local.mjs';
import { log, waitFor, serverRow, shot, netLog, writeEvidence, setHidden } from './_util.mjs';

const out = { A: {}, B: {}, C: {} };
const L = await local({ variant: 'typical', clock: 'real' });
try {
  const ph = await L.newDevice({ name: 'Eli phone', profiles: ['eli'] });
  const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  const inet = netLog(ipad.page);
  await ipad.goto('#home');
  await waitFor(() => ipad.page.evaluate(() => hub.sync.lastPull > 0), { timeout: 15000 });
  const homeCard = () => ipad.page.evaluate(() => { const c = [...document.querySelectorAll('#view-home .gcard')].find(c => /Today's reading/.test(c.textContent)); return c ? c.querySelector('.gbig').textContent.trim() + ' | ' + c.querySelector('.gsub').textContent.trim() : null; });
  out.A.homeBefore = await homeCard();
  out.A.shotBefore = await shot(ipad.page, 'e1-A-ipad-home-before.png');
  log('iPad Home before:', out.A.homeBefore);

  const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: ph });
  const f = await phone.openApp('f260', { wait: '#todayDone' });
  await waitFor(() => f.evaluate(() => hub.sync.lastPull > 0), { timeout: 15000 });

  // ── A ──
  const tA = Date.now();
  out.A.target = await f.getAttribute('#todayDone', 'data-target');
  await f.click('#todayDone');
  const lsQueueRightAfter = await f.evaluate(() => { try { return JSON.parse(localStorage.getItem('hub.queue.f260.person.eli') || '{}'); } catch { return null; } });
  out.A.queuedKeysImmediately = Object.keys(lsQueueRightAfter || {});
  const srv = await waitFor(async () => { const r = await serverRow(L, 'eli', 'f260', 'f260.done'); return r && r.value[out.A.target] ? r : null; }, { timeout: 10000, every: 50 });
  out.A.serverMs = srv ? Date.now() - tA : null;
  log(`A: phone ticked ${out.A.target}; queued at once in localStorage: ${out.A.queuedKeysImmediately.join(', ')}; server has it after ${out.A.serverMs} ms`);
  const before = await homeCard();
  const hc = await waitFor(async () => { const t = await homeCard(); return t && t !== before ? t : null; }, { timeout: 70000, every: 200 });
  out.A.homeAfter = hc; out.A.homeMs = hc ? Date.now() - tA : null;
  out.A.ipadPullsBetween = inet.filter(r => r.t >= tA && r.t <= Date.now() && r.method === 'GET' && r.url.startsWith('/api/data/f260')).map(r => ({ dt: r.t - tA, url: r.url.slice(0, 60), frame: r.frame }));
  out.A.shotAfter = await shot(ipad.page, 'e1-A-ipad-home-after.png');
  log(`A: iPad Home card changed after ${out.A.homeMs} ms → ${hc}`);
  log('A: iPad f260 pulls in that window', JSON.stringify(out.A.ipadPullsBetween));

  // ── B ── iPad opens F260 (it already has the first tick), then the phone ticks the next reading
  const fi = await ipad.openApp('f260', { wait: '#todayDone' });
  await waitFor(() => fi.evaluate(() => hub.sync.lastPull > 0), { timeout: 15000 });
  await sleep(1500);
  out.B.ipadTodayBefore = await fi.textContent('#todayTitle');
  const tB = Date.now();
  out.B.target = await f.getAttribute('#todayDone', 'data-target');
  await f.click('#todayDone');
  const isDone = id => fi.evaluate(id => { const d = document.querySelector('[data-day="' + id + '"]'); return !!(d && d.classList.contains('done')); }, id);
  const ok = await waitFor(() => isDone(out.B.target), { timeout: 70000, every: 200 });
  out.B.ms = ok ? Date.now() - tB : null;
  out.B.ipadTodayAfter = await fi.textContent('#todayTitle');
  out.B.pulls = inet.filter(r => r.t >= tB && r.t <= Date.now() && r.method === 'GET' && r.url.startsWith('/api/data/f260')).map(r => ({ dt: r.t - tB, frame: r.frame }));
  out.B.shot = await shot(ipad.page, 'e1-B-ipad-f260-after.png');
  log(`B: phone ticked ${out.B.target}; iPad's open F260 shows it after ${out.B.ms} ms (today card ${out.B.ipadTodayBefore} → ${out.B.ipadTodayAfter}); f260 GETs:`, JSON.stringify(out.B.pulls));

  // ── C ── iPad hidden
  await setHidden(ipad.page, true);
  const tC = Date.now();
  out.C.target = await f.getAttribute('#todayDone', 'data-target');
  await f.click('#todayDone');
  await sleep(65000);
  out.C.doneWhileHidden = await isDone(out.C.target);
  out.C.requestsWhileHidden = inet.filter(r => r.t >= tC && r.url.startsWith('/api/data')).length;
  await setHidden(ipad.page, false);
  const tV = Date.now();
  const okC = await waitFor(() => isDone(out.C.target), { timeout: 15000, every: 100 });
  out.C.msAfterVisible = okC ? Date.now() - tV : null;
  log(`C: phone ticked ${out.C.target}; after 65 s hidden the iPad shows it: ${out.C.doneWhileHidden}; /api/data requests while hidden: ${out.C.requestsWhileHidden}; after visibilitychange → shown in ${out.C.msAfterVisible} ms`);

  out.pageErrors = ipad.logs.filter(l => /pageerror/.test(l)).concat(phone.logs.filter(l => /pageerror/.test(l)));
  log('evidence', writeEvidence('e1-propagation.json', out));
} finally { await L.close(); }
