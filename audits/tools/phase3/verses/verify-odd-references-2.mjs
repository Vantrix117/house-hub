// Skeptic #2 for finding "odd-references" (Verses): are "Psalm 1:1-7" (week 18) and "Jeremiah 1:15" (week 24) an app
// defect, or a faithful copy of the published F260 plan?
//  (1) runtime: a fresh local instance, Eli's iPad opens Verses, read window.verses.REFS for weeks 18 and 24;
//  (2) source: every copy of the two references in the repo (f260 PLAN, verses REFS, kidverse, index.html TV copy,
//      worker/src/chat.js), and whether they all agree;
//  (3) optional: pass one or more downloaded copies of the published F260 plan PDF as arguments (e.g. the Replicate
//      "F260 reading plan" PDFs hosted by churches) and the script inflates their text streams and prints the week 18 and
//      week 24 "Memorize"/"Memory Verses" lines. Nothing is fetched from the network by this script.
//   node "audits/tools/phase3/verses/verify-odd-references-2.mjs" [plan1.pdf plan2.pdf ...]
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import { local, DEMO } from '../../lib/local.mjs';
import { openVerses } from './_lib.mjs';

const out = { odd: ['Psalm 1:1-7', 'Jeremiah 1:15'] };
// (2) every copy in the repo
const files = ['apps/f260.html', 'apps/verses.html', 'apps/kidverse.html', 'index.html', 'worker/src/chat.js'];
out.copies = {};
for (const f of files) {
  const lines = fs.readFileSync(f, 'utf8').split('\n');
  out.copies[f] = lines.flatMap((l, i) => out.odd.filter(r => l.includes(`'${r}'`) || l.includes(`"${r}"`)).map(r => `${f}:${i + 1} ${r}`));
}
out.copyCount = Object.values(out.copies).flat().length;
// (1) runtime
const L = await local({ variant: 'typical', clock: 'demo' });
try {
  const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', installClock: DEMO });
  const v = await openVerses(ipad);
  const refs = await v.evaluate(() => window.verses && window.verses.REFS);
  out.runtimeWeek18 = refs && refs[17];
  out.runtimeWeek24 = refs && refs[23];
  out.runtimeHasOdd = !!refs && out.odd.every(r => refs.flat().includes(r));
  await ipad.close();
} finally { await L.close(); }
// (3) the published plan, if copies were supplied
out.publishedPlan = [];
for (const pdf of process.argv.slice(2)) {
  const b = fs.readFileSync(pdf); const s = b.toString('latin1'); let text = ''; let i = 0;
  while ((i = s.indexOf('stream', i)) >= 0) {
    let st = i + 6; if (s[st] === '\r') st++; if (s[st] === '\n') st++;
    const e = s.indexOf('endstream', st); if (e < 0) break;
    try { const d = zlib.inflateSync(b.subarray(st, e)).toString('latin1'); text += [...d.matchAll(/\(((?:\\.|[^\\)])*)\)/g)].map(m => m[1].replace(/\\(.)/g, '$1')).join('') + '\n'; } catch {}
    i = e + 9;
  }
  const hits = [];
  for (const k of ['Psalm 1:1-7', 'Psalms 1:1-7', 'Jeremiah 1:15', 'Jeremiah 1:5']) {
    let j = -1; while ((j = text.indexOf(k, j + 1)) >= 0) hits.push({ ref: k, context: text.slice(Math.max(0, j - 30), j + 30).replace(/\s+/g, ' ') });
  }
  out.publishedPlan.push({ file: path.basename(pdf), bytes: b.length, hits });
}
console.log(JSON.stringify(out, null, 1));
fs.writeFileSync('audits/evidence/p3/verses/verify-odd-references-2.json', JSON.stringify(out, null, 1));
