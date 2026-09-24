// Completeness critic (Phase 3, F260): Face ID / Touch ID (WebAuthn PRF) with two devices of one person.
// The biometric wrap `bio` is one slot inside the synced vault row (apps/f260.html:1083, 902), but the credential is a
// platform credential bound to the device that made it (apps/f260.html:1076). Expected problems:
//   - the other device shows "Use Face ID" and "On." for a credential it does not hold (apps/f260.html:1141, 1786);
//   - enabling it on the second device overwrites the first device's wrap, so the first device's Face ID stops working.
// Chromium with a CDP virtual platform authenticator (PRF) per device; the rig cannot do real Face ID.
//   node "audits/tools/phase3/f260/critic-faceid.mjs"
// Throwaway passcode on the local demo database only.
import { local, sleep, save, rows, ready } from './_lib.mjs';

const PASS = '2468';
const out = {};
const L = await local({ variant: 'typical', clock: 'demo', engine: 'chromium' });
async function authenticator(d) {
  const cdp = await d.ctx.newCDPSession(d.page);
  await cdp.send('WebAuthn.enable', { enableUI: false });
  const r = await cdp.send('WebAuthn.addVirtualAuthenticator', { options: { protocol: 'ctap2', ctap2Version: 'ctap2_1', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, hasPrf: true, automaticPresenceSimulation: true } });
  return { cdp, id: r.authenticatorId };
}
const hear = async (f, id) => { await f.evaluate(i => document.querySelector(`[data-jr="${i}"]`).scrollIntoView({ block: 'center' }), id); await f.locator(`[data-jr="${id}"]`).click(); };
const openSheet = f => f.evaluate(() => { const s = document.getElementById('sheet'); if (!s.classList.contains('on')) document.getElementById('settingsBtn').click(); });
const bioState = f => f.evaluate(() => ({ hint: document.getElementById('bioHint').textContent, onDisabled: document.getElementById('bioOn').disabled, offDisabled: document.getElementById('bioOff').disabled }));
async function lockAndTryFaceId(f, label) {
  await openSheet(f); await sleep(200); await f.evaluate(() => document.getElementById('lockBtn').click()); await sleep(300);
  await hear(f, '38-0'); await f.waitForSelector('#pass.on', { timeout: 8000 }); await sleep(200);
  const r = { host: await f.evaluate(() => location.hostname), faceIdButtonShown: await f.evaluate(() => !document.getElementById('passBio').hidden) };
  if (r.faceIdButtonShown) { await f.locator('#passBio').click(); await sleep(4000); r.after = await f.evaluate(() => ({ dialogOn: document.getElementById('pass').classList.contains('on'), err: document.getElementById('passErr').textContent })); }
  out[label] = r;
}
try {
  const ph = await L.newDevice({ name: 'Eli phone', profiles: ['eli'] });
  const pad = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: ph });
  const aPad = await authenticator(pad), aPhone = await authenticator(phone);
  // iPad: set a passcode, then enable Face ID
  const g = await pad.openApp('f260'); await ready(g);
  await hear(g, '38-0'); await g.waitForSelector('#pass.on'); await g.fill('#pass1', PASS); await g.fill('#pass2', PASS); await g.locator('#passOk').click();
  await g.waitForSelector('#jf-38-0-a', { timeout: 10000 }); await g.locator('#jf-38-0-a').fill('iPad entry'); await g.locator('#jf-38-0-h').click(); await sleep(800);
  await openSheet(g); await sleep(200);
  out.padBeforeEnable = await bioState(g);
  await g.evaluate(() => document.getElementById('bioOn').click()); await sleep(4000);
  out.padAfterEnable = await bioState(g);
  await g.evaluate(() => hub.pull()); await sleep(1500);
  const v1 = (await rows(L, 'eli'))['f260.journal.vault'];
  out.serverBio1 = v1 && v1.bio ? { id: v1.bio.id.slice(0, 12) } : null;
  // control: Face ID works on the iPad that enabled it
  await lockAndTryFaceId(g, 'padFaceIdControl');
  if (out.padFaceIdControl.after && out.padFaceIdControl.after.dialogOn) { await g.locator('#passCancel').click(); }
  // phone: open, unlock with the passcode, look at the Face ID setting and the unlock dialog
  const f = await phone.openApp('f260'); await ready(f);
  await openSheet(f); await sleep(200);
  out.phoneLockedSetting = await bioState(f);
  await openSheet(f);
  await lockAndTryFaceId(f, 'phoneFaceIdFromIpadWrap');
  // unlock with the passcode, then enable Face ID on the phone as well
  await f.evaluate(() => { if (!document.getElementById('pass').classList.contains('on')) return; document.getElementById('passErr').textContent = ''; });
  if (!(await f.evaluate(() => document.getElementById('pass').classList.contains('on')))) { await hear(f, '38-0'); await f.waitForSelector('#pass.on'); }
  await f.fill('#pass1', PASS); await f.locator('#passOk').click(); await sleep(3000);
  await openSheet(f); await sleep(200);
  out.phoneUnlockedSetting = await bioState(f);
  await f.evaluate(() => { const b = document.getElementById('bioOff'); if (!b.disabled) b.click(); }); await sleep(500);   // "Turn off" first, as the only way to re-enable here
  out.phoneAfterTurnOff = await bioState(f);
  await f.evaluate(() => document.getElementById('bioOn').click()); await sleep(4000);
  out.phoneAfterEnable = await bioState(f);
  await sleep(1500);
  const v2 = (await rows(L, 'eli'))['f260.journal.vault'];
  out.serverBio2 = v2 && v2.bio ? { id: v2.bio.id.slice(0, 12), sameAsIpad: out.serverBio1 && v2.bio.id.slice(0, 12) === out.serverBio1.id } : null;
  // iPad again: pull, then try its own Face ID
  if (await g.evaluate(() => document.getElementById('pass').classList.contains('on'))) { await g.fill('#pass1', PASS); await g.locator('#passOk').click(); await sleep(3000); }
  await g.evaluate(() => hub.pull()); await sleep(2000);
  await lockAndTryFaceId(g, 'padFaceIdAfterPhoneEnabled');
  await pad.close(); await phone.close();
} catch (e) { out.error = String(e && e.stack || e).slice(0, 800); }
finally { await L.close(); }
for (const [k, v] of Object.entries(out)) console.log(k.padEnd(28), JSON.stringify(v).slice(0, 400));
console.log('evidence →', save('critic-faceid.json', out));
