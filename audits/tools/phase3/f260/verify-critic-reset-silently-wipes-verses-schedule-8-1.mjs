// Skeptic #1 for "critic-reset-silently-wipes-verses-schedule-8": does F260 Settings → Reset progress… delete the
// Verses trainer's Leitner history (f260.recall), undisclosed, and what exactly is lost beyond what the dialog names?
//   node "audits/tools/phase3/f260/verify-critic-reset-silently-wipes-verses-schedule-8-1.mjs"
import { local, sleep, DEMO, save, shot, rows, put, ready } from './_lib.mjs';
const P = 'verify-critic-reset-silently-wipes-verses-schedule-8-1';
const out = {};
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const n = v => v && typeof v === 'object' ? Object.keys(v).length : (v === undefined ? '(absent)' : v);
async function verses(d) {
  const v = await d.openApp('verses'); await sleep(2500);
  const ui = await v.evaluate(() => ({ empty: !document.getElementById('empty').hidden, boxes: window.verses ? window.verses.boxCounts() : null, trained: window.verses ? window.verses.trained().length : null, text: document.body.innerText.replace(/\s+/g, ' ').trim().slice(0, 200) }));
  const s = (await rows(L, 'eli', 'verses'))['summary'];
  return { ui, summary: s && { due: s.due, boxes: s.boxes, total: s.total, streak: s.streak } };
}
try {
  await L.reset('typical');
  const r0 = await rows(L, 'eli');
  const rc0 = r0['f260.recall'] || {};
  const leit = Object.entries(rc0).filter(([, r]) => r && r.box).sort((a, b) => b[1].box - a[1].box);
  out.seed = { recall: n(rc0), leitnerRows: leit.length, boxHist: leit.reduce((h, [, r]) => (h[r.box] = (h[r.box] || 0) + 1, h), {}), mem: n(r0['f260.mem']), verses: n(r0['f260.verses']), done: n(r0['f260.done']) };
  const [probeId, probeRow] = leit[0] || [];
  out.probe = { id: probeId, row: probeRow };
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: DEMO + 2000 });
  out.versesBefore = await verses(d);
  const f = await d.openApp('f260'); await ready(f);
  await f.evaluate(() => document.getElementById('settingsBtn').scrollIntoView({ block: 'center' }));
  await f.locator('#settingsBtn').tap(); await sleep(300);
  out.resetButton = await f.evaluate(() => document.getElementById('resetBtn').textContent.trim());
  await f.locator('#resetBtn').tap(); await sleep(400);
  out.dialog = await f.evaluate(() => document.getElementById('confirm').innerText.replace(/\s+/g, ' ').trim());
  out.dialogMentionsVerses = /verses app|practice|review|box|trainer|schedule/i.test(out.dialog);
  await shot(d.page, P + '-dialog-iphone.png');
  await f.locator('#doConfirm').tap(); await sleep(2500);
  const r1 = await rows(L, 'eli');
  out.afterReset = { recall: n(r1['f260.recall']), mem: n(r1['f260.mem']), verses: n(r1['f260.verses']), done: n(r1['f260.done']), probeRow: (r1['f260.recall'] || {})[probeId] ?? '(gone)' };
  out.versesAfterReset = await verses(d);
  // Re-memorise the probe verse the way F260 does (its mem map gains the id), then ask Verses where it sits.
  // (done in F260 itself: after Reset the plan is back on week 1, where the probe verse lives; tap its circle)
  const f3 = await d.openApp('f260'); await ready(f3);
  out.probeVisible = await f3.evaluate(id => { const e = document.querySelector(`[data-mem="${id}"]`); if (e) e.scrollIntoView({ block: 'center' }); return !!e; }, probeId);
  await f3.locator(`[data-mem="${probeId}"] .mkm`).tap(); await sleep(2500);
  out.memAfterTap = (await rows(L, 'eli'))['f260.mem'];
  out.versesAfterRememorise = await verses(d);
  await shot(d.page, P + '-verses-after-rememorise-iphone.png');
  await d.close();
} finally { await L.close(); }
console.log('seed          :', JSON.stringify(out.seed));
console.log('probe         :', JSON.stringify(out.probe));
console.log('Verses before :', JSON.stringify(out.versesBefore));
console.log('dialog        :', out.dialog, '| mentions Verses/practice history:', out.dialogMentionsVerses);
console.log('after reset   :', JSON.stringify(out.afterReset));
console.log('Verses after  :', JSON.stringify(out.versesAfterReset));
console.log('mem after tap :', JSON.stringify(out.memAfterTap));
console.log('re-memorised  :', JSON.stringify(out.versesAfterRememorise));
console.log('evidence ->', save(P + '.json', out));
