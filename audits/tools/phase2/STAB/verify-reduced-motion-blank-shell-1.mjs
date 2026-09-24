// Skeptic #1 for STAB "reduced-motion-blank-shell": does prefers-reduced-motion: reduce really leave the shell blank?
//   node "audits/tools/phase2/STAB/verify-reduced-motion-blank-shell-1.mjs"
// Independent of the investigator's reduced-motion.mjs:
//   1. WebKit, reducedMotion set on the CONTEXT at creation (not page.emulateMedia) for an unpaired device (fresh storage),
//      so nothing from the rig's device()/emulateMedia path is involved; plus 'no-preference' control.
//   2. WebKit via L.device (signed-in Eli on ipad-portrait, the TV kiosk on 'tv') with emulateMedia before first load,
//      waiting 6 s (not 2.5 s) in case boot is just slow.
//   3. Counterfactual: an overlay index.html identical to the working tree except index.html's `hub.sheenFrom(views);`
//      guarded with `hub.sheenFrom && ` — if the shell then boots under 'reduce', that one call is the whole cause.
//   4. Same unpaired check in Chromium (installed Chrome) to show it is not a WebKit-on-Windows artefact.
// Evidence → audits/evidence/p2/STAB/verify-rm1-*.png + verify-rm1.json
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';
import { contextOptions } from '../../lib/devices.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/STAB');
const OVL = path.join(ROOT, 'audits/tools/phase2/STAB/overlay-rm-guard');
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(OVL, { recursive: true });
// Build the counterfactual overlay from the current working tree (one-line change, asserted to apply exactly once).
const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const needle = '  hub.sheenFrom(views);\n';
const nl = src.includes('\r\n') ? needle.replace('\n', '\r\n') : needle;
if (src.split(nl).length !== 2) throw new Error('expected exactly one `hub.sheenFrom(views);` line in index.html');
fs.writeFileSync(path.join(OVL, 'index.html'), src.replace(nl, nl.replace('hub.sheenFrom(views)', 'hub.sheenFrom && hub.sheenFrom(views)')));
const lineNo = src.slice(0, src.indexOf(nl)).split('\n').length;
console.log('index.html line of hub.sheenFrom(views):', lineNo);

const probe = page => page.evaluate(() => ({
  reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
  gateHidden: document.getElementById('gate').hidden, shellHidden: document.getElementById('shell').hidden,
  sheenFrom: typeof (window.hub && hub.sheenFrom),
  visibleText: document.body.innerText.trim().replace(/\s+/g, ' ').slice(0, 70),
}));

const results = [];
const record = (r) => { results.push(r); console.log(JSON.stringify(r)); };

async function rawUnpaired(L, engineName, rm, tag) {
  // A bare context: no rig init script, no seeded localStorage. Only the local API is pointed at, prod is aborted.
  const ctx = await L.browser.newContext({ ...contextOptions('iphone-pwa', 'light'), reducedMotion: rm, serviceWorkers: 'block' });
  await ctx.route('https://house-hub-api.catalystfarm1.workers.dev/**', r => r.abort());
  await ctx.addInitScript(api => { try { if (!localStorage.getItem('hub.api')) localStorage.setItem('hub.api', JSON.stringify(api)); } catch {} }, L.api);
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', e => errs.push(e.message.slice(0, 200)));
  await page.goto(L.site + '/index.html', { waitUntil: 'load' });
  await sleep(6000);
  const s = await probe(page);
  const file = path.join(OUT, `verify-rm1-${tag}.png`);
  await page.screenshot({ path: file, scale: 'css', animations: 'disabled', caret: 'hide' });
  record({ case: `${engineName} unpaired iphone-pwa (context reducedMotion=${rm})`, ...s, pageerrors: errs, screenshot: path.relative(ROOT, file).replace(/\\/g, '/') });
  await ctx.close();
}

async function signedIn(L, device, profile, rm, tag, label) {
  const d = await L.device({ device, profile });
  await d.page.emulateMedia({ reducedMotion: rm });
  await d.goto('#home');
  await sleep(6000);
  const s = await probe(d.page);
  const file = path.join(OUT, `verify-rm1-${tag}.png`);
  await d.page.screenshot({ path: file, scale: 'css', animations: 'disabled', caret: 'hide' });
  record({ case: `${label} ${device} as ${profile} (emulateMedia reducedMotion=${rm})`, ...s, pageerrors: d.logs.filter(l => l.startsWith('pageerror')), screenshot: path.relative(ROOT, file).replace(/\\/g, '/') });
  await d.close();
}

let L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
try {
  await rawUnpaired(L, 'webkit', 'reduce', 'webkit-unpaired-reduce');
  await rawUnpaired(L, 'webkit', 'no-preference', 'webkit-unpaired-nopref');
  await signedIn(L, 'ipad-portrait', 'eli', 'reduce', 'webkit-ipad-eli-reduce', 'webkit');
  await signedIn(L, 'tv', 'tv', 'reduce', 'webkit-tv-reduce', 'webkit');
  await signedIn(L, 'ipad-portrait', 'eli', 'no-preference', 'webkit-ipad-eli-nopref', 'webkit');
  // counterfactual: the same under 'reduce' with the one call guarded
  await L.overlay(OVL);
  await signedIn(L, 'ipad-portrait', 'eli', 'reduce', 'webkit-ipad-eli-reduce-guarded', 'webkit+guard-overlay');
  await signedIn(L, 'tv', 'tv', 'reduce', 'webkit-tv-reduce-guarded', 'webkit+guard-overlay');
  await L.overlay('');
} finally { await L.close(); }

L = await local({ variant: 'typical', clock: 'demo', engine: 'chromium' });
try {
  await rawUnpaired(L, 'chromium', 'reduce', 'chromium-unpaired-reduce');
} finally { await L.close(); }

fs.writeFileSync(path.join(OUT, 'verify-rm1.json'), JSON.stringify(results, null, 1));
console.log('wrote audits/evidence/p2/STAB/verify-rm1.json');
