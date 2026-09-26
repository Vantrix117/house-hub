// UX-TIMER-4 skeptic s1: what actually changes between running and done (Elizabeth, iPad portrait, in the hub viewer).
// Records the text, live regions, ring fg/bg paint, digit colour, blink opacity at both phases, and screenshots
// (running, done at full blink, done at dim blink) for pixel sampling. Local rig only, WebKit, real clock.
// Run: node "audits/tools/phase5/ux-verify/UX-TIMER-4/s1-done-cues.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../../lib/local.mjs';
const OUT = path.join(ROOT, 'audits', 'evidence', 'p5', 'ux-verify', 'UX-TIMER-4', 's1');
fs.mkdirSync(OUT, { recursive: true });
const out = {};
const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
const probe = f => f.evaluate(() => {
  const q = s => document.querySelector(s), cs = s => getComputedStyle(q(s));
  return {
    bodyText: document.body.innerText.replace(/\s+/g, ' ').trim(),
    bodyClass: document.body.className, dialClass: q('#dial').className,
    live: document.querySelectorAll('[aria-live],[role=alert],[role=status]').length,
    fg: { stroke: cs('.ring .fg').stroke, opacity: cs('.ring .fg').opacity },
    bg: { stroke: cs('.ring .bg').stroke },
    time: { text: q('#t').textContent, color: cs('#t').color, opacity: cs('#t').opacity },
    bodyBg: cs('body').backgroundColor, dialShadow: cs('#dial').boxShadow.slice(0, 200),
    dial: (r => ({ w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x), y: Math.round(r.y) }))(q('#dial').getBoundingClientRect()),
    go: q('#go').textContent,
  };
});
try {
  const d = await L.device({ device: 'ipad-portrait', profile: 'mom', fixedTime: false });
  const f = await d.openApp('timer', { wait: '#go' });
  await f.waitForFunction(() => window.hub && hub.profile); await sleep(1200);
  const now = Date.now();
  await L.apiAs('mom', '/api/data/timer/batch?scope=person', { method: 'POST', body: { items: [{ key: 'timer.active', value: { endAt: now + 6000, total: 300, startedAt: now - 294000 }, updated_at: now }] } });
  await f.evaluate(() => hub.pull()); await sleep(1500);
  out.running = await probe(f);
  await d.page.screenshot({ path: path.join(OUT, 'running-mom-ipad.png'), animations: 'allow' });
  await sleep(6500);
  // freeze the blink at each phase
  const phase = async ms => f.evaluate(ms => { for (const a of document.getAnimations()) { a.pause(); a.currentTime = ms; } }, ms);
  await phase(100); out.doneFull = await probe(f);
  await d.page.screenshot({ path: path.join(OUT, 'done-full-mom-ipad.png'), animations: 'allow' });
  await phase(750); out.doneDim = await probe(f);
  await d.page.screenshot({ path: path.join(OUT, 'done-dim-mom-ipad.png'), animations: 'allow' });
  out.animations = await f.evaluate(() => document.getAnimations().map(a => ({ name: a.animationName, dur: a.effect.getTiming().duration, easing: a.effect.getTiming().easing })));
  out.logs = d.logs.slice(0, 10);
  await d.close();
} finally { await L.close(); }
fs.writeFileSync(path.join(OUT, 'done-cues.json'), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
