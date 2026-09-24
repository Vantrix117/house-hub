// Skeptic #1 (413-drops-whole-channel): what REALLY happens when an F260 journal grows large, through the app's own UI.
//   node "audits/tools/phase2/SYNC/verify-413-drops-whole-channel-1-real.mjs"      (~60 s)
// F260 base64-encodes the ciphertext with String.fromCharCode.apply(null, bytes) (apps/f260.html:993), which throws RangeError
// past the engine's argument limit (see verify-413-drops-whole-channel-1-b64.mjs: WebKit 638,750 bytes, Chromium 123,930 bytes),
// and persistJournal() swallows it (.catch(() => {}), apps/f260.html:1024). So the vault never reaches the Worker's 900 KB limit.
// For each engine: set a passcode and type a HEAR entry (4 fields) through the real textareas, once below and once above the
// engine's limit; then close and reopen F260, unlock with the passcode, and read the entry back.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep } from '../../lib/local.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const EVID = path.join(ROOT, 'audits', 'evidence', 'p2', 'SYNC');
const t0 = Date.now();
const log = (...a) => console.log(((Date.now() - t0) / 1000).toFixed(1).padStart(6) + 's', ...a);
async function waitFor(fn, timeout = 10000) { const u = Date.now() + timeout; while (Date.now() < u) { try { const v = await fn(); if (v) return v; } catch {} await sleep(200); } return null; }

async function trial(engine, device, perField, label) {
  const r = { engine, device, perField, label };
  const L = await local({ variant: 'typical', clock: 'real', engine });
  try {
    const d = await L.device({ device, profile: 'eli', fixedTime: false });
    let f = await d.openApp('f260', { wait: '#todayDone' });
    await waitFor(() => f.evaluate(() => hub.sync.lastPull > 0), 15000); await sleep(600);
    const id = await f.evaluate(() => document.getElementById('todayDone').dataset.target);
    await f.evaluate(id => { const b = document.querySelector('[data-jr="' + id + '"]'); b.scrollIntoView(); b.click(); }, id);
    await f.waitForSelector('#pass.on', { timeout: 5000 });
    await f.fill('#pass1', '24680'); await f.fill('#pass2', '24680'); await f.click('#passOk');
    await waitFor(() => f.evaluate(id => document.querySelectorAll('#jr-' + id + ' textarea[data-jf]').length === 4, id), 15000);
    r.vaultAfterPasscode = await f.evaluate(() => JSON.stringify(hub.get('f260.journal.vault')).length);
    await f.evaluate(({ id, n }) => {
      let base = ''; while (base.length < n) base += 'still waters and green pastures restore my soul ';
      for (const t of document.querySelectorAll('#jr-' + id + ' textarea[data-jf]')) {
        t.value = base.slice(0, n);
        t.dispatchEvent(new Event('input', { bubbles: true }));
        t.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
      }
    }, { id, n: perField });
    await sleep(4000);
    r.vaultLocal = await f.evaluate(() => JSON.stringify(hub.get('f260.journal.vault')).length);
    const srv = await L.apiAs('eli', '/api/data/f260?scope=person&key=f260.journal.vault');
    r.vaultServer = srv.body && srv.body.item ? JSON.stringify(srv.body.item.value).length : null;
    r.savedLabel = await f.evaluate(id => { const s = document.querySelector('#jr-' + id + ' .jsaved'); return s && s.textContent; }, id);
    r.hubToast = await f.evaluate(() => { const t = document.getElementById('hub-toast'); return t && t.offsetParent !== null ? t.textContent : null; });
    r.sync = (await d.hub(f)).sync.state;
    r.errors = d.logs.filter(l => /error/i.test(l)).slice(-3);
    // close F260 and reopen it; unlock with the passcode; read the entry back
    await d.goto('#home'); await sleep(800);
    f = await d.openApp('f260', { wait: '#todayDone' }); await sleep(1500);
    await f.evaluate(id => { const b = document.querySelector('[data-jr="' + id + '"]'); b.scrollIntoView(); b.click(); }, id);
    await f.waitForSelector('#pass.on', { timeout: 5000 });
    await f.fill('#pass1', '24680'); await f.click('#passOk');
    await waitFor(() => f.evaluate(id => document.querySelectorAll('#jr-' + id + ' textarea[data-jf]').length === 4 && !document.getElementById('pass').classList.contains('on'), id), 15000);
    r.afterReopen = await f.evaluate(id => [...document.querySelectorAll('#jr-' + id + ' textarea[data-jf]')].map(t => t.value.length), id);
    const shotFile = path.join(EVID, `v413-1-real-${engine}-${label}.png`);
    await d.page.screenshot({ path: shotFile, scale: 'css', animations: 'disabled', caret: 'hide' });
    r.shot = path.relative(ROOT, shotFile).split(path.sep).join('/');
    log(`[${engine} ${device} ${label}] typed 4 × ${perField} chars; vault chars: after passcode ${r.vaultAfterPasscode}, after typing (device) ${r.vaultLocal}, (server) ${r.vaultServer}; panel says ${JSON.stringify(r.savedLabel)}; hub toast ${JSON.stringify(r.hubToast)}; sync ${r.sync}; console errors ${JSON.stringify(r.errors)}`);
    log(`[${engine} ${device} ${label}] after closing and reopening F260 + unlock, the entry's field lengths are ${JSON.stringify(r.afterReopen)}`);
  } finally { await L.close(); }
  return r;
}

const out = [
  await trial('chromium', 'desktop', 20000, 'below'),     // ~80 KB ciphertext: under Chromium's 123,930
  await trial('chromium', 'desktop', 40000, 'above'),     // ~160 KB: over it
  await trial('webkit', 'iphone-pwa', 100000, 'below'),        // ~400 KB: under WebKit's 638,750
  await trial('webkit', 'iphone-pwa', 180 * 1024, 'above'),    // ~737 KB: over it (what a 900 KB+ vault would need)
];
fs.writeFileSync(path.join(EVID, 'verify-413-drops-whole-channel-1-real.json'), JSON.stringify(out, null, 2));
log('evidence audits/evidence/p2/SYNC/verify-413-drops-whole-channel-1-real.json');
