// Phase 3 skeptic #1: does the build guide's legacy-localStorage migration (apps/dollywood.html:1107 -> hub.migrate,
// apps/hub.js:397-411) overwrite the person's server progress when the first dollywood/person pull has not landed?
//   node "audits/tools/phase3/dollywood/verify-migrate-race-overwrites-progress-1.mjs" [arms...]   arms: A B C D E (default all)
// A control (pull untouched) · B pull held 8 s · C pull aborted · D pull held 5 s · E app opened offline, back online after 8 s.
// Each arm: reset 'typical' seed, fresh iPad context whose localStorage holds dollywood-build-progress-v2 = {"entrance-02":true}
// (one stale tick), open the build guide in the shell, wait, then read Eli's server row and the UI. After B, a second
// device of Eli's (a phone, never had the legacy key) opens the guide normally to show what it adopts.
// Writes audits/evidence/p3/dollywood/verify-migrate-race-overwrites-progress-1.json (+ -B-ipad.png, -B-phone.png).
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';
const EV = path.resolve('audits/evidence/p3/dollywood');
const PFX = 'verify-migrate-race-overwrites-progress-1';
fs.mkdirSync(EV, { recursive: true });
const want = process.argv.slice(2);
const on = a => !want.length || want.includes(a);
const out = {};
const log = (k, v) => { out[k] = v; console.log(k, JSON.stringify(v)); };
const PULL = /\/api\/data\/dollywood\?scope=person/;
const LEGACY = { 'entrance-02': true };

async function server(L) {
  const r = await L.apiAs('eli', '/api/data/dollywood?scope=person&since=0');
  const it = (r.body.items || []).find(i => i.key === 'progress');
  const v = it && it.value;
  return { ticks: v ? Object.values(v).filter(x => x === true).length : 0, keys: v ? Object.keys(v) : [], updated_at: it && it.updated_at };
}
const ui = f => f.evaluate(() => ({ count: (document.getElementById('b-count') || {}).textContent, sync: window.hub && hub.sync.state, migrated: JSON.parse(localStorage.getItem('hub.migrated') || '{}') }));
const png = async (d, n) => { const p = path.join(EV, `${PFX}-${n}.png`); await d.page.screenshot({ path: p, scale: 'css', animations: 'disabled', caret: 'hide' }); return path.relative(process.cwd(), p).replace(/\\/g, '/'); };

const L = await local({ variant: 'typical', engine: 'webkit' });
try {
  for (const arm of ['A', 'B', 'C', 'D', 'E']) {
    if (!on(arm)) continue;
    await L.reset('typical');
    const before = await server(L);
    const d = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false, localStorage: { 'dollywood-build-progress-v2': JSON.stringify(LEGACY) } });
    let pulls = 0;
    await d.ctx.route(PULL, async r => {
      pulls++;
      if (arm === 'B' && pulls === 1) { await sleep(8000); return r.continue().catch(() => {}); }
      if (arm === 'D' && pulls === 1) { await sleep(5000); return r.continue().catch(() => {}); }
      if (arm === 'C' && pulls === 1) return r.abort('failed');
      return r.continue().catch(() => {});
    });
    if (arm === 'E') { await d.goto('#home'); await sleep(1500); await d.setOffline(true); }
    const t0 = Date.now();
    const f = await d.openApp('dollywood', { wait: '#b-count' });
    if (arm === 'E') { await sleep(8000); await d.setOffline(false); }
    await sleep(arm === 'B' ? 12000 : 7000);
    // a later pull (30 s timer / visibility) — force one so the UI reflects the server
    await f.evaluate(() => window.hub && hub.pull()).catch(() => {});
    await sleep(1500);
    const after = await server(L);
    log(arm, { hold: { A: 'none', B: '8 s', C: 'abort', D: '5 s', E: 'offline 8 s' }[arm], before: { ticks: before.ticks }, after: { ticks: after.ticks, keys: after.keys.slice(0, 5), updated_at: after.updated_at }, ui: await ui(f), secs: Math.round((Date.now() - t0) / 1000), overwritten: after.ticks < before.ticks });
    if (arm === 'B') {
      log('B.ipadPng', await png(d, 'B-ipad'));
      const ph = await L.newDevice({ name: 'Eli phone', profiles: ['eli'] });
      const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: ph });
      const pf = await phone.openApp('dollywood', { wait: '#b-count' });
      await sleep(7000);
      log('B.secondDevice', await ui(pf));
      log('B.phonePng', await png(phone, 'B-phone'));
      await phone.close();
    }
    await d.close();
  }
} finally {
  fs.writeFileSync(path.join(EV, PFX + '.json'), JSON.stringify(out, null, 1));
  await L.close();
}
