// Skeptic #1 for "beacon-height-controls-missing-when-nobody-sharing": independent reproduction, UI-only.
//  A. variant 'typical' (an ordinary day: only kid:<id> heights, no loc:* rows). Eli (adult admin) opens the park map on the
//     Kitchen iPad and taps Family. We record whether the Kids' beacons switches (input[data-kid]) and the Kids' heights
//     steppers (#kid-list .lv-kid) are present.
//  B. Same instance: Mom, on her own phone, opens the map, gets a GPS fix inside the park and switches on Share my spot
//     (the shipped switch). Eli's pane re-renders from the pull / onChange; we record the same counts again.
// Run: node "audits/tools/phase3/dollywood-live/verify-beacon-height-controls-missing-when-nobody-sharing-1.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep } from '../../lib/local.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const EV = path.resolve(HERE, '..', '..', '..', 'evidence', 'p3', 'dollywood-live'); fs.mkdirSync(EV, { recursive: true });
const PFX = 'verify-beacon-height-controls-missing-when-nobody-sharing-1';
const out = {};
const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
async function openMap(d) {
  const f = await d.openApp('dollywood-live');
  await f.waitForSelector('#lv-pill[data-state]', { timeout: 20000 });
  await f.waitForFunction(() => window.hub && hub.profile, null, { timeout: 10000 }).catch(() => {});
  await sleep(1500); return f;
}
const probe = f => f.evaluate(() => ({
  viewer: hub.profile && { id: hub.profile.id, kind: hub.profile.kind, canWrite: hub.canWrite },
  kidsInPeople: (hub.people ? hub.people() : []).filter(p => p.kind === 'kid').map(p => p.id),
  famRows: Object.keys(window.FAM || {}),
  famListText: (document.getElementById('fam-list') || {}).textContent,
  beaconSwitches: document.querySelectorAll('#fam-list input[data-kid]').length,
  beaconGroupHeader: !!document.querySelector('#fam-list .lv-grp'),
  heightSteppers: document.querySelectorAll('#kid-list .lv-kid').length,
  kidListHtmlLength: (document.getElementById('kid-list') || {}).innerHTML?.length,
  familyPaneVisible: !document.getElementById('lv-fam').hidden,
}));
try {
  const srv0 = await L.apiAs('eli', '/api/data/dollywood-live?scope=family');
  out.serverFamilyKeysAtStart = (srv0.body.items || []).filter(r => !r.deleted).map(r => r.key);
  // A
  const eli = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  await eli.goto('#home'); await sleep(1500);
  const ef = await openMap(eli);
  await ef.click('#lv-family'); await sleep(1500);
  out.A_ordinaryDay_eli = await probe(ef);
  await eli.page.screenshot({ path: path.join(EV, PFX + '-A-eli-family-ipad.png'), scale: 'css', animations: 'disabled', caret: 'hide' });
  // B: Mom shares from her own phone through the shipped switch
  const md = await L.newDevice({ name: 'Mom phone', profiles: ['mom'] });
  const mom = await L.device({ device: 'iphone-pwa', profile: 'mom', fixedTime: false, as: md });
  await mom.ctx.grantPermissions(['geolocation'], { origin: L.site });
  await mom.goto('#home'); await sleep(1500);
  const mf = await openMap(mom);
  const ll = await mf.evaluate(([x, y]) => ({ latitude: y / D.geo.my + D.geo.lat0, longitude: x / D.geo.mx + D.geo.lon0 }), [842, 858]);
  await mom.ctx.setGeolocation({ ...ll, accuracy: 6 });
  await mf.click('#lv-family'); await sleep(800);
  await mf.click('#lv-share'); await sleep(6000);
  const srv1 = await L.apiAs('eli', '/api/data/dollywood-live?scope=family');
  out.serverHasMomLocAfterShare = (srv1.body.items || []).some(r => r.key === 'loc:mom' && !r.deleted);
  // Eli's page: wait for the next pull (30 s interval or visibility); force a pull the way a return to the tab would
  await ef.evaluate(() => hub.sync && hub.sync.pull ? hub.sync.pull() : null).catch(() => {});
  let B = null;
  for (let i = 0; i < 45; i++) { B = await probe(ef); if (B.famRows.includes('mom')) break; await sleep(1000); }
  out.B_afterMomShares_eli = B;
  await eli.page.screenshot({ path: path.join(EV, PFX + '-B-eli-family-ipad.png'), scale: 'css', animations: 'disabled', caret: 'hide' });
  out.summary = {
    ordinaryDay: { beaconSwitches: out.A_ordinaryDay_eli.beaconSwitches, heightSteppers: out.A_ordinaryDay_eli.heightSteppers, emptyLine: /No one else is sharing/.test(out.A_ordinaryDay_eli.famListText) },
    afterSomeoneShares: { beaconSwitches: B.beaconSwitches, heightSteppers: B.heightSteppers },
  };
  console.log(JSON.stringify(out, null, 2));
} catch (e) { out.error = String(e && e.stack || e); console.error(e); }
finally {
  fs.writeFileSync(path.join(EV, PFX + '.json'), JSON.stringify(out, null, 2));
  console.log('wrote', path.join(EV, PFX + '.json'));
  await L.close();
}
