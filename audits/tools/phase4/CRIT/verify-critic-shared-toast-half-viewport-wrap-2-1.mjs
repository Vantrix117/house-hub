// Skeptic 1 for critic-shared-toast-half-viewport-wrap-2: does the shared hub.toast (.ds .toast, apps/design.css:588-591,
// index.html:340-341) really cap at half the viewport and wrap on the iPhone? Also a counterfactual: the same element with
// left/right 16px + margin auto + width max-content (no translate) — does the message then fit on one line?
// Usage: node audits/tools/phase4/CRIT/verify-critic-shared-toast-half-viewport-wrap-2-1.mjs
import fs from 'node:fs';
import path from 'node:path';
import { local, ROOT, sleep } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p4/CRIT/verify-critic-shared-toast-half-viewport-wrap-2-1';
const SHELL_MSGS = [
  'Checked with the house.',                                      // index.html:1284
  'Notifications on for this device.',                            // index.html:1567
  'That app is not available for this profile.',                  // index.html:715
  'Hub updated — it will use the new version next time it opens.',// index.html:1695
];
const APP_MSGS = {
  tally: ['This screen only looks — sign in on a phone to change things.'],       // hub.js:248 via kioskNudge
  f260: ['This screen only looks — sign in on a phone to change things.'],
  kidverse: ['This device cannot read aloud.', 'You already have today’s star — come back tomorrow!'], // kidverse.html:301,328
  verses: ['This device cannot read aloud.', 'Could not save that.'],            // verses.html:270,298
};
const measure = (msg) => new Promise(res => {
  const old = document.getElementById('hub-toast'); if (old) old.hidden = true;
  hub.toast(msg, 60000);
  const rect = el => { const r = el.getBoundingClientRect(); const rg = document.createRange(); rg.selectNodeContents(el);
    return { w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10, left: Math.round(r.left), lines: new Set([...rg.getClientRects()].map(x => Math.round(x.top))).size }; };
  setTimeout(() => {
    const el = document.getElementById('hub-toast'); const cs = getComputedStyle(el);
    const actual = rect(el);
    // natural one-line width of the same box
    const c = el.cloneNode(true); c.id = 'probe'; c.style.cssText = 'white-space:nowrap;left:0;transform:none;animation:none;visibility:hidden'; el.parentNode.appendChild(c);
    const natural = Math.round(c.getBoundingClientRect().width); c.remove();
    // counterfactual centring
    const saved = el.getAttribute('style');
    el.style.cssText = 'left:16px;right:16px;margin-inline:auto;width:max-content;transform:none;animation:none';
    const fixed = rect(el); if (saved == null) el.removeAttribute('style'); else el.setAttribute('style', saved);
    res({ msg, len: msg.length, vw: innerWidth, cssLeft: cs.left, cssMaxWidth: cs.maxWidth, fontSize: cs.fontSize, actual, naturalOneLineW: natural, counterfactual: fixed });
  }, 700);
});
const L = await local({ variant: 'typical', engine: 'webkit' });
const out = [];
try {
  for (const device of ['iphone-pwa', 'iphone-safari', 'ipad-portrait', 'ipad-landscape', 'desktop']) {
    const d = await L.device({ device, profile: 'eli', mode: 'light' });
    await d.goto('#me'); await sleep(1500);
    for (const m of SHELL_MSGS) out.push({ device, doc: 'shell', ...(await d.page.evaluate(measure, m)) });
    if (device === 'iphone-pwa') {
      await d.page.evaluate(measure, SHELL_MSGS[2]); await sleep(900); // the counterfactual restarts the entrance animation
      await d.page.screenshot({ path: path.join(ROOT, OUT + '-shell-iphone.png'), scale: 'css' });
    }
    if (device === 'iphone-pwa' || device === 'ipad-portrait') {
      for (const [app, msgs] of Object.entries(APP_MSGS)) {
        try {
          const f = await d.openApp(app); await sleep(1500);
          for (const m of msgs) out.push({ device, doc: app, ...(await f.evaluate(measure, m)) });
          if (device === 'iphone-pwa' && app === 'verses') {
            await f.evaluate(measure, msgs[0]); await sleep(900);
            await d.page.screenshot({ path: path.join(ROOT, OUT + '-verses-iphone.png'), scale: 'css' });
          }
        } catch (e) { out.push({ device, doc: app, error: String(e.message || e).slice(0, 200) }); }
        await d.goto('#me'); await sleep(800);
      }
    }
    await d.close();
  }
} finally { await L.close(); }
for (const o of out) console.log(JSON.stringify(o));
fs.writeFileSync(path.join(ROOT, OUT + '.json'), JSON.stringify(out, null, 1));
