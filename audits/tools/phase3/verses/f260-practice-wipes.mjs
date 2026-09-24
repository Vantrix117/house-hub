// F260's practice dialog replaces a verse's whole f260.recall entry with {s, t} (apps/f260.html:1915), dropping the
// trainer's Leitner fields (box, due, last, streak) that Verses writes (apps/verses.html:296). Verses then treats the
// row as box 1, never reviewed, due now (apps/verses.html:219, 229, 350).
// Flow, all real taps on an iPad as Eli (typical seed): F260 → open week 1 → tap the memorised verse Genesis 1:27 (1-0,
// box 5, due 2 Oct, streak 4) → paste its text if none is on file → Reveal → Got it. Then open Verses.
import { local, DEMO, sleep } from '../../lib/local.mjs';
import { openVerses, state, serverRow, save, shot, waitQueueEmpty } from './_lib.mjs';
const L = await local({ variant: 'typical', clock: 'demo' });
const out = {};
const ID = process.argv[2] || '1-0';
try {
  out.before = (await serverRow(L, 'eli', 'f260', 'f260.recall')).value[ID];
  const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', installClock: DEMO });
  // Verses first: the verse is not due, it sits in Coming up
  let v = await openVerses(ipad);
  const s1 = await state(v); out.versesBefore = { who: s1.who, due: s1.stats && s1.stats.due, queue: s1.queue };
  const f = await ipad.openApp('f260');
  await f.waitForSelector('[data-toggle]', { timeout: 15000 });
  await sleep(800);
  const w = ID.split('-')[0];
  if (!(await f.locator(`[data-mem="${ID}"]`).first().isVisible().catch(() => false))) await f.click(`[data-toggle="${w}"]`);
  await sleep(500);
  await f.click(`[data-mem="${ID}"] .pr`);
  await f.waitForSelector('#practice.on', { timeout: 5000 });
  out.dialogHadText = !(await f.locator('#prPaste').count());
  if (!out.dialogHadText) { await f.fill('#prPaste', 'So God created man in his own image, in the image of God created he him; male and female created he them.'); await f.click('[data-prsave]'); await sleep(300); }
  await f.click('[data-prreveal]'); await sleep(200);
  await f.click('[data-prmark="got"]'); await sleep(400);
  out.f260Toast = await f.evaluate(() => [...document.querySelectorAll('.toast, .toasts *')].map(e => e.textContent).filter(Boolean).slice(-2));
  await waitQueueEmpty(ipad);
  out.after = (await serverRow(L, 'eli', 'f260', 'f260.recall')).value[ID];
  v = await openVerses(ipad);
  const s2 = await state(v); out.versesAfter = { who: s2.who, due: s2.stats && s2.stats.due, ref: s2.ref, boxchip: s2.boxchip, queue: s2.queue };
  out.shot = await shot(ipad.page, `f260-practice-wipes-${ID}-ipad.png`);
  await v.evaluate(() => document.getElementById('queue').scrollIntoView());
  await sleep(200);
  out.shot2 = await shot(ipad.page, `f260-practice-wipes-${ID}-queue-ipad.png`);
  console.log(JSON.stringify(out, null, 1));
  save(`f260-practice-wipes-${ID}.json`, out);
} finally { await L.close(); }
