// Skeptic #1 for "critic-locked-phone-no-alert-2": does anything ring/notify at 0 when the hub is not running?
// Model of a locked/suspended iPhone: page hidden, then the browser clock JUMPS (clock.setSystemTime) past endAt without
// firing any timer (suspended JS runs nothing), then visible again and 1.5 s of timers run (resume).
// Two cases: S1 = Timer app closed (Home) at lock; S2 = Timer app open at lock. Plus the server side: while the record
// sits past endAt, is there any server job that could push? (POST /api/admin/cron/run {job:'timer'}, and every job's run.)
// Run: node "audits/tools/phase3/timer/verify-critic-locked-phone-no-alert-2-1.mjs"
// Output: audits/evidence/p3/timer/verify-critic-locked-phone-no-alert-2-1.json
import { local, sleep } from '../../lib/local.mjs';
import { save, appState, pillState, serverTimer, audioProbe, notifyProbe, toastText } from './_util.mjs';
const out = {};
const L = await local({ variant: 'typical', clock: 'real', engine: 'chromium' });
const setHidden = async (page, h) => { for (const fr of page.frames()) await fr.evaluate(h => {
  Object.defineProperty(document, 'hidden', { get: () => h, configurable: true });
  Object.defineProperty(document, 'visibilityState', { get: () => (h ? 'hidden' : 'visible'), configurable: true });
  document.dispatchEvent(new Event('visibilitychange')); }, h).catch(() => {}); };
const reset = () => L.apiAs('eli', '/api/data/timer/batch?scope=person', { method: 'POST', body: { items: [{ key: 'timer.active', value: null, updated_at: Date.now() + 1 }] } });
const shellAudio = p => p.evaluate(() => window.__audio ? { made: window.__audio.made, osc: window.__audio.osc } : null);
async function start(openAtLock) {
  const t0 = Date.now();
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: t0 });
  await audioProbe(d.ctx); await notifyProbe(d.ctx);
  await d.goto('#home'); await d.page.waitForFunction(() => window.hub && hub.profile); await d.ctx.clock.runFor(800);
  await d.page.click('.tab[data-tab="apps"]'); await d.page.click('.tile[data-id="timer"]');
  let f; for (let i = 0; i < 60 && !(f = d.frame('timer')); i++) await sleep(100);
  await f.waitForFunction(() => window.hub && document.getElementById('go'));
  await d.ctx.clock.runFor(700);
  await f.click('[data-s="60"]'); await f.click('#go'); await d.ctx.clock.runFor(1500);
  if (!openAtLock) { await d.page.click('#pill-home'); await d.ctx.clock.runFor(1500); await d.page.click('.tab[data-tab="home"]'); await d.ctx.clock.runFor(1000); }
  await d.ctx.clock.runFor(2000); // let the write flush
  const beforeLock = { app: openAtLock ? await appState(f) : null, shell: await pillState(d.page), server: await serverTimer(L, 'eli') };
  // lock: hidden, then time jumps 2 min with NO timers fired (suspended), server side checked while "locked"
  await setHidden(d.page, true);
  const now = await d.page.evaluate(() => Date.now());
  await d.ctx.clock.setSystemTime(now + 120000);
  const whileLocked = { shellNotify: await d.page.evaluate(() => window.__notify.shown.length), shellAudio: await shellAudio(d.page),
    appAudio: openAtLock ? (await appState(f)).audio : null, serverRecord: await serverTimer(L, 'eli') };
  // unlock
  await setHidden(d.page, false); await d.ctx.clock.runFor(1500);
  const back = { app: openAtLock ? await appState(f) : null, shell: await pillState(d.page), toast: await toastText(d.page), server: await serverTimer(L, 'eli') };
  await d.close(); await reset();
  return { beforeLock, whileLocked, back };
}
try {
  out.S1_appClosed = await start(false);
  out.S2_appOpen = await start(true);
  // server: a still-running record past endAt; is there a job that knows timers?
  await L.apiAs('eli', '/api/data/timer/batch?scope=person', { method: 'POST', body: { items: [{ key: 'timer.active', value: { endAt: Date.now() - 5000, total: 60, startedAt: Date.now() - 65000 }, updated_at: Date.now() }] } });
  const r = await L.apiAs('eli', '/api/admin/cron/run', { method: 'POST', body: { job: 'timer' } });
  out.server = { cronTimerJob: { status: r.status, body: r.body } };
  await reset();
} catch (e) { out.error = String(e && e.stack || e).slice(0, 800); }
finally { await L.close(); }
console.log('saved', save('verify-critic-locked-phone-no-alert-2-1.json', out));
console.log(JSON.stringify(out, null, 1));
