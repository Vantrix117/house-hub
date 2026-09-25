// Phase 4 GLASS, skeptic #1 for "tally-taps-glass-cost": re-measure independently of perf.mjs.
// Local instance, Chromium (installed Chrome, headless), iPad portrait 820x1180, light, profile ezra (kid), Tally open.
// Arms (one <style> injected into the named documents, same page state):
//   A  shipped
//   B  glass off everywhere (page + app frame): backdrop-filter:none on every element
//   D  glass off in the Tally frame only (the five content layers); the shell's tab bar / viewer pill keep theirs
//   T  glass on, but no press animation in Tally (.tbtn/.reset transition + transform none)
//   --extra: arms A, P (glass off on #plus only, the pressed button), TB (no press animation AND glass off) -> *-extra.json
// Rotated order over 3 rounds (A B D T / B D T A / D T A B), so every arm is measured 3x at different positions.
// Action "taps": tap #plus every 450 ms for 5 s (as the finding). Also "idle" (5 s nothing) for A and B, 2x each.
// Cost: CPU seconds per wall second summed over all browser processes (CDP SystemInfo.getProcessInfo), split by type.
//   node audits/tools/phase4/GLASS/verify-tally-taps-glass-cost-1.mjs
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const EXTRA = process.argv.includes('--extra');
const OUT = path.join(ROOT, 'audits/evidence/p4/GLASS/verify-tally-taps-glass-cost-1' + (EXTRA ? '-extra' : '') + '.json');
const GLASS_OFF = '*,*::before,*::after{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}';
const NO_PRESS = '.tbtn,.tbtn:active,.btn.reset,.btn.reset:active{transition:none!important;transform:none!important}';
const WIN = 5000;

const L = await local({ variant: 'typical', engine: 'chromium' });
const out = { method: 'see header of audits/tools/phase4/GLASS/verify-tally-taps-glass-cost-1.mjs', env: null, layers: [], count: {}, arms: { taps: {}, idle: {} } };
try {
  const b = await L.browser.newBrowserCDPSession();
  out.env = { product: (await b.send('Browser.getVersion')).product, cores: (await import('node:os')).cpus().length };
  const cpu = async () => { const r = await b.send('SystemInfo.getProcessInfo'); const by = {}; for (const p of r.processInfo) by[p.type] = (by[p.type] || 0) + p.cpuTime; return by; };
  const d = await L.device({ device: 'ipad-portrait', mode: 'light', profile: 'ezra' });
  const f = await d.openApp('tally');
  await f.waitForSelector('.dial', { timeout: 10000 });
  await f.waitForFunction(() => (document.getElementById('who') || {}).textContent, null, { timeout: 8000 }).catch(() => {});
  await sleep(2500);
  out.kind = await f.evaluate(() => document.documentElement.dataset.kind);
  // every visible element with a backdrop-filter, in every document
  for (const fr of d.page.frames()) out.layers.push(...await fr.evaluate(() => [...document.querySelectorAll('*')].filter(e => { const s = getComputedStyle(e); const bf = (s.backdropFilter && s.backdropFilter !== 'none') || (s.webkitBackdropFilter && s.webkitBackdropFilter !== 'none'); if (!bf) return false; const r = e.getBoundingClientRect(); return r.width > 1 && r.height > 1 && r.bottom > 0 && r.top < innerHeight && s.display !== 'none' && s.visibility !== 'hidden'; }).map(e => { const r = e.getBoundingClientRect(); return { doc: location.pathname.split('/').pop(), el: e.id ? '#' + e.id : e.tagName.toLowerCase() + '.' + [...e.classList].join('.'), w: Math.round(r.width), h: Math.round(r.height), bf: getComputedStyle(e).backdropFilter }; })).catch(() => []));
  // what is behind the dial: the body background of the frame
  out.backdrop = await f.evaluate(() => { const s = getComputedStyle(document.body); return { bgImage: s.backgroundImage.slice(0, 200), attachment: s.backgroundAttachment }; });
  const inject = async (fr, id, css) => fr.evaluate(([id, css]) => { let s = document.getElementById(id); if (css == null) { if (s) s.remove(); return; } if (!s) { s = document.createElement('style'); s.id = id; document.head.appendChild(s); } s.textContent = css; }, [id, css]);
  const set = async arm => {
    for (const fr of d.page.frames()) await inject(fr, 'v1-glass', arm === 'B' || arm === 'TB' ? GLASS_OFF : null).catch(() => {});
    await inject(f, 'v1-glass-app', arm === 'D' ? GLASS_OFF : arm === 'P' ? '#plus{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}' : null);
    await inject(f, 'v1-press', arm === 'T' || arm === 'TB' ? NO_PRESS : null);
  };
  const count0 = await f.evaluate(() => document.getElementById('n').textContent);
  let taps = 0;
  const measure = async (arm, action) => {
    await set(arm); await sleep(1500);
    const c0 = await cpu(), w0 = Date.now();
    if (action === 'taps') { const plus = f.locator('#plus'); const until = Date.now() + WIN; while (Date.now() < until) { await plus.tap(); taps++; await sleep(450); } }
    else await sleep(WIN);
    const secs = (Date.now() - w0) / 1000, c1 = await cpu();
    const by = {}; for (const k of Object.keys(c1)) by[k] = +(((c1[k] || 0) - (c0[k] || 0)) / secs).toFixed(3);
    const total = +Object.values(by).reduce((a, x) => a + x, 0).toFixed(3);
    ((out.arms[action][arm] ||= { runs: [] }).runs).push({ secs: +secs.toFixed(2), total, gpu: by.GPU || 0, renderer: by.renderer || 0, browser: by.browser || 0 });
    console.log(action, arm, 'total', total, 'gpu', by.GPU, 'renderer', by.renderer);
  };
  const orders = EXTRA ? [['A', 'P', 'TB', 'B'], ['P', 'TB', 'B', 'A'], ['TB', 'B', 'A', 'P']] : [['A', 'B', 'D', 'T'], ['B', 'D', 'T', 'A'], ['D', 'T', 'A', 'B']];
  for (const order of orders) for (const arm of order) await measure(arm, 'taps');
  for (const arm of EXTRA ? [] : ['A', 'B', 'A', 'B']) await measure(arm, 'idle');
  await set('A');
  const count1 = await f.evaluate(() => document.getElementById('n').textContent);
  out.count = { before: count0, after: count1, taps };
  for (const act of Object.values(out.arms)) for (const v of Object.values(act)) {
    const m = k => +(v.runs.reduce((a, r) => a + r[k], 0) / v.runs.length).toFixed(3);
    v.mean = { total: m('total'), gpu: m('gpu'), renderer: m('renderer') };
    v.range = [Math.min(...v.runs.map(r => r.total)), Math.max(...v.runs.map(r => r.total))];
  }
  const t = out.arms.taps;
  out.summary = EXTRA ? { A: t.A.mean, B: t.B.mean, P: t.P.mean, TB: t.TB.mean, ratioAB: +(t.A.mean.total / t.B.mean.total).toFixed(2), ratioAP: +(t.A.mean.total / t.P.mean.total).toFixed(2) } : { ratioAB: +(t.A.mean.total / t.B.mean.total).toFixed(2), glassShareOfA: +((t.A.mean.total - t.B.mean.total) / t.B.mean.total).toFixed(2), ratioAD: +(t.A.mean.total / t.D.mean.total).toFixed(2), ratioAT: +(t.A.mean.total / t.T.mean.total).toFixed(2), gpuA: t.A.mean.gpu, gpuB: t.B.mean.gpu, gpuD: t.D.mean.gpu, idleA: out.arms.idle.A.mean.total, idleB: out.arms.idle.B.mean.total };
  console.log(JSON.stringify(out.summary));
  await d.close();
} finally {
  fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
  await L.close();
}
