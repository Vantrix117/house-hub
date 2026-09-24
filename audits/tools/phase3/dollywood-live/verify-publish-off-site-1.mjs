// Skeptic #1 for finding "publish-off-site": does a GPS fix far from Dollywood get published as loc:<id>, and does
// Home's "At the park" card then count that person as at the park?
// Clean scenario (independent of the investigator's park-variant rig): variant 'typical' = an ordinary day with NO loc rows,
// real clock. Eli (at home, 7+ mi from the park) switches Share my spot on through the Family pane switch and gets a good
// GPS fix (10 m). We then read the server row, Mom's Home, and Mom's park map (map marker + Family pane row).
// Run: node "audits/tools/phase3/dollywood-live/verify-publish-off-site-1.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep } from '../../lib/local.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const EV = path.resolve(HERE, '..', '..', '..', 'evidence', 'p3', 'dollywood-live');
fs.mkdirSync(EV, { recursive: true });
const PFX = 'verify-publish-off-site-1';
const shot = (d, n) => d.page.screenshot({ path: path.join(EV, `${PFX}-${n}.png`), scale: 'css', animations: 'disabled', caret: 'hide' });
const pill = f => f.evaluate(() => ({ state: document.getElementById('lv-pill').dataset.state, title: document.getElementById('loc-sec').textContent, sub: document.getElementById('loc-acc').textContent }));
const toLL = (f, x, y) => f.evaluate(([x, y]) => ({ latitude: y / D.geo.my + D.geo.lat0, longitude: x / D.geo.mx + D.geo.lon0 }), [x, y]);
async function openMap(d) {
  const f = await d.openApp('dollywood-live');
  await f.waitForSelector('#lv-pill[data-state]', { timeout: 15000 });
  await f.waitForFunction(() => window.hub && hub.profile, null, { timeout: 10000 }).catch(() => {});
  await sleep(1200); return f;
}
const out = {};
const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
try {
  // 0. baseline: no loc rows, Mom's Home has no park card
  const before = await L.apiAs('eli', '/api/data/dollywood-live?scope=family');
  out.O_locRowsBefore = (before.body.items || []).filter(r => /^loc:/.test(r.key)).map(r => r.key);
  const eli = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
  await eli.ctx.grantPermissions(['geolocation'], { origin: L.site });
  const posts = [];
  eli.page.on('request', r => { if (/\/api\/data/.test(r.url()) && r.method() !== 'GET') posts.push((r.postData() || '').slice(0, 300)); });
  await eli.goto('#home'); await sleep(1500);
  let f = await openMap(eli);
  // at home: ~9 km west, 10 km north of the map origin (same point as the investigator), 10 m accuracy = a good fix
  const HOME_XY = [-9000, 10000];
  await eli.ctx.setGeolocation({ ...(await toLL(f, ...HOME_XY)), accuracy: 10 });
  // switch Share my spot on the way a user does: open the Family pane's switch
  out.A_shareSwitch = await f.evaluate(() => { renderFam(); const c = document.getElementById('lv-share'); if (!c) return 'no switch'; c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); return { checked: c.checked, shareOn: shareOn() }; });
  // start GPS with the locate button (the ◎ FAB)
  await f.evaluate(() => { const b = document.getElementById('loc-btn'); b && b.click(); });
  await sleep(6000);
  out.B_eliPill = await pill(f);
  out.B_eliState = await f.evaluate(() => ({ me: me && { x: Math.round(me.x), y: Math.round(me.y), acc: me.acc, src: me.src, stale: !!me.stale }, onProperty: me ? onProperty([me.x, me.y]) : null, watchId, shareOn: shareOn() }));
  await sleep(3000); // let the write queue flush
  out.B_eliDataPosts = posts.filter(p => /loc:/.test(p));
  await shot(eli, 'eli-iphone-far');
  const srv = await L.apiAs('mom', '/api/data/dollywood-live?scope=family');
  const row = (srv.body.items || []).find(r => r.key === 'loc:eli');
  out.C_serverLocEli = row ? { x: row.value.x, y: row.value.y, acc: row.value.acc, ageS: Math.round((Date.now() - row.value.t) / 1000) } : null;
  // Mom's Home on the kitchen iPad
  const mom = await L.device({ device: 'ipad-portrait', profile: 'mom', fixedTime: false });
  await mom.goto('#home'); await sleep(4000);
  out.D_momHomeParkCard = await mom.page.evaluate(() => { const c = document.querySelector('.park-card'); return c ? c.innerText.replace(/\s+/g, ' ').slice(0, 300) : null; });
  out.D_momHomeSummaryBits = await mom.page.evaluate(() => (document.body.innerText.match(/\d+ at the park/) || [null])[0]);
  await shot(mom, 'mom-home-ipad');
  // Mom's park map: is Eli drawn on the map, and what does the Family pane say?
  const mf = await openMap(mom); await sleep(1500);
  out.E_momMap = await mf.evaluate(() => { loadFam(); renderFam(); const b = document.querySelector('#fam-list [data-f="eli"]'); return { famHasEli: !!FAM.eli, famRowText: b ? b.innerText.replace(/\s+/g, ' ') : null, markerNodesForEli: document.querySelectorAll('[data-f="eli"], [data-id="f:eli"]').length, famGroupChildren: G.fam ? G.fam.childElementCount : null }; });
} catch (e) { out.error = String(e && e.stack || e); }
finally {
  fs.writeFileSync(path.join(EV, `${PFX}.json`), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  await L.close();
}
