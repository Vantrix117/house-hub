// Skeptic #3 (tie-break) for "critic-locked-phone-no-alert-2": is there ANY path that alerts at 0 when the hub's JS is not running?
// Engine: WebKit (closest to iOS). Three runs on a fresh local instance:
//   CTRL  = page visible through the end (proves the probes see beep/toast/notification when JS runs);
//   LOCK  = Timer app closed, page hidden, clock jumps +120 s with no timers fired (suspended JS), then visible;
//   LOCKO = Timer app open at lock, same jump.
// Plus a code scan of worker/src/*.js and sw.js for any timer-aware server/push path, and the cron job list.
// Run: node "audits/tools/phase3/timer/verify-critic-locked-phone-no-alert-2-3.mjs"
// Output: audits/evidence/p3/timer/verify-critic-locked-phone-no-alert-2-3.json
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';
import { save, appState, pillState, serverTimer, audioProbe, notifyProbe, toastText } from './_util.mjs';
const out = { code: {} };
for (const f of fs.readdirSync(path.join(ROOT, 'worker', 'src')).filter(f => f.endsWith('.js'))) {
  const lines = fs.readFileSync(path.join(ROOT, 'worker', 'src', f), 'utf8').split('\n');
  const hits = lines.map((l, i) => /timer/i.test(l) ? (i + 1) + ': ' + l.trim().slice(0, 120) : null).filter(Boolean);
  if (hits.length) out.code[f] = hits;
}
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8').split('\n');
out.code.swPushHandler = sw.map((l, i) => /addEventListener\('(push|notificationclick)'/.test(l) ? (i + 1) + ': ' + l.trim().slice(0, 140) : null).filter(Boolean);
out.code.jobsLine = fs.readFileSync(path.join(ROOT, 'worker', 'src', 'reminders.js'), 'utf8').split('\n').find(l => /export const JOBS/.test(l)).trim();
const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
const setHidden = async (page, h) => { for (const fr of page.frames()) await fr.evaluate(h => {
  Object.defineProperty(document, 'hidden', { get: () => h, configurable: true });
  Object.defineProperty(document, 'visibilityState', { get: () => (h ? 'hidden' : 'visible'), configurable: true });
  document.dispatchEvent(new Event('visibilitychange')); }, h).catch(() => {}); };
const reset = () => L.apiAs('eli', '/api/data/timer/batch?scope=person', { method: 'POST', body: { items: [{ key: 'timer.active', value: null, updated_at: Date.now() + 1 }] } });
async function run(mode) {
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: Date.now() });
  await audioProbe(d.ctx); await notifyProbe(d.ctx);
  await d.goto('#home'); await d.page.waitForFunction(() => window.hub && hub.profile); await d.ctx.clock.runFor(800);
  await d.page.click('.tab[data-tab="apps"]'); await d.page.click('.tile[data-id="timer"]');
  let f; for (let i = 0; i < 80 && !(f = d.frame('timer')); i++) await sleep(100);
  await f.waitForFunction(() => window.hub && document.getElementById('go'));
  await d.ctx.clock.runFor(700);
  await f.click('[data-s="60"]'); await f.click('#go'); await d.ctx.clock.runFor(1500);
  const appOpen = mode === 'LOCKO';
  if (!appOpen) { await d.page.click('#pill-home'); await d.ctx.clock.runFor(1500); await d.page.click('.tab[data-tab="home"]'); await d.ctx.clock.runFor(2000); }
  const before = { shell: await pillState(d.page), server: await serverTimer(L, 'eli') };
  let during = null;
  if (mode === 'CTRL') {
    await d.ctx.clock.runFor(62000);                       // visible, JS running through 0
  } else {
    await setHidden(d.page, true);
    const now = await d.page.evaluate(() => Date.now());
    await d.ctx.clock.setSystemTime(now + 120000);         // suspended: time passes, nothing fires
    during = { notifyCount: await d.page.evaluate(() => window.__notify.shown.length), serverRecordStillThere: !!(await serverTimer(L, 'eli'))['timer.active'] };
    await setHidden(d.page, false); await d.ctx.clock.runFor(1500);
  }
  const after = { app: appOpen ? await appState(f) : null, shell: await pillState(d.page), toast: await toastText(d.page), server: await serverTimer(L, 'eli') };
  await d.close(); await reset();
  return { before, during, after };
}
try {
  out.CTRL = await run('CTRL');
  out.LOCK = await run('LOCK');
  out.LOCKO = await run('LOCKO');
  const r = await L.apiAs('eli', '/api/admin/cron/run', { method: 'POST', body: { job: 'timer' } });
  out.cronTimer = { status: r.status, body: r.body };
} catch (e) { out.error = String(e && e.stack || e).slice(0, 900); }
finally { await L.close(); }
console.log('saved', save('verify-critic-locked-phone-no-alert-2-3.json', out));
console.log(JSON.stringify(out, null, 1));
