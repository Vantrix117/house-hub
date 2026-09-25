// Phase 4 GLASS skeptic #3 (tie-break): is the TV board's Switch button's live backdrop-filter a measurable idle cost?
// Paired design, independent of perf.mjs and of skeptics 1-2: only two arms, A (as shipped) and S (.kiosk-switch
// backdrop-filter:none, the proposed fix), in ABBA order over R rounds (round 0 discarded as warm-up), so each A window has
// an S neighbour measured under the same drift. Statistic = paired difference A-S per round, with mean, sd, a t-based 95% CI
// and the sign count. Also a zero-effect control pair (A vs A') so the noise floor is measured in the same run.
// Window: force a crossfade, wait 3.5 s (2.5 s fade done), then W ms of idle (clock ticks only; the board's own 45 s fade
// cannot land in it — checked via __tv.state().lastFade). Cost = CDP SystemInfo.getProcessInfo cpuTime per wall second.
// Records GPU info (hardware vs software raster) because it bounds how far a headless Windows number transfers to a TV/iPad.
//   node audits/tools/phase4/GLASS/verify-tv-switch-live-blur-3.mjs --device tv [--rounds 13] [--window 6000]
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const R = +arg('rounds', 13), W = +arg('window', 6000), DEV = arg('device', 'tv');
const OUT = path.join(ROOT, `audits/evidence/p4/GLASS/verify-tv-switch-live-blur-3-${DEV}.json`);
const OFF = '.kiosk-switch{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}';
const CSS = { A: '', A2: '/* control: no change */', S: OFF };
const out = { method: 'see script header', device: DEV, rounds: R, windowMs: W };
const L = await local({ variant: 'typical', engine: 'chromium' });
try {
  const b = await L.browser.newBrowserCDPSession();
  const info = await b.send('SystemInfo.getInfo').catch(e => ({ err: String(e) }));
  out.gpu = info.gpu ? { devices: (info.gpu.devices || []).map(g => g.deviceString || g.vendorString), featureStatus: Object.fromEntries(Object.entries(info.gpu.featureStatus || {}).filter(([k]) => /raster|compositing|gpu_compositing|webgl$/i.test(k))) } : info;
  const cpu = async () => { const r = await b.send('SystemInfo.getProcessInfo'); const by = {}; for (const p of r.processInfo) by[p.type] = (by[p.type] || 0) + p.cpuTime; return by; };
  await L.reset('typical');
  const d = await L.device({ device: DEV, mode: 'light', profile: 'tv', fixedTime: false });
  await d.page.goto(L.site + '/index.html#home', { waitUntil: 'load' });
  await d.page.waitForFunction(() => window.__tv && document.querySelector('#tv #clock')?.textContent, null, { timeout: 15000 });
  await sleep(4000);
  out.facts = await d.page.evaluate(() => {
    const bf = e => { const s = getComputedStyle(e); const v = s.backdropFilter || s.webkitBackdropFilter; return v && v !== 'none' ? v : null; };
    const onScreen = e => { const r = e.getBoundingClientRect(); return r.width > 1 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth; };
    const all = [...document.querySelectorAll('*')].filter(bf).map(e => { const r = e.getBoundingClientRect(); return { el: (e.id ? '#' + e.id : e.tagName.toLowerCase()) + '.' + [...e.classList].join('.'), rect: [r.x, r.y, r.width, r.height].map(Math.round), onScreen: onScreen(e), bf: bf(e) }; });
    const sw = document.getElementById('kiosk-switch'); const cs = getComputedStyle(sw);
    return { withBackdrop: all, switchOpacity: cs.opacity, switchParent: sw.parentElement.className, panesBf: [...document.querySelectorAll('.tv-pane')].map(p => getComputedStyle(p).backdropFilter), kioskBlur: getComputedStyle(document.documentElement).getPropertyValue('--blur').trim() };
  });
  console.log(JSON.stringify(out.facts));
  const setArm = css => d.page.evaluate(c => { let s = document.getElementById('v3-arm'); if (!s) { s = document.createElement('style'); s.id = 'v3-arm'; document.head.appendChild(s); } s.textContent = c; }, css);
  const measure = async arm => {
    await setArm(CSS[arm]);
    const applied = await d.page.evaluate(() => getComputedStyle(document.getElementById('kiosk-switch')).backdropFilter);
    await d.page.evaluate(() => window.__tv.crossfade()); await sleep(3500);
    const lf0 = await d.page.evaluate(() => window.__tv.state().lastFade);
    const c0 = await cpu(), t0 = Date.now(); await sleep(W); const c1 = await cpu(); const secs = (Date.now() - t0) / 1000;
    const lf1 = await d.page.evaluate(() => window.__tv.state().lastFade);
    const per = {}; for (const k of Object.keys(c1)) per[k] = (c1[k] - (c0[k] || 0)) / secs;
    const total = Object.values(per).reduce((a, x) => a + x, 0);
    return { arm, applied, total: +total.toFixed(4), gpu: +(per.GPU || 0).toFixed(4), renderer: +(per.renderer || 0).toFixed(4), fade: lf1 !== lf0 };
  };
  const rounds = [];
  for (let i = 0; i < R; i++) {
    const order = i % 2 ? ['S', 'A', 'A2'] : ['A', 'S', 'A2'];   // A2 is the control, paired with A
    const row = { round: i };
    for (const arm of order) { row[arm] = await measure(arm); }
    console.log(DEV, i, 'A', row.A.total, row.A.gpu, '| S', row.S.total, row.S.gpu, '| A2', row.A2.total, row.A2.gpu, (row.A.fade || row.S.fade || row.A2.fade) ? 'FADE' : '');
    if (i > 0) rounds.push(row);
    out.rounds = rounds; fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
  }
  const clean = rounds.filter(r => !r.A.fade && !r.S.fade && !r.A2.fade);
  const t975 = n => [0, 12.71, 4.30, 3.18, 2.78, 2.57, 2.45, 2.36, 2.31, 2.26, 2.23, 2.20, 2.18, 2.16, 2.14, 2.13][n - 1] || 2.1;
  const st = xs => { const n = xs.length, m = xs.reduce((a, x) => a + x, 0) / n, sd = Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / Math.max(1, n - 1)), h = t975(n) * sd / Math.sqrt(n); const s = [...xs].sort((a, c) => a - c); return { n, mean: +m.toFixed(4), median: +s[Math.floor(n / 2)].toFixed(4), sd: +sd.toFixed(4), ci95: [+(m - h).toFixed(4), +(m + h).toFixed(4)], positive: xs.filter(x => x > 0).length }; };
  const diff = (a, c, k) => clean.map(r => r[a][k] - r[c][k]);
  out.summary = {
    cleanRounds: clean.length,
    A: { total: st(clean.map(r => r.A.total)), gpu: st(clean.map(r => r.A.gpu)) },
    S: { total: st(clean.map(r => r.S.total)), gpu: st(clean.map(r => r.S.gpu)) },
    A2: { total: st(clean.map(r => r.A2.total)), gpu: st(clean.map(r => r.A2.gpu)) },
    paired_A_minus_S: { total: st(diff('A', 'S', 'total')), gpu: st(diff('A', 'S', 'gpu')) },
    control_A2_minus_A: { total: st(diff('A2', 'A', 'total')), gpu: st(diff('A2', 'A', 'gpu')) },
  };
  out.summary.pct_A_over_S_total = +(100 * (out.summary.A.total.mean / out.summary.S.total.mean - 1)).toFixed(1);
  out.summary.pct_A_over_S_gpu = +(100 * (out.summary.A.gpu.mean / out.summary.S.gpu.mean - 1)).toFixed(1);
  console.log(JSON.stringify(out.summary, null, 1));
  await d.close();
} finally { fs.writeFileSync(OUT, JSON.stringify(out, null, 1)); await L.close(); }
