// UX-TIMER-6 skeptic s1: Ezra (kid) in the hub viewer on the rig iPad portrait and iPhone PWA. What each control carries
// (icon? digits?), its size, and how Pause and Reset are painted while running (fill, border, shadow) vs idle Start.
// Local rig only, WebKit, real clock. Run: node "audits/tools/phase5/ux-verify/UX-TIMER-6/s1-kid-controls.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../../lib/local.mjs';
const OUT = path.join(ROOT, 'audits', 'evidence', 'p5', 'ux-verify', 'UX-TIMER-6', 's1');
fs.mkdirSync(OUT, { recursive: true });
const out = {};
const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
const look = f => f.evaluate(() => [...document.querySelectorAll('button')].map(b => { const s = getComputedStyle(b), r = b.getBoundingClientRect();
  return { label: b.textContent.trim(), hasDigit: /\d/.test(b.textContent), icon: !!b.querySelector('svg,img'), aria: b.getAttribute('aria-label'), w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x), y: Math.round(r.y),
    bg: s.backgroundColor, bgImg: s.backgroundImage.slice(0, 60), border: s.borderTopWidth + ' ' + s.borderTopColor, shadow: s.boxShadow === 'none' ? 'none' : 'yes', color: s.color, cls: b.className }; }));
try {
  for (const device of ['ipad-portrait', 'iphone-pwa']) {
    const d = await L.device({ device, profile: 'ezra', fixedTime: false });
    const f = await d.openApp('timer', { wait: '#go' });
    await f.waitForFunction(() => window.hub && hub.profile); await sleep(1200);
    const kind = await f.evaluate(() => document.documentElement.dataset.kind);
    const idle = await look(f);
    await f.click('[data-s="180"]'); await sleep(300);
    const dialAfterChip = await f.evaluate(() => document.getElementById('t').textContent);
    await f.click('#go'); await sleep(1500);
    const running = await look(f);
    await d.page.screenshot({ path: path.join(OUT, `kid-running-${device}.png`), animations: 'disabled' });
    out[device] = { kind, idle, dialAfterChip, running };
    await f.click('#reset'); await sleep(500); await d.close();
  }
} finally { await L.close(); }
fs.writeFileSync(path.join(OUT, 'kid-controls.json'), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
