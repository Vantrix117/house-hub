// Skeptic #1 for critic-erase-dialog-misstates-scope-7: does "Erase journal" (whose dialog says "deleted from this
// device") delete Eli's journal on his other device too? Eli's phone sets a passcode and writes a HEAR entry; the
// Kitchen iPad (same profile, different device) opens F260 and erases; then we read the server row and the phone.
// The passcode is a throwaway value on the local demo database.
//   node "audits/tools/phase3/f260/verify-critic-erase-dialog-misstates-scope-7-1.mjs"
import { local, sleep, DEMO, save, shot, ready } from './_lib.mjs';

const PASS = '1357';
const P = 'verify-critic-erase-dialog-misstates-scope-7-1';
const out = {};
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const vaultOnServer = async () => { const r = await L.apiAs('eli', '/api/data/f260?scope=person&key=f260.journal.vault'); const it = r.body.item; return it ? { value: it.value == null ? null : { hasCt: !!it.value.ct, keys: Object.keys(it.value) }, updated_at: it.updated_at } : '(no row)'; };
try {
  const ph = await L.newDevice({ name: 'Eli phone', profiles: ['eli'] });
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: DEMO, as: ph });
  const f = await d.openApp('f260'); await ready(f);
  // phone: set a passcode from today's HEAR panel and write an Apply line
  const day = await f.evaluate(() => { const w = document.getElementById('todayDone').dataset.target.split('-')[0]; const b = document.querySelector('[data-jr="' + w + '-0"]'); b.scrollIntoView({ block: 'center' }); return b.dataset.jr; });
  await f.locator(`[data-jr="${day}"]`).tap();
  await f.waitForSelector('#pass.on', { timeout: 5000 }); await sleep(150);
  await f.fill('#pass1', PASS); await f.fill('#pass2', PASS); await f.locator('#passOk').tap();
  await f.waitForSelector('#pass.on', { state: 'detached', timeout: 8000 }).catch(() => {}); await sleep(400);
  await f.locator(`#jf-${day}-a`).tap(); await f.locator(`#jf-${day}-a`).fill('Phone-only entry: call Grandma Sunday.');
  await f.locator(`#jf-${day}-h`).tap(); await sleep(2500);
  out.phoneBefore = await f.evaluate(() => ({ state: document.getElementById('vaultHint').textContent }));
  out.serverAfterPhoneWrite = await vaultOnServer();
  // lock the phone journal (as on reopen) so it relies on the synced vault
  await f.evaluate(() => document.getElementById('jLock') && document.getElementById('jLock').click()).catch(() => {});

  // iPad (the rig's Kitchen iPad, another device) signed in as Eli
  const pad = await L.device({ device: 'ipad-portrait', profile: 'eli', installClock: DEMO + 60000 });
  const g = await pad.openApp('f260'); await ready(g); await sleep(1500);
  await g.evaluate(() => document.getElementById('settingsBtn').click()); await sleep(300);
  out.padBeforeErase = await g.evaluate(() => ({ hint: document.getElementById('vaultHint').textContent, eraseDisabled: document.getElementById('eraseBtn').disabled }));
  await g.evaluate(() => document.getElementById('eraseBtn').click()); await sleep(300);
  out.eraseDialog = await g.evaluate(() => ({ title: document.getElementById('confirmTitle').textContent, text: document.getElementById('confirmText').textContent, ok: document.getElementById('doConfirm').textContent }));
  await shot(pad.page, P + '-erase-dialog-ipad.png');
  await g.locator('#doConfirm').tap(); await sleep(2500);
  out.serverAfterErase = await vaultOnServer();

  // phone: wait for its pulls (every 30 s) to bring the tombstone
  const f3 = d.frame('f260'); const t0 = Date.now(); let hint = '';
  while (Date.now() - t0 < 70000) { hint = await f3.evaluate(() => document.getElementById('vaultHint').textContent); if (/No passcode yet/.test(hint)) break; await d.ctx.clock.runFor(5000); await sleep(1000); }
  out.phoneAfterErase = { hint, realSeconds: Math.round((Date.now() - t0) / 1000) };
  // phone: try to open the HEAR panel → is it an unlock prompt (journal still there) or a set-passcode prompt (gone)?
  await f3.evaluate(() => { const s = document.getElementById('sheet'); if (s && s.classList.contains('on')) document.getElementById('settingsBtn').click(); });
  await f3.evaluate(d => { const b = document.querySelector(`[data-jr="${d}"]`); b.scrollIntoView({ block: 'center' }); b.click(); }, day); await sleep(600);
  out.phoneHearAfterErase = await f3.evaluate(() => ({ dialogOpen: document.getElementById('pass').classList.contains('on'), title: document.getElementById('passTitle').textContent }));
  await shot(d.page, P + '-phone-after-erase.png');
  // Restore copy (the finding's second claim)
  out.restoreConfirmCopyInCode = 'apps/f260.html:2022';
  await d.close(); await pad.close();
} finally { await L.close(); }
for (const [k, v] of Object.entries(out)) console.log(k.padEnd(24), JSON.stringify(v).slice(0, 600));
console.log('evidence →', save(P + '.json', out));
