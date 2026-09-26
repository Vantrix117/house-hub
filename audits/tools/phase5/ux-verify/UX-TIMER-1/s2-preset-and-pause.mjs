// Skeptic s2, UX-TIMER-1 and UX-TIMER-2 (one run, WebKit, real clock, typical seed, local rig only).
//  P1: phone (Eli, iPhone PWA) runs 10 min; a second device (Eli, iPad) shows the shell pill; one tap on "3 min" on the phone.
//      Record the phone app, the server row, the iPad pill after a pull, chip/Pause geometry, any disabled/confirm.
//  P2: phone runs 10 min, pauses after ~4 s; record the app (label, ring --p, any "Paused" text), the server row,
//      the iPad Timer app after a pull, then leave to Home and reopen the Timer on the phone.
//  P3: kid (Ezra, iPhone PWA): are the chips live while running?
// Run: node "audits/tools/phase5/ux-verify/UX-TIMER-1/s2-preset-and-pause.mjs"
// Output: audits/evidence/p5/ux-verify/UX-TIMER-{1,2}/s2/preset-and-pause.json (+ PNGs: p1-* in UX-TIMER-1, p2-* in UX-TIMER-2)
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../../lib/local.mjs';
const OUT = path.join(ROOT, 'audits', 'evidence', 'p5', 'ux-verify', 'UX-TIMER-1', 's2');
fs.mkdirSync(OUT, { recursive: true });
const OUT2 = path.join(ROOT, "audits", "evidence", "p5", "ux-verify", "UX-TIMER-2", "s2"); fs.mkdirSync(OUT2, { recursive: true });
const shot = async (page, name) => { const f = path.join(name.startsWith("p2-") ? OUT2 : OUT, name); await page.screenshot({ path: f, scale: 'css', animations: 'disabled', caret: 'hide' }); return path.relative(ROOT, f).split(path.sep).join('/'); };
const app = f => f.evaluate(() => ({
  time: document.getElementById('t').textContent, go: document.getElementById('go').textContent.trim(),
  primary: document.getElementById('go').classList.contains('btn-primary'), done: document.body.classList.contains('done'),
  on: [...document.querySelectorAll('[data-s].on')].map(b => b.textContent), ringP: document.querySelector('#dial .ring').style.getPropertyValue('--p'),
  disabledChips: [...document.querySelectorAll('[data-s]')].filter(b => b.disabled || b.getAttribute('aria-disabled') === 'true').length,
  pausedWord: /paused|resume/i.test(document.body.innerText), bodyText: document.body.innerText.replace(/\s+/g, ' ').trim().slice(0, 100) }));
const pill = page => page.evaluate(() => ({ pill: document.getElementById('timer-pill').hidden ? null : document.getElementById('timer-pill-time').textContent,
  chip: document.getElementById('pill-timer').hidden ? null : document.getElementById('pill-timer-time').textContent }));
const server = async L => { const r = await L.apiAs('eli', '/api/data/timer?scope=person'); const o = {}; for (const it of (r.body && r.body.items) || []) o[it.key] = it.value; return o; };
const out = { dialogs: [] };
const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
try {
  const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
  const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  phone.page.on('dialog', d => { out.dialogs.push(d.message()); d.dismiss(); });
  await ipad.goto('#home'); await sleep(1200);
  let f = await phone.openApp('timer', { wait: '#go' }); await sleep(1000);
  // P1
  await f.click('[data-s="600"]'); await f.click('#go'); await sleep(2500);
  await ipad.page.evaluate(() => hub.pull()); await sleep(1200);
  const geo = await f.evaluate(() => { const r = s => { const b = document.querySelector(s).getBoundingClientRect(); return { y: Math.round(b.y), h: Math.round(b.height), w: Math.round(b.width) }; };
    return { viewport: [innerWidth, innerHeight], chip10: r('[data-s="600"]'), chip3: r('[data-s="180"]'), go: r('#go'), reset: r('#reset') }; });
  out.P1 = { before: await app(f), serverBefore: await server(L), ipadPillBefore: await pill(ipad.page), geo };
  out.P1.shotBefore = await shot(phone.page, 'p1-running-before-preset-iphone.png');
  await f.click('[data-s="180"]'); await sleep(1500);
  out.P1.after = await app(f); out.P1.serverAfter = await server(L);
  await ipad.page.evaluate(() => hub.pull()); await sleep(1500);
  out.P1.ipadPillAfter = await pill(ipad.page);
  out.P1.shotAfter = await shot(phone.page, 'p1-after-preset-iphone.png');
  // P2
  await f.click('[data-s="600"]'); await f.click('#go'); await sleep(1500);
  const ipadF = await ipad.openApp('timer', { wait: '#go' }); await sleep(1500);
  await ipadF.evaluate(() => hub.pull()); await sleep(1200);
  out.P2 = { ipadRunning: await app(ipadF) };
  await sleep(2500);
  await f.click('#go'); const tPause = Date.now(); await sleep(800);
  out.P2.phonePaused = await app(f); out.P2.shotPaused = await shot(phone.page, 'p2-paused-iphone.png');
  await sleep(1200); out.P2.serverAfterPause = await server(L);
  await ipadF.evaluate(() => hub.pull()); await sleep(1500);
  out.P2.ipadAfterPause = await app(ipadF); out.P2.ipadAfterMs = Date.now() - tPause;
  out.P2.shotIpad = await shot(ipad.page, 'p2-ipad-after-phone-pause.png');
  // an idle 10-min timer for comparison of the button/ring styling
  // leave to Home, reopen
  await phone.page.click('#pill-home'); await sleep(600); await phone.page.click('.tab[data-tab="home"]'); await sleep(1000);
  out.P2.homePill = await pill(phone.page);
  await phone.page.click('.tab[data-tab="apps"]'); await phone.page.click('.tile[data-id="timer"]');
  f = null; for (let i = 0; i < 50 && !(f = phone.frame('timer')); i++) await sleep(100);
  await f.waitForFunction(() => window.hub && document.getElementById('go')); await sleep(1000);
  out.P2.phoneReopened = await app(f);
  // P3 kid
  const kid = await L.device({ device: 'iphone-pwa', profile: 'ezra', fixedTime: false });
  const kf = await kid.openApp('timer', { wait: '#go' }); await sleep(1000);
  await kf.click('#go'); await sleep(1500);
  out.P3 = { kidRunning: await app(kf), kind: await kf.evaluate(() => document.documentElement.dataset.kind || null),
    kidGeo: await kf.evaluate(() => { const r = s => { const b = document.querySelector(s).getBoundingClientRect(); return { y: Math.round(b.y), h: Math.round(b.height) }; }; return { lastChip: r('[data-s="1800"]'), go: r('#go') }; }) };
  await kf.click('[data-s="60"]'); await sleep(1000);
  out.P3.kidAfterChip = await app(kf);
  await kid.close();
} finally { await L.close(); }
fs.writeFileSync(path.join(OUT, 'preset-and-pause.json'), JSON.stringify(out, null, 1));
fs.writeFileSync(path.join(OUT2, 'preset-and-pause.json'), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
