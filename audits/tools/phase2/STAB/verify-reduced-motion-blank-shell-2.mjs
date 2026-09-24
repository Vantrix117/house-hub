// STAB skeptic #2: does prefers-reduced-motion: reduce leave the whole shell blank, and is index.html:662 the sole cause?
//   node "audits/tools/phase2/STAB/verify-reduced-motion-blank-shell-2.mjs"
// Independent of reduced-motion.mjs: real clock (no frozen browser time), reducedMotion emulated before the first load,
// four boot paths (signed-in iPad, TV kiosk, signed-out iPhone → picker, unpaired iPhone → pairing), and a CAUSAL CONTROL:
// the same 'reduce' page with index.html served through a route that only guards the one call
// (`hub.sheenFrom(views);` → `hub.sheenFrom && hub.sheenFrom(views);`). Nothing in the repo is changed.
// Also one Chromium run (installed Chrome) of the signed-in iPad case. Evidence → audits/evidence/p2/STAB/verify2-*.
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/STAB');
fs.mkdirSync(OUT, { recursive: true });
const CALL = 'hub.sheenFrom(views);';

async function probe(L, { device, profile, rm, patch, tag }) {
  const d = await L.device({ device, profile, fixedTime: false });
  const errors = [];
  d.page.on('pageerror', e => errors.push(e.message));
  let patched = null;
  if (patch) {
    await d.ctx.route(u => u.pathname.endsWith('/index.html'), async route => {
      const res = await route.fetch(); let body = await res.text();
      patched = body.split(CALL).length - 1;   // must be exactly 1
      body = body.replace(CALL, 'hub.sheenFrom && hub.sheenFrom(views);');
      await route.fulfill({ response: res, body });
    });
  }
  await d.page.emulateMedia({ reducedMotion: rm });
  await d.goto('#home');
  await sleep(5000);
  const s = await d.page.evaluate(() => {
    const g = document.getElementById('gate'), sh = document.getElementById('shell');
    return {
      reducedMatches: matchMedia('(prefers-reduced-motion: reduce)').matches,
      gateHiddenAttr: g.hidden, shellHiddenAttr: sh.hidden,
      gateDisplay: getComputedStyle(g).display, shellDisplay: getComputedStyle(sh).display,
      sheenFromType: typeof (window.hub && hub.sheenFrom),
      signedIn: !!(window.hub && hub.profile), profile: window.hub && hub.profile && hub.profile.id,
      visibleTextLen: document.body.innerText.trim().length,
      visibleText: document.body.innerText.trim().replace(/\s+/g, ' ').slice(0, 70),
    };
  });
  const file = path.join(OUT, `verify2-${tag}.png`);
  await d.page.screenshot({ path: file, scale: 'css', animations: 'disabled', caret: 'hide' });
  await d.close();
  const r = { engine: L.engine, device, profile, reducedMotion: rm, patchedIndexCall: patch ? patched : undefined, ...s, pageErrors: errors.slice(0, 3), screenshot: path.relative(ROOT, file).replace(/\\/g, '/') };
  console.log(JSON.stringify(r));
  return r;
}

const results = [];
let L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
try {
  for (const [device, profile, name] of [['ipad-portrait', 'eli', 'ipad-eli'], ['tv', 'tv', 'tv-kiosk'], ['iphone-pwa', null, 'iphone-signedout'], ['iphone-pwa', 'unpaired', 'iphone-unpaired']]) {
    results.push(await probe(L, { device, profile, rm: 'reduce', patch: false, tag: `webkit-${name}-reduce` }));
    results.push(await probe(L, { device, profile, rm: 'no-preference', patch: false, tag: `webkit-${name}-nopref` }));
    results.push(await probe(L, { device, profile, rm: 'reduce', patch: true, tag: `webkit-${name}-reduce-guarded` }));
  }
} finally { await L.close(); }
L = await local({ variant: 'typical', clock: 'real', engine: 'chromium' });
try {
  results.push(await probe(L, { device: 'ipad-portrait', profile: 'eli', rm: 'reduce', patch: false, tag: 'chromium-ipad-eli-reduce' }));
  results.push(await probe(L, { device: 'ipad-portrait', profile: 'eli', rm: 'no-preference', patch: false, tag: 'chromium-ipad-eli-nopref' }));
} finally { await L.close(); }
fs.writeFileSync(path.join(OUT, 'verify2-reduced-motion.json'), JSON.stringify(results, null, 1));
console.log('summary:', results.map(r => `${r.engine}/${r.device}/${r.profile}/${r.reducedMotion}${r.patchedIndexCall ? '+guard' : ''}: gate=${r.gateDisplay} shell=${r.shellDisplay} text=${r.visibleTextLen} err=${r.pageErrors.length}`).join('\n  '));
