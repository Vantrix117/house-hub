// Skeptic #1 (Phase 3, F260) for finding critic-vault-stale-device-overwrites-1: a device that still has the HEAR
// journal unlocked overwrites a vault another device of the same person erased (E1) or erased and re-keyed (E2).
// Independent of the investigator's script: no hub.pull() calls on the stale iPad — it only gets the erase through the
// SDK's own 30 s background pull (we wait 40 s), and the stale save is a plain type + tap-away (focusout) in the UI.
// C0 is a control: the same sequence, but the iPad saves BEFORE its background pull has seen the erase.
//   node "audits/tools/phase3/f260/verify-critic-vault-stale-device-overwrites-1-1.mjs" [E1|E2|C0]   (default: all three)
// Throwaway passcodes on the local demo database only.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep } from '../../lib/local.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const EVID = path.join(ROOT, 'audits', 'evidence', 'p3', 'f260');
const PFX = 'verify-critic-vault-stale-device-overwrites-1-1';
const rel = f => path.relative(ROOT, f).replace(/\\/g, '/');
const P1 = '1357', P2 = '8642';
const modes = process.argv[2] ? [process.argv[2]] : ['E1', 'E2', 'C0'];
const out = {};

const shape = v => v == null ? null : { keys: Object.keys(v).sort(), hasPass: !!v.pass, salt: v.pass ? v.pass.salt.slice(0, 10) : null, ct: v.ct ? v.ct.slice(0, 10) : null };
async function serverVault(L) {
  const r = await L.apiAs('eli', '/api/data/f260?scope=person');
  const it = (r.body.items || []).find(i => i.key === 'f260.journal.vault');
  return it ? it.value : null;
}
async function ready(f) { await f.waitForFunction(() => { const t = document.getElementById('todayTitle'); return t && t.textContent.trim().length > 0; }, null, { timeout: 20000 }); await sleep(400); }
async function passcode(f, a, confirm) {
  await f.waitForSelector('#pass.on', { timeout: 10000 }); await sleep(200);
  await f.fill('#pass1', a); if (confirm) await f.fill('#pass2', a);
  await f.locator('#passOk').click();
}
async function openHear(f, id) {
  const b = f.locator(`[data-jr="${id}"]`); await b.scrollIntoViewIfNeeded(); await b.click();
}
async function writeField(f, id, field, text, away) {
  const t = f.locator(`#jf-${id}-${field}`); await t.scrollIntoViewIfNeeded(); await t.click(); await t.fill(text);
  await f.locator(`#jf-${id}-${away}`).click();                // tap into another field → focusout → saveJournal
}

for (const mode of modes) {
  const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
  const o = out[mode] = {};
  try {
    const ph = await L.newDevice({ name: 'Eli phone (verify)', profiles: ['eli'] });
    const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: ph });
    const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
    o.serverAtStart = shape(await serverVault(L));
    // 1. phone: first HEAR → set passcode P1, write Apply on 38-0
    await phone.goto('#home'); const f = await phone.openApp('f260'); await ready(f);
    await openHear(f, '38-0'); await passcode(f, P1, true);
    await f.waitForSelector('#jf-38-0-a', { timeout: 15000 });
    await writeField(f, '38-0', 'a', 'Phone entry: share a meal.', 'h'); await sleep(3000);
    o.serverAfterPhoneEntry = shape(await serverVault(L));
    // 2. iPad: open F260, pull happens on open; unlock with P1, leave the entry open
    await ipad.goto('#home'); const g = await ipad.openApp('f260'); await ready(g); await sleep(1500);
    await openHear(g, '38-0'); await passcode(g, P1, false);
    await g.waitForSelector('#jf-38-0-a', { timeout: 15000 }); await sleep(300);
    o.ipadSeesPhoneEntry = await g.evaluate(() => document.getElementById('jf-38-0-a').value);
    // 3. phone: Settings → Erase journal… → Erase journal
    const sb = f.locator('#settingsBtn'); await sb.scrollIntoViewIfNeeded(); await sb.click(); await sleep(400);
    const eb = f.locator('#eraseBtn'); await eb.scrollIntoViewIfNeeded(); await eb.click(); await sleep(400);
    o.eraseCopy = await f.evaluate(() => document.getElementById('confirmText').textContent);
    await f.locator('#doConfirm').click(); await sleep(3000);
    o.serverAfterErase = shape(await serverVault(L));
    if (mode === 'E2') {   // start over: new passcode P2 and a new entry on 38-1
      await openHear(f, '38-1'); await passcode(f, P2, true);
      await f.waitForSelector('#jf-38-1-a', { timeout: 15000 });
      await writeField(f, '38-1', 'a', 'Phone after starting over: call Grandma Jo.', 'h'); await sleep(3000);
      o.serverAfterNewPass = shape(await serverVault(L));
    }
    // 4. iPad: E1/E2 wait for the SDK's own background pull (30 s timer); C0 saves right away
    if (mode !== 'C0') await sleep(40000);
    o.ipadCacheVaultBeforeSave = shape(await g.evaluate(() => { const v = hub.get('f260.journal.vault'); return v === undefined ? null : v; }));
    o.ipadStillShowsEntry = await g.evaluate(() => ({ open: !!document.getElementById('jf-38-0-r'), a: (document.getElementById('jf-38-0-a') || {}).value }));
    await writeField(g, '38-0', 'r', 'iPad: Lord, make me generous.', 'h'); await sleep(4000);
    o.serverAfterIpadSave = shape(await serverVault(L));
    // 5. phone: close and reopen F260, Journal tab, enter the passcode it should now take
    await phone.goto('#home'); await sleep(800);
    const f2 = await phone.openApp('f260'); await ready(f2); await sleep(1500);
    await f2.locator('#tabJournal').click(); await sleep(800);
    o.phoneDialog = await f2.evaluate(() => ({ on: document.getElementById('pass').classList.contains('on'), title: document.getElementById('passTitle').textContent, confirmHidden: document.getElementById('pass2').hidden }));
    const tryUnlock = async p => {
      await f2.fill('#pass1', p); if (await f2.evaluate(() => !document.getElementById('pass2').hidden)) await f2.fill('#pass2', p);
      await f2.locator('#passOk').click(); await sleep(4000);
      return f2.evaluate(() => ({ dialogOn: document.getElementById('pass').classList.contains('on'), err: document.getElementById('passErr').textContent, journal: document.getElementById('jList').innerText.replace(/\s+/g, ' ').trim().slice(0, 240) }));
    };
    if (o.phoneDialog.on) {
      o.phoneTry1 = { pass: mode === 'E2' ? 'P2 (new)' : 'P1', ...(await tryUnlock(mode === 'E2' ? P2 : P1)) };
      if (mode === 'E2' && o.phoneTry1.dialogOn) o.phoneTry2 = { pass: 'P1 (old)', ...(await tryUnlock(P1)) };
    }
    const png = path.join(EVID, `${PFX}-${mode}-phone-iphone.png`);
    await phone.page.screenshot({ path: png, scale: 'css', animations: 'disabled', caret: 'hide' }); o.shot = rel(png);
    await phone.close(); await ipad.close();
  } catch (e) { o.error = String(e && e.stack || e).slice(0, 800); }
  finally { await L.close(); }
  for (const [k, v] of Object.entries(o)) console.log(mode, k.padEnd(26), JSON.stringify(v).slice(0, 420));
}
const jf = path.join(EVID, `${PFX}.json`);
let prev = {}; try { prev = JSON.parse(fs.readFileSync(jf, 'utf8')); } catch {}
fs.writeFileSync(jf, JSON.stringify({ ...prev, ...out }, null, 1));
console.log('evidence →', rel(jf));
