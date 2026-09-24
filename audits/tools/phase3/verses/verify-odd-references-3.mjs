// Skeptic #3 (tie-break) for the Verses finding "odd-references": "Psalm 1:1-7" (week 18) and "Jeremiah 1:15" (week 24).
// Question: an app defect, or a faithful copy of the published F260 plan?
//  (1) runtime on a fresh local instance (chromium, to differ from skeptics 1-2): Eli's Verses exposes REFS[17], REFS[23];
//      then the family week is set to 18 as Mom and Ezra's Verses (kid mode) is opened; #ref read + screenshot.
//  (2) static: the 52-entry F260 PLAN[].m (apps/f260.html) vs Verses REFS (apps/verses.html) - equal or not.
//  (3) optional args: already-downloaded published F260 plan PDFs; the script inflates every Flate stream, joins the
//      text of Tj strings and TJ arrays, and prints the text around "Psalm(s) 1:1-7" and "Jeremiah 1:15"/"1:5".
//      This script itself fetches nothing from the network.
// Run: node "audits/tools/phase3/verses/verify-odd-references-3.mjs" [plan1.pdf ...]
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';

const EVID = path.resolve('audits/evidence/p3/verses');
fs.mkdirSync(EVID, { recursive: true });
const out = {};

// (2) static
const f260 = fs.readFileSync('apps/f260.html', 'utf8');
const plan = [...f260.slice(f260.indexOf('const PLAN = [')).matchAll(/\{ w: (\d+),[^\n]*?m: (\[[^\]]*\])/g)].slice(0, 52).map(m => ({ w: +m[1], m: JSON.parse(m[2]) }));
const vs = fs.readFileSync('apps/verses.html', 'utf8');
const s0 = vs.indexOf('const REFS = [');
const refs = [...vs.slice(s0, vs.indexOf('\n  ];', s0)).matchAll(/\['([^']+)', '([^']+)'\]/g)].map(m => [m[1], m[2]]);
out.static = {
  planWeeks: plan.length, refsWeeks: refs.length,
  equal: plan.length === 52 && plan.every((p, i) => JSON.stringify(p.m) === JSON.stringify(refs[i])),
  plan18: plan[17] && plan[17].m, plan24: plan[23] && plan[23].m,
};

// (1) runtime
const L = await local({ variant: 'typical', clock: 'demo', engine: 'chromium' });
try {
  const eli = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  await eli.goto('#home');
  const f = await eli.openApp('verses');
  await f.waitForFunction(() => window.verses && window.verses.REFS, null, { timeout: 15000 });
  out.eli = await f.evaluate(() => ({ w18: window.verses.REFS[17], w24: window.verses.REFS[23],
    say: [window.verses.sayRef('Psalm 1:1-7'), window.verses.sayRef('Jeremiah 1:15')] }));
  await eli.close();
  const w = await L.apiAs('mom', '/api/data/kidverse/batch?scope=family',
    { method: 'POST', body: { items: [{ key: 'week', value: { week: 18 }, updated_at: Date.now() + 60000 }] } });
  const kid = await L.device({ device: 'iphone-pwa', profile: 'ezra', fixedTime: false });
  await kid.goto('#home');
  const k = await kid.openApp('verses');
  await k.waitForSelector('#trainer:not([hidden]), #done:not([hidden]), #empty:not([hidden])', { timeout: 15000 }).catch(() => {});
  await sleep(800);
  out.kidWeek18 = { writeStatus: w.status, ref: await k.evaluate(() => { const t = document.getElementById('trainer'); return t && !t.hidden ? document.getElementById('ref').textContent : null; }) };
  const shot = 'audits/evidence/p3/verses/verify-odd-references-3-ezra-week18.png';
  await kid.page.screenshot({ path: shot, scale: 'css', animations: 'disabled', caret: 'hide' });
  out.kidWeek18.shot = shot;
  await kid.close();
} finally { await L.close(); }

// (3) published plan PDFs
const unesc = s => s.replace(/\\([nrtbf()\\]|[0-7]{1,3})/g, (_, c) => /^[0-7]/.test(c) ? String.fromCharCode(parseInt(c, 8)) : ({ n: '\n', r: '\r', t: '\t', b: '', f: '' }[c] ?? c));
out.pdfs = [];
for (const pdf of process.argv.slice(2)) {
  const b = fs.readFileSync(pdf); const s = b.toString('latin1'); let text = '';
  const re = /stream\r?\n/g; let m;
  while ((m = re.exec(s))) {
    const st = m.index + m[0].length; const e = s.indexOf('endstream', st); if (e < 0) break;
    let d; try { d = zlib.inflateSync(b.subarray(st, e)).toString('latin1'); } catch { re.lastIndex = e; continue; }
    // Tj strings and TJ arrays (kerning numbers dropped); a space for large negative kerns
    for (const t of d.matchAll(/\[((?:\\.|[^\]])*)\]\s*TJ|\(((?:\\.|[^\\)])*)\)\s*Tj|(T\*|Td|TD|ET)/g)) {
      if (t[3]) { text += ' '; continue; }
      if (t[2] != null) { text += unesc(t[2]); continue; }
      for (const p of t[1].matchAll(/\(((?:\\.|[^\\)])*)\)|(-?\d+\.?\d*)/g)) text += p[1] != null ? unesc(p[1]) : (+p[2] < -200 ? ' ' : '');
    }
    re.lastIndex = e;
  }
  text = text.replace(/\s+/g, ' ');
  const hits = [];
  for (const key of [/Psalms? 1:1-7/g, /Jeremiah 1:15/g, /Jeremiah 1:5\b/g, /Psalms? 1:1-6/g])
    for (const h of text.matchAll(key)) hits.push({ ref: h[0], ctx: text.slice(Math.max(0, h.index - 70), h.index + 40) });
  out.pdfs.push({ file: path.basename(pdf), bytes: b.length, textChars: text.length, hits });
}
fs.writeFileSync(path.join(EVID, 'verify-odd-references-3.json'), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
