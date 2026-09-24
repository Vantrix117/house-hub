// Skeptic 2 for "No server push exists for a kitchen timer, so nothing can ring or notify on a locked iPhone at 0".
// Part 1 (code): scan worker/src, worker/wrangler.toml and sw.js for any timer scheduling; list the reminder JOBS; quote the
//   shell's own comment and CLAUDE.md's statement of intent (local notification only).
// Part 2 (rig, Chromium, controllable clock, notification stubbed 'granted' + fake registration, AudioContext counted):
//   R1 page "suspended" (document.hidden forced, fastForward) through 0 and back 2 min after the end  -> what fires?
//   R2 the same, back 20 s after the end (page resumes within the 60 s window)                       -> what fires?
//   R3 control: page visible the whole time, app closed (Home)                                         -> what fires?
// Run: node "audits/tools/phase3/timer/verify-critic-locked-phone-no-alert-2-2.mjs"
// Output: audits/evidence/p3/timer/verify-critic-locked-phone-no-alert-2-2.json
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const EVD = path.join(ROOT, 'audits', 'evidence', 'p3', 'timer');
fs.mkdirSync(EVD, { recursive: true });
const out = { code: {}, rig: {} };

// ── Part 1: code ─────────────────────────────────────────────
const scan = [];
const wdir = path.join(ROOT, 'worker', 'src');
for (const f of fs.readdirSync(wdir).filter(f => f.endsWith('.js'))) scan.push(path.join('worker', 'src', f));
scan.push('worker/wrangler.toml', 'sw.js');
out.code.timerMentions = {};
for (const f of scan) {
  const lines = fs.readFileSync(path.join(ROOT, f), 'utf8').split('\n');
  const hits = lines.map((l, i) => [i + 1, l]).filter(([, l]) => /timer|showTrigger|TimestampTrigger|endAt/i.test(l) && !/'apps\/timer\.html'|'icons\/timer\.svg'|art\/app\/timer\.svg/.test(l));
  if (hits.length) out.code.timerMentions[f] = hits.map(([n, l]) => n + ': ' + l.trim().slice(0, 160));
}
const rem = fs.readFileSync(path.join(ROOT, 'worker/src/reminders.js'), 'utf8');
out.code.reminderJobs = (rem.match(/export const JOBS = \{[^}]*\}/) || [''])[0];
const shell = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').split('\n');
const grab = re => { const i = shell.findIndex(l => re.test(l)); return i < 0 ? null : (i + 1) + ': ' + shell[i].trim().slice(0, 200); };
out.code.shellIntent = [grab(/at 0 — with the app closed — beeps, shows a local notification/), grab(/async function timerNotify/), grab(/one that ran out while the hub was closed just gets cleared/)];
const claude = fs.readFileSync(path.join(ROOT, 'CLAUDE.md'), 'utf8').split('\n');
const ci = claude.findIndex(l => l.startsWith('- **Timer** runs in the shell'));
out.code.claudeMd = ci < 0 ? null : (ci + 1) + ': ' + claude[ci].slice(0, 260);

// ── Part 2: rig ──────────────────────────────────────────────
const L = await local({ variant: 'typical', clock: 'real', engine: 'chromium' });
const probes = ctx => ctx.addInitScript(() => {
  const log = window.__v = { audio: 0, notes: [] };
  const Real = window.AudioContext || window.webkitAudioContext;
  if (Real) { class P extends Real { constructor(...a) { super(...a); log.audio++; } } window.AudioContext = P; window.webkitAudioContext = P; }
  try {
    Object.defineProperty(window.Notification, 'permission', { get: () => 'granted', configurable: true });
    const reg = { showNotification: (t, o) => { log.notes.push({ t, body: o && o.body }); return Promise.resolve(); } };
    navigator.serviceWorker.getRegistration = () => Promise.resolve(reg);
  } catch (e) { log.err = String(e); }
});
const setHidden = (page, h) => Promise.all(page.frames().map(fr => fr.evaluate(h => {
  Object.defineProperty(document, 'hidden', { get: () => h, configurable: true });
  Object.defineProperty(document, 'visibilityState', { get: () => (h ? 'hidden' : 'visible'), configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
}, h).catch(() => {})));
const state = page => page.evaluate(() => {
  const t = document.getElementById('hub-toast'), p = document.getElementById('timer-pill');
  return { pill: p.hidden ? null : document.getElementById('timer-pill-time').textContent, toast: t && !t.hidden ? t.textContent : null,
    audioContextsMade: window.__v.audio, notifications: window.__v.notes };
});
const serverTimer = async () => { const r = await L.apiAs('eli', '/api/data/timer?scope=person'); const it = ((r.body && r.body.items) || []).find(x => x.key === 'timer.active'); return it ? it.value : '(no row)'; };
const clear = () => L.apiAs('eli', '/api/data/timer/batch?scope=person', { method: 'POST', body: { items: [{ key: 'timer.active', value: null, updated_at: Date.now() + 1 }] } });

async function run(name, { hide, ff }) {
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: Date.now() });
  try {
    await probes(d.ctx);
    await d.goto('#home'); await d.page.waitForFunction(() => window.hub && hub.profile); await d.ctx.clock.runFor(800);
    await d.page.click('.tab[data-tab="apps"]'); await d.page.click('.tile[data-id="timer"]');
    let f; for (let i = 0; i < 60 && !(f = d.frame('timer')); i++) await sleep(100);
    await f.waitForFunction(() => window.hub && document.getElementById('go'));
    await d.ctx.clock.runFor(700);
    await f.click('[data-s="60"]'); await f.click('#go'); await d.ctx.clock.runFor(1000);
    await d.page.click('#pill-home'); await d.ctx.clock.runFor(600); await d.page.click('.tab[data-tab="home"]'); await d.ctx.clock.runFor(400);
    const r = { startedServer: await serverTimer(), beforeZero: await state(d.page) };
    if (hide) { await setHidden(d.page, true); await d.ctx.clock.fastForward(ff); r.whileHidden = await state(d.page); await setHidden(d.page, false); }
    else await d.ctx.clock.runFor(ff);
    await d.ctx.clock.runFor(1500);
    r.afterReturn = await state(d.page); await sleep(1500); r.serverAfter = await serverTimer();
    if (name === 'R1') await d.page.screenshot({ path: path.join(EVD, 'verify-critic-locked-phone-no-alert-2-2-R1-back-iphone.png'), scale: 'css' });
    out.rig[name] = r;
  } catch (e) { out.rig[name] = { error: String(e).slice(0, 300) }; }
  await d.close(); await clear();
}
try {
  await run('R1', { hide: true, ff: '02:59' });   // start + ~1 s elapsed; back about 2 min after the end
  await run('R2', { hide: true, ff: '01:18' });   // back about 20 s after the end
  await run('R3', { hide: false, ff: 62000 });    // visible throughout
} finally { await L.close(); }
fs.writeFileSync(path.join(EVD, 'verify-critic-locked-phone-no-alert-2-2.json'), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
