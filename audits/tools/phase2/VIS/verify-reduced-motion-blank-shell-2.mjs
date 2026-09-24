// Skeptic #2 for finding "reduced-motion-blank-shell": does the shell boot with prefers-reduced-motion: reduce?
// Independent of density-motion.mjs. Runs on the local rig only (production is blocked by the harness).
//   node "audits/tools/phase2/VIS/verify-reduced-motion-blank-shell-2.mjs"
// Cases: WebKit iPad/iPhone/TV x (signed in adult, kid, kiosk, signed out, unpaired) with Reduce Motion on, a
// no-preference control, a Chromium cross-check, an app opened standalone, and a toggle AFTER load (to show the
// failure is decided once at load). Evidence → audits/evidence/p2/VIS/verify-rm2-*.png + verify-rm2.json.
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const EV = path.join(ROOT, 'audits/evidence/p2/VIS');
fs.mkdirSync(EV, { recursive: true });
const out = { cases: [] };

const state = page => page.evaluate(() => {
  const vis = sel => { const el = document.querySelector(sel); if (!el) return null; const r = el.getBoundingClientRect(); return { hidden: el.hidden, w: Math.round(r.width), h: Math.round(r.height) }; };
  return {
    reduceMatches: matchMedia('(prefers-reduced-motion: reduce)').matches,
    sheenFrom: typeof (window.hub && hub.sheenFrom),
    hubLoaded: !!window.hub,
    gate: vis('#gate'), shell: vis('#shell'),
    gatePanelHtmlLen: (document.querySelector('#gate-panel') || {}).innerHTML?.length ?? null,
    homeHtmlLen: (document.querySelector('#view-home') || {}).innerHTML?.length ?? null,
    visibleText: document.body.innerText.trim().slice(0, 120),
  };
});

async function run(L, label, { device, profile, reduce, file, toggleAfter = false }) {
  const d = await L.device({ device, profile, fixedTime: false });
  if (!toggleAfter) await d.page.emulateMedia({ reducedMotion: reduce ? 'reduce' : 'no-preference' });
  if (file) await d.page.goto(L.site + '/' + file, { waitUntil: 'load' });
  else await d.goto('#home');
  await sleep(2500);
  if (toggleAfter) { await d.page.emulateMedia({ reducedMotion: 'reduce' }); await sleep(500); }
  const st = await state(d.page);
  const shot = path.join(EV, `verify-rm2-${label}.png`);
  await d.page.screenshot({ path: shot, scale: 'css', animations: 'disabled', caret: 'hide' });
  const errors = d.logs.filter(l => /pageerror|error:/i.test(l)).slice(0, 4);
  const rec = { label, engine: L.engine, device, profile, reduce, file: file || 'index.html', toggleAfter, ...st, errors, shot: path.relative(ROOT, shot).replace(/\\/g, '/') };
  out.cases.push(rec);
  console.log(`\n== ${label}\n   reduce=${st.reduceMatches} sheenFrom=${st.sheenFrom} gate.hidden=${st.gate && st.gate.hidden} shell.hidden=${st.shell && st.shell.hidden} gatePanelLen=${st.gatePanelHtmlLen} homeLen=${st.homeHtmlLen}\n   text="${st.visibleText.replace(/\s+/g, ' ').slice(0, 80)}"\n   errors=${JSON.stringify(errors)}`);
  await d.close();
}

// ── WebKit ──
let L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
try {
  await run(L, 'webkit-ipad-eli-control', { device: 'ipad-portrait', profile: 'eli', reduce: false });
  await run(L, 'webkit-ipad-eli-reduce', { device: 'ipad-portrait', profile: 'eli', reduce: true });
  await run(L, 'webkit-iphone-eli-reduce', { device: 'iphone-pwa', profile: 'eli', reduce: true });
  await run(L, 'webkit-ipad-ezra-reduce', { device: 'ipad-portrait', profile: 'ezra', reduce: true });
  await run(L, 'webkit-tv-kiosk-reduce', { device: 'tv', profile: 'tv', reduce: true });
  await run(L, 'webkit-ipad-signedout-reduce', { device: 'ipad-portrait', profile: null, reduce: true });
  await run(L, 'webkit-ipad-unpaired-reduce', { device: 'ipad-portrait', profile: 'unpaired', reduce: true });
  await run(L, 'webkit-ipad-eli-reduce-after-load', { device: 'ipad-portrait', profile: 'eli', reduce: true, toggleAfter: true });
  await run(L, 'webkit-standalone-tally-reduce', { device: 'iphone-pwa', profile: 'eli', reduce: true, file: 'apps/tally.html' });
} finally { await L.close(); }

// ── Chromium cross-check ──
L = await local({ variant: 'typical', clock: 'real', engine: 'chromium' });
try {
  await run(L, 'chromium-desktop-eli-control', { device: 'desktop', profile: 'eli', reduce: false });
  await run(L, 'chromium-desktop-eli-reduce', { device: 'desktop', profile: 'eli', reduce: true });
} finally { await L.close(); }

fs.writeFileSync(path.join(EV, 'verify-rm2.json'), JSON.stringify(out, null, 1));
console.log('\nwrote audits/evidence/p2/VIS/verify-rm2.json');
