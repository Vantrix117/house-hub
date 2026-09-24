// Visual measurements of the Kitchen timer (local rig, WebKit, typical seed, real clock). The page is opened standalone
// (apps/timer.html, signed in as Elizabeth "mom", whose 15-minute timer is running, and as Eli, idle at 10 min) so the
// Phase 2 contrast sampler (audits/tools/phase2/VIS/lib-vis.mjs, read-only import) can screenshot it.
//  V1 rendered contrast of every text item in all five palettes, states idle (Eli) / running (mom) / done
//  V2 type sizes vs the iOS Dynamic Type scale, font families, radii
//  V3 glanceability: rendered digit height of the dial on the iPad (canvas actualBoundingBox), in mm at 0.192 mm per CSS px
//  V4 how far the done ring is from Elizabeth's running ring in each palette (colour + luminance ratio)
// Run: node "audits/tools/phase3/timer/visual.mjs"   Output: audits/evidence/p3/timer/visual.json + PNGs
import { local, sleep } from '../../lib/local.mjs';
import { contrastSweep, nearestDT } from '../../phase2/VIS/lib-vis.mjs';
import { save, shot } from './_util.mjs';
const out = { V1: {}, V4: {} };
const THEMES = [['hearth', 'light'], ['parchment', 'light'], ['frost', 'light'], ['midnight', 'dark'], ['forest', 'dark']];
const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
const openStandalone = async (profile, theme, mode, device = 'ipad-portrait') => {
  const d = await L.device({ device, profile, mode, fixedTime: false, localStorage: { 'hub.theme': theme } });
  await d.page.goto(L.site + '/apps/timer.html'); await d.page.waitForFunction(() => window.hub && hub.profile && document.getElementById('go'));
  await sleep(1500); return d;
};
const summarize = r => r.measured.map(m => ({ text: m.text.slice(0, 20), fs: m.fs, fw: m.fw, ratio: m.p10 != null ? +(+m.p10).toFixed(2) : m.ratio, med: m.med != null ? +(+m.med).toFixed(2) : undefined, large: m.large }));
try {
  for (const [theme, mode] of THEMES) {
    const row = {};
    { const d = await openStandalone('eli', theme, mode); row.idle = summarize(await contrastSweep(d.page, null)); if (theme === 'midnight' || theme === 'hearth') row.idleShot = await shot(d.page, `visual-idle-${theme}-ipad.png`); await d.close(); }
    { const d = await openStandalone('mom', theme, mode); row.running = summarize(await contrastSweep(d.page, null));
      const ring = await d.page.evaluate(() => getComputedStyle(document.querySelector('.ring .fg')).stroke);
      // make it finish: a 2 s timer written as Elizabeth, pulled
      const now = Date.now();
      await L.apiAs('mom', '/api/data/timer/batch?scope=person', { method: 'POST', body: { items: [{ key: 'timer.active', value: { endAt: now + 2500, total: 900, startedAt: now - 897500 }, updated_at: now }] } });
      await d.page.evaluate(() => hub.pull()); await sleep(4200);
      await d.page.evaluate(() => { for (const a of document.getAnimations()) a.pause(), (a.currentTime = 0); });   // freeze the blink at full opacity
      row.done = summarize(await contrastSweep(d.page, null));
      const doneRing = await d.page.evaluate(() => getComputedStyle(document.querySelector('.ring .fg')).stroke);
      const lr = await d.page.evaluate(([a, b]) => { const cv = document.createElement('canvas').getContext('2d'); const px = c => { cv.fillStyle = c; cv.fillRect(0, 0, 1, 1); return [...cv.getImageData(0, 0, 1, 1).data].slice(0, 3); };
        const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; const lum = p => 0.2126 * lin(p[0]) + 0.7152 * lin(p[1]) + 0.0722 * lin(p[2]);
        const A = px(a), B = px(b); const x = lum(A), y = lum(B); return { running: A, done: B, lumRatio: +((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)).toFixed(2) }; }, [ring, doneRing]);
      out.V4[theme] = lr;
      if (theme === 'midnight' || theme === 'hearth') row.doneShot = await shot(d.page, `visual-done-${theme}-ipad.png`);
      await L.apiAs('mom', '/api/data/timer/batch?scope=person', { method: 'POST', body: { items: [{ key: 'timer.active', value: { endAt: Date.now() + 600000, total: 900, startedAt: Date.now() - 300000 }, updated_at: Date.now() }] } });
      await d.close(); }
    out.V1[theme] = row;
  }
  // V2 + V3 on the iPad (portrait and landscape) and the iPhone, inside the hub viewer
  out.V2 = {}; out.V3 = {};
  for (const device of ['ipad-portrait', 'ipad-landscape', 'iphone-pwa', 'desktop']) {
    const d = await L.device({ device, profile: 'mom', fixedTime: false });
    const f = await d.openApp('timer', { wait: '#go' }); await sleep(1500);
    const m = await f.evaluate(() => {
      const t = document.getElementById('t'); const cs = getComputedStyle(t);
      const c = document.createElement('canvas').getContext('2d'); c.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      const mt = c.measureText('0123456789'); const digitH = mt.actualBoundingBoxAscent + mt.actualBoundingBoxDescent;
      const items = [['time', '#t'], ['title', '.hd h1'], ['preset', '[data-s="60"]'], ['start', '#go'], ['reset', '#reset']].map(([k, s]) => { const e = document.querySelector(s); const x = getComputedStyle(e); const r = e.getBoundingClientRect(); return { k, fs: parseFloat(x.fontSize), fw: x.fontWeight, ff: x.fontFamily.split(',')[0], radius: x.borderRadius, w: Math.round(r.width), h: Math.round(r.height), shown: x.display !== 'none' && getComputedStyle(e.closest('.hd') || e).display !== 'none' }; });
      const dial = document.getElementById('dial'), dr = dial.getBoundingClientRect();
      return { items, digitHeightPx: +digitH.toFixed(1), fontPx: parseFloat(cs.fontSize), dial: { w: Math.round(dr.width), h: Math.round(dr.height), radius: getComputedStyle(dial).borderRadius, backdrop: getComputedStyle(dial).backdropFilter || getComputedStyle(dial).webkitBackdropFilter } };
    });
    const pillTop = await d.page.evaluate(() => { const p = document.getElementById('pill'); const s = getComputedStyle(p); return { h: Math.round(p.getBoundingClientRect().height), title: getComputedStyle(document.getElementById('pill-label')).fontSize }; });
    out.V2[device] = { ...m, nearestDT: m.items.map(i => ({ k: i.k, fs: i.fs, dt: nearestDT(i.fs)[0] })), viewerBar: pillTop };
    const mm = m.digitHeightPx * 0.192;
    out.V3[device] = { digitHeightPx: m.digitHeightPx, digitHeightMm_11inIpad: +mm.toFixed(1), readableUpToM_by_h_ge_d_over_200: +(mm * 200 / 1000).toFixed(2) };
    await d.close();
  }
} finally { await L.close(); }
console.log(JSON.stringify(out, null, 1));
console.log('saved', save('visual.json', out));
