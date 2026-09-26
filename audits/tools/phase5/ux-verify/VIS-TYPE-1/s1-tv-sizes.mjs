// s1 skeptic: measure TV board font sizes on the kiosk at 1920x1080 and 1920x1000 (short viewport), write JSON.
import fs from 'node:fs';
import path from 'node:path';
import { local, ROOT, sleep } from '../../../lib/local.mjs';
const OUT = path.join(ROOT, 'audits/evidence/p5/ux-verify/VIS-TYPE-1/s1');
fs.mkdirSync(OUT, { recursive: true });
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const res = {};
try {
  const d = await L.device({ device: 'tv', profile: 'tv' });
  await d.goto();
  await d.page.waitForSelector('#tv-date', { timeout: 20000 });
  await sleep(2500);
  const measure = () => d.page.evaluate(() => {
    const cs = el => { const s = getComputedStyle(el); return { fs: parseFloat(s.fontSize), fw: s.fontWeight, text: (el.textContent || '').trim().slice(0, 40) }; };
    const q = sel => [...document.querySelectorAll(sel)].map(cs);
    return {
      vh: innerHeight, vw: innerWidth, kind: document.documentElement.dataset.kind,
      tokens: Object.fromEntries(['--fs-xs','--fs-sm','--fs-md','--fs-lg'].map(t => [t, getComputedStyle(document.documentElement).getPropertyValue(t).trim()])),
      date: q('#tv-date'), faceNames: q('.tv-face'), faceStar: q('.tv-face b'), lines: q('.tv-lines li'), times: q('.tv-lines .when'),
      remText: q('.tv-rem .rem-text'), remBy: q('.tv-rem .rem-by'), clock: q('#clock'), greet: q('#tv-greet'), refs: q('.tv-refs'),
    };
  });
  res['1920x1080'] = await measure();
  await d.shot(path.join(OUT, 'tv-1920x1080.png'));
  await d.page.setViewportSize({ width: 1920, height: 1000 });
  await sleep(1000);
  res['1920x1000'] = await measure();
} finally { await L.close(); }
fs.writeFileSync(path.join(OUT, 'tv-sizes.json'), JSON.stringify(res, null, 1));
console.log(JSON.stringify(Object.fromEntries(Object.entries(res).map(([k, v]) => [k, { vh: v.vh, tokens: v.tokens, date: v.date, face: v.faceNames.slice(0,2), star: v.faceStar.slice(0,2), line: v.lines.slice(0,1).map(x=>x.fs), time: v.times.slice(0,1), rem: v.remText.slice(0,1).map(x=>x.fs), by: v.remBy.slice(0,1) }])), null, 1));
