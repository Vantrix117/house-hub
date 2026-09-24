// Skeptic #2 (intent/context lens) for finding critic-faceid-wrap-synced-single-slot-2:
// "Face ID unlock is one synced slot: another device shows a Face ID button that cannot work, and enabling it there
//  breaks the first device."  apps/f260.html:897 (vault not in LOCAL), 1060 bioEnabled, 1072-1084 enableBio,
//  1091 disableBio, 1097 backup strips bio, 1141 passBio shown, 1784-1788 bioHint.
// Independent minimal repro. Chromium + one CDP virtual platform authenticator (PRF) per device (the rig cannot do real
// Face ID). Extra step the investigator did not run: model a *synced* passkey (iCloud Keychain / Google Password
// Manager) by copying the iPad's credential into the phone's authenticator, to see whether the claim holds when the
// passkey provider syncs. Throwaway passcode on the local demo database only.
//   node "audits/tools/phase3/f260/verify-critic-faceid-wrap-synced-single-slot-2-2.mjs"
import { local, sleep, save, rows, ready } from './_lib.mjs';

const PASS = '1357';
const out = {};
const L = await local({ variant: 'typical', clock: 'demo', engine: 'chromium' });
async function authn(d) {
  const cdp = await d.ctx.newCDPSession(d.page);
  await cdp.send('WebAuthn.enable', { enableUI: false });
  const r = await cdp.send('WebAuthn.addVirtualAuthenticator', { options: { protocol: 'ctap2', ctap2Version: 'ctap2_1', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, hasPrf: true, automaticPresenceSimulation: true } });
  return { cdp, id: r.authenticatorId };
}
const openHear = async (f, id = '38-0') => { await f.evaluate(i => document.querySelector(`[data-jr="${i}"]`).scrollIntoView({ block: 'center' }), id); await f.locator(`[data-jr="${id}"]`).click(); };
const sheetOn = f => f.evaluate(() => { if (!document.getElementById('sheet').classList.contains('on')) document.getElementById('settingsBtn').click(); });
const bio = f => f.evaluate(() => ({ hint: document.getElementById('bioHint').textContent, enableDisabled: document.getElementById('bioOn').disabled, offDisabled: document.getElementById('bioOff').disabled }));
const dlg = f => f.evaluate(() => ({ open: document.getElementById('pass').classList.contains('on'), faceIdShown: !document.getElementById('passBio').hidden, err: document.getElementById('passErr').textContent }));
async function lockThenFaceId(f) {
  await sheetOn(f); await sleep(200);
  await f.evaluate(() => { const b = document.getElementById('lockBtn'); if (!b.disabled) b.click(); }); await sleep(300);
  if (!(await dlg(f)).open) { await openHear(f); await f.waitForSelector('#pass.on', { timeout: 8000 }); }
  await sleep(200);
  const before = await dlg(f);
  if (before.faceIdShown) { await f.locator('#passBio').click(); await sleep(3500); }
  return { before, after: await dlg(f) };
}
async function unlockWithPass(f) {
  if (!(await dlg(f)).open) { await openHear(f); await f.waitForSelector('#pass.on', { timeout: 8000 }); }
  await f.fill('#pass1', PASS); await f.locator('#passOk').click(); await sleep(2500);
}
const serverBioId = async () => { const v = (await rows(L, 'eli'))['f260.journal.vault']; return v && v.bio ? v.bio.id.slice(0, 16) : null; };
try {
  const ph = await L.newDevice({ name: 'Eli phone (verify)', profiles: ['eli'] });
  const pad = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: ph });
  const aPad = await authn(pad), aPhone = await authn(phone);

  // 1. iPad: passcode + enable Face ID
  const g = await pad.openApp('f260'); await ready(g);
  await openHear(g); await g.waitForSelector('#pass.on'); await g.fill('#pass1', PASS); await g.fill('#pass2', PASS); await g.locator('#passOk').click();
  await g.waitForSelector('#jf-38-0-a', { timeout: 10000 }); await g.locator('#jf-38-0-a').fill('verify entry'); await g.locator('#jf-38-0-h').click(); await sleep(800);
  await sheetOn(g); await sleep(200);
  await g.evaluate(() => document.getElementById('bioOn').click()); await sleep(3500);
  out.s1_padAfterEnable = await bio(g);
  await g.evaluate(() => hub.pull()); await sleep(1500);
  out.s1_serverBioId = await serverBioId();
  out.s1_padCredCount = (await aPad.cdp.send('WebAuthn.getCredentials', { authenticatorId: aPad.id })).credentials.length;
  out.s2_padControl = await lockThenFaceId(g);

  // 2. Phone (no credential of its own): setting + unlock dialog
  const f = await phone.openApp('f260'); await ready(f);
  await sheetOn(f); await sleep(200);
  out.s3_phoneSettingLocked = await bio(f);
  out.s3_phoneCredCount = (await aPhone.cdp.send('WebAuthn.getCredentials', { authenticatorId: aPhone.id })).credentials.length;
  out.s4_phoneFaceIdNoCred = await lockThenFaceId(f);

  // 2b. Model a synced passkey: copy the iPad credential (private key, id, rpId, userHandle) into the phone authenticator.
  const pc = (await aPad.cdp.send('WebAuthn.getCredentials', { authenticatorId: aPad.id })).credentials[0];
  try {
    await aPhone.cdp.send('WebAuthn.addCredential', { authenticatorId: aPhone.id, credential: { credentialId: pc.credentialId, isResidentCredential: pc.isResidentCredential, rpId: pc.rpId, privateKey: pc.privateKey, userHandle: pc.userHandle, signCount: pc.signCount } });
    if ((await dlg(f)).open) await f.evaluate(() => { document.getElementById('passErr').textContent = ''; });
    await f.locator('#passBio').click(); await sleep(3500);
    out.s4b_phoneFaceIdCopiedCred = { after: await dlg(f), note: 'CDP cannot export the per-credential PRF/hmac-secret, so this copy is not a faithful model of a synced passkey' };
  } catch (e) { out.s4b_phoneFaceIdCopiedCred = { error: String(e.message || e).slice(0, 300) }; }
  await aPhone.cdp.send('WebAuthn.clearCredentials', { authenticatorId: aPhone.id });

  // 3. Phone: unlock with passcode, look at the only path to enable here
  if (!(await dlg(f)).open) { /* unlocked by copied cred? lock again */ await sheetOn(f); await f.evaluate(() => document.getElementById('lockBtn').click()); await sleep(300); }
  if ((await dlg(f)).open) { await f.fill('#pass1', PASS); await f.locator('#passOk').click(); await sleep(2500); } else await unlockWithPass(f);
  await sheetOn(f); await sleep(200);
  out.s5_phoneSettingUnlocked = await bio(f);
  await f.evaluate(() => document.getElementById('bioOff').click()); await sleep(1500);
  out.s6_phoneAfterTurnOff = await bio(f);
  out.s6_serverBioIdAfterTurnOff = await serverBioId();
  await g.evaluate(() => hub.pull()); await sleep(1500);
  out.s6_padDialogAfterPhoneTurnOff = await g.evaluate(() => ({ faceIdShown: !document.getElementById('passBio').hidden }));
  await f.evaluate(() => document.getElementById('bioOn').click()); await sleep(3500);
  out.s7_phoneAfterEnable = await bio(f);
  await sleep(1500);
  out.s7_serverBioId = await serverBioId();
  out.s7_replacedIpadWrap = out.s7_serverBioId !== out.s1_serverBioId;

  // 4. iPad again: its own Face ID after the phone enabled
  if ((await dlg(g)).open) { await g.fill('#pass1', PASS); await g.locator('#passOk').click(); await sleep(2500); }
  await g.evaluate(() => hub.pull()); await sleep(1500);
  out.s8_padFaceIdAfterPhoneEnabled = await lockThenFaceId(g);
  await pad.close(); await phone.close();
} catch (e) { out.error = String(e && e.stack || e).slice(0, 800); }
finally { await L.close(); }
for (const [k, v] of Object.entries(out)) console.log(k.padEnd(34), JSON.stringify(v).slice(0, 420));
console.log('evidence ->', save('verify-critic-faceid-wrap-synced-single-slot-2-2.json', out));
