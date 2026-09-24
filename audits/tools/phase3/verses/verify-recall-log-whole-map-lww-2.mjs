// Skeptic #2 for finding "recall-log-whole-map-lww" (Verses): does a stale device's rating erase another device's rating
// of a DIFFERENT verse, and the day's review count? Own minimal script; fresh local instance per run.
//   RUN  : phone (Eli) rates 2 due verses Got it and flushes; the iPad (Eli, opened before, not yet pulled) rates its card Almost.
//   CTRL : same, but the iPad calls hub.pull() (what the 30 s poll does) before it rates.
// After each: the server's f260.recall entries and verses.log[today], then the phone pulls (as its 30 s poll would) and we read it.
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, DEMO } from '../../lib/local.mjs';
const EV = path.resolve('audits/evidence/p3/verses');
const IDS = ['33-0', '36-1', '37-0'];
const pick = rc => Object.fromEntries(IDS.map(id => [id, rc && rc[id] ? `${rc[id].s} box${rc[id].box} due ${rc[id].due} last ${rc[id].last}` : null]));
async function row(L, app, key) { const r = await L.apiAs('eli', `/api/data/${app}?scope=person`); const it = (r.body.items || []).find(i => i.key === key); return it && it.value; }
async function open(d) { const f = await d.openApp('verses'); await f.waitForSelector('#trainer:not([hidden]), #done:not([hidden])', { timeout: 15000 }); await sleep(400); return f; }
async function rate(f, kind) { await f.click('#show'); await f.waitForSelector('#act-rate:not([hidden])', { timeout: 4000 }); await f.click(`#act-rate [data-rate="${kind}"]`); await sleep(200); }
async function drained(d) { for (let i = 0; i < 60; i++) { const h = await d.hub(); if (!Object.values(h.queue).some(q => Object.keys(q).length)) return true; await sleep(250); } return false; }
const who = f => f.evaluate(() => document.querySelector('#who').textContent.trim());
const card = f => f.evaluate(() => document.querySelector('#trainer').hidden ? null : document.querySelector('#ref').textContent);
async function run(mode) {
  const L = await local({ variant: 'typical', clock: 'demo' });
  const o = { mode };
  try {
    o.serverBefore = pick(await row(L, 'f260', 'f260.recall'));
    o.logBefore = (await row(L, 'verses', 'log') || {})['2026-09-22'] ?? null;
    const ph = await L.newDevice({ name: 'Eli phone', profiles: ['eli'] });
    const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: DEMO, as: ph });
    const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', installClock: DEMO });
    const pf = await open(phone), vf = await open(ipad);
    o.phoneCards = [];
    for (let i = 0; i < 2; i++) { o.phoneCards.push(await card(pf)); await rate(pf, 'got'); }
    o.phoneFlushed = await drained(phone);
    o.serverAfterPhone = pick(await row(L, 'f260', 'f260.recall'));
    o.logAfterPhone = (await row(L, 'verses', 'log') || {})['2026-09-22'];
    if (mode === 'CTRL') { await vf.evaluate(() => hub.pull()); await sleep(300); }
    o.ipadCard = await card(vf);
    o.ipadWhoBeforeRating = await who(vf);
    await rate(vf, 'almost');
    o.ipadFlushed = await drained(ipad);
    o.serverFinal = pick(await row(L, 'f260', 'f260.recall'));
    o.logFinal = (await row(L, 'verses', 'log') || {})['2026-09-22'];
    o.phoneWhoBeforePull = await who(pf);
    await pf.evaluate(() => hub.pull()); await sleep(600);
    o.phoneWhoAfterPull = await who(pf); o.phoneCardAfterPull = await card(pf);
    o.phoneSync = (await phone.hub()).sync;
    o.phoneErrorLogs = phone.logs.filter(l => /error|could not/i.test(l)).slice(0, 5);
    o.lostPhoneRatings = Object.keys(o.serverAfterPhone).filter(id => o.serverAfterPhone[id] !== o.serverBefore[id] && o.serverFinal[id] === o.serverBefore[id]);
    await phone.page.screenshot({ path: path.join(EV, `verify-recall-log-whole-map-lww-2-${mode}-phone-after-pull.png`), scale: 'css' });
  } finally { await L.close(); }
  return o;
}
const out = { RUN: await run('RUN'), CTRL: await run('CTRL') };
console.log(JSON.stringify(out, null, 1));
fs.writeFileSync(path.join(EV, 'verify-recall-log-whole-map-lww-2.json'), JSON.stringify(out, null, 1));
