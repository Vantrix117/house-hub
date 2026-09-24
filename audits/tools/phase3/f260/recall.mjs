// F260 — the practice dialog and Reset vs the Verses trainer (both write f260.recall in the person's F260 scope).
// 1) Give a verse Leitner progress as Verses writes it (box 4, due next week), rate it "Got it" in F260's practice
//    dialog, and read the row and the Verses summary before/after.  2) Settings → Reset progress… → Reset: what happens
//    to f260.recall (the trainer's boxes) — the dialog text does not mention it.
//   node "audits/tools/phase3/f260/recall.mjs"
import { local, sleep, DEMO, save, shot, rows, put, ready } from './_lib.mjs';

const out = {};
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const ID = '38-0';
async function versesSummary(d) {
  const v = await d.openApp('verses'); await sleep(2500);
  const sum = (await rows(L, 'eli', 'verses'))['summary'];
  const text = await v.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').trim().slice(0, 240));
  return { summary: sum && { due: sum.due, boxes: sum.boxes, total: sum.total }, text };
}
try {
  await L.reset('typical');
  const r0 = await rows(L, 'eli');
  const mem = { ...r0['f260.mem'], [ID]: true };
  const verses = { ...r0['f260.verses'], [ID]: 'They devoted themselves to the apostles’ teaching and the fellowship, to the breaking of bread and the prayers.' };
  const recall = { ...r0['f260.recall'], [ID]: { s: 'got', t: DEMO - 7 * 86400000, box: 4, due: '2026-09-29', last: '2026-09-22', streak: 3 } };
  await put(L, 'eli', 'f260.mem', mem); await put(L, 'eli', 'f260.verses', verses); await put(L, 'eli', 'f260.recall', recall);
  const d = await L.device({ device: 'ipad-portrait', profile: 'eli', installClock: DEMO + 2000 });
  out.versesBefore = await versesSummary(d);
  out.rowBefore = (await rows(L, 'eli'))['f260.recall'][ID];
  // F260: tap the memorized verse (not its circle) → practice → Reveal → Got it
  const f = await d.openApp('f260'); await ready(f);
  await f.evaluate(id => { const el = document.querySelector(`[data-mem="${id}"] .pr`) || document.querySelector(`[data-mem="${id}"]`); el.scrollIntoView({ block: 'center' }); }, ID);
  await f.locator(`[data-mem="${ID}"] .pr`).tap(); await sleep(400);
  const dlg = await f.evaluate(() => document.getElementById('practice').classList.contains('on'));
  await f.locator('[data-prreveal]').tap(); await sleep(200);
  await shot(d.page, 'recall-practice-reveal-ipad.png');
  await f.locator('[data-prmark="got"]').tap(); await sleep(1500);
  out.practiceOpened = dlg;
  out.rowAfterF260GotIt = (await rows(L, 'eli'))['f260.recall'][ID];
  out.versesAfter = await versesSummary(d);
  await shot(d.page, 'recall-verses-after-ipad.png');
  // Reset progress… (Settings), then the recall row and Verses
  const f2 = await d.openApp('f260'); await ready(f2);
  const before = await rows(L, 'eli');
  await f2.evaluate(() => document.getElementById('settingsBtn').scrollIntoView({ block: 'center' }));
  await f2.locator('#settingsBtn').tap(); await sleep(300);
  await f2.locator('#resetBtn').tap(); await sleep(300);
  out.resetDialog = await f2.evaluate(() => document.getElementById('confirm').innerText.replace(/\s+/g, ' ').trim());
  await f2.locator('#doConfirm').tap(); await sleep(2000);
  const after = await rows(L, 'eli');
  const n = v => v && typeof v === 'object' ? Object.keys(v).length : v;
  out.reset = { before: { recall: n(before['f260.recall']), mem: n(before['f260.mem']), verses: n(before['f260.verses']), done: n(before['f260.done']) },
    after: { recall: n(after['f260.recall']) ?? '(deleted)', mem: n(after['f260.mem']) ?? '(deleted)', verses: n(after['f260.verses']), done: n(after['f260.done']) ?? '(deleted)' } };
  out.versesAfterReset = await versesSummary(d);
  await d.close();
} finally { await L.close(); }
console.log('Verses before :', JSON.stringify(out.versesBefore.summary), '| row', JSON.stringify(out.rowBefore));
console.log('F260 Got it   → row', JSON.stringify(out.rowAfterF260GotIt));
console.log('Verses after  :', JSON.stringify(out.versesAfter.summary));
console.log('Reset dialog  :', out.resetDialog);
console.log('Reset rows    :', JSON.stringify(out.reset));
console.log('Verses after reset:', JSON.stringify(out.versesAfterReset.summary), out.versesAfterReset.text.slice(0, 160));
console.log('evidence →', save('recall.json', out));
