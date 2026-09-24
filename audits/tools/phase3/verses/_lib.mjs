// Shared helpers for the Phase 3 Verses experiments (apps/verses.html). Read-only use of the rig (audits/tools/lib/local.mjs).
import fs from 'node:fs';
import path from 'node:path';
import { sleep } from '../../lib/local.mjs';
export const EVID = path.resolve('audits/evidence/p3/verses');
fs.mkdirSync(EVID, { recursive: true });
export const save = (name, obj) => { const f = path.join(EVID, name); fs.writeFileSync(f, JSON.stringify(obj, null, 1)); return 'audits/evidence/p3/verses/' + name; };
export const shot = async (page, name, opts = {}) => { const f = path.join(EVID, name); await page.screenshot({ path: f, scale: 'css', animations: 'disabled', caret: 'hide', ...opts }); return 'audits/evidence/p3/verses/' + name; };
const VIEW = '#trainer:not([hidden]), #done:not([hidden]), #empty:not([hidden])';
/** Open Verses in the shell viewer and wait for render() to have picked a view (apps/verses.html:318-320). */
export async function openVerses(d, { wait = true } = {}) {
  const f = await d.openApp('verses');
  if (wait) await f.waitForSelector(VIEW, { timeout: 12000 }).catch(() => {});
  await sleep(300);
  return f;
}
/** What the app shows right now. */
export const state = f => f.evaluate(() => {
  const q = s => document.querySelector(s); const vis = s => { const e = q(s); return !!e && !e.hidden; };
  return {
    who: q('#who') && q('#who').textContent.trim(), trainer: vis('#trainer'), done: vis('#done'), empty: vis('#empty'),
    ref: vis('#trainer') ? q('#ref').textContent : null, kick: q('#kick').textContent, boxchip: vis('#boxchip') ? q('#boxchip').textContent : null,
    hint: q('#hint').textContent, doneBig: vis('#done') ? q('#done-big').textContent : null, doneSub: vis('#done') ? q('#done-sub').textContent : null,
    stats: vis('#stats') ? { due: q('#st-due').textContent, streak: q('#st-streak').textContent, total: q('#st-total').textContent, sub: q('#stats-sub').textContent } : null,
    queue: vis('#queue') ? [...document.querySelectorAll('#queue-list li')].map(li => li.textContent.replace(/\s+/g, ' ').trim()) : null,
    later: vis('#queue') ? [...document.querySelectorAll('#later-list li')].slice(0, 4).map(li => li.textContent.replace(/\s+/g, ' ').trim()) : null,
    again: vis('#again') ? q('#again').textContent.trim() : null,
    today: (() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); })(),
  };
});
/** Tap Show, then a rating button (real clicks). kind: got | almost | not */
export async function rate(f, kind) {
  await f.click('#show');
  await f.waitForSelector('#act-rate:not([hidden])', { timeout: 3000 });
  await f.click(`#act-rate [data-rate="${kind}"]`);
  await sleep(150);
}
/** One row from the local server as a profile. */
export async function serverRow(L, profile, app, key, scope = 'person') {
  const r = await L.apiAs(profile, `/api/data/${app}?scope=${scope}`);
  const it = (r.body.items || []).find(i => i.key === key);
  return it ? { value: it.value, updated_at: it.updated_at } : null;
}
export const waitQueueEmpty = async (d, ms = 15000) => { const until = Date.now() + ms; while (Date.now() < until) { const h = await d.hub(); if (!Object.values(h.queue).some(q => Object.keys(q).length)) return true; await sleep(250); } return false; };
/** Advance an installed Playwright clock by ms in <12 s slices, letting real requests finish between slices
 *  (hub.request aborts after 12 s of page time, apps/hub.js:132). Same approach as the Phase 2 STAB helper, own copy. */
export async function advance(d, ms, slice = 10000) {
  if (!d._inflight) { d._inflight = { n: 0 }; d.page.on('request', () => d._inflight.n++); d.page.on('requestfinished', () => d._inflight.n--); d.page.on('requestfailed', () => d._inflight.n--); }
  for (let t = 0; t < ms; t += slice) {
    await d.ctx.clock.runFor(Math.min(slice, ms - t));
    const until = Date.now() + 3000; let quiet = 0; await sleep(20);
    while (Date.now() < until) { if (d._inflight.n <= 0) { if (++quiet >= 6) break; } else quiet = 0; await sleep(12); }
  }
}
