// Skeptic #1 for finding "recall-practice-wipes-verses-box": does rating a verse in F260's practice dialog erase the
// Leitner fields (box/due/last/streak) the Verses trainer keeps in the same f260.recall row?
// Independent of recall.mjs: no API writes of recall rows. Uses only the seeded (typical) household data and the
// shipped UI. Path A: a seeded box>=2 verse, opened by tapping the memorized verse in F260's week list. Path B: a verse
// Verses itself just rated "Got it" in the Verses UI (box 1 -> 2), then rated in F260. Path C: the "Practice again" chip
// (rows with s:'not'), then Verses' summary / due list before and after.
//   node "audits/tools/phase3/f260/verify-recall-practice-wipes-verses-box-1.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep, DEMO } from '../../lib/local.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const EVID = path.join(ROOT, 'audits', 'evidence', 'p3', 'f260');
fs.mkdirSync(EVID, { recursive: true });
const P = 'verify-recall-practice-wipes-verses-box-1';
const rel = f => path.relative(ROOT, f).replace(/\\/g, '/');

const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const out = { steps: [] };
const log = (...a) => { const s = a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' '); out.steps.push(s); console.log(s); };
async function rowsOf(pid, app) { const r = await L.apiAs(pid, `/api/data/${app}?scope=person`); const o = {}; for (const it of (r.body.items || [])) o[it.key] = it.value; return o; }
const recallRow = async id => (await rowsOf('eli', 'f260'))['f260.recall']?.[id];
const summary = async () => { const s = (await rowsOf('eli', 'verses'))['summary']; return s && { due: s.due, boxes: s.boxes, total: s.total }; };

async function f260Ready(f) { await f.waitForFunction(() => { const t = document.getElementById('todayTitle'); return t && t.textContent.trim().length > 0; }, null, { timeout: 15000 }); await sleep(400); }
async function practiseInF260(d, id, via, kind = 'got', shotName) {
  const f = await d.openApp('f260'); await f260Ready(f);
  if (via === 'chip') {
    const has = await f.evaluate(id => !!document.querySelector(`[data-practice="${id}"]`), id);
    if (!has) return { opened: false, reason: 'no chip' };
    await f.evaluate(id => document.querySelector(`[data-practice="${id}"]`).scrollIntoView({ block: 'center' }), id);
    await f.locator(`[data-practice="${id}"]`).first().tap();
  } else {
    // open the verse's week so its memory-verse line is rendered, then tap the verse text (not the circle)
    const w = +id.split('-')[0];
    const isOpen = await f.evaluate(w => { const s = document.getElementById('week-' + w); return s ? s.classList.contains('open') : null; }, w);
    if (isOpen === false) { await f.evaluate(w => document.querySelector(`[data-toggle="${w}"]`).scrollIntoView({ block: 'center' }), w); await f.locator(`[data-toggle="${w}"]`).tap(); await sleep(700); }
    const sel = `#week-${w} [data-mem="${id}"]`;
    const n = await f.locator(sel).count(); log('  week', w, 'was open', isOpen, 'mem spans', n);
    if (!n) return { opened: false, reason: 'verse not rendered' };
    await f.evaluate(s => document.querySelector(s).scrollIntoView({ block: 'center' }), sel); await sleep(200);
    // tap the verse reference text, not the .mkm circle (which toggles memorised)
    const box = await f.evaluate(s => { const el = document.querySelector(s); const mk = el.querySelector('.mkm'); const r = el.getBoundingClientRect(), m = mk ? mk.getBoundingClientRect() : null; return { html: el.innerHTML.slice(0, 300), r: [r.x, r.y, r.width, r.height], mk: m && [m.x, m.y, m.width, m.height] }; }, sel);
    log('  verse element', box);
    const tgt = await f.locator(`${sel} :not(.mkm):not(.mkm *)`).count();
    await (tgt ? f.locator(`${sel} :not(.mkm):not(.mkm *)`).last() : f.locator(sel)).tap();
  }
  await sleep(400);
  const opened = await f.evaluate(() => document.getElementById('practice').classList.contains('on'));
  if (!opened) return { opened };
  const pasteNeeded = await f.locator('#prPaste').count();
  if (pasteNeeded) return { opened, reason: 'no verse text (paste box)' };
  await f.locator('[data-prreveal]').tap(); await sleep(250);
  if (shotName) await d.page.screenshot({ path: path.join(EVID, shotName), scale: 'css', animations: 'disabled' });
  await f.locator(`[data-prmark="${kind}"]`).tap(); await sleep(1800);
  const toastF = await f.evaluate(() => { const t = document.getElementById('toast'); return t ? t.textContent.trim() : null; });
  return { opened, toast: toastF };
}

try {
  const d = await L.device({ device: 'ipad-portrait', profile: 'eli', installClock: DEMO + 2000 });
  const r0 = await rowsOf('eli', 'f260');
  const rc0 = r0['f260.recall'] || {}, mem0 = r0['f260.mem'] || {}, txt0 = r0['f260.verses'] || {};
  // Path A candidate: memorised, has text, box >= 3, s 'got'
  const A = Object.keys(rc0).filter(id => mem0[id] && txt0[id] && rc0[id].box >= 3 && rc0[id].s === 'got').sort((a, b) => rc0[b].box - rc0[a].box)[0];
  const C = Object.keys(rc0).find(id => mem0[id] && txt0[id] && rc0[id].s === 'not');
  log('seeded recall rows:', Object.keys(rc0).length, '| path A id', A, rc0[A], '| path C id', C, rc0[C]);
  out.summary0 = await summary(); log('Verses summary (seed):', out.summary0);

  // ── Path B first: rate the Verses card "Got it" in the Verses UI ──
  const v = await d.openApp('verses'); await sleep(2500);
  const Bcard = await v.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 200));
  await v.locator('#show').tap(); await sleep(300);
  const beforeB = await rowsOf('eli', 'f260');
  await v.locator('[data-rate="got"]').tap(); await sleep(1800);
  const afterB = await rowsOf('eli', 'f260');
  const B = Object.keys(afterB['f260.recall']).find(id => JSON.stringify(afterB['f260.recall'][id]) !== JSON.stringify((beforeB['f260.recall'] || {})[id]));
  out.B = { id: B, card: Bcard, rowBefore: (beforeB['f260.recall'] || {})[B], rowAfterVersesGot: afterB['f260.recall'][B] };
  log('B: Verses UI "Got it" on', B, '→', out.B.rowAfterVersesGot, '(was', out.B.rowBefore, ')');
  out.summaryB1 = await summary(); log('Verses summary after Verses rating:', out.summaryB1);

  // ── Path A: seeded box>=3 verse, rate "Got it" in F260 by tapping the memorised verse ──
  out.A = { id: A, rowBefore: await recallRow(A) };
  out.A.ui = await practiseInF260(d, A, 'verse', 'got', P + '-f260-reveal-ipad.png');
  out.A.rowAfter = await recallRow(A);
  log('A: F260 "Got it" on', A, out.A.ui, '\n   before', out.A.rowBefore, '\n   after ', out.A.rowAfter);
  out.summaryA = await summary(); log('Verses summary (not yet re-opened) :', out.summaryA);

  // ── Path B continued: the verse Verses just moved to box 2, now rated in F260 ──
  if (B) {
    out.B.ui = await practiseInF260(d, B, 'verse', 'got');
    out.B.rowAfterF260Got = await recallRow(B);
    log('B: F260 "Got it" on', B, out.B.ui, '→', out.B.rowAfterF260Got);
  }
  // ── Path C: "Practice again" chip (s:'not' row), F260 "Got it" ──
  if (C) {
    out.C = { id: C, rowBefore: await recallRow(C) };
    out.C.ui = await practiseInF260(d, C, 'chip', 'got');
    out.C.rowAfter = await recallRow(C);
    log('C: chip → F260 "Got it" on', C, out.C.ui, '\n   before', out.C.rowBefore, '\n   after ', out.C.rowAfter);
  }
  // Other rows untouched? (whole-object write)
  const rcEnd = (await rowsOf('eli', 'f260'))['f260.recall'];
  const changed = Object.keys(rcEnd).filter(id => JSON.stringify(rcEnd[id]) !== JSON.stringify((afterB['f260.recall'] || {})[id]));
  out.changedIdsSinceB = changed; log('recall ids changed after Path B Verses rating:', changed);

  // ── Verses re-opened: how does it see A now? ──
  const v2 = await d.openApp('verses'); await sleep(2800);
  out.summaryEnd = await summary(); log('Verses summary after reopen:', out.summaryEnd);
  out.versesText = await v2.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').trim().slice(0, 300));
  log('Verses screen:', out.versesText.slice(0, 200));
  await d.page.screenshot({ path: path.join(EVID, P + '-verses-after-ipad.png'), scale: 'css', animations: 'disabled' });
  await d.close();
} finally { await L.close(); }
const f = path.join(EVID, P + '.json'); fs.writeFileSync(f, JSON.stringify(out, null, 1)); console.log('evidence →', rel(f));
