// SYNC skeptic #2 — counterfactual for "initial-state-offline": the same two scenarios as verify-initial-state-offline-2.mjs,
// served with an overlay copy of apps/hub.js whose ONLY change is line 51's initial state
//   state: 'offline'  →  state: navigator.onLine === false ? 'offline' : 'pending'
// If the false Larder line and Home's missing skeletons disappear, the initial state is the cause (not the rig's delay).
//   node "audits/tools/phase2/SYNC/verify-initial-state-offline-2-counterfactual.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep } from '../../lib/local.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const EVID = path.join(ROOT, 'audits', 'evidence', 'p2', 'SYNC');
const OV = path.join(HERE, 'overlay-initial-pending');
fs.mkdirSync(path.join(OV, 'apps'), { recursive: true });
const src = fs.readFileSync(path.join(ROOT, 'apps', 'hub.js'), 'utf8');
const needle = "sync: { state: 'offline', pending: 0, lastError: null, lastPull: 0 },";
if (!src.includes(needle)) throw new Error('apps/hub.js line 51 changed; update the counterfactual');
fs.writeFileSync(path.join(OV, 'apps', 'hub.js'), src.replace(needle, "sync: { state: navigator.onLine === false ? 'offline' : 'pending', pending: 0, lastError: null, lastPull: 0 },"));
const rel = f => path.relative(ROOT, f).split(path.sep).join('/');
const out = {};

for (const variantName of ['baseline', 'counterfactual']) {
  const L = await local({ variant: 'typical', clock: 'real', overlay: variantName === 'counterfactual' ? rel(OV) : undefined });
  try {
    const r = out[variantName] = {};
    // Larder warm open, 1.5 s first pull
    const ph = await L.newDevice({ name: 'CF phone', profiles: ['eli'] });
    const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: ph });
    let f = await phone.openApp('leftovers');
    for (let i = 0; i < 60 && !(await f.evaluate(() => window.hub && hub.sync.lastPull > 0).catch(() => false)); i++) await sleep(250);
    await sleep(500);
    await phone.ctx.route(/\/api\/data\/leftovers\?/, async route => { await sleep(1500); route.continue().catch(() => {}); });
    await phone.page.goto('about:blank');
    f = await phone.openApp('leftovers');
    await sleep(600);
    r.larderMidPull = await f.evaluate(() => ({ onLine: navigator.onLine, state: hub.sync.state, lastPull: hub.sync.lastPull, line: document.getElementById('mode').hidden ? null : document.getElementById('mode').textContent }));
    await sleep(2000);
    r.larderAfter = await f.evaluate(() => ({ state: hub.sync.state, line: document.getElementById('mode').hidden ? null : document.getElementById('mode').textContent }));
    // Home on a cold device, 2 s per data request
    const ph2 = await L.newDevice({ name: 'CF cold phone', profiles: ['eli'] });
    const cold = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: ph2 });
    await cold.ctx.route(/\/api\/data\//, async route => { await sleep(2000); route.continue().catch(() => {}); });
    await cold.page.goto(L.site + '/index.html#home', { waitUntil: 'domcontentloaded' });
    await sleep(700);
    r.homeMidPull = await cold.page.evaluate(() => ({
      state: hub.sync.state, lastPull: hub.sync.lastPull, skeletons: document.querySelectorAll('#view-home .skeleton').length,
      fridge: ([...document.querySelectorAll('#view-home .card h2')].find(h => /fridge/i.test(h.textContent)) || {}).parentElement?.innerText.replace(/\s+/g, ' ').slice(0, 80) || null,
      reminders: ((document.getElementById('remlist') || {}).innerText || '').replace(/\s+/g, ' ').slice(0, 60), dot: document.getElementById('syncdot').className,
    }));
    const shotF = path.join(EVID, `v-initial-offline-2-cf-home-cold-${variantName}.png`);
    await cold.page.screenshot({ path: shotF, scale: 'css', animations: 'disabled', caret: 'hide' });
    r.homeShot = rel(shotF);
    console.log(`[${variantName}] Larder 0.6 s into a 1.5 s pull: ${JSON.stringify(r.larderMidPull)}; after: ${JSON.stringify(r.larderAfter)}`);
    console.log(`[${variantName}] Home cold, 0.7 s into the first pull: ${JSON.stringify(r.homeMidPull)} → ${r.homeShot}`);
  } finally { await L.close(); }
}
fs.writeFileSync(path.join(EVID, 'v-initial-offline-2-counterfactual.json'), JSON.stringify(out, null, 1));
console.log('evidence', rel(path.join(EVID, 'v-initial-offline-2-counterfactual.json')));
