// Skeptic #2 for "f260-practice-wipes-leitner". Independent of the investigator's script and seed row:
// 1. On an iPhone (PWA) as Eli, open Verses and rate the verse on the card "Got it" with real taps — Verses itself writes
//    the Leitner fields (apps/verses.html:294-297).
// 2. Open F260 on the same phone, tap that same memorised verse's practice button, Reveal, Got it (apps/f260.html:1915).
// 3. Print the server's f260.recall entry after each step and what Verses shows afterwards.
// Local rig only. Usage: node "audits/tools/phase3/verses/verify-f260-practice-wipes-leitner-2.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, DEMO, sleep } from '../../lib/local.mjs';
const EVID = path.resolve('audits/evidence/p3/verses'); fs.mkdirSync(EVID, { recursive: true });
const NAME = 'verify-f260-practice-wipes-leitner-2';
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const out = {};
const row = async () => { const r = await L.apiAs('eli', '/api/data/f260?scope=person'); const it = (r.body.items || []).find(i => i.key === 'f260.recall'); return it ? it.value : {}; };
const idle = async d => { for (let k = 0; k < 60; k++) { const h = await d.hub(); if (!Object.values(h.queue || {}).some(q => Object.keys(q).length)) return true; await sleep(250); } return false; };
const view = f => f.evaluate(() => { const q = s => document.querySelector(s); const vis = s => { const e = q(s); return !!e && !e.hidden; };
  return { who: q('#who').textContent.trim(), ref: vis('#trainer') ? q('#ref').textContent : null, boxchip: vis('#boxchip') ? q('#boxchip').textContent : null,
    due: vis('#stats') ? q('#st-due').textContent : null, queue: [...document.querySelectorAll('#queue-list li')].map(li => li.textContent.replace(/\s+/g, ' ').trim()),
    later: [...document.querySelectorAll('#later-list li')].map(li => li.textContent.replace(/\s+/g, ' ').trim()) }; });
try {
  const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: DEMO });
  const r0 = await row();
  // step 1: rate in Verses
  let v = await phone.openApp('verses'); await v.waitForSelector('#trainer:not([hidden])', { timeout: 15000 }); await sleep(400);
  out.versesStart = await view(v);
  await v.click('#show'); await v.waitForSelector('#act-rate:not([hidden])'); await v.click('#act-rate [data-rate="got"]'); await sleep(300);
  out.versesToast = await v.evaluate(() => [...document.querySelectorAll('.toast, [class*=toast]')].map(e => e.textContent.trim()).filter(Boolean).slice(-1));
  await idle(phone);
  const r1 = await row();
  const id = Object.keys(r1).find(k => JSON.stringify(r1[k]) !== JSON.stringify(r0[k]));
  out.id = id; out.entryBeforeVerses = r0[id] || null; out.entryAfterVerses = r1[id];
  out.versesAfterOwnRating = await view(v);
  // step 2: practise the same verse in F260
  const f = await phone.openApp('f260'); await f.waitForSelector('[data-toggle]', { timeout: 15000 }); await sleep(800);
  const w = id.split('-')[0];
  if (!(await f.locator(`[data-mem="${id}"] .pr`).first().isVisible().catch(() => false))) await f.click(`[data-toggle="${w}"]`);
  await sleep(500);
  await f.locator(`[data-mem="${id}"] .pr`).first().scrollIntoViewIfNeeded(); await f.click(`[data-mem="${id}"] .pr`);
  await f.waitForSelector('#practice.on', { timeout: 5000 });
  out.f260NeededPaste = !!(await f.locator('#prPaste').count());
  if (out.f260NeededPaste) { await f.fill('#prPaste', 'Verse text for the practice test.'); await f.click('[data-prsave]'); await sleep(300); }
  await f.click('[data-prreveal]'); await sleep(200);
  out.f260Buttons = await f.$$eval('#prBody button', bs => bs.map(b => b.textContent.trim()));
  await f.click('[data-prmark="got"]'); await sleep(500);
  out.f260Toast = await f.evaluate(() => [...document.querySelectorAll('.toasts *, .toast')].map(e => e.textContent.trim()).filter(Boolean).slice(-1));
  await idle(phone);
  const r2 = await row();
  out.entryAfterF260 = r2[id];
  out.otherEntriesUnchanged = Object.keys(r1).filter(k => k !== id).every(k => JSON.stringify(r1[k]) === JSON.stringify(r2[k]));
  // step 3: Verses again
  v = await phone.openApp('verses'); await v.waitForSelector('#trainer:not([hidden]), #done:not([hidden])', { timeout: 15000 }); await sleep(500);
  out.versesAfterF260 = await view(v);
  await phone.page.screenshot({ path: path.join(EVID, NAME + '-iphone.png'), scale: 'css', animations: 'disabled', caret: 'hide' });
  out.shot = 'audits/evidence/p3/verses/' + NAME + '-iphone.png';
  console.log(JSON.stringify(out, null, 1));
  fs.writeFileSync(path.join(EVID, NAME + '.json'), JSON.stringify(out, null, 1));
} finally { await L.close(); }
