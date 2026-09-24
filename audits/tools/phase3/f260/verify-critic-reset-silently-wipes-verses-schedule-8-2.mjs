// Skeptic 2 for critic-reset-silently-wipes-verses-schedule-8: does F260 "Reset progress…" delete the Verses
// trainer's Leitner schedule (f260.recall) without the dialog saying so, and what exactly is lost beyond what the
// dialog discloses ("memorized verse")? Isolates the recall loss from the (disclosed) f260.mem loss by re-marking the
// same verses memorised after the reset and reading Verses' boxes/due again. Local instance only.
//   node "audits/tools/phase3/f260/verify-critic-reset-silently-wipes-verses-schedule-8-2.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep, DEMO } from '../../lib/local.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const EVID = path.join(ROOT, 'audits', 'evidence', 'p3', 'f260');
const P = 'verify-critic-reset-silently-wipes-verses-schedule-8-2';
fs.mkdirSync(EVID, { recursive: true });

const rows = async (L, pid, app = 'f260') => { const r = await L.apiAs(pid, `/api/data/${app}?scope=person`); const o = {}; for (const it of (r.body.items || [])) o[it.key] = it.value; return o; };
const put = async (L, pid, key, value, app = 'f260') => { const g = await L.apiAs(pid, `/api/data/${app}?scope=person&key=__none__`); return L.apiAs(pid, `/api/data/${app}/${encodeURIComponent(key)}?scope=person`, { method: 'PUT', body: { value, updated_at: g.body.now } }); };
const n = v => v && typeof v === 'object' ? Object.keys(v).length : (v === undefined ? '(absent)' : v);

const out = {};
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
try {
  await L.reset('typical');
  // give three memorised verses real Leitner progress (as Verses writes it)
  const r0 = await rows(L, 'eli');
  const IDS = ['36-0', '37-1', '38-0'];
  const mem = { ...r0['f260.mem'] }; IDS.forEach(id => mem[id] = true);
  const recall = { ...r0['f260.recall'] };
  recall['36-0'] = { s: 'got', t: DEMO - 3 * 86400000, box: 5, due: '2026-10-03', last: '2026-09-19', streak: 6 };
  recall['37-1'] = { s: 'got', t: DEMO - 2 * 86400000, box: 4, due: '2026-09-27', last: '2026-09-20', streak: 4 };
  recall['38-0'] = { s: 'got', t: DEMO - 1 * 86400000, box: 3, due: '2026-09-25', last: '2026-09-21', streak: 2 };
  await put(L, 'eli', 'f260.mem', mem); await put(L, 'eli', 'f260.recall', recall);

  const d = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: DEMO + 2000 });
  const verses = async label => {
    await d.page.goto('about:blank'); await d.openApp('verses');
    let v = null;
    for (let i = 0; i < 120; i++) {
      v = d.page.frames().find(fr => /verses\.html/.test(fr.url()));
      if (v && await v.evaluate(() => typeof hub !== 'undefined' && !!document.body && document.body.innerText.trim().length > 0).catch(() => false)) break;
      v = null; await sleep(250);
    }
    await sleep(3000);
    const sum = (await rows(L, 'eli', 'verses'))['summary'];
    let local = null, text = '';
    for (let i = 0; i < 40 && !local; i++) {
      const fr = d.page.frames().find(x => /\/apps\/verses\.html/.test(x.url()));
      const r = fr && await fr.evaluate(() => { if (typeof hub === 'undefined') return null; const g = k => hub.get(k, { app: 'f260', scope: 'person' }) || {}; return { local: { rc: Object.keys(g('f260.recall')).length, mem: Object.keys(g('f260.mem')).length, r36: g('f260.recall')['36-0'] || null, r37: g('f260.recall')['37-1'] || null }, text: document.body.innerText.replace(/\s+/g, ' ').trim().slice(0, 200) }; }).catch(() => null);
      if (r) { local = r.local; text = r.text; } else await sleep(250);
    }
    const vlog = (await rows(L, 'eli', 'verses'))['log'];
    return { label, local, summary: sum && { due: sum.due, boxes: sum.boxes, total: sum.total, streak: sum.streak }, text, versesLogDays: n(vlog) };
  };
  out.before = { rows: { recall: n((await rows(L, 'eli'))['f260.recall']), mem: n(mem) }, seeded: IDS.map(id => ({ id, ...recall[id] })), verses: await verses('before') };

  // F260 → Settings → Reset progress… → Reset
  // the viewer frame can be swapped while it boots: keep looking until a live F260 frame has painted Today
  let f = null;
  for (let attempt = 0; attempt < 3 && !f; attempt++) {
    await d.page.goto('about:blank'); await d.openApp('f260');
    for (let i = 0; i < 160 && !f; i++) {
      const c = d.page.frames().find(fr => /\/apps\/f260\.html/.test(fr.url()));
      if (c && await c.evaluate(() => { const t = document.getElementById('todayTitle'); return !!(document.getElementById('settingsBtn') && t && t.textContent.trim()); }).catch(() => false)) f = c;
      else await sleep(250);
    }
  }
  if (!f) throw new Error('F260 frame never painted');
  await sleep(1500);
  f = d.page.frames().find(fr => /\/apps\/f260\.html/.test(fr.url()));
  await f.evaluate(() => document.getElementById('settingsBtn').scrollIntoView({ block: 'center' }));
  await f.locator('#settingsBtn').tap(); await sleep(300);
  await f.evaluate(() => document.getElementById('resetBtn').scrollIntoView({ block: 'center' }));
  await f.locator('#resetBtn').tap(); await sleep(400);
  out.dialog = await f.evaluate(() => document.getElementById('confirm').innerText.replace(/\s+/g, ' ').trim());
  out.dialogMentionsVerses = /verses app|trainer|practice|review|schedule|box/i.test(out.dialog);
  await d.page.screenshot({ path: path.join(EVID, P + '-dialog-iphone.png'), scale: 'css', animations: 'disabled' });
  await f.locator('#doConfirm').tap(); await sleep(2500);
  const after = await rows(L, 'eli');
  out.afterReset = { recall: n(after['f260.recall']), mem: n(after['f260.mem']), verses: n(after['f260.verses']), done: n(after['f260.done']), journalKeysKept: Object.keys(after).filter(k => /vault|journal|jstats/.test(k)) };
  out.versesAfterReset = await verses('after reset (mem and recall both gone)');

  // Isolate the recall loss: re-mark the same three verses memorised (as the user would in F260) and read Verses again
  const mem2 = {}; IDS.forEach(id => mem2[id] = true);
  const meta = (await L.apiAs('eli', '/api/data/f260?scope=person&key=f260.mem')).body.item;
  out.memTombstone = meta && { value: meta.value, updated_at: meta.updated_at, deleted: meta.deleted };
  const now = (await L.apiAs('eli', '/api/data/f260?scope=person&key=__none__')).body.now;
  const at = Math.max(now, ((meta && meta.updated_at) || 0) + 1000);
  out.putRemark = (await L.apiAs('eli', '/api/data/f260/f260.mem?scope=person', { method: 'PUT', body: { value: mem2, updated_at: at } })).status;
  out.memAfterRemark = n((await rows(L, 'eli'))['f260.mem']);
  await d.page.reload(); await sleep(3000);
  out.versesAfterRemark = await verses('after re-marking the same 3 verses memorised');
  out.recallAfterRemark = n((await rows(L, 'eli'))['f260.recall']);
  await d.page.screenshot({ path: path.join(EVID, P + '-verses-after-remark-iphone.png'), scale: 'css', animations: 'disabled' });
  await d.close();
} finally { await L.close(); }
fs.writeFileSync(path.join(EVID, P + '.json'), JSON.stringify(out, null, 1));
console.log('BEFORE  rows', JSON.stringify(out.before.rows), '| Verses', JSON.stringify(out.before.verses.summary), '| log days', out.before.verses.versesLogDays, '| frame', JSON.stringify(out.before.verses.local));
console.log('DIALOG ', out.dialog, '| mentions Verses/schedule:', out.dialogMentionsVerses);
console.log('AFTER   rows', JSON.stringify(out.afterReset));
console.log('VERSES after reset  ', JSON.stringify(out.versesAfterReset.summary), '|', out.versesAfterReset.text.slice(0, 120), '| log days', out.versesAfterReset.versesLogDays);
console.log('tombstone', JSON.stringify(out.memTombstone), 're-mark put', out.putRemark, 'server mem', out.memAfterRemark, '| frame sees', JSON.stringify(out.versesAfterRemark.local));
console.log('VERSES after re-mark', JSON.stringify(out.versesAfterRemark.summary), '|', out.versesAfterRemark.text.slice(0, 120), '| recall rows', out.recallAfterRemark);
console.log('evidence → audits/evidence/p3/f260/' + P + '.json');
