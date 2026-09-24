// Skeptic #1 check of "f260-practice-wipes-leitner": does rating a verse in F260's practice dialog (apps/f260.html:1915)
// drop the Leitner fields Verses writes (apps/verses.html:296)? Independent of the investigator's _lib.mjs.
// Device: iPhone PWA (the investigator used the iPad), profile Eli, typical seed, demo clock. Verse id argv[2] (default 1-0).
// Run: node "audits/tools/phase3/verses/verify-f260-practice-wipes-leitner-1.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, DEMO, sleep } from '../../lib/local.mjs';
const EV = path.resolve('audits/evidence/p3/verses'); fs.mkdirSync(EV, { recursive: true });
const ID = process.argv[2] || '1-0';
const L = await local({ variant: 'typical', clock: 'demo' });
const out = { id: ID };
const row = async () => { const r = await L.apiAs('eli', '/api/data/f260?scope=person'); const it = (r.body.items || []).find(i => i.key === 'f260.recall'); return it ? it.value : null; };
const versesView = async d => {
  const f = await d.openApp('verses');
  await f.waitForSelector('#trainer:not([hidden]), #done:not([hidden]), #empty:not([hidden])', { timeout: 15000 });
  await sleep(400);
  return { f, s: await f.evaluate(id => {
    const q = s => document.querySelector(s);
    return { who: q('#who').textContent.trim(), ref: q('#trainer').hidden ? null : q('#ref').textContent, boxchip: q('#boxchip').hidden ? null : q('#boxchip').textContent,
      due: q('#st-due') && q('#st-due').textContent,
      queue: [...document.querySelectorAll('#queue-list li')].map(li => li.textContent.replace(/\s+/g, ' ').trim()),
      later: [...document.querySelectorAll('#later-list li')].map(li => li.textContent.replace(/\s+/g, ' ').trim()) };
  }, ID) };
};
try {
  const before = await row(); out.rowBefore = before && before[ID]; out.otherKeysBefore = before ? Object.keys(before).length : 0;
  const ph = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: DEMO });
  let v = await versesView(ph); out.versesBefore = v.s;
  const f = await ph.openApp('f260');
  await f.waitForSelector('[data-toggle]', { timeout: 15000 }); await sleep(800);
  const w = ID.split('-')[0];
  if (!(await f.locator(`[data-mem="${ID}"]`).first().isVisible().catch(() => false))) await f.click(`[data-toggle="${w}"]`);
  await sleep(500);
  out.chipBefore = await f.locator(`[data-mem="${ID}"] .pr`).first().textContent();
  await f.click(`[data-mem="${ID}"] .pr`);   // tap the memorised verse's "practice" chip (apps/f260.html:1365, 1651)
  await f.waitForSelector('#practice.on', { timeout: 5000 });
  out.neededPaste = (await f.locator('#prPaste').count()) > 0;
  if (out.neededPaste) { await f.fill('#prPaste', 'So God created man in his own image.'); await f.click('[data-prsave]'); await sleep(300); }
  await f.click('[data-prreveal]'); await sleep(200);
  await f.click('[data-prmark="got"]'); await sleep(300);
  out.toasts = await f.evaluate(() => [...document.querySelectorAll('.toast, .toasts *, #toast')].map(e => e.textContent.trim()).filter(Boolean));
  const until = Date.now() + 15000; while (Date.now() < until) { const h = await ph.hub(); if (!Object.values(h.queue || {}).some(q => Object.keys(q).length)) break; await sleep(250); }
  await sleep(500);
  const after = await row(); out.rowAfter = after && after[ID]; out.otherKeysAfter = after ? Object.keys(after).length : 0;
  v = await versesView(ph); out.versesAfter = v.s;
  await ph.page.screenshot({ path: path.join(EV, `verify-f260-practice-wipes-leitner-1-${ID}-iphone.png`), scale: 'css', animations: 'disabled' });
  out.lostFields = out.rowBefore ? Object.keys(out.rowBefore).filter(k => !(out.rowAfter && k in out.rowAfter)) : null;
  console.log(JSON.stringify(out, null, 1));
  fs.writeFileSync(path.join(EV, `verify-f260-practice-wipes-leitner-1-${ID}.json`), JSON.stringify(out, null, 1));
} finally { await L.close(); }
