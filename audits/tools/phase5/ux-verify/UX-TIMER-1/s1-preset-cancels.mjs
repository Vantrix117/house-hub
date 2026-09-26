// Skeptic s1, UX-TIMER-1: does one preset tap (or Reset) cancel a running timer on every device, with no confirm/undo?
// WebKit, real clock, typical seed. Eli on an iPhone PWA (Timer open) and on the Kitchen iPad (Home pill); Ezra on an iPhone.
// Run: node "audits/tools/phase5/ux-verify/UX-TIMER-1/s1-preset-cancels.mjs"  Output: audits/evidence/p5/ux-verify/UX-TIMER-1/s1/
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../../lib/local.mjs';
const OUT = path.join(ROOT, 'audits/evidence/p5/ux-verify/UX-TIMER-1/s1'); fs.mkdirSync(OUT, { recursive: true });
const out = {};
const st = f => f.evaluate(() => ({ time: t.textContent, go: go.textContent, primary: go.classList.contains('btn-primary'), on: [...document.querySelectorAll('[data-s].on')].map(b => b.textContent),
  chipsDisabled: [...document.querySelectorAll('[data-s]')].filter(b => b.disabled || b.getAttribute('aria-disabled') === 'true').length, confirmCalls: window.__confirms || 0 }));
const pill = p => p.evaluate(() => ({ pill: document.getElementById('timer-pill').hidden ? null : document.getElementById('timer-pill-time').textContent,
  toast: (() => { const x = document.getElementById('hub-toast'); return x && !x.hidden ? x.textContent : null; })() }));
const server = async pid => { const r = await L.apiAs(pid, '/api/data/timer?scope=person'); const o = {}; for (const it of (r.body && r.body.items) || []) o[it.key] = it.value; return o; };
const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
try {
  const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
  await phone.ctx.addInitScript(() => { window.__confirms = 0; const c = window.confirm; window.confirm = (...a) => { window.__confirms++; return c ? true : true; }; });
  const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  const f = await phone.openApp('timer', { wait: '#go' }); await sleep(1200);
  await f.click('[data-s="600"]'); await f.click('#go'); await sleep(2500);
  await ipad.goto('#home'); await sleep(1500); await ipad.page.evaluate(() => hub.pull()); await sleep(1200);
  out.running = { phone: await st(f), server: await server('eli'), ipadPill: await pill(ipad.page) };
  await phone.shot(path.join(OUT, 'running-iphone.png'));
  await f.click('[data-s="180"]'); await sleep(300);
  out.afterPresetTap = { phone: await st(f), phoneShell: await pill(phone.page), phoneText: await f.evaluate(() => document.body.innerText.replace(/\s+/g, ' ')) };
  await sleep(1500);
  out.afterPresetTap.server = await server('eli');
  await ipad.page.evaluate(() => hub.pull()); await sleep(1500);
  out.afterPresetTap.ipadPill = await pill(ipad.page);
  await phone.shot(path.join(OUT, 'after-preset-tap-iphone.png'));
  await ipad.shot(path.join(OUT, 'after-preset-tap-ipad-home.png'));
  // Reset while running
  await f.click('#go'); await sleep(2500);
  const beforeReset = await st(f);
  await f.click('#reset'); await sleep(1800);
  out.reset = { before: beforeReset, after: await st(f), server: await server('eli') };
  // Kid: chips live while running, geometry
  const kid = await L.device({ device: 'iphone-pwa', profile: 'ezra', fixedTime: false });
  const kf = await kid.openApp('timer', { wait: '#go' }); await sleep(1200);
  await kf.click('[data-s="300"]'); await kf.click('#go'); await sleep(1500);
  out.kid = { state: await st(kf), geom: await kf.evaluate(() => { const b = s => { const r = document.querySelector(s).getBoundingClientRect(); return { y: Math.round(r.y), bottom: Math.round(r.bottom), h: Math.round(r.height), w: Math.round(r.width) }; };
    return { viewport: [innerWidth, innerHeight], chip30: b('[data-s="1800"]'), chip1: b('[data-s="60"]'), go: b('#go'), kind: document.documentElement.dataset.kind || null }; }) };
  out.kid.gapChipsToPause = out.kid.geom.go.y - out.kid.geom.chip30.bottom;
  await kid.shot(path.join(OUT, 'kid-running-iphone.png'));
  await kf.click('[data-s="60"]'); await sleep(1500);
  out.kid.afterChipTap = { state: await st(kf), server: await server('ezra') };
} finally { await L.close(); }
fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
