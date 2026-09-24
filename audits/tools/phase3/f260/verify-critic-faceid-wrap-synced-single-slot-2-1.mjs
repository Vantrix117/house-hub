// Skeptic #1 for "Face ID unlock is one synced slot" (Phase 3, F260). Independent re-run.
// Chromium, one CDP virtual platform authenticator (PRF) per device = two devices that do NOT share a passkey store.
// Checks: (1) the iPad's credential lives only in the iPad authenticator; (2) the phone shows "On." and "Use Face ID"
// from the synced vault row and the tap fails; (3) the phone cannot enable without "Turn off", which removes the wrap
// from the server row for every device; (4) after the phone enables, the server wrap is the phone's and the iPad fails.
//   node "audits/tools/phase3/f260/verify-critic-faceid-wrap-synced-single-slot-2-1.mjs"
// Throwaway passcode on the local demo database only.
import { local, sleep, save, rows, ready } from './_lib.mjs';

const PASS = '1357';
const N = 'verify-critic-faceid-wrap-synced-single-slot-2-1';
const out = {};
const L = await local({ variant: 'typical', clock: 'demo', engine: 'chromium' });
async function auth(d) {
  const cdp = await d.ctx.newCDPSession(d.page);
  await cdp.send('WebAuthn.enable', { enableUI: false });
  const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', { options: { protocol: 'ctap2', ctap2Version: 'ctap2_1', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, hasPrf: true, automaticPresenceSimulation: true } });
  return { creds: async () => (await cdp.send('WebAuthn.getCredentials', { authenticatorId })).credentials.map(c => c.credentialId) };
}
const b64std = s => s.replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '');
const sheet = f => f.evaluate(() => { if (!document.getElementById('sheet').classList.contains('on')) document.getElementById('settingsBtn').click(); });
const bio = f => f.evaluate(() => ({ hint: document.getElementById('bioHint').textContent, enableDisabled: document.getElementById('bioOn').disabled, offDisabled: document.getElementById('bioOff').disabled }));
const serverBio = async () => { const v = (await rows(L, 'eli'))['f260.journal.vault']; return v ? (v.bio ? v.bio.id : null) : 'no-vault'; };
async function openHear(f) { await f.evaluate(() => { const b = document.querySelector('[data-jr]'); b.scrollIntoView({ block: 'center' }); b.click(); }); await f.waitForSelector('#pass.on', { timeout: 8000 }); await sleep(200); }
async function tryFaceId(f) {
  await sheet(f); await f.evaluate(() => { const b = document.getElementById('lockBtn'); if (!b.disabled) b.click(); }); await sleep(300);
  await openHear(f);
  const r = { buttonShown: await f.evaluate(() => !document.getElementById('passBio').hidden) };
  if (r.buttonShown) { await f.locator('#passBio').click(); await sleep(3500); r.after = await f.evaluate(() => ({ dialogStillOpen: document.getElementById('pass').classList.contains('on'), err: document.getElementById('passErr').textContent })); }
  return r;
}
async function passUnlock(f) { if (!(await f.evaluate(() => document.getElementById('pass').classList.contains('on')))) await openHear(f); await f.fill('#pass1', PASS); await f.locator('#passOk').click(); await sleep(2500); }
try {
  const ph = await L.newDevice({ name: 'Eli phone', profiles: ['eli'] });
  const pad = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: ph });
  const aPad = await auth(pad), aPhone = await auth(phone);
  const g = await pad.openApp('f260'); await ready(g);
  // iPad: set passcode (first HEAR opens "set"), enable Face ID
  await openHear(g); await g.fill('#pass1', PASS); await g.fill('#pass2', PASS); await g.locator('#passOk').click(); await sleep(2500);
  await sheet(g); await sleep(200); await g.evaluate(() => document.getElementById('bioOn').click()); await sleep(3500);
  out.padAfterEnable = await bio(g);
  await g.evaluate(() => hub.flush && hub.flush()); await sleep(2000);
  const idPad = await serverBio();
  out.serverWrapAfterPadEnable = idPad;
  out.padAuthenticatorCreds = await aPad.creds(); out.phoneAuthenticatorCredsBefore = await aPhone.creds();
  out.padHoldsServerCred = out.padAuthenticatorCreds.map(b64std).includes(b64std(String(idPad)));
  out.padControl = await tryFaceId(g);
  if (out.padControl.after && out.padControl.after.dialogStillOpen) await g.locator('#passCancel').click();
  // phone: same person, other device
  const f = await phone.openApp('f260'); await ready(f); await sleep(1500);
  await sheet(f); await sleep(200); out.phoneSettingLocked = await bio(f);
  out.phoneFaceId = await tryFaceId(f);
  await passUnlock(f);
  await sheet(f); await sleep(200); out.phoneSettingUnlocked = await bio(f);
  await f.evaluate(() => document.getElementById('bioOff').click()); await sleep(2500);
  out.serverWrapAfterPhoneTurnOff = await serverBio();
  await f.evaluate(() => document.getElementById('bioOn').click()); await sleep(3500);
  out.phoneAfterEnable = await bio(f); await sleep(2000);
  const idPhone = await serverBio();
  out.serverWrapAfterPhoneEnable = idPhone; out.serverWrapChanged = idPhone !== idPad;
  out.phoneAuthenticatorCredsAfter = await aPhone.creds();
  // iPad again: pull, try its Face ID
  if (await g.evaluate(() => document.getElementById('pass').classList.contains('on'))) await g.locator('#passCancel').click();
  await g.evaluate(() => hub.pull()); await sleep(2000);
  out.padFaceIdAfterPhoneEnabled = await tryFaceId(g);
  out.padPasscodeStillWorks = await (async () => { if (out.padFaceIdAfterPhoneEnabled.after && out.padFaceIdAfterPhoneEnabled.after.dialogStillOpen) { await g.fill('#pass1', PASS); await g.locator('#passOk').click(); await sleep(2500); } return !(await g.evaluate(() => document.getElementById('pass').classList.contains('on'))); })();
  await pad.close(); await phone.close();
} catch (e) { out.error = String(e && e.stack || e).slice(0, 800); }
finally { await L.close(); }
for (const [k, v] of Object.entries(out)) console.log(k.padEnd(32), JSON.stringify(v).slice(0, 300));
console.log('evidence →', save(N + '.json', out));
