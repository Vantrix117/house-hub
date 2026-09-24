// Skeptic #1 for finding "home-full-rebuild-every-pull": does the shell's own 30 s pull (no manual hub.pull, no data change)
// really rebuild all of adult Home on the Kitchen iPad, and what does one such rebuild cost?
//
//   node "audits/tools/phase2/HOME/verify-home-full-rebuild-every-pull-1.mjs"
//     → audits/evidence/p2/HOME/verify-home-full-rebuild-every-pull-1.json
//
// Part A (WebKit, real clock, ipad-portrait, Eli on Home): instrument the page, then just WAIT ~70 s for hub.js's own
//   setInterval pull (apps/hub.js:342). Count: pulls (lastPull changes), hub.onChange events (= data changes),
//   #view-home rebuilds (MutationObserver on its direct children), nodes/imgs that survive, and network requests for
//   the Home images after the first paint (memory-cache hits make none).
// Part B (WebKit): time from hub.js setting sync.lastPull to the end of the sync listeners (= renderHome for Home) and to
//   two frames later, for 8 manual pulls on Home, versus 8 on the Me tab (whose onSync handler does not re-render) as control.
// Part C (Chromium/CDP): TaskDuration/ScriptDuration/LayoutDuration/RecalcStyleDuration per pull, Home vs Me, 10 pulls each.
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/HOME');
fs.mkdirSync(OUT, { recursive: true });
const res = {};
const med = a => a.slice().sort((x, y) => x - y)[Math.floor((a.length - 1) / 2)];

async function ready(d) {
  await d.goto('#home');
  await d.page.waitForFunction(() => window.hub && hub.sync.lastPull > 0 && document.querySelector('#feed .fline'), null, { timeout: 20000 });
  await sleep(2500);
}

// ── A: the natural 30 s timer ─────────────────────────────────────────────────────────────────────────────────────
{
  const L = await local({ variant: 'typical', clock: 'real' });
  try {
    const d = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
    await ready(d);
    const reqs = [];
    d.page.on('request', r => { const u = r.url(); if (/\/(art|icons|api\/media)\//.test(u)) reqs.push(u.replace(/^https?:\/\/[^/]+/, '')); });
    const before = await d.page.evaluate(() => {
      window.__v = { pulls: [], changes: [], rebuilds: 0 };
      hub.onSync(s => { if (s.lastPull && !window.__v.pulls.includes(s.lastPull)) window.__v.pulls.push(s.lastPull); });
      window.__v.pulls = [hub.sync.lastPull];
      hub.onChange(ch => window.__v.changes.push(`${ch.app}/${ch.scope}/${ch.key}`));
      const v = document.querySelector('#view-home');
      new MutationObserver(ms => { if (ms.some(m => [...m.removedNodes].some(n => n.classList && n.classList.contains('hero')))) window.__v.rebuilds++; }).observe(v, { childList: true });
      const all = [...v.querySelectorAll('*')]; all.forEach(e => { e.__gen0 = 1; });
      window.__v.tab = document.querySelector('#tabbar .tab[aria-selected="true"], #tabbar .tab.on, #tabbar .tab.active')?.dataset.tab || null;
      return { nodes: all.length, imgs: [...v.querySelectorAll('img')].map(i => i.getAttribute('src')), lastPull: hub.sync.lastPull, hidden: document.hidden, heroSub: v.querySelector('.hero-sub')?.textContent };
    });
    const t0 = Date.now();
    await sleep(70000);
    const after = await d.page.evaluate(() => {
      const v = document.querySelector('#view-home'); const all = [...v.querySelectorAll('*')];
      return { ...window.__v, nodes: all.length, kept: all.filter(e => e.__gen0).length, imgs: v.querySelectorAll('img').length, heroSub: v.querySelector('.hero-sub')?.textContent, state: hub.sync.state };
    });
    const pullGaps = after.pulls.slice(1).map((p, i) => Math.round((p - after.pulls[i]) / 1000));
    res.A = { waitedMs: Date.now() - t0, before, after: { ...after, pullGapsS: pullGaps }, imageRequestsAfterFirstPaint: reqs, logs: d.logs.filter(l => /error/i.test(l)).slice(0, 5) };
    console.log(`[A] document.hidden=${before.hidden}; waited ${Math.round((Date.now() - t0) / 1000)} s with no manual pull: ${after.pulls.length - 1} timer pulls (gaps ${pullGaps.join('/')} s), ${after.changes.length} hub.onChange events ${JSON.stringify(after.changes)}, #view-home rebuilt ${after.rebuilds} times.`);
    console.log(`[A] nodes before ${before.nodes}, now ${after.nodes}, surviving from before ${after.kept}; <img> ${before.imgs.length} → ${after.imgs}; hero sub before "${before.heroSub}" after "${after.heroSub}".`);
    console.log(`[A] img srcs: ${before.imgs.join(', ')}`);
    console.log(`[A] network requests for art/icons/media after the first paint: ${reqs.length} ${reqs.slice(0, 6).join(', ')}`);

    // ── B: sync cost of the pull-triggered render, Home vs Me ──
    const timePulls = async n => d.page.evaluate(async n => {
      let t0 = 0, lp = hub.sync.lastPull;
      Object.defineProperty(hub.sync, 'lastPull', { configurable: true, enumerable: true, get: () => lp, set: v => { if (v !== lp) t0 = performance.now(); lp = v; } });
      const out = []; let tEnd = 0;
      const off = hub.onSync(() => { if (t0) tEnd = performance.now(); });
      for (let i = 0; i < n; i++) {
        t0 = 0; tEnd = 0;
        await hub.pull();
        const sync = tEnd && t0 ? tEnd - t0 : null;
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        out.push({ syncListenersMs: sync == null ? null : Math.round(sync * 10) / 10, twoFramesMs: t0 ? Math.round(performance.now() - t0) : null });
        await new Promise(r => setTimeout(r, 400));
      }
      off();
      return out;
    }, n);
    const home = await timePulls(8);
    await d.page.evaluate(() => document.querySelector('#tabbar .tab[data-tab="me"]').click()); await sleep(1500);
    const me = await timePulls(8);
    res.B = { home, me };
    console.log(`[B] WebKit, one pull's lastPull → end of sync listeners: Home median ${med(home.map(r => r.syncListenersMs))} ms (${home.map(r => r.syncListenersMs).join('/')}), Me (control, no re-render) median ${med(me.map(r => r.syncListenersMs))} ms (${me.map(r => r.syncListenersMs).join('/')}).`);
    console.log(`[B] …to two frames later: Home median ${med(home.map(r => r.twoFramesMs))} ms, Me median ${med(me.map(r => r.twoFramesMs))} ms.`);
  } finally { await L.close(); }
}

// ── C: Chromium CDP task metrics per pull ─────────────────────────────────────────────────────────────────────────
{
  const L = await local({ variant: 'typical', clock: 'real', engine: 'chromium' });
  try {
    const d = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
    await ready(d);
    const cdp = await d.ctx.newCDPSession(d.page); await cdp.send('Performance.enable');
    const metrics = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));
    const run = async (label, n) => {
      const a = await metrics();
      for (let i = 0; i < n; i++) { await d.page.evaluate(async () => { await hub.pull(); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); }); await sleep(300); }
      const b = await metrics();
      const per = k => Math.round(((b[k] - a[k]) / n) * 1e4) / 10;            // seconds → ms per pull
      return { label, pulls: n, taskMsPerPull: per('TaskDuration'), scriptMsPerPull: per('ScriptDuration'), layoutMsPerPull: per('LayoutDuration'), styleMsPerPull: per('RecalcStyleDuration'), layoutCountPerPull: (b.LayoutCount - a.LayoutCount) / n, nodesDelta: b.Nodes - a.Nodes };
    };
    await d.page.evaluate(() => document.querySelector('#tabbar .tab[data-tab="home"]').click()); await sleep(800);
    const home = await run('home', 10);
    await d.page.evaluate(() => document.querySelector('#tabbar .tab[data-tab="me"]').click()); await sleep(1500);
    const me = await run('me', 10);
    res.C = { home, me };
    console.log(`[C] Chromium per pull — Home: task ${home.taskMsPerPull} ms, script ${home.scriptMsPerPull} ms, layout ${home.layoutMsPerPull} ms, style ${home.styleMsPerPull} ms | Me (control): task ${me.taskMsPerPull} ms, script ${me.scriptMsPerPull} ms, layout ${me.layoutMsPerPull} ms, style ${me.styleMsPerPull} ms.`);
  } finally { await L.close(); }
}

fs.writeFileSync(path.join(OUT, 'verify-home-full-rebuild-every-pull-1.json'), JSON.stringify(res, null, 1));
console.log('wrote audits/evidence/p2/HOME/verify-home-full-rebuild-every-pull-1.json');
