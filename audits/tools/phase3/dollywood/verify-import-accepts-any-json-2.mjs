// Skeptic #2 for "import-accepts-any-json" (apps/dollywood.html:1101).
//   node "audits/tools/phase3/dollywood/verify-import-accepts-any-json-2.mjs"
// Drives the real UI path (… menu → Import progress → file chooser) as Eli on the Kitchen iPad, typical seed, local rig only.
// Arm A: a file that is not a build-guide export (shape of Prayer's own "Export" file, apps/prayer.html:1500-1505).
// Arm B: an older build-guide export (2 ticks) over the current progress.
// For each: dialogs seen, UI count, server 'progress' row before/after, and whether a second device (Eli phone) adopts it.
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';
const EV = path.resolve('audits/evidence/p3/dollywood');
fs.mkdirSync(EV, { recursive: true });
const out = {};
const log = (k, v) => { out[k] = v; console.log(k, JSON.stringify(v)); };
async function server(L) {
  const r = await L.apiAs('eli', '/api/data/dollywood?scope=person&since=0');
  const it = (r.body.items || []).find(i => i.key === 'progress');
  const v = it && it.value;
  return { ticks: v && typeof v === 'object' ? Object.values(v).filter(x => x === true).length : 0, keys: v && typeof v === 'object' ? Object.keys(v) .slice(0, 6) : v, updated_at: it && it.updated_at };
}
const count = f => f.evaluate(() => document.getElementById('b-count').textContent);
const waitCount = f => f.waitForFunction(() => /of \d+ done/.test(document.getElementById('b-count').textContent), null, { timeout: 20000 });
const FILES = {
  A: { name: 'prayers-2026-09-20.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ prayers: [{ id: 'x1', text: 'Test request', cat: 'family', added: '2026-09-01' }], cats: ['family'], lastExport: '2026-09-20' }, null, 2)) },
  B: { name: 'dollywood-progress.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ version: 1, exported: '2026-05-01T12:00:00Z', done: { 'entrance-01': true, 'entrance-02': true } })) },
};
const L = await local({ variant: 'typical', engine: 'webkit' });
try {
  for (const arm of ['A', 'B']) {
    await L.reset('typical');
    const ph = await L.newDevice({ name: 'Eli phone', profiles: ['eli'] });
    const d = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
    const dialogs = []; d.page.on('dialog', async dg => { dialogs.push(dg.type() + ': ' + dg.message()); await dg.accept(); });
    const f = await d.openApp('dollywood', { wait: '#b-count' }); await waitCount(f); await sleep(800);
    const before = { ui: await count(f), server: await server(L) };
    // real UI path: open the … menu, tap Import progress, answer the file chooser
    await f.evaluate(() => document.getElementById('b-menu').click()); await sleep(300);
    const menuVisible = await f.evaluate(() => { const m = document.getElementById('bmenu'); return m && !m.hidden; });
    const [fc] = await Promise.all([d.page.waitForEvent('filechooser', { timeout: 10000 }), f.click('#b-import')]);
    await fc.setFiles(FILES[arm]); await sleep(3000);
    const after = { ui: await count(f), server: await server(L), hubValue: await f.evaluate(() => JSON.stringify(hub.get('progress')).slice(0, 160)), sync: await f.evaluate(() => hub.sync.state) };
    // does anything offer a way back? (undo control / toast text on the page)
    const undo = await f.evaluate(() => [...document.querySelectorAll('button,[role=button]')].map(b => b.textContent.trim()).filter(t => /undo|restore|revert/i.test(t)));
    if (arm === 'A') await d.page.screenshot({ path: path.join(EV, 'verify-import-accepts-any-json-2-A-ipad.png'), scale: 'css', type: 'png', animations: 'disabled' });
    // second device
    const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: ph });
    const fp = await phone.openApp('dollywood', { wait: '#b-count' }); await waitCount(fp); await sleep(1500);
    const phoneCount = await count(fp);
    log(arm, { file: FILES[arm].name, menuVisible, before, after, dialogs, undo, phoneCount });
    await phone.close(); await d.close();
  }
} finally { fs.writeFileSync(path.join(EV, 'verify-import-accepts-any-json-2.json'), JSON.stringify(out, null, 2)); await L.close(); }
