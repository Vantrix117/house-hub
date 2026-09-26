// Skeptic s1, GAP-TIMER-3: what durations can the Timer UI set, and can a second timer run beside the first?
// WebKit, typical seed, real clock, Eli on an iPhone. Inventories every control in the app frame, then starts 10 min and
// taps 3 min while it runs, and reads what the server holds for Eli's timer scope afterwards.
// Run: node "audits/tools/phase5/ux-verify/GAP-TIMER-3/s1-presets-only.mjs"
// Output: audits/evidence/p5/ux-verify/GAP-TIMER-3/s1/presets-only.json (+ one screenshot)
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../../lib/local.mjs';
const OUT = path.join(ROOT, 'audits', 'evidence', 'p5', 'ux-verify', 'GAP-TIMER-3', 's1');
fs.mkdirSync(OUT, { recursive: true });
const rel = p => path.relative(ROOT, p).split(path.sep).join('/');
const out = {};
const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
const server = async () => { const r = await L.apiAs('eli', '/api/data/timer?scope=person'); const o = {}; for (const it of (r.body && r.body.items) || []) o[it.key] = it.value; return o; };
try {
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
  await d.goto('#home'); await d.page.waitForFunction(() => window.hub && hub.profile);
  await d.page.click('.tab[data-tab="apps"]'); await d.page.click('.tile[data-id="timer"]');
  let f; for (let i = 0; i < 60 && !(f = d.frame('timer')); i++) await sleep(100);
  await f.waitForFunction(() => window.hub && document.getElementById('go')); await sleep(1500);
  out.controls = await f.evaluate(() => ({
    buttons: [...document.querySelectorAll('button')].map(b => ({ text: b.textContent.trim(), s: b.dataset.s ? +b.dataset.s : null, h: Math.round(b.getBoundingClientRect().height) })),
    inputs: document.querySelectorAll('input, select, textarea, [contenteditable]').length,
    dialListeners: typeof document.getElementById('dial').onclick === 'function' || typeof document.getElementById('t').onclick === 'function',
    timeEditable: document.getElementById('t').isContentEditable }));
  await f.click('[data-s="600"]'); await f.click('#go'); await sleep(2500);
  out.running10 = { time: await f.textContent('#t'), go: await f.textContent('#go'), server: await server() };
  await f.click('[data-s="180"]'); await sleep(2500);
  out.afterTapping3min = { time: await f.textContent('#t'), go: await f.textContent('#go'), server: await server(),
    pill: await d.page.evaluate(() => ({ pill: document.getElementById('timer-pill').hidden ? null : document.getElementById('timer-pill-time').textContent, chip: document.getElementById('pill-timer').hidden ? null : document.getElementById('pill-timer-time').textContent })) };
  const shot = path.join(OUT, 'after-tapping-3min-iphone.png'); await d.page.screenshot({ path: shot, scale: 'css', animations: 'disabled' }); out.shot = rel(shot);
  const presets = out.controls.buttons.filter(b => b.s).map(b => b.s / 60);
  out.reachableMinutes = presets;
  out.missingCommon = [2, 4, 6, 7, 8, 12, 20, 25, 40, 45, 60].filter(m => !presets.includes(m));
  await d.close();
} catch (e) { out.error = String(e).slice(0, 400); } finally { await L.close(); }
const file = path.join(OUT, 'presets-only.json'); fs.writeFileSync(file, JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1)); console.log('saved', rel(file));
