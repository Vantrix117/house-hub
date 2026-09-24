// Skeptic #1 for finding "reduced-motion-blank-shell": does the shell really stay blank under prefers-reduced-motion: reduce?
// Independent of density-motion.mjs. Runs a fresh local instance per engine and checks:
//   A. WebKit, reduce, every entry path of the boot switch (index.html:1701-1703): adult iPad, kid iPhone PWA, kiosk TV,
//      signed-out picker, unpaired pairing screen.
//   B. WebKit, no-preference control (adult iPad).
//   C. WebKit, reduce + causal control: apps/hub.js served with ONLY the early return patched to leave a no-op
//      hub.sheenFrom behind (network route, no file edited). If the shell then boots, line 662 is the sole cause.
//   D. Chromium (installed Chrome), reduce vs no-preference (adult iPad) — engine independence.
// Run: node "audits/tools/phase2/VIS/verify-reduced-motion-blank-shell-1.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const EV = path.join(ROOT, 'audits', 'evidence', 'p2', 'VIS');
fs.mkdirSync(EV, { recursive: true });
const out = { webkit: {}, chromium: {} };

const EARLY = "if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;";
const PATCHED = "if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) { hub.sheenFrom = () => {}; return; }";

async function probe(L, { device, profile, rm, patch = false, shot = null }) {
  const d = await L.device({ device, mode: 'light', profile });
  await d.ctx.addInitScript(() => {
    window.__rej = [];
    addEventListener('unhandledrejection', e => { try { window.__rej.push(String(e.reason && e.reason.message || e.reason)); } catch {} });
    addEventListener('error', e => { try { window.__rej.push('error: ' + e.message); } catch {} });
  });
  let patchedOk = null;
  if (patch) {
    await d.ctx.route(u => u.pathname.endsWith('/apps/hub.js'), async r => {
      const res = await r.fetch(); const body = await res.text();
      patchedOk = body.includes(EARLY);
      await r.fulfill({ response: res, body: body.replace(EARLY, PATCHED) });
    });
  }
  await d.page.emulateMedia({ reducedMotion: rm });
  await d.goto('#home');
  await sleep(4000);
  const st = await d.page.evaluate(() => {
    const vis = el => !!el && !el.hidden && getComputedStyle(el).display !== 'none';
    return {
      matchesReduce: matchMedia('(prefers-reduced-motion: reduce)').matches,
      sheenFrom: typeof (window.hub && hub.sheenFrom),
      gateHidden: document.querySelector('#gate').hidden,
      shellHidden: document.querySelector('#shell').hidden,
      gateOrShellVisible: vis(document.querySelector('#gate')) || vis(document.querySelector('#shell')),
      visibleText: (document.body.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 120),
      caught: window.__rej || [],
      htmlKind: document.documentElement.dataset.kind || null,
    };
  });
  const r = { device, profile, rm, patch, patchApplied: patchedOk, ...st, pageerrors: d.logs.filter(l => /pageerror|error/i.test(l)).slice(0, 3) };
  if (shot) { await d.page.screenshot({ path: path.join(EV, shot), animations: 'disabled', caret: 'hide', scale: 'css' }); r.shot = 'audits/evidence/p2/VIS/' + shot; }
  await d.close();
  console.log(JSON.stringify(r));
  return r;
}

// WebKit
{
  const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
  try {
    console.log('\n== A. WebKit, prefers-reduced-motion: reduce, each boot path');
    out.webkit.reduce = [
      await probe(L, { device: 'ipad-portrait', profile: 'eli', rm: 'reduce', shot: 'verify-rm1-webkit-ipad-eli-reduce.png' }),
      await probe(L, { device: 'iphone-pwa', profile: 'ezra', rm: 'reduce', shot: 'verify-rm1-webkit-iphone-ezra-reduce.png' }),
      await probe(L, { device: 'tv', profile: 'tv', rm: 'reduce', shot: 'verify-rm1-webkit-tv-reduce.png' }),
      await probe(L, { device: 'ipad-portrait', profile: null, rm: 'reduce' }),
      await probe(L, { device: 'ipad-portrait', profile: 'unpaired', rm: 'reduce' }),
    ];
    console.log('\n== B. WebKit, no-preference control');
    out.webkit.control = await probe(L, { device: 'ipad-portrait', profile: 'eli', rm: 'no-preference', shot: 'verify-rm1-webkit-ipad-eli-nopref.png' });
    console.log('\n== C. WebKit, reduce + hub.js early return patched to leave a no-op sheenFrom (route only)');
    out.webkit.causal = await probe(L, { device: 'ipad-portrait', profile: 'eli', rm: 'reduce', patch: true, shot: 'verify-rm1-webkit-ipad-eli-reduce-patched.png' });
  } finally { await L.close(); }
}
// Chromium
{
  const L = await local({ variant: 'typical', clock: 'demo', engine: 'chromium' });
  try {
    console.log('\n== D. Chromium, reduce vs no-preference');
    out.chromium.reduce = await probe(L, { device: 'ipad-portrait', profile: 'eli', rm: 'reduce' });
    out.chromium.control = await probe(L, { device: 'ipad-portrait', profile: 'eli', rm: 'no-preference' });
  } finally { await L.close(); }
}

const f = path.join(EV, 'verify-reduced-motion-blank-shell-1.json');
fs.writeFileSync(f, JSON.stringify(out, null, 1));
console.log('\nwrote', path.relative(ROOT, f));
