// Skeptic #2 for "critic-kid-beacon-off-republished-1": a parent switches a kid's beacon off while the kid's park map is
// open and moving. Does the kid's phone republish loc:<kid> after the parent's tombstone (apps/dollywood-live.html:1308
// vs publish() :1250-1253), and does the resurrected row stay once the kid's device has learned kidshare=false?
//  Trial A: Ezra walks (a fresh GPS fix every 1.5 s) through the switch-off.
//  Trial B (control): Ezra stands still (no new fixes after the switch-off) - the race needs a fix inside the window.
// Park seed, real clock, WebKit, local instance only. Run: node "audits/tools/phase3/dollywood-live/verify-critic-kid-beacon-off-republished-1-2.mjs"
import { local, sleep, save, shot, openMap, latLon } from './_lib.mjs';
const P = 'verify-critic-kid-beacon-off-republished-1-2';
const L = await local({ variant: 'park', clock: 'real', engine: 'webkit' });
const out = {};
const row = async key => { const r = await L.apiAs('mom', '/api/data/dollywood-live?scope=family'); const it = (r.body.items || []).find(x => x.key === key); if (!it) return { present: false }; const v = it.value; return v == null ? { tomb: true, u: it.updated_at } : { x: v.x, y: v.y, ageS: Math.round((Date.now() - v.t) / 1000), u: it.updated_at }; };
const kstate = f => f.evaluate(() => ({ kidshare: hub.get('kidshare:' + hub.profile.id, { scope: 'family' }) ?? null, viewOnly: VIEW_ONLY(), shareOn: shareOn(), watching: watchId != null, wakeLock: !!wakeLock, locBtnHidden: document.getElementById('loc-btn').hidden, pill: document.getElementById('lv-pill').dataset.state, sub: document.getElementById('loc-acc').textContent }));
async function setBeacon(mf, on) {
  await mf.evaluate(() => renderFam());
  const c = mf.locator('#fam-list input[data-kid="ezra"]');
  if ((await c.isChecked()) !== on) await c.click({ force: true });
}
try {
  const ed = await L.newDevice({ name: 'Ezra phone', profiles: ['ezra'] });
  const ezra = await L.device({ device: 'iphone-pwa', profile: 'ezra', fixedTime: false, as: ed });
  await ezra.ctx.grantPermissions(['geolocation'], { origin: L.site });
  await ezra.goto('#home'); await sleep(1500);
  const ef = await openMap(ezra, { settle: 500 });
  let pos = [847, 864];
  await ezra.ctx.setGeolocation({ ...(await latLon(ef, ...pos)), accuracy: 9 });
  await sleep(4000);
  out.ezraStart = await kstate(ef);

  const md = await L.newDevice({ name: 'Mom iPad', profiles: ['mom'] });
  const mom = await L.device({ device: 'ipad-portrait', profile: 'mom', fixedTime: false, as: md });
  await mom.goto('#home'); await sleep(1500);
  const mf = await openMap(mom, { settle: 2500 });
  await mf.click('#lv-family').catch(() => {}); await sleep(800);

  for (const trial of ['A_walking', 'B_still']) {
    const T = out[trial] = {};
    // make sure the beacon is on and Ezra's phone knows it, then (A) keep walking / (B) stop moving
    await setBeacon(mf, true); await sleep(1000);
    await ef.evaluate(() => hub.pull && hub.pull()).catch(() => {});
    for (let i = 0; i < 15 && !(await kstate(ef)).shareOn; i++) await sleep(1000);
    let walking = true;
    const walk = (async () => { while (walking) { pos = [pos[0] + 5, pos[1] + 3]; await ezra.ctx.setGeolocation({ ...(await latLon(ef, ...pos)), accuracy: 9 }).catch(() => {}); await sleep(1500); } })();
    await sleep(6000);
    if (trial === 'B_still') { walking = false; await walk; await sleep(3000); }
    T.ezraBefore = await kstate(ef);
    T.locBefore = await row('loc:ezra');
    const t0 = Date.now();
    await setBeacon(mf, false);
    T.momSwitchAfterClick = await mf.locator('#fam-list input[data-kid="ezra"]').isChecked();
    const poll = []; let learnedAt = null;
    for (let i = 0; i < 40; i++) {
      await sleep(1000);
      const s = Math.round((Date.now() - t0) / 1000), r = await row('loc:ezra'), k = await kstate(ef);
      if (learnedAt == null && k.kidshare === false) learnedAt = s;
      poll.push({ s, loc: r.tomb ? 'TOMBSTONE' : r.present === false ? 'absent' : `${r.x},${r.y} age ${r.ageS}s`, ezraKidshare: k.kidshare });
      if (learnedAt != null && s > learnedAt + 8) break;
    }
    T.poll = poll; T.ezraLearnedKidshareFalseAtS = learnedAt;
    T.firstRepublishS = (poll.find(p => p.loc !== 'TOMBSTONE' && p.loc !== 'absent') || {}).s ?? null;
    if (trial === 'A_walking') { walking = false; await walk; }
    await sleep(5000);
    T.locFinal = await row('loc:ezra');
    T.ezraAfter = await kstate(ef);
    await mf.evaluate(() => hub.pull && hub.pull()).catch(() => {}); await sleep(2500);
    T.momMap = await mf.evaluate(() => { renderFam(); drawFam(); const b = document.querySelector('.lv-item[data-f="ezra"]'); return { inFAM: !!FAM.ezra, markerDrawn: !!document.querySelector('.famk[data-pick="f:ezra"]'), familyRow: b ? b.innerText.replace(/\s+/g, ' ').trim() : null, beaconSwitch: (document.querySelector('#fam-list input[data-kid="ezra"]') || {}).checked ?? null }; });
    if (trial === 'A_walking') await shot(mom, `${P}-A-mom-family-ipad.png`);
  }
  // What Mom's Home "At the park" card lists (index.html:872-877) after trial A+B
  await mom.goto('#home'); await sleep(3000);
  out.momHomeAtPark = await mom.page.evaluate(() => { try { return hub.list('loc:', { app: 'dollywood-live', scope: 'family' }).filter(r => r.value && Date.now() - r.value.t < 4 * 3600e3).map(r => r.key); } catch (e) { return String(e); } });
  out.momHomeText = await mom.page.evaluate(() => (document.body.innerText.match(/[^\n]*park[^\n]*\n?[^\n]*\n?[^\n]*/i) || [''])[0].slice(0, 200));
} catch (e) { out.error = String(e && e.stack || e); }
finally {
  save(`${P}.json`, out);
  for (const t of ['A_walking', 'B_still']) if (out[t]) console.log(t, JSON.stringify({ firstRepublishS: out[t].firstRepublishS, learnedAt: out[t].ezraLearnedKidshareFalseAtS, locFinal: out[t].locFinal, ezraAfter: out[t].ezraAfter, momMap: out[t].momMap }));
  console.log('ezraStart', JSON.stringify(out.ezraStart), 'homeAtPark', JSON.stringify(out.momHomeAtPark), out.error || '');
  await L.close();
}
