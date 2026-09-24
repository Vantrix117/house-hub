// Skeptic #1 for finding "recall-log-whole-map-lww" (Verses). Independent minimal reproduction.
// Claim: apps/verses.html:294-298 writes the whole f260.recall map and the whole verses.log map on every rating, and the
// server keeps the newer row (worker/src/data.js:60-64), so a device that has not pulled erases the other device's ratings.
// Scenario A (online): phone rates two verses Got it and flushes; the iPad (opened at the same time, no pull since) rates
//   its current card Almost. Scenario B (offline): phone offline rates every due verse; iPad rates one; phone reconnects.
// Prints the server rows before/after, the log count, and what each device shows after an explicit hub.pull().
// Run: node "audits/tools/phase3/verses/verify-recall-log-whole-map-lww-1.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, DEMO, sleep } from '../../lib/local.mjs';

const EVID = path.resolve('audits/evidence/p3/verses');
fs.mkdirSync(EVID, { recursive: true });
const TODAY = '2026-09-22';

const row = async (L, app, key) => {
  const r = await L.apiAs('eli', `/api/data/${app}?scope=person`);
  const it = (r.body.items || []).find(i => i.key === key);
  return it ? { value: it.value, updated_at: it.updated_at } : null;
};
const slim = rc => Object.fromEntries(Object.entries(rc || {}).filter(([, v]) => v && v.last).map(([k, v]) => [k, `${v.s}/box${v.box}/due${v.due}/last${v.last}`]));
const openV = async d => { const f = await d.openApp('verses'); await f.waitForSelector('#trainer:not([hidden]), #done:not([hidden])', { timeout: 15000 }); await sleep(400); return f; };
const rateUI = async (f, kind) => {
  const id = await f.evaluate(() => window.verses.current());
  await f.click('#show'); await f.waitForSelector('#act-rate:not([hidden])', { timeout: 4000 });
  await f.click(`#act-rate [data-rate="${kind}"]`); await sleep(200);
  return id;
};
const drained = async (d, ms = 15000) => { const end = Date.now() + ms; while (Date.now() < end) { const h = await d.hub(); if (!Object.values(h.queue).some(q => q && Object.keys(q).length)) return true; await sleep(250); } return false; };
const view = f => f.evaluate(() => ({ who: document.querySelector('#who').textContent.trim(), card: window.verses.current(), due: window.verses.dueIds(), log: (hub.get('log') || {})['2026-09-22'] }));

async function scenario(mode) {
  const L = await local({ variant: 'typical', clock: 'demo' });
  const o = { mode };
  try {
    o.serverBefore = slim((await row(L, 'f260', 'f260.recall')).value);
    o.logBefore = ((await row(L, 'verses', 'log')) || { value: {} }).value[TODAY] ?? null;
    const ph = await L.newDevice({ name: 'Eli phone', profiles: ['eli'] });
    const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: DEMO, as: ph });
    const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', installClock: DEMO });
    const pf = await openV(phone); const vf = await openV(ipad);
    o.phoneDueAtOpen = await pf.evaluate(() => window.verses.dueIds());
    o.ipadDueAtOpen = await vf.evaluate(() => window.verses.dueIds());
    if (mode === 'B') await phone.setOffline(true);
    o.phoneRated = [];
    const n = mode === 'B' ? o.phoneDueAtOpen.length : 2;
    for (let i = 0; i < n; i++) o.phoneRated.push(await rateUI(pf, 'got'));
    if (mode === 'A') o.phoneFlushed = await drained(phone);
    o.phoneView = await view(pf);
    o.serverAfterPhone = slim((await row(L, 'f260', 'f260.recall')).value);
    o.logAfterPhone = ((await row(L, 'verses', 'log')) || { value: {} }).value[TODAY] ?? null;
    // proof the iPad has not seen the phone's ratings yet
    o.ipadCacheBeforeRating = await vf.evaluate(() => { const rc = hub.get('f260.recall', { app: 'f260', scope: 'person' }) || {}; return Object.fromEntries(Object.entries(rc).filter(([, v]) => v && v.last).map(([k, v]) => [k, v.s + '/box' + v.box + '/last' + v.last])); });
    o.ipadRated = await rateUI(vf, 'almost');
    o.ipadFlushed = await drained(ipad);
    if (mode === 'B') { await phone.setOffline(false); o.phoneFlushedAfterReconnect = await drained(phone); await sleep(1500); }
    o.serverFinal = slim((await row(L, 'f260', 'f260.recall')).value);
    o.logFinal = ((await row(L, 'verses', 'log')) || { value: {} }).value[TODAY] ?? null;
    await pf.evaluate(() => hub.pull()); await vf.evaluate(() => hub.pull()); await sleep(800);
    o.phoneAfterPull = await view(pf); o.ipadAfterPull = await view(vf);
    o.phoneErrorLogs = phone.logs.filter(l => /error/i.test(l)).slice(0, 5);
    o.lostPhoneRatings = o.phoneRated.filter(id => !(o.serverFinal[id] || '').startsWith('got/') || !(o.serverFinal[id] || '').endsWith('last' + TODAY));
    const shotPath = path.join(EVID, `verify-recall-log-whole-map-lww-1-${mode}-phone-after-pull.png`);
    await phone.page.screenshot({ path: shotPath, scale: 'css', animations: 'disabled' });
    o.shot = 'audits/evidence/p3/verses/' + path.basename(shotPath);
  } finally { await L.close(); }
  return o;
}

const out = { A: await scenario('A'), B: await scenario('B') };
fs.writeFileSync(path.join(EVID, 'verify-recall-log-whole-map-lww-1.json'), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
