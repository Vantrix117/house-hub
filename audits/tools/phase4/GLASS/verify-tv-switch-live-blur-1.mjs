// Phase 4 GLASS skeptic #1: does the TV board's Switch button carry the board's only live backdrop-filter, and what does
// it cost at idle? Independent of perf.mjs: arms differ ONLY in #kiosk-switch's backdrop-filter (S = none on that one
// element), plus a null arm A2 (shipped again) to size run-to-run noise. Chromium (installed Chrome, headless), light,
// real clock, local instance. Order interleaved A S A2 S A ... ; each 'still' window starts 3.2 s after a forced crossfade.
//   node audits/tools/phase4/GLASS/verify-tv-switch-live-blur-1.mjs [--device tv] [--reps 6] [--win 8000] [--action still|fade]
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const DEVICE = arg('device', 'tv'), REPS = +arg('reps', 6), WIN = +arg('win', 8000), ACTION = arg('action', 'still');
const OUTF = path.join(ROOT, 'audits/evidence/p4/GLASS', 'verify-tv-switch-live-blur-1-' + DEVICE + '-' + ACTION + '.json');
const SW_OFF = '#kiosk-switch{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}';

const mod = await import(pathToFileURL(path.join(ROOT, 'audits/tools/areas/tv.mjs')));
const scr = mod.screens.find(s => s.screen === (DEVICE === 'tv' ? 'board' : 'board-ipad'));
const L = await local({ variant: 'typical', engine: 'chromium' });
const out = { device: DEVICE, action: ACTION, reps: REPS, win: WIN, static: null, arms: {} };
try {
  const bcdp = await L.browser.newBrowserCDPSession();
  const cpu = async () => { const r = await bcdp.send('SystemInfo.getProcessInfo'); const by = {}; for (const p of r.processInfo) by[p.type] = (by[p.type] || 0) + p.cpuTime; return by; };
  const d = await L.device({ device: DEVICE, mode: 'light', profile: 'tv', fixedTime: false });
  const page = d.page;
  const t = { page, ctx: d.ctx, loading: false, reopened: false, goto: async (h = '') => page.goto(L.site + '/index.html' + h, { waitUntil: 'load' }) };
  await scr.go(t); await sleep(2500);
  out.static = await page.evaluate(() => {
    const live = [...document.querySelectorAll('*')].filter(e => { const s = getComputedStyle(e); const bf = s.backdropFilter || s.webkitBackdropFilter; const r = e.getBoundingClientRect(); return bf && bf !== 'none' && r.width > 1 && r.height > 1 && s.display !== 'none' && s.visibility !== 'hidden'; })
      .map(e => { const s = getComputedStyle(e), r = e.getBoundingClientRect(); return { sel: (e.id ? '#' + e.id : e.tagName.toLowerCase()) + '.' + [...e.classList].join('.'), bf: s.backdropFilter, opacity: s.opacity, rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)] }; });
    const panes = [...document.querySelectorAll('.tv-pane')].map(e => ({ cls: e.className, bf: getComputedStyle(e).backdropFilter }));
    const c = document.getElementById('clock').getBoundingClientRect(), b = document.getElementById('kiosk-switch').getBoundingClientRect();
    const overlapClock = !(b.right < c.left || b.left > c.right || b.bottom < c.top || b.top > c.bottom);
    const img = [...document.querySelectorAll('.tv-bg-img')].map(i => ({ id: i.id, filter: getComputedStyle(i).filter, on: i.classList.contains('on'), src: (i.currentSrc || '').slice(-40) }));
    return { live, panes, clockRect: [c.x, c.y, c.width, c.height].map(Math.round), switchRect: [b.x, b.y, b.width, b.height].map(Math.round), switchOverlapsClock: overlapClock, bgImgs: img, kioskBlurVar: getComputedStyle(document.documentElement).getPropertyValue('--blur').trim() };
  });
  // count clock DOM mutations in 5 s (the 1 s tick rewrites textContent even when the minute has not changed)
  out.static.clockMutationsPer5s = await page.evaluate(() => new Promise(r => { let n = 0; const mo = new MutationObserver(m => { n += m.length; }); mo.observe(document.getElementById('clock'), { childList: true, characterData: true, subtree: true }); setTimeout(() => { mo.disconnect(); r(n); }, 5000); }));
  console.log(JSON.stringify(out.static));
  const pcdp = await d.ctx.newCDPSession(page); await pcdp.send('Performance.enable');
  const pm = async () => Object.fromEntries((await pcdp.send('Performance.getMetrics')).metrics.map(x => [x.name, x.value]));
  const set = async on => page.evaluate(([css, on]) => { let s = document.getElementById('v1-sw-off'); if (!on) { if (s) s.remove(); return; } if (!s) { s = document.createElement('style'); s.id = 'v1-sw-off'; document.head.appendChild(s); } s.textContent = css; }, [SW_OFF, on]);
  const order = []; for (let i = 0; i < REPS; i++) order.push(i % 2 ? 'A2' : 'A', 'S');
  for (const arm of order) {
    await set(arm === 'S'); await sleep(1200);
    const bf = await page.evaluate(() => getComputedStyle(document.getElementById('kiosk-switch')).backdropFilter);
    await page.evaluate(() => window.__tv && window.__tv.crossfade());
    if (ACTION === 'still') await sleep(3200);
    const c0 = await cpu(), m0 = await pm(), w0 = Date.now();
    await sleep(ACTION === 'fade' ? 12000 : WIN);
    const secs = (Date.now() - w0) / 1000, c1 = await cpu(), m1 = await pm();
    const by = {}; for (const k of Object.keys(c1)) by[k] = +(((c1[k] || 0) - (c0[k] || 0)) / secs).toFixed(4);
    const r = { bf, secs: +secs.toFixed(2), total: +Object.values(by).reduce((a, b) => a + b, 0).toFixed(4), gpu: by.GPU || 0, renderer: by.renderer || 0, browser: by.browser || 0, main: +((m1.TaskDuration - m0.TaskDuration) / secs).toFixed(4), stylePerSec: +((m1.RecalcStyleCount - m0.RecalcStyleCount) / secs).toFixed(2), layoutPerSec: +((m1.LayoutCount - m0.LayoutCount) / secs).toFixed(2) };
    (out.arms[arm] ||= { runs: [] }).runs.push(r);
    console.log(arm, JSON.stringify(r));
    fs.writeFileSync(OUTF, JSON.stringify(out, null, 1));
  }
  await set(false);
  const stat = xs => { const s = [...xs].sort((a, b) => a - b); const m = s.reduce((a, b) => a + b, 0) / s.length; return { n: s.length, mean: +m.toFixed(4), median: +s[Math.floor((s.length - 1) / 2)].toFixed(4), min: s[0], max: s[s.length - 1], sd: +Math.sqrt(s.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, s.length - 1)).toFixed(4) }; };
  const Aall = [...(out.arms.A?.runs || []), ...(out.arms.A2?.runs || [])];
  out.summary = { shipped_total: stat(Aall.map(r => r.total)), switchOff_total: stat(out.arms.S.runs.map(r => r.total)), shipped_gpu: stat(Aall.map(r => r.gpu)), switchOff_gpu: stat(out.arms.S.runs.map(r => r.gpu)),
    A_vs_A2_totalMean: [stat((out.arms.A?.runs || []).map(r => r.total)).mean, out.arms.A2 ? stat(out.arms.A2.runs.map(r => r.total)).mean : null] };
  out.summary.ratioMean = +(out.summary.shipped_total.mean / out.summary.switchOff_total.mean).toFixed(3);
  out.summary.ratioMedian = +(out.summary.shipped_total.median / out.summary.switchOff_total.median).toFixed(3);
  console.log(JSON.stringify(out.summary));
  fs.writeFileSync(OUTF, JSON.stringify(out, null, 1));
  await d.close();
} finally { await L.close(); }
