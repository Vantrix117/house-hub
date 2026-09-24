// Skeptic #1 for the Verses finding "odd-references": are "Psalm 1:1-7" (week 18) and "Jeremiah 1:15" (week 24)
// really in every copy of the F260 memory-verse list, and does Verses really show them?
//  (1) static: parse the four copies (apps/f260.html PLAN[].m, apps/verses.html REFS, index.html MEMORY, apps/kidverse.html refs)
//  (2) runtime, fresh local instance: window.verses.REFS; then set the family week (kidverse/family 'week') to 18 and 24
//      as Mom and open Verses as Ezra (kid mode shows the family week's two verses) and read what #ref shows.
// Run: node "audits/tools/phase3/verses/verify-odd-references-1.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';
const EVID = path.resolve('audits/evidence/p3/verses');
fs.mkdirSync(EVID, { recursive: true });
const out = { static: {}, runtime: {} };
const ODD = ['Psalm 1:1-7', 'Jeremiah 1:15'];

// (1) static
const f260 = fs.readFileSync('apps/f260.html', 'utf8');
const plan = [...f260.slice(f260.indexOf('const PLAN = [')).matchAll(/\{ w: (\d+),[^\n]*?m: (\[[^\]]*\])/g)].slice(0, 52).map(x => JSON.parse(x[2]));
const vs = fs.readFileSync('apps/verses.html', 'utf8');
const refsSrc = vs.slice(vs.indexOf('const REFS = ['), vs.indexOf('];', vs.indexOf('const REFS = [')) + 1);
const refs = [...refsSrc.matchAll(/\['([^']+)', '([^']+)'\]/g)].map(m => [m[1], m[2]]);
const idx = fs.readFileSync('index.html', 'utf8');
const memSrc = idx.slice(idx.indexOf('const MEMORY = '), idx.indexOf(']);', idx.indexOf('const MEMORY = ')));
const mem = [...memSrc.matchAll(/\["([^"]+)","([^"]+)"\]/g)].map(m => [m[1], m[2]]);
const kv = fs.readFileSync('apps/kidverse.html', 'utf8');
const kvRefs = [...kv.matchAll(/\{ w: (\d+),\s+refs: \['([^']+)', '([^']+)'\]/g)].map(m => [m[2], m[3]]);
const lineOf = (src, s) => src.slice(0, src.indexOf(s)).split('\n').length;
out.static = {
  counts: { f260: plan.length, verses: refs.length, index: mem.length, kidverse: kvRefs.length },
  allEqualToF260: { verses: JSON.stringify(refs) === JSON.stringify(plan), index: JSON.stringify(mem) === JSON.stringify(plan), kidverse: JSON.stringify(kvRefs) === JSON.stringify(plan) },
  week18: { f260: plan[17], verses: refs[17], index: mem[17], kidverse: kvRefs[17] },
  week24: { f260: plan[23], verses: refs[23], index: mem[23], kidverse: kvRefs[23] },
  lines: {
    f260: ODD.map(s => lineOf(f260, '"' + s + '"')), verses: ODD.map(s => lineOf(vs, "'" + s + "'")),
    index: ODD.map(s => lineOf(idx, '"' + s + '"')), kidverse: ODD.map(s => lineOf(kv, "'" + s + "'")),
  },
  // kidverse's 'p' = which ref the kid paraphrase is based on
  kidversePara: [...kv.matchAll(/\{ w: (18|24),\s+refs:[^\n]*?p: (\d)/g)].map(m => ({ week: +m[1], p: +m[2] })),
};

// (2) runtime
const L = await local({ variant: 'typical', clock: 'demo' });
try {
  const eli = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  await eli.goto('#home');
  const f = await eli.openApp('verses');
  await f.waitForFunction(() => window.verses && window.verses.REFS, null, { timeout: 15000 });
  out.runtime.eliRefs = await f.evaluate(odd => ({
    week18: window.verses.REFS[17], week24: window.verses.REFS[23],
    sayRef: odd.map(r => window.verses.sayRef(r)),
  }), ODD);
  await eli.close();
  for (const week of [18, 24]) {
    const w = await L.apiAs('mom', '/api/data/kidverse/batch?scope=family', { method: 'POST', body: { items: [{ key: 'week', value: { week }, updated_at: Date.now() + week * 1000 }] } });
    const kid = await L.device({ device: 'iphone-pwa', profile: 'ezra', fixedTime: false });
    await kid.goto('#home');
    const k = await kid.openApp('verses');
    await k.waitForSelector('#trainer:not([hidden]), #done:not([hidden]), #empty:not([hidden])', { timeout: 15000 }).catch(() => {});
    await sleep(800);
    const shotPath = `audits/evidence/p3/verses/verify-odd-references-1-kid-week${week}.png`;
    await kid.page.screenshot({ path: shotPath, scale: "css", animations: "disabled", caret: "hide" });
    const seen = [];
    for (let i = 0; i < 3; i++) {
      const s = await k.evaluate(() => ({ trainer: !document.getElementById('trainer').hidden, ref: document.getElementById('ref') && document.getElementById('ref').textContent, cur: window.verses && window.verses.current && window.verses.current() }));
      seen.push(s);
      if (!s.trainer) break;
      // rate it so the next one comes up
      await k.click('#show').catch(() => {}); await sleep(200);
      const b = await k.$('#act-rate:not([hidden]) [data-rate]');
      if (!b) break; await b.click(); await sleep(500);
    }
    out.runtime["kidWeek" + week] = { write: w.status, seen, shot: shotPath };
    await kid.close();
  }
} finally { await L.close(); }
fs.writeFileSync(path.join(EVID, 'verify-odd-references-1.json'), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
