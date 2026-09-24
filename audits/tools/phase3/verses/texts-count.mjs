// How many memorised verses have verse text on file (f260.verses), i.e. how often "Show" reveals anything
// (apps/verses.html:326: the text block exists only when F260 has text for that id). Typical and overflow seeds.
import { local } from '../../lib/local.mjs';
import { serverRow, save } from './_lib.mjs';
const L = await local({ variant: 'typical', clock: 'demo' });
const out = {};
try {
  for (const v of ['typical', 'overflow']) {
    if (v !== 'typical') await L.reset(v);
    for (const p of ['eli', 'christian', 'mom', 'dad', 'niece']) {
      const mem = (await serverRow(L, p, 'f260', 'f260.mem'))?.value || {};
      const tx = (await serverRow(L, p, 'f260', 'f260.verses'))?.value || {};
      const m = Object.keys(mem).filter(k => mem[k]);
      out[v + ':' + p] = { memorised: m.length, withText: m.filter(k => tx[k]).length };
    }
  }
  console.log(JSON.stringify(out));
  save('texts-count.json', out);
} finally { await L.close(); }
