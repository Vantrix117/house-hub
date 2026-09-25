// Completeness critic probe: does the shared .ds .toast (apps/design.css:588, index.html:340-341) wrap at half the viewport,
// and where does it sit? Usage: node audits/tools/phase4/CRITIC/toast-wrap.mjs  → one JSON line per (device, document, message)
import fs from 'node:fs';
import path from 'node:path';
import { local, ROOT, sleep } from '../../lib/local.mjs';
const MSGS = [
  'Checked with the house.',                                   // index.html:1284
  'Notifications on for this device.',                         // index.html:1567
  'Grandma Jo can now tap their name on any device.',          // index.html:1420
  'This screen only looks — sign in on a phone to change things.', // apps/hub.js:248 (kiosk nudge)
];
const measure = (msg) => new Promise(res => {
  const old = document.getElementById('hub-toast'); if (old) old.hidden = true;
  hub.toast(msg, 60000);
  setTimeout(() => {                       // after the 360 ms hub-toast entrance
    const el = document.getElementById('hub-toast');
    const r = el.getBoundingClientRect();
    const range = document.createRange(); range.selectNodeContents(el);
    const tops = new Set([...range.getClientRects()].map(x => Math.round(x.top)));
    const cs = getComputedStyle(el);
    res({ msg, w: Math.round(r.width), h: Math.round(r.height), lines: tops.size, left: Math.round(r.left), right: Math.round(innerWidth - r.right),
      centreOffset: Math.round((r.left + r.width / 2) - innerWidth / 2), vw: innerWidth, cssLeft: cs.left });
  }, 700);
});
const L = await local({ variant: 'typical', engine: 'webkit' });
const out = [];
try {
  for (const [device, profile] of [['iphone-pwa', 'eli'], ['ipad-portrait', 'eli'], ['ipad-landscape', 'eli'], ['desktop', 'eli']]) {
    const d = await L.device({ device, profile, mode: 'light' });
    await d.goto('#me'); await sleep(1500);
    for (const m of MSGS) { const r = await d.page.evaluate(measure, m); out.push({ device, doc: 'shell', ...r }); }
    if (device === 'iphone-pwa') {
      await d.page.evaluate(measure, MSGS[2]);
      await d.page.screenshot({ path: path.join(ROOT, `audits/evidence/p4/CRITIC/toast-shell-${device}.png`), scale: 'css' });
    }
    if (device === 'iphone-pwa' || device === 'ipad-portrait') {
      for (const app of ['tally', 'f260']) {
        const f = await d.openApp(app); await sleep(1500);
        for (const m of MSGS.slice(1, 3)) { const r = await f.evaluate(measure, m); out.push({ device, doc: app, ...r }); }
      }
    }
    await d.close();
  }
} finally { await L.close(); }
for (const o of out) console.log(JSON.stringify(o));
fs.writeFileSync(path.join(ROOT, 'audits/evidence/p4/CRITIC/toast-wrap.json'), JSON.stringify(out, null, 1));
