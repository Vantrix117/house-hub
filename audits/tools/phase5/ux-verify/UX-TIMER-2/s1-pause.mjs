// Skeptic s1, UX-TIMER-2: is Pause local to one page, and does a paused timer look like an idle one?
// WebKit, real clock, typical seed. Eli on an iPhone PWA and on the iPad, both with the Timer open; explicit hub.pull() instead of waiting 30 s.
// Run: node "audits/tools/phase5/ux-verify/UX-TIMER-2/s1-pause.mjs"  Output: audits/evidence/p5/ux-verify/UX-TIMER-2/s1/
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../../lib/local.mjs';
const OUT = path.join(ROOT, 'audits/evidence/p5/ux-verify/UX-TIMER-2/s1'); fs.mkdirSync(OUT, { recursive: true });
const out = {};
const look = f => f.evaluate(() => { const cs = e => getComputedStyle(e); const fg = document.querySelector('.ring .fg'), ring = document.querySelector('.ring');
  return { time: t.textContent, go: go.textContent, goClass: go.className, bodyClass: document.body.className, dialClass: document.getElementById('dial').className,
    timeColor: cs(t).color, timeOpacity: cs(t).opacity, timeAnim: cs(t).animationName, fgStroke: cs(fg).stroke, fgOpacity: cs(fg).opacity, ringP: ring.style.getPropertyValue('--p'),
    text: document.body.innerText.replace(/\s+/g, ' ').trim(), on: [...document.querySelectorAll('[data-s].on')].map(b => b.textContent) }; });
const pill = p => p.evaluate(() => ({ pill: document.getElementById('timer-pill').hidden ? null : document.getElementById('timer-pill-time').textContent, chip: document.getElementById('pill-timer').hidden ? null : document.getElementById('pill-timer-time').textContent }));
const server = async pid => { const r = await L.apiAs(pid, '/api/data/timer?scope=person'); const o = {}; for (const it of (r.body && r.body.items) || []) o[it.key] = it.value; return o; };
const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
try {
  const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
  const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  const f = await phone.openApp('timer', { wait: '#go' }); await sleep(1200);
  await f.click('[data-s="600"]'); await sleep(400);
  out.idle10 = await look(f);
  await f.click('#go'); await sleep(1500);
  const g = await ipad.openApp('timer', { wait: '#go' }); await sleep(1200); await g.evaluate(() => hub.pull()); await sleep(1500);
  out.running = { phone: await look(f), ipad: await look(g), server: await server('eli') };
  await sleep(3000);
  await f.click('#go'); await sleep(400);          // Pause
  out.paused = { phone: await look(f) };
  await phone.shot(path.join(OUT, 'paused-iphone.png'));
  await sleep(1500);
  out.paused.server = await server('eli');
  await g.evaluate(() => hub.pull()); await sleep(1500);
  out.paused.ipadAfterPull = await look(g);
  await ipad.shot(path.join(OUT, 'ipad-after-phone-pause.png'));
  // a genuinely idle timer of the same length as the paused remaining time: the paused state vs idle 10:00 differ only in digits and ring --p
  const same = ['goClass', 'bodyClass', 'dialClass', 'timeColor', 'timeOpacity', 'timeAnim', 'fgStroke', 'fgOpacity', 'go'].filter(k => out.paused.phone[k] === out.idle10[k]);
  out.pausedVsIdleIdenticalProps = same;
  // leave the phone's Timer and come back: does the pause survive?
  await phone.page.click('#pill-home'); await sleep(600);
  await phone.page.click('.tab[data-tab="home"]'); await sleep(900);
  out.phoneHomeWhilePaused = await pill(phone.page);
  const f2 = await phone.openApp('timer', { wait: '#go' }); await sleep(1200);
  out.phoneReopened = await look(f2);
} finally { await L.close(); }
fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
