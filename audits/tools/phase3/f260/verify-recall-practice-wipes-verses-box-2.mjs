// Skeptic #2 for "recall-practice-wipes-verses-box": does F260's practice dialog replace a verse's whole
// f260.recall entry, dropping the Verses trainer's Leitner fields (box/due/last/streak)?
// Independent of recall.mjs: iPhone instead of iPad, two other verses (12-1 rated "Not yet", 20-0 rated "Got it"),
// each reached by opening its week and tapping the memorized verse. Also a control: the verse's
// row in F260's in-memory map right before the tap (so a stale map, P2-SYNC-18, is ruled out as the cause).
//   node "audits/tools/phase3/f260/verify-recall-practice-wipes-verses-box-2.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep, DEMO } from '../../lib/local.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const EVID = path.join(ROOT, 'audits', 'evidence', 'p3', 'f260');
fs.mkdirSync(EVID, { recursive: true });
const PFX = 'verify-recall-practice-wipes-verses-box-2';

async function rows(L, pid, app) {
  const r = await L.apiAs(pid, `/api/data/${app}?scope=person`);
  const o = {}; for (const it of (r.body.items || [])) o[it.key] = it.value; return o;
}
async function put(L, pid, key, value) {
  const g = await L.apiAs(pid, `/api/data/f260?scope=person&key=__none__`);
  const r = await L.apiAs(pid, `/api/data/f260/${encodeURIComponent(key)}?scope=person`, { method: 'PUT', body: { value, updated_at: g.body.now } });
  if (r.status >= 300) throw new Error('put ' + key + ' ' + r.status);
}
async function versesView(d) {
  const v = await d.openApp('verses'); await sleep(2500);
  const text = await v.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').trim().slice(0, 200));
  const s = (await rows(L, 'eli', 'verses')).summary;
  return { summary: s && { due: s.due, boxes: s.boxes, total: s.total }, text };
}

const out = {};
const IDS = { a: '12-1', b: '20-0' };
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
try {
  const r0 = await rows(L, 'eli', 'f260');
  const lt = { s: 'got', t: DEMO - 5 * 86400000, box: 5, due: '2026-10-05', last: '2026-09-21', streak: 6 };
  const mem = { ...r0['f260.mem'], [IDS.a]: true, [IDS.b]: true };
  const verses = { ...r0['f260.verses'], [IDS.a]: 'Verse text A for the practice dialog.', [IDS.b]: 'Verse text B for the practice dialog.' };
  const recall = { ...r0['f260.recall'], [IDS.a]: { ...lt }, [IDS.b]: { ...lt, box: 3, due: '2026-09-26', streak: 2 } };
  await put(L, 'eli', 'f260.mem', mem); await put(L, 'eli', 'f260.verses', verses); await put(L, 'eli', 'f260.recall', recall);

  const d = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: DEMO + 1000 });
  out.versesBefore = await versesView(d);
  const srv0 = (await rows(L, 'eli', 'f260'))['f260.recall'];
  out.rowsBefore = { [IDS.a]: srv0[IDS.a], [IDS.b]: srv0[IDS.b] };

  const f = await d.openApp('f260');
  await f.waitForFunction(() => { const t = document.getElementById('todayTitle'); return t && t.textContent.trim(); }, null, { timeout: 15000 });
  await sleep(500);
  for (const [label, id, mark] of [['a', IDS.a, 'not'], ['b', IDS.b, 'got']]) {
    // control: what F260 holds in memory right before the rating (stale-map check)
    out['inMemoryBefore_' + label] = await f.evaluate(i => (typeof recall !== 'undefined' ? recall[i] : '(recall not reachable)'), id);
    // open the verse's week with F260's own week header if it is collapsed
    const w = +id.split('-')[0];
    if (!(await f.evaluate(w => document.getElementById('week-' + w).classList.contains('open'), w))) {
      await f.evaluate(w => document.querySelector(`[data-toggle="${w}"]`).scrollIntoView({ block: 'center' }), w);
      await f.locator(`[data-toggle="${w}"]`).tap(); await sleep(800);
    }
    await f.evaluate(i => document.querySelector(`[data-mem="${i}"]`).scrollIntoView({ block: 'center' }), id);
    const tgt = f.locator(`[data-mem="${id}"] .pr`);
    if (await tgt.count()) await tgt.tap(); else await f.locator(`[data-mem="${id}"]`).tap();
    await sleep(400);
    out['dialogOpen_' + label] = await f.evaluate(() => document.getElementById('practice').classList.contains('on'));
    await f.locator('[data-prreveal]').tap(); await sleep(200);
    if (label === 'b') await d.page.screenshot({ path: path.join(EVID, PFX + '-dialog-iphone.png'), scale: 'css', animations: 'disabled', caret: 'hide' });
    await f.locator(`[data-prmark="${mark}"]`).tap(); await sleep(1500);
  }
  const srv1 = (await rows(L, 'eli', 'f260'))['f260.recall'];
  out.rowsAfter = { [IDS.a]: srv1[IDS.a], [IDS.b]: srv1[IDS.b] };
  out.versesAfter = await versesView(d);
  await d.page.screenshot({ path: path.join(EVID, PFX + '-verses-after-iphone.png'), scale: 'css', animations: 'disabled', caret: 'hide' });
  await d.close();
} finally { await L.close(); }
fs.writeFileSync(path.join(EVID, PFX + '.json'), JSON.stringify(out, null, 1));
console.log('rows before     :', JSON.stringify(out.rowsBefore));
console.log('F260 in-memory  :', JSON.stringify(out.inMemoryBefore_a), JSON.stringify(out.inMemoryBefore_b));
console.log('dialog opened   :', out.dialogOpen_a, out.dialogOpen_b);
console.log('rows after      :', JSON.stringify(out.rowsAfter));
console.log('Verses before   :', JSON.stringify(out.versesBefore.summary));
console.log('Verses after    :', JSON.stringify(out.versesAfter.summary));
console.log('Verses text     :', out.versesAfter.text);
console.log('evidence ->', 'audits/evidence/p3/f260/' + PFX + '.json');
