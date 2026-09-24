// Skeptic #2 for critic-vault-stale-device-overwrites-1 (F260 journal vault overwritten by a stale unlocked device).
// Independent of the investigator's script: the iPad is NOT made to pull by the script; it waits for hub.js's own
// 30 s interval pull (apps/hub.js:342), as a real idle iPad would. Throwaway passcodes on the local demo DB only.
//   node "audits/tools/phase3/f260/verify-critic-vault-stale-device-overwrites-1-2.mjs" [E1|E2]   (default both)
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const EVID = path.join(ROOT, 'audits', 'evidence', 'p3', 'f260'); fs.mkdirSync(EVID, { recursive: true });
const PRE = 'verify-critic-vault-stale-device-overwrites-1-2';
const A = '1357', B = '8642';
const modes = process.argv[2] ? [process.argv[2]] : ['E1', 'E2'];
const out = {};
const shape = v => v == null ? null : { keys: Object.keys(v).sort(), passSalt: v.pass ? v.pass.salt.slice(0, 10) : null, iv: v.iv ? v.iv.slice(0, 8) : null };
async function vault(L) { const r = await L.apiAs('eli', '/api/data/f260?scope=person'); const it = (r.body.items || []).find(i => i.key === 'f260.journal.vault'); return it ? it.value : null; }
async function ready(f) { await f.waitForFunction(() => { const t = document.getElementById('todayTitle'); return t && t.textContent.trim(); }, null, { timeout: 15000 }); await sleep(400); }
async function pass(f, a, b) { await f.waitForSelector('#pass.on', { timeout: 8000 }); await sleep(150); await f.fill('#pass1', a); if (b) await f.fill('#pass2', b); await f.locator('#passOk').click(); }
async function hear(f, id) { await f.evaluate(i => document.querySelector(`[data-jr="${i}"]`).scrollIntoView({ block: 'center' }), id); await f.locator(`[data-jr="${id}"]`).click(); }

for (const mode of modes) {
  const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
  const o = out[mode] = {};
  try {
    const ph = await L.newDevice({ name: 'Eli phone', profiles: ['eli'] });
    const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: ph });
    const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
    const f = await phone.openApp('f260'); await ready(f);
    await hear(f, '38-2'); await pass(f, A, A);
    await f.waitForSelector('#jf-38-2-h', { timeout: 10000 });
    await f.locator('#jf-38-2-h').fill('Original entry from the phone.'); await f.locator('#jf-38-2-a').click(); await sleep(2500);
    o.v1_afterSetup = shape(await vault(L));
    const g = await ipad.openApp('f260'); await ready(g);
    await hear(g, '38-2'); await pass(g, A);
    await g.waitForSelector('#jf-38-2-h', { timeout: 10000 }); await sleep(300);
    o.ipadSees = await g.evaluate(() => document.getElementById('jf-38-2-h').value);
    // phone: Settings → Erase journal → confirm
    await f.evaluate(() => document.getElementById('settingsBtn').click()); await sleep(300);
    await f.evaluate(() => document.getElementById('eraseBtn').click()); await sleep(300);
    o.eraseCopy = await f.evaluate(() => document.getElementById('confirmText').textContent);
    await f.locator('#doConfirm').click(); await sleep(2500);
    o.v2_afterErase = shape(await vault(L));
    if (mode === 'E2') {
      await f.evaluate(() => { const s = document.getElementById('sheet'); if (s && s.classList.contains('on')) document.getElementById('settingsBtn').click(); }); await sleep(300);
      await hear(f, '38-3'); await pass(f, B, B);
      await f.waitForSelector('#jf-38-3-h', { timeout: 10000 });
      await f.locator('#jf-38-3-h').fill('New entry after starting over.'); await f.locator('#jf-38-3-a').click(); await sleep(2500);
      o.v3_afterNewPass = shape(await vault(L));
    }
    // iPad: no scripted pull; wait for hub.js's own 30 s interval pull
    await sleep(36000);
    o.ipadCachedVault = await g.evaluate(() => { const v = hub.get('f260.journal.vault', { default: null }); return v == null ? null : Object.keys(v).sort(); });
    o.ipadStillShows = await g.evaluate(() => { const t = document.getElementById('jf-38-2-h'); return t ? t.value : null; });
    await g.locator('#jf-38-2-r').click(); await g.locator('#jf-38-2-r').fill('Typed on the iPad afterwards.'); await g.locator('#jf-38-2-a').click(); await sleep(3000);
    o.v4_afterIpadSave = shape(await vault(L));
    // iPad itself: lock and try to reopen with the old passcode
    await g.evaluate(() => document.getElementById('jLock') && document.getElementById('jLock').click()); await sleep(500);
    await g.locator('#tabJournal').click(); await sleep(600);
    if (await g.evaluate(() => document.getElementById('pass').classList.contains('on'))) {
      await g.fill('#pass1', A); await g.locator('#passOk').click(); await sleep(3500);
      o.ipadReopenOldPass = await g.evaluate(() => ({ dialogOn: document.getElementById('pass').classList.contains('on'), err: document.getElementById('passErr').textContent }));
    } else o.ipadReopenOldPass = 'no dialog';
    // phone: reopen F260 and try the passcode(s)
    await phone.goto('#home'); await sleep(600);
    const f2 = await phone.openApp('f260'); await ready(f2); await sleep(1500);
    await f2.locator('#tabJournal').click(); await sleep(700);
    o.phoneDialog = await f2.evaluate(() => ({ on: document.getElementById('pass').classList.contains('on'), title: document.getElementById('passTitle').textContent, confirmFieldHidden: document.getElementById('pass2').hidden }));
    for (const p of (mode === 'E2' ? [B, A] : [A])) {
      if (!(await f2.evaluate(() => document.getElementById('pass').classList.contains('on')))) break;
      await f2.fill('#pass1', p); await f2.locator('#passOk').click(); await sleep(3500);
      o['phoneTry_' + p] = await f2.evaluate(() => ({ dialogOn: document.getElementById('pass').classList.contains('on'), err: document.getElementById('passErr').textContent }));
    }
    const png = path.join(EVID, `${PRE}-${mode}-phone.png`);
    await phone.page.screenshot({ path: png, scale: 'css' }); o.shot = path.relative(ROOT, png).split(path.sep).join('/');
    await phone.close(); await ipad.close();
  } catch (e) { o.error = String(e && e.stack || e).slice(0, 800); }
  finally { await L.close(); }
  for (const [k, v] of Object.entries(o)) console.log(mode, k.padEnd(20), JSON.stringify(v).slice(0, 300));
}
fs.writeFileSync(path.join(EVID, PRE + '.json'), JSON.stringify(out, null, 1));
console.log('evidence → audits/evidence/p3/f260/' + PRE + '.json');
