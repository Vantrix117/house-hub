// Phase 4 GLASS skeptic #2: does the TV board's Switch button (the one live backdrop-filter on the board) cost idle CPU/GPU?
// Independent of perf.mjs. Chromium (the installed Chrome, headless; the only engine in the rig that paints backdrop-filter).
// Board: profile 'tv', real clock (so the 1 s tick and the 45 s crossfade run), light, System theme.
// Arms, interleaved over R rounds, same page state:
//   A  as shipped
//   P  only the off-screen pull-to-refresh #ptr span (the other element with a computed backdrop-filter)
//   SP both S and P
//   (round 0 is a discarded warm-up)
//   S  only the Switch: .kiosk-switch { backdrop-filter:none } (the proposed fix)
//   B  every backdrop-filter off
// Window: force a crossfade, wait 3.5 s (2.5 s fade done), then measure W ms of pure idle (no crossfade can land: 45 s rule).
// Cost = CDP SystemInfo.getProcessInfo cpuTime deltas per wall second, split by process type.
// Also records: every element with a computed backdrop-filter on the board, the Switch rect, whether it overlaps the clock,
// and its opacity/backdrop value.
//   node audits/tools/phase4/GLASS/verify-tv-switch-live-blur-2.mjs [--rounds 5] [--window 8000] [--device tv]
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const R = +arg('rounds', 5), W = +arg('window', 8000), DEVS = arg('device', 'tv,ipad-landscape').split(',');
const OUT = path.join(ROOT, 'audits/evidence/p4/GLASS/verify-tv-switch-live-blur-2' + (arg('tag', '') ? '-' + arg('tag', '') : '') + '.json');
const CSS = { P: '#ptr span{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}', SP: '.kiosk-switch,#ptr span{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}', S: '.kiosk-switch{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}', B: '*,*::before,*::after{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}' };
const out = { method: 'see script header', rounds: R, windowMs: W, devices: {} };
const L = await local({ variant: 'typical', engine: 'chromium' });
try {
  const b = await L.browser.newBrowserCDPSession();
  const cpu = async () => { const r = await b.send('SystemInfo.getProcessInfo'); const by = {}; for (const p of r.processInfo) by[p.type] = (by[p.type] || 0) + p.cpuTime; return by; };
  for (const dev of DEVS) {
    await L.reset('typical');
    const d = await L.device({ device: dev, mode: 'light', profile: 'tv', fixedTime: false });
    await d.page.goto(L.site + '/index.html#home', { waitUntil: 'load' });
    await d.page.waitForFunction(() => window.__tv && document.querySelector('#tv #clock') && document.querySelector('#tv #clock').textContent, null, { timeout: 15000 });
    await d.page.waitForFunction(() => window.hub && window.hub.sync.lastPull > 0, null, { timeout: 10000 }).catch(() => {});
    await sleep(4000);
    const facts = await d.page.evaluate(() => {
      const bf = e => { const s = getComputedStyle(e); return (s.backdropFilter && s.backdropFilter !== 'none') ? s.backdropFilter : ((s.webkitBackdropFilter && s.webkitBackdropFilter !== 'none') ? s.webkitBackdropFilter : null); };
      const live = [...document.querySelectorAll('*')].filter(e => bf(e) && e.getBoundingClientRect().width > 1 && getComputedStyle(e).display !== 'none').map(e => { const r = e.getBoundingClientRect(); return { el: (e.id ? '#' + e.id : e.tagName.toLowerCase()) + '.' + [...e.classList].join('.'), w: Math.round(r.width), h: Math.round(r.height), bf: bf(e) }; });
      const sw = document.getElementById('kiosk-switch'), ck = document.getElementById('clock');
      const r = sw.getBoundingClientRect(), c = ck.getBoundingClientRect();
      const rng = document.createRange(); rng.selectNodeContents(ck); const tr = rng.getBoundingClientRect();
      const ov = (a, b2, pad = 0) => !(a.right + pad < b2.left || b2.right < a.left - pad || a.bottom + pad < b2.top || b2.bottom < a.top - pad);
      const panes = [...document.querySelectorAll('.tv-pane')].map(p => ({ cls: p.className, bf: getComputedStyle(p).backdropFilter }));
      const pr = document.querySelector('#ptr span').getBoundingClientRect(); return { ptrSpanRect: [pr.x, pr.y, pr.width, pr.height].map(Math.round), live, switchRect: [r.x, r.y, r.width, r.height].map(Math.round), switchOpacity: getComputedStyle(sw).opacity, clockGlyphRect: [tr.x, tr.y, tr.width, tr.height].map(Math.round), switchOverClockGlyphs: ov(r, tr), switchOverClockGlyphsWithin28px: ov(r, tr, 28 * 3), clockText: ck.textContent, panes, stats: window.__tvStats };
    });
    const res = { facts, arms: { A: [], S: [], P: [], SP: [], B: [] } };
    console.log(dev, JSON.stringify(facts.live), 'overClock', facts.switchOverClockGlyphs, facts.switchOverClockGlyphsWithin28px);
    const setArm = async arm => d.page.evaluate(([css]) => { let s = document.getElementById('v2-arm'); if (!s) { s = document.createElement('style'); s.id = 'v2-arm'; document.head.appendChild(s); } s.textContent = css || ''; }, [CSS[arm] || '']);
    for (let i = 0; i < R; i++) {
      const base = ['A', 'S', 'P', 'SP', 'B']; const order = i % 2 ? base.slice().reverse() : base; const warm = i === 0;
      for (const arm of order) {
        await setArm(arm);
        await d.page.evaluate(() => window.__tv.crossfade()); await sleep(3500);
        const lf0 = await d.page.evaluate(() => window.__tv.state().lastFade);
        const c0 = await cpu(), t0 = Date.now(); await sleep(W); const c1 = await cpu(); const secs = (Date.now() - t0) / 1000;
        const lf1 = await d.page.evaluate(() => window.__tv.state().lastFade);
        const per = {}; for (const k of Object.keys(c1)) per[k] = +(((c1[k] || 0) - (c0[k] || 0)) / secs).toFixed(4);
        const tot = +Object.values(per).reduce((a, x) => a + x, 0).toFixed(4);
        if (!warm) res.arms[arm].push({ round: i, total: tot, gpu: per.GPU || 0, renderer: per.renderer || 0, browser: per.browser || 0, fadeInWindow: lf1 !== lf0 });
        console.log(dev, i, arm, tot, 'gpu', per.GPU, 'rend', per.renderer, lf1 !== lf0 ? 'FADE' : '');
      }
    }
    const st = xs => { const s = [...xs].sort((a, b2) => a - b2); const m = s.reduce((a, x) => a + x, 0) / s.length; const sd = Math.sqrt(s.reduce((a, x) => a + (x - m) ** 2, 0) / Math.max(1, s.length - 1)); return { mean: +m.toFixed(4), median: +s[Math.floor(s.length / 2)].toFixed(4), sd: +sd.toFixed(4), min: s[0], max: s[s.length - 1] }; };
    res.summary = Object.fromEntries(Object.entries(res.arms).map(([k, v]) => [k, { total: st(v.map(x => x.total)), gpu: st(v.map(x => x.gpu)), renderer: st(v.map(x => x.renderer)) }]));
    res.summary.ratio_A_over_S_total = +(res.summary.A.total.mean / res.summary.S.total.mean).toFixed(2);
    res.summary.ratio_A_over_B_total = +(res.summary.A.total.mean / res.summary.B.total.mean).toFixed(2);
    res.summary.ratio_SP_over_B_total = +(res.summary.SP.total.mean / res.summary.B.total.mean).toFixed(2);
    res.summary.ratio_S_over_B_total = +(res.summary.S.total.mean / res.summary.B.total.mean).toFixed(2);
    out.devices[dev] = res;
    await d.page.screenshot({ path: path.join(ROOT, `audits/evidence/p4/GLASS/verify-tv-switch-live-blur-2-${dev}.png`), clip: { x: 0, y: 0, width: Math.min(960, d.page.viewportSize().width), height: 540 } }).catch(() => {});
    await d.close();
    fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
  }
} finally { fs.writeFileSync(OUT, JSON.stringify(out, null, 1)); await L.close(); }
