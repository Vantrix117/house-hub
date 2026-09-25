// Skeptic 2 for critic-shared-toast-half-viewport-wrap-2: does the shared hub.toast (.ds .toast, apps/design.css:588-591;
// index.html:340-341) shrink-wrap into half the viewport? Uses only messages each document really sends through hub.toast
// (shell index.html, kidverse.html, verses.html). Tally/F260/Timer/Leftovers/Prayer send none (only the kiosk nudge, apps/hub.js:248).
// For each toast: its box, the line count, and a counterfactual = the one-line max-content width of the same box, to show
// whether the message would fit on one line within 100vw - 32px.
// Usage: node audits/tools/phase4/CRIT/verify-critic-shared-toast-half-viewport-wrap-2-2.mjs
import fs from 'node:fs';
import path from 'node:path';
import { local, ROOT, sleep } from '../../lib/local.mjs';
const OUT = path.join(ROOT, 'audits/evidence/p4/CRIT');
const SHELL = [
  'Checked with the house.',                                       // index.html:1284
  'That app is not available for this profile.',                   // index.html:715
  'Notifications on for this device.',                             // index.html:1567
  'Cashed in 3 stars for Ezra.',                                   // index.html:1370
  'Hub updated — it will use the new version next time it opens.', // index.html:1695
];
const KID = ['Great listening!', 'You already have today’s star — come back tomorrow!', 'New badge: First star!']; // kidverse.html:641,328,480
const VERSES = ['This device cannot read aloud.', 'Could not save that.']; // verses.html:270,298
const measure = (msg) => new Promise(res => {
  const old = document.getElementById('hub-toast'); if (old) old.hidden = true;
  hub.toast(msg, 60000);
  setTimeout(() => {
    const el = document.getElementById('hub-toast');
    const r = el.getBoundingClientRect();
    const range = document.createRange(); range.selectNodeContents(el);
    const lines = new Set([...range.getClientRects()].map(x => Math.round(x.top))).size;
    const cs = getComputedStyle(el);
    // counterfactual: same box, but one line (max-content)
    const c = el.cloneNode(true); c.id = ''; c.style.cssText = 'position:fixed;left:0;top:0;transform:none;animation:none;width:max-content;max-width:none;visibility:hidden';
    el.parentNode.appendChild(c); const oneLine = Math.round(c.getBoundingClientRect().width); c.remove();
    res({ msg, w: Math.round(r.width), h: Math.round(r.height), lines, oneLineW: oneLine, fitsOneLineInVwMinus32: oneLine <= innerWidth - 32,
      vw: innerWidth, cssLeft: cs.left, cssMaxWidth: cs.maxWidth, fontSize: cs.fontSize, fontFamily: cs.fontFamily.slice(0, 60) });
  }, 700);
});
const L = await local({ variant: 'typical', engine: 'webkit' });
const out = [];
try {
  for (const device of ['iphone-pwa', 'iphone-safari', 'ipad-portrait', 'desktop']) {
    const d = await L.device({ device, profile: 'eli', mode: 'light' });
    await d.goto('#me'); await sleep(1500);
    for (const m of SHELL) out.push({ device, doc: 'shell', ...(await d.page.evaluate(measure, m)) });
    if (device === 'iphone-pwa') { await d.page.evaluate(measure, SHELL[1]); await d.page.screenshot({ path: path.join(OUT, 'verify-critic-shared-toast-half-viewport-wrap-2-2-shell-iphone.png'), scale: 'css' }); }
    const f = await d.openApp('verses'); await sleep(1500);
    for (const m of VERSES) out.push({ device, doc: 'verses', ...(await f.evaluate(measure, m)) });
    await d.close?.();
  }
  for (const device of ['iphone-pwa', 'ipad-portrait']) {
    const d = await L.device({ device, profile: 'ezra', mode: 'light' });
    await d.goto(''); await sleep(1200);
    const f = await d.openApp('kidverse'); await sleep(1800);
    for (const m of KID) out.push({ device, doc: 'kidverse', ...(await f.evaluate(measure, m)) });
    if (device === 'iphone-pwa') { await f.evaluate(measure, KID[1]); await d.page.screenshot({ path: path.join(OUT, 'verify-critic-shared-toast-half-viewport-wrap-2-2-kidverse-iphone.png'), scale: 'css' }); }
  }
} finally { await L.close(); }
fs.writeFileSync(path.join(OUT, 'verify-critic-shared-toast-half-viewport-wrap-2-2.json'), JSON.stringify(out, null, 1));
for (const o of out) console.log(JSON.stringify({ device: o.device, doc: o.doc, msg: o.msg, w: o.w, h: o.h, lines: o.lines, oneLineW: o.oneLineW, fits: o.fitsOneLineInVwMinus32, left: o.cssLeft, fs: o.fontSize }));
