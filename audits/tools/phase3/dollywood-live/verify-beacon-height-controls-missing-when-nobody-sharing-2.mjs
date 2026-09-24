// Skeptic #2: does the Family pane lose the Kids' beacons switches and Kids' heights steppers when nobody else is sharing?
// A. typical variant (ordinary day), Eli on the Kitchen iPad: count family loc rows, open Family, count controls.
// B. Eli shares his own spot (own loc row is excluded from FAM): do the controls appear?
// C. Mom writes a loc: row through the API (as a phone would): after a pull, do the controls appear?
// Run: node "audits/tools/phase3/dollywood-live/verify-beacon-height-controls-missing-when-nobody-sharing-2.mjs"
import { local, sleep, save, shot, openMap } from './_lib.mjs';
const P = 'verify-beacon-height-controls-missing-when-nobody-sharing-2';
const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
const out = {};
const pane = f => f.evaluate(() => ({
  famRows: Object.keys(window.FAM || {}).length,
  empty: (document.querySelector('#fam-list .lv-empty') || {}).textContent || null,
  groups: [...document.querySelectorAll('#fam-list .lv-grp, #kid-list .lv-grp')].map(g => g.textContent.trim()),
  beaconSwitches: document.querySelectorAll('#fam-list input[data-kid]').length,
  heightSteppers: document.querySelectorAll('#kid-list .lv-kid button').length,
  kidListHtmlLen: (document.getElementById('kid-list') || {}).innerHTML?.length ?? null,
  kids: (hub.people ? hub.people() : []).filter(p => p.kind === 'kid').map(p => p.id),
  profile: hub.profile && { id: hub.profile.id, kind: hub.profile.kind }, canWrite: hub.canWrite,
}));
try {
  const rows0 = (await L.apiAs('eli', '/api/data/dollywood-live?scope=family')).body.items || [];
  out.familyRowsBefore = rows0.map(r => r.key);
  const d = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  await d.goto('#home'); await sleep(1000);
  const f = await openMap(d, { settle: 2000 });
  await f.click('#lv-family'); await sleep(1200);
  out.A_ordinaryDay = await pane(f);
  await shot(d, P + '-A-ipad.png');
  // B. Eli switches Share on (no GPS fix, so nothing publishes; even if it did, his own row is skipped at :1254)
  await f.evaluate(() => { const c = document.getElementById('lv-share'); if (c) { c.checked = true; c.dispatchEvent(new Event('change')); } });
  await sleep(1200);
  out.B_afterOwnShareOn = await pane(f);
  // C. Mom's phone publishes a loc row
  const put = await L.apiAs('mom', '/api/data/dollywood-live/loc:mom?scope=family', { method: 'PUT', body: { value: { x: 600, y: 700, t: Date.now(), name: 'Mom', emoji: '🌻', color: '#B5543C', acc: 8 }, updated_at: Date.now() } }).catch(e => ({ err: String(e) }));
  out.C_put = { status: put.status, body: JSON.stringify(put.body || put.err).slice(0, 200) };
  await f.evaluate(() => hub.pull()).catch(() => {});
  await sleep(2500);
  await f.evaluate(() => { try { loadFam() } catch (e) {} }); await sleep(800);
  out.C_afterMomShares = await pane(f);
  await shot(d, P + '-C-ipad.png');
  await d.close();
} catch (e) { out.error = String(e && e.stack || e); }
finally { await L.close(); }
save(P + '.json', out);
console.log(JSON.stringify(out, null, 2));
