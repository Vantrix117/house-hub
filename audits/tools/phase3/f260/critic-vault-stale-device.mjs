// Completeness critic (Phase 3, F260): a device that still has the HEAR journal unlocked writes its old ciphertext into
// the vault after another device of the same person erased it (E1) or erased it and set a new passcode (E2).
// persistJournal() reads the *current* vault row (apps/f260.html:1020) and overwrites iv/ct with ciphertext made with
// the in-memory data key of the stale device (apps/f260.html:1018-1022).
//   node "audits/tools/phase3/f260/critic-vault-stale-device.mjs" [E1|E2]      (default: both)
// Throwaway passcodes on the local demo database only.
import { local, sleep, save, shot, rows, ready } from './_lib.mjs';

const P1 = '2468', P2 = '9753';
const modes = process.argv[2] ? [process.argv[2]] : ['E1', 'E2'];
const out = {};
const vaultShape = v => v == null ? null : { keys: Object.keys(v).sort(), hasPass: !!v.pass, ctLen: v.ct ? v.ct.length : 0, iv: v.iv ? v.iv.slice(0, 8) : null };
async function passDialog(f, a, b) {
  await f.waitForSelector('#pass.on', { timeout: 8000 }); await sleep(150);
  await f.fill('#pass1', a); if (b != null) await f.fill('#pass2', b);
  await f.locator('#passOk').click();
}
async function openHear(f, id) {
  await f.evaluate(i => document.querySelector(`[data-jr="${i}"]`).scrollIntoView({ block: 'center' }), id);
  await f.locator(`[data-jr="${id}"]`).click();
}
async function settle(f) { await sleep(1200); await f.evaluate(() => hub.pull()); await sleep(1500); }

for (const mode of modes) {
  const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
  const o = out[mode] = {};
  try {
    const ph = await L.newDevice({ name: 'Eli phone', profiles: ['eli'] });
    const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: ph });
    const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
    const f = await phone.openApp('f260'); await ready(f);
    // 1. phone: set a passcode and write an entry
    await openHear(f, '38-0'); await passDialog(f, P1, P1);
    await f.waitForSelector('#jf-38-0-a', { timeout: 10000 }); await sleep(300);
    await f.locator('#jf-38-0-a').fill('Phone: share a meal this week.'); await f.locator('#jf-38-0-h').click(); await settle(f);
    o.serverAfterPhoneEntry = vaultShape((await rows(L, 'eli'))['f260.journal.vault']);
    // 2. iPad: open F260 and unlock with the same passcode (autolock default 15 min)
    const g = await ipad.openApp('f260'); await ready(g);
    await openHear(g, '38-0'); await passDialog(g, P1);
    await g.waitForSelector('#jf-38-0-a', { timeout: 10000 }); await sleep(300);
    o.ipadUnlocked = await g.evaluate(() => document.getElementById('jf-38-0-a').value);
    // 3. phone: Erase the journal (Settings → Erase journal → confirm)
    await f.evaluate(() => { const s = document.getElementById('sheet'); if (!s.classList.contains('on')) document.getElementById('settingsBtn').click(); }); await sleep(200);
    await f.evaluate(() => document.getElementById('eraseBtn').click()); await sleep(300);
    o.eraseText = await f.evaluate(() => document.getElementById('confirmText').textContent);
    await f.locator('#doConfirm').click(); await settle(f);
    o.serverAfterErase = vaultShape((await rows(L, 'eli'))['f260.journal.vault']);
    if (mode === 'E2') {
      // phone: start over with a new passcode and a new entry
      await f.evaluate(() => { document.getElementById('settingsBtn').click(); }); await sleep(200);
      await openHear(f, '38-1'); await passDialog(f, P2, P2);
      await f.waitForSelector('#jf-38-1-a', { timeout: 10000 }); await sleep(300);
      await f.locator('#jf-38-1-a').fill('Phone after starting over: call Grandma Jo.'); await f.locator('#jf-38-1-h').click(); await settle(f);
      o.serverAfterNewPass = vaultShape((await rows(L, 'eli'))['f260.journal.vault']);
    }
    // 4. iPad (still unlocked, has pulled): the person taps into the open entry, adds a line, taps away
    await g.evaluate(() => hub.pull()); await sleep(2000);
    o.ipadStateBeforeTyping = await g.evaluate(() => ({ hint: document.getElementById('vaultHint').textContent, panelOpen: !!document.getElementById('jf-38-0-r') }));
    await g.locator('#jf-38-0-r').click(); await g.locator('#jf-38-0-r').fill('iPad: Lord, make me generous.'); await g.locator('#jf-38-0-h').click();
    await settle(g);
    o.serverAfterIpadSave = vaultShape((await rows(L, 'eli'))['f260.journal.vault']);
    // 5. phone: reopen F260 and try to open the journal with the passcode it should take now
    await phone.goto('#home'); await sleep(500);
    const f2 = await phone.openApp('f260'); await ready(f2);
    await f2.locator('#tabJournal').click(); await sleep(600);
    o.phoneJournalDialog = await f2.evaluate(() => ({ on: document.getElementById('pass').classList.contains('on'), title: document.getElementById('passTitle').textContent }));
    const tryPass = mode === 'E2' ? P2 : P1;
    if (o.phoneJournalDialog.on) {
      await f2.fill('#pass1', tryPass); if (await f2.evaluate(() => !document.getElementById('pass2').hidden)) await f2.fill('#pass2', tryPass);
      await f2.locator('#passOk').click(); await sleep(3500);
      o.phoneUnlockResult = await f2.evaluate(() => ({ dialogStillOn: document.getElementById('pass').classList.contains('on'), err: document.getElementById('passErr').textContent, list: document.getElementById('jList').innerText.replace(/\s+/g, ' ').trim().slice(0, 200) }));
      if (mode === 'E2' && o.phoneUnlockResult.dialogStillOn) {   // the old passcode does not open it either
        await f2.fill('#pass1', P1); await f2.locator('#passOk').click(); await sleep(3500);
        o.phoneOldPassResult = await f2.evaluate(() => ({ dialogStillOn: document.getElementById('pass').classList.contains('on'), err: document.getElementById('passErr').textContent }));
      }
    }
    o.shot = await shot(phone.page, 'critic-vault-stale-' + mode + '-phone-unlock.png');
    await phone.close(); await ipad.close();
  } catch (e) { o.error = String(e && e.stack || e).slice(0, 600); }
  finally { await L.close(); }
  for (const [k, v] of Object.entries(o)) console.log(mode, k.padEnd(24), JSON.stringify(v).slice(0, 400));
}
console.log('evidence →', save('critic-vault-stale-device.json', out));
