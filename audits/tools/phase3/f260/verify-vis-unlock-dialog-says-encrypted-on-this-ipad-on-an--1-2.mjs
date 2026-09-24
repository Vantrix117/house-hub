// Skeptic #2: does F260's Unlock dialog say "encrypted on this iPad" on an iPhone and on desktop, and is the vault
// actually device-bound (which would make the copy right on the iPad and only the device name wrong)?
// Fresh local rig; throwaway passcode on the local demo database.
//   node "audits/tools/phase3/f260/verify-vis-unlock-dialog-says-encrypted-on-this-ipad-on-an--1-2.mjs"
import { local, sleep, DEMO, save, shot, rows, ready } from './_lib.mjs';

const PASS = '9753';
const P = 'verify-vis-unlock-dialog-says-encrypted-on-this-ipad-on-an--1-2';
const out = { ua: {} };
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
async function passDialog(f, a, b) {
  await f.waitForSelector('#pass.on', { timeout: 8000 }); await sleep(150);
  await f.fill('#pass1', a); if (b != null) await f.fill('#pass2', b);
  await f.locator('#passOk').click();
  await f.waitForFunction(() => !document.getElementById('pass').classList.contains('on'), null, { timeout: 10000 });
}
const dlg = f => f.evaluate(() => ({ on: document.getElementById('pass').classList.contains('on'), title: document.getElementById('passTitle').textContent, text: document.getElementById('passText').textContent }));
try {
  // 1. iPhone: set a passcode, lock, reopen the Journal tab -> Unlock dialog
  const ph = await L.newDevice({ name: 'Eli phone', profiles: ['eli'] });
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: DEMO, as: ph });
  let f = await d.openApp('f260'); await ready(f);
  out.ua.iphone = await f.evaluate(() => navigator.userAgent);
  await f.locator('#tabJournal').click(); await sleep(400);
  out.iphoneSetDialog = await dlg(f);
  await passDialog(f, PASS, PASS); await sleep(500);
  await f.locator('#tabPlan').click(); await sleep(200);
  await f.evaluate(() => document.getElementById('settingsBtn').scrollIntoView({ block: 'center' }));
  await f.locator('#settingsBtn').click(); await sleep(300);
  await f.locator('#lockBtn').click(); await sleep(400);
  await f.locator('#settingsBtn').click(); await sleep(200);
  await f.evaluate(() => window.scrollTo(0, 0));
  await f.locator('#tabJournal').click(); await sleep(500);
  out.iphoneUnlockDialog = await dlg(f);
  out.iphoneShot = await shot(d.page, P + '-iphone.png');
  // unlock works on the phone
  await passDialog(f, PASS); await sleep(400);
  out.iphoneUnlocked = await f.evaluate(() => !document.getElementById('pass').classList.contains('on'));
  await sleep(2500); await d.hub();
  // 2. Is the vault device-bound? What the server holds for Eli's person scope
  const r = await rows(L, 'eli');
  const v = r['f260.journal.vault'];
  out.serverVault = v ? { present: true, v: v.v, hasPass: !!v.pass, hasData: Object.keys(v).filter(k => k !== 'pass') } : { present: false };
  // 3. Desktop (a different paired device) opens the same person's vault with the same passcode
  const pc = await L.newDevice({ name: 'Eli desktop', profiles: ['eli'] });
  const dk = await L.device({ device: 'desktop', profile: 'eli', installClock: DEMO, as: pc });
  f = await dk.openApp('f260'); await ready(f); await sleep(1500);
  out.ua.desktop = await f.evaluate(() => navigator.userAgent);
  await f.locator('#tabJournal').click(); await sleep(500);
  out.desktopDialog = await dlg(f);
  out.desktopShot = await shot(dk.page, P + '-desktop.png');
  try { await passDialog(f, PASS); out.desktopUnlockedWithPhonePasscode = true; }
  catch (e) { out.desktopUnlockedWithPhonePasscode = false; out.desktopErr = await f.evaluate(() => document.getElementById('passErr').textContent); }
  // 4. iPad: same copy (so the copy's "this device" claim is also wrong there: the vault is on the server)
  const ip = await L.device({ device: 'ipad-portrait', profile: 'eli', installClock: DEMO });
  f = await ip.openApp('f260'); await ready(f); await sleep(1500);
  await f.locator('#tabJournal').click(); await sleep(500);
  out.ipadDialog = await dlg(f);
  save(P + '.json', out);
  console.log(JSON.stringify(out, null, 1));
} catch (e) { console.error('FAILED', e); save(P + '.json', Object.assign(out, { error: String(e && e.stack || e) })); }
finally { await L.close(); }
