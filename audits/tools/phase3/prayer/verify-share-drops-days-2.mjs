// Skeptic #2 for finding "share-drops-days": does Send to family list drop a weekly request's days so the copy never
// shows on anyone's family Today? Fresh local instance, typical seed, demo clock (Tue 22 Sep 2026), WebKit.
// Flow through the real UI: Eli shares p006 (weekly Sun/Tue/Thu) -> read the server row -> Eli's Family Today (DOM),
// Elizabeth's Family Today on another session (DOM), Ezra (kid, family list only) Today (DOM), and the copy's edit sheet.
// Run: node "audits/tools/phase3/prayer/verify-share-drops-days-2.mjs" -> audits/evidence/p3/prayer/verify-share-drops-days-2.json (+ PNGs)
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p3/prayer';
const res = {};
const log = (k, v) => { res[k] = v; console.log(k, '→', JSON.stringify(v)); };
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
async function app(profile, device = 'iphone-pwa', opts = {}) {
  const d = await L.device({ device, profile, ...opts });
  const f = await d.openApp('prayer', { wait: '#todayLine' });
  await f.waitForFunction(() => document.getElementById('todayLine').textContent.trim().length > 0, null, { timeout: 10000 }); await sleep(800);
  return { d, f };
}
const todayIds = f => f.evaluate(() => [...document.querySelectorAll('#todayList [data-open]')].map(b => b.dataset.open));
try {
  let copyId;
  {
    const { d, f } = await app('eli');
    log('eli-source', await f.evaluate(() => { const p = D.lists.personal.prayers.find(p => p.id === 'p006'); return { title: p.title, cadence: p.cadence, days: p.days, dow: DOW[new Date().getDay()], activeList: D.activeList }; }));
    if (await f.evaluate(() => D.activeList) !== 'personal') { await f.click('#listSwitch [data-list="personal"]'); await sleep(300); }
    log('eli-mine-today-has-p006', (await todayIds(f)).includes('p006'));
    await f.click('nav [data-go="all"]'); await f.fill('#f-search', 'Pastor Tim'); await sleep(300);
    await f.click('#allList [data-open="p006"]'); await sleep(400);
    await f.click('[data-share="p006"]'); await sleep(300);
    await f.click('#askSave'); await sleep(2500);   // save + flush
    const c = await f.evaluate(() => { const c = D.lists.shared.prayers.find(p => p.sharedFrom === 'p006'); return c && { id: c.id, cadence: c.cadence, days: c.days, status: c.status }; });
    copyId = c.id; log('eli-local-copy', c);
    await f.evaluate(() => { const s = document.querySelector('[data-shut]'); if (s) s.click(); });
    await sleep(300);
    await f.click('nav [data-go="today"]'); await sleep(500);
    await f.click('#listSwitch [data-list="shared"]'); await sleep(800);
    const ids = await todayIds(f);
    log('eli-family-today', { activeList: await f.evaluate(() => D.activeList), ids, copyShown: ids.includes(copyId), plan: await f.evaluate(() => { const S = D.lists.shared; const p = S.plans.find(x => x.id === S.activePlan) || S.plans[0]; return { id: p.id, mode: p.mode }; }) });
    await d.shot(`${OUT}/verify-share-drops-days-2-eli-family-today.png`);
    await d.close();
  }
  // what the server holds
  const raw = await L.apiAs('mom', '/api/data/prayer?scope=family');
  const rows = (raw.rows || raw.items || raw.data || raw);
  const txt = JSON.stringify(raw); const m = txt.includes(copyId);
  let row = null; try { const arr = Array.isArray(rows) ? rows : Object.values(rows); row = arr.find(r => r && (r.key === 'prayer:' + copyId || (r.value && r.value.id === copyId))); } catch {}
  log('server-row', row ? { key: row.key, cadence: row.value.cadence, days: row.value.days, sharedFrom: row.value.sharedFrom } : { foundInText: m });
  {
    const { d, f } = await app('mom', 'iphone-pwa');
    if (await f.evaluate(() => D.activeList) !== 'shared') { await f.click('#listSwitch [data-list="shared"]'); await sleep(600); }
    const ids = await todayIds(f);
    const inList = await f.evaluate(id => { const c = D.lists.shared.prayers.find(p => p.id === id); return c ? { cadence: c.cadence, days: c.days } : null; }, copyId);
    log('mom-family-today', { ids, copyShown: ids.includes(copyId), copyInHerData: inList, dow: await f.evaluate(() => DOW[new Date().getDay()]) });
    // the copy's edit sheet: which day chips are on?
    await f.click('nav [data-go="all"]'); await f.fill('#f-search', 'Pastor Tim'); await sleep(300);
    const allHas = await f.evaluate(id => !!document.querySelector(`#allList [data-open="${id}"]`), copyId);
    log('mom-family-all-lists-copy', allHas);
    if (allHas) {
      await f.click(`#allList [data-open="${copyId}"]`); await sleep(400);
      const sheet = await f.evaluate(() => document.getElementById('sheetInner').textContent.replace(/\s+/g, ' ').trim().slice(0, 300));
      const editBtn = await f.$('[data-edit]');
      let chips = null;
      if (editBtn) { await editBtn.click(); await sleep(400);
        chips = await f.evaluate(() => ({ cadPressed: [...document.querySelectorAll('[data-ecad][aria-pressed="true"]')].map(b => b.dataset.ecad), daysWrapHidden: document.getElementById('e-daysWrap')?.hidden, daysPressed: [...document.querySelectorAll('#eday .chip[aria-pressed="true"]')].map(b => b.dataset.eday) })); }
      log('mom-copy-sheet', { sheet, edit: chips });
      await d.shot(`${OUT}/verify-share-drops-days-2-mom-copy-edit.png`);
    }
    await d.close();
  }
  {
    const { d, f } = await app('ezra', 'ipad-portrait');
    const ids = await todayIds(f);
    const kid = await f.evaluate(id => ({ set: todaySet().map(p => p.id), copyInData: !!D.lists.shared.prayers.find(p => p.id === id),
      todayText: document.getElementById('todayList').textContent.replace(/\s+/g, ' ').slice(0, 400) }), copyId);
    log('ezra-today', { kid: await f.evaluate(() => !!hub.isKid), activeList: await f.evaluate(() => D.activeList), domIds: ids, todaySet: kid.set, copyInHisData: kid.copyInData,
      copyShown: kid.set.includes(copyId) || kid.todayText.includes('Pastor Tim and the church staff'), todayText: kid.todayText });
    await d.shot(`${OUT}/verify-share-drops-days-2-ezra-today.png`);
    await d.close();
  }
} catch (e) { console.error('ERROR', e); res.error = String(e && e.stack || e); }
finally {
  fs.writeFileSync(`${OUT}/verify-share-drops-days-2.json`, JSON.stringify(res, null, 2));
  await L.close();
}
