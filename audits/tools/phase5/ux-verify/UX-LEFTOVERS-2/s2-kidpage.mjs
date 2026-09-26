// Skeptic s2, UX-LEFTOVERS-2: what does kid mode actually change on the Larder page? Compare Ezra's and Eli's
// computed styles element by element on the iPad, count the kid's write controls and any pictures. No writes.
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../../lib/local.mjs';
const OUT = path.resolve('audits/evidence/p5/ux-verify/UX-LEFTOVERS-2/s2');
fs.mkdirSync(OUT, { recursive: true });
const SEL = ['h1', '.tally', '.lede', '.alert', '.group h2', '.group h2 small', '.item', '.nm', '.meta', '.status', '.done', '.hearth p', '.copy', '#name', '.log', '.mic', 'select', '#date', 'form[id="add"]'];
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const out = {};
try {
  for (const who of ['ezra', 'eli']) {
    const d = await L.device({ device: 'ipad-portrait', profile: who });
    const f = await d.openApp('leftovers');
    await f.waitForFunction(() => window.__larder && document.getElementById('tally').textContent.length > 0);
    await sleep(1200);
    out[who] = await f.evaluate(SEL => {
      const o = { kind: document.documentElement.dataset.kind, canWrite: hub.canWrite, styles: {} };
      for (const s of SEL) {
        const e = document.querySelector(s);
        if (!e) { o.styles[s] = null; continue; }
        const cs = getComputedStyle(e); const r = e.getBoundingClientRect();
        o.styles[s] = { fs: cs.fontSize, radius: cs.borderTopLeftRadius, w: Math.round(r.width), h: Math.round(r.height), display: cs.display, hidden: e.hidden || cs.display === 'none' };
      }
      o.doneButtons = document.querySelectorAll('.done').length;
      o.items = document.querySelectorAll('.item').length;
      o.picturesInItems = document.querySelectorAll('.item img, .item picture, .item [role=img]:not(.bar)').length;
      o.emojiInNames = [...document.querySelectorAll('.nm')].filter(n => /\p{Extended_Pictographic}/u.test(n.textContent)).length;
      o.fsMdToken = getComputedStyle(document.documentElement).getPropertyValue('--fs-md').trim();
      o.tapToken = getComputedStyle(document.documentElement).getPropertyValue('--tap').trim();
      return o;
    }, SEL);
    await d.shot(path.join(OUT, `${who}-larder-ipad.png`));
    await d.close();
  }
  out.diff = Object.fromEntries(SEL.map(s => [s, JSON.stringify(out.ezra.styles[s]) === JSON.stringify(out.eli.styles[s]) ? 'same' : { ezra: out.ezra.styles[s], eli: out.eli.styles[s] }]));
  console.log(JSON.stringify({ ezra: { kind: out.ezra.kind, canWrite: out.ezra.canWrite, doneButtons: out.ezra.doneButtons, items: out.ezra.items, picturesInItems: out.ezra.picturesInItems, emojiInNames: out.ezra.emojiInNames, fsMdToken: out.ezra.fsMdToken, tapToken: out.ezra.tapToken, form: out.ezra.styles['form[id="add"]'], mic: out.ezra.styles['.mic'], log: out.ezra.styles['.log'] }, diff: out.diff }, null, 1));
  fs.writeFileSync(path.join(OUT, 'kidpage.json'), JSON.stringify(out, null, 1));
} finally { await L.close(); }
