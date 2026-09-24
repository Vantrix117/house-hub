// Skeptic 2 for critic-erase-dialog-misstates-scope-7: does "Erase journal" (confirm copy: "deleted from this device")
// erase the journal on the person's OTHER device too? Eli writes a HEAR entry on his phone, then erases on the Kitchen
// iPad; we read the server row and the phone (still open, then freshly reopened). Throwaway passcode on the local demo DB.
//   node "audits/tools/phase3/f260/verify-critic-erase-dialog-misstates-scope-7-2.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep, DEMO } from '../../lib/local.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EVID = path.resolve(HERE, '..', '..', '..', 'evidence', 'p3', 'f260');
fs.mkdirSync(EVID, { recursive: true });
const NAME = 'verify-critic-erase-dialog-misstates-scope-7-2';
const PASS = '9753';
const out = {};
const ready = async f => { await f.waitForFunction(() => { const t = document.getElementById('todayTitle'); return t && t.textContent.trim().length > 0; }, null, { timeout: 20000 }); await sleep(400); };
const vaultRow = async () => { const r = await L.apiAs('eli', '/api/data/f260?scope=person&key=f260.journal.vault'); const it = r.body.item; return it ? { value: it.value && typeof it.value === 'object' ? { keys: Object.keys(it.value), ctChars: it.value.ct ? it.value.ct.length : 0 } : it.value, updated_at: it.updated_at } : '(no row)'; };
const hint = f => f.evaluate(() => document.getElementById('vaultHint').textContent.trim());

const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
try {
  // 1. Eli's phone: set a passcode from today's HEAR panel and write an entry
  const ph = await L.newDevice({ name: 'Eli phone', profiles: ['eli'] });
  const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: DEMO, as: ph });
  let f = await phone.openApp('f260'); await ready(f);
  const day = '38-0';
  await f.evaluate(i => document.querySelector(`[data-jr="${i}"]`).scrollIntoView({ block: 'center' }), day);
  await f.locator(`[data-jr="${day}"]`).tap();
  await f.waitForSelector('#pass.on', { timeout: 5000 }); await sleep(150);
  out.phoneSetPassText = await f.evaluate(() => document.getElementById('passText').textContent);
  await f.fill('#pass1', PASS); await f.fill('#pass2', PASS); await f.locator('#passOk').tap();
  await f.waitForSelector('#pass.on', { state: 'detached', timeout: 8000 }).catch(() => {}); await sleep(400);
  await f.locator(`#jf-${day}-a`).tap(); await f.locator(`#jf-${day}-a`).fill('Call Grandma on Sunday.');
  await f.locator(`#jf-${day}-h`).tap(); await sleep(1500);
  await phone.ctx.clock.runFor(3000); await sleep(1500);
  out.serverBeforeErase = await vaultRow();
  out.phoneFooter = await f.evaluate(() => (document.querySelector('p.foot') || {}).textContent || null);

  // 2. The Kitchen iPad, same person: sees the synced (locked) journal, then Erase
  const pad = await L.device({ device: 'ipad-portrait', profile: 'eli', installClock: DEMO + 60000 });
  const g = await pad.openApp('f260'); await ready(g);
  await g.evaluate(() => document.getElementById('settingsBtn').click()); await sleep(400);
  out.ipadBeforeErase = { hint: await hint(g), eraseDisabled: await g.evaluate(() => document.getElementById('eraseBtn').disabled) };
  await g.evaluate(() => document.getElementById('eraseBtn').click()); await sleep(400);
  out.eraseDialog = await g.evaluate(() => ({ title: document.getElementById('confirmTitle') ? document.getElementById('confirmTitle').textContent : null, text: document.getElementById('confirmText').textContent }));
  await pad.page.screenshot({ path: path.join(EVID, NAME + '-ipad-erase-dialog.png'), scale: 'css', animations: 'disabled', caret: 'hide' });
  await g.locator('#doConfirm').tap(); await sleep(1500);
  await pad.ctx.clock.runFor(3000); await sleep(1500);
  out.serverAfterErase = await vaultRow();
  out.ipadAfterErase = await hint(g);

  // 3. The phone (app still open): wait for a pull; then a fresh reopen
  const t0 = Date.now(); let h = '';
  while (Date.now() - t0 < 70000) { h = await hint(f); if (/No passcode yet/.test(h)) break; await phone.ctx.clock.runFor(5000); await sleep(1000); }
  out.phoneOpenAfterErase = { hint: h, realSeconds: Math.round((Date.now() - t0) / 1000) };
  await phone.page.reload(); await sleep(1500);
  await phone.goto('#home'); f = await phone.openApp('f260'); await ready(f);
  await phone.ctx.clock.runFor(3000); await sleep(1500);
  out.phoneReopened = { hint: await hint(f), cachedVault: await phone.page.evaluate(() => { const hits = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); const v = localStorage.getItem(k) || ''; if (/f260/.test(k) && /journal\.vault/.test(v)) hits.push({ k, hasCt: /"ct"\s*:\s*"[A-Za-z0-9+/=]{8,}/.test(v) }); } return hits; }) };
  await f.evaluate(() => document.getElementById('tabJournal').click()); await sleep(600);
  out.phoneJournalTab = await f.evaluate(() => ({ passDialog: document.getElementById('pass').classList.contains('on'), passTitle: document.getElementById('passTitle').textContent }));
  await phone.page.screenshot({ path: path.join(EVID, NAME + '-phone-after-erase.png'), scale: 'css', animations: 'disabled', caret: 'hide' });
  await phone.close(); await pad.close();
} finally { await L.close(); }
for (const [k, v] of Object.entries(out)) console.log(k.padEnd(22), JSON.stringify(v).slice(0, 600));
fs.writeFileSync(path.join(EVID, NAME + '.json'), JSON.stringify(out, null, 1));
console.log('evidence → audits/evidence/p3/f260/' + NAME + '.json');
