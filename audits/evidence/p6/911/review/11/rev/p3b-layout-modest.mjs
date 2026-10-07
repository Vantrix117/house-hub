// Reviewer probe 3: the claims script measures the layout with ONE counter and no resets. Fill the page the way the batch
// allows (6 named counters of 24 characters, so the switcher is a seg-grid; 5 recent resets), then measure: + above the
// fold, pill/switcher clear of the dial, no sideways scroll, every pair of visible blocks not overlapping.
import fs from 'node:fs';
import { local, sleep } from '../../hub-audit/audits/tools/lib/local.mjs';
const OUT = 'C:/Users/ex_bo/b11/rev/shots'; fs.mkdirSync(OUT, { recursive: true });
const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
const now = Date.now();
async function seed(pid) {
  const put = (key, value) => L.apiAs(pid, `/api/data/tally/${encodeURIComponent(key)}?scope=person`, { method: 'PUT', body: { value, updated_at: Date.now() } });
  const names = ['Laps', 'Water'];
  for (let i = 0; i < 2; i++) await put('counter:k' + i, { name: names[i], at: now - 100000 + i });
  for (let i = 0; i < 2; i++) await put('resetlog:' + (now - 5000 * (i + 1)), { cid: i % 2 ? 'k' + i : null, from: 123456 - i, at: now - 5000 * (i + 1) });
  await put('count', 37);
}
await seed('eli'); await seed('ezra');
const SIZES = [[375, 667], [390, 844], [844, 390], [667, 375], [820, 1180], [1180, 820], [1024, 768], [1440, 900]];
let bad = 0;
try {
  for (const profile of ['eli', 'ezra']) for (const xxl of [false, true]) for (const [w, h] of SIZES) {
    const d = await L.device({ device: 'iphone-pwa', profile, mode: 'light', fixedTime: false });
    await d.page.setViewportSize({ width: w, height: h });
    const f = await d.openApp('tally', { wait: '#plus' });
    await f.waitForFunction(() => !document.getElementById('n').classList.contains('skeleton'), null, { timeout: 15000 }); await sleep(900);
    if (xxl) { await f.evaluate(() => document.documentElement.setAttribute('data-text-size', 'xxl')); await sleep(500); }
    const m = await f.evaluate(() => {
      const vis = e => e && !e.hidden && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().height > 0;
      const R = e => { const b = e.getBoundingClientRect(); return { t: Math.round(b.top), b: Math.round(b.bottom), l: Math.round(b.left), r: Math.round(b.right) }; };
      const blocks = { who: '#who', switcher: '#switcher', dial: '.dial', ctl: '#ctl', manage: '#manage', resets: '#resets' };
      const got = {}; for (const [k, s] of Object.entries(blocks)) { const e = document.querySelector(s); if (vis(e)) got[k] = R(e); }
      const over = []; const ks = Object.keys(got);
      for (let i = 0; i < ks.length; i++) for (let j = i + 1; j < ks.length; j++) { const a = got[ks[i]], b = got[ks[j]]; if (a.l < b.r - 1 && b.l < a.r - 1 && a.t < b.b - 1 && b.t < a.b - 1) over.push(ks[i] + '/' + ks[j]); }
      const p = R(document.getElementById('plus'));
      const disc = document.querySelector('.dial').getBoundingClientRect().width;
      const cnt = document.getElementById('n'); const cr = cnt.getBoundingClientRect(), dr = document.querySelector('.dial').getBoundingClientRect();
      return { ih: innerHeight, iw: innerWidth, plusIn: p.t >= 0 && p.b <= innerHeight, plus: p, over, hs: document.documentElement.scrollWidth > innerWidth + 1, disc: Math.round(disc), countFits: cr.left >= dr.left - 1 && cr.right <= dr.right + 1, segRows: (() => { const bs = [...document.querySelectorAll('#seg button')]; return new Set(bs.map(b => Math.round(b.getBoundingClientRect().top))).size; })(), scrollH: document.scrollingElement.scrollHeight };
    });
    const tag = `${profile}${xxl ? ' XXL' : ''} ${w}x${h}`;
    const fail = !m.plusIn || m.over.length || m.hs || m.disc < 120 || !m.countFits;
    if (fail) bad++;
    console.log(`${fail ? 'FAIL' : 'ok  '} ${tag}: frame ${m.iw}x${m.ih} plus ${m.plus.t}-${m.plus.b} in=${m.plusIn} overlaps=${m.over.join(',') || '-'} hscroll=${m.hs} disc=${m.disc} countFits=${m.countFits} segRows=${m.segRows}`);
    if (fail || (w === 390 && !xxl)) await d.page.screenshot({ path: `${OUT}/p3m-${profile}${xxl ? '-xxl' : ''}-${w}x${h}.png` });
    await d.close();
  }
} finally { console.log('\nFAIL count', bad); await L.close(); }
