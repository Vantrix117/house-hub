// s2 skeptic: text sizes of visible text on Home and in the Larder, iPhone PWA (430) vs iPad portrait (820), and kid vs adult on iPad.
import fs from 'node:fs';
import path from 'node:path';
import { local, ROOT, sleep } from '../../../lib/local.mjs';
const OUT = path.join(ROOT, 'audits/evidence/p5/ux-verify/GAP-TYPE-1/s2');
const OUT2 = path.join(ROOT, 'audits/evidence/p5/ux-verify/GAP-TOK-4/s2');
fs.mkdirSync(OUT, { recursive: true }); fs.mkdirSync(OUT2, { recursive: true });
const probe = () => {
  const out = {}; const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n; while ((n = walker.nextNode())) {
    const t = n.textContent.trim(); if (!t) continue; const el = n.parentElement; const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none' || r.width === 0 || r.height === 0) continue;
    const fs = parseFloat(cs.fontSize); const k = fs.toFixed(1); out[k] = (out[k] || 0) + t.length;
  }
  const total = Object.values(out).reduce((a, b) => a + b, 0);
  const hist = Object.fromEntries(Object.entries(out).sort((a, b) => +a[0] - +b[0]));
  const median = (() => { let acc = 0; for (const [k, v] of Object.entries(hist)) { acc += v; if (acc >= total / 2) return +k; } })();
  const le16 = Object.entries(hist).filter(([k]) => +k <= 16).reduce((a, [, v]) => a + v, 0);
  return { chars: total, medianPx: median, shareAtOrBelow16px: +(le16 / total).toFixed(3), hist, kind: document.documentElement.dataset.kind || null };
};
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const res = {};
try {
  for (const [dev, prof] of [['iphone-pwa', 'eli'], ['ipad-portrait', 'eli'], ['ipad-portrait', 'ezra']]) {
    const d = await L.device({ device: dev, profile: prof });
    await d.goto(''); await sleep(2500);
    res[`home ${dev} ${prof}`] = await d.page.evaluate(probe);
    await d.shot(path.join(OUT, `home-${dev}-${prof}.png`));
    const f = await d.openApp('leftovers'); await sleep(2000);
    res[`leftovers ${dev} ${prof}`] = f ? await f.evaluate(probe) : 'not opened';
    await d.shot(path.join(prof === 'ezra' ? OUT2 : OUT, `leftovers-${dev}-${prof}.png`));
    await d.ctx.close();
  }
} finally { await L.close(); }
fs.writeFileSync(path.join(OUT, 'measure.json'), JSON.stringify(res, null, 1));
for (const [k, v] of Object.entries(res)) console.log(k, typeof v === 'string' ? v : `kind=${v.kind} chars=${v.chars} median=${v.medianPx} <=16px=${v.shareAtOrBelow16px} sizes=${Object.keys(v.hist).join(',')}`);
