// TELL / flash: "white flash on load or navigation", the same capture in all 11 areas and both engines.
//   node audits/tools/phase4/TELL/flash.mjs chromium|webkit [area…]   → audits/evidence/p4/TELL/flash-<engine>.json (merged)
// Scenarios (iPad portrait; the TV area on the TV):
//   A  dark OS, System theme          (P2's case: the OS scheme and the palette agree)
//   B  light OS, Midnight theme       (a named dark palette on a light OS: the palette is applied only when hub.js runs)
//   C  light OS, System theme (delay 0 only): a DARK flash — the viewer turns near-black for the "dark": true apps
//      (apps.json:9-10, index.html:331) before a light app paints; darkFlash = settled light (lightShare >= 0.35) and a
//      frame whose mean luminance is >= 0.3 below it. Run one scenario with FLASH_SCEN=C.
// each with hub.js answered at once (0) or 400 ms late (a cold, service-worker-less load: first visit, a Safari tab,
// the first open after a deploy). Apps open through the shell's hash route from a settled Home; shell and TV are a cold
// load of index.html. Frames: Chromium = CDP Page.startScreencast (every compositor frame); WebKit = screenshots in a loop
// (~8-15 per second, so a short flash can be missed: WebKit is the cross-check, not the proof).
// Per frame, over the app's iframe box (whole viewport for shell/TV): lightShare = share of pixels with relative luminance
// > 0.45. A FLASH = a frame, after the trigger, whose lightShare exceeds the settled frame's by >= 0.35 while the settled
// frame is dark (lightShare < 0.35). The brightest frame of every flash is saved as a 1x PNG:
//   audits/evidence/p4/TELL/flash-<engine>-<area>-<scenario>-<delay>.png  (also saved for a PALETTE flash: a frame whose mean
//   relative luminance exceeds the settled frame's by >= 0.15 — the light palette painted before hub.js applies the theme)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep } from '../../lib/local.mjs';
import { AREAS, profileFor, deviceFor } from './areas.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const EV = path.join(ROOT, 'audits/evidence/p4/TELL');
const engine = process.argv[2] === 'webkit' ? 'webkit' : 'chromium';
const want = process.argv.slice(3).length ? process.argv.slice(3) : AREAS;
const OUT = path.join(EV, `flash-${engine}.json`);
const prev = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : { areas: {} };
const out = { note: 'See the header of audits/tools/phase4/TELL/flash.mjs.', engine, areas: prev.areas || {} };
const SCEN = [{ id: 'A', mode: 'dark', theme: 'system' }, { id: 'B', mode: 'light', theme: 'midnight' }, { id: 'C', mode: 'light', theme: 'system', delays: [0] }];
const ONLY = process.env.FLASH_SCEN ? process.env.FLASH_SCEN.split(',') : null;
const DELAYS = [0, 400];

const L = await local({ variant: 'typical', engine });
const dec = await L.browser.newPage();
async function stats(b64, mime, rect, save) {
  return dec.evaluate(async ([b64, mime, r, save]) => {
    const im = new Image(); im.src = `data:${mime};base64,` + b64; await im.decode();
    const sx = im.width / r.vw; // screencast / screenshot may be at device pixels
    const c = document.createElement('canvas'); c.width = Math.round(r.vw); c.height = Math.round(im.height / sx); const g = c.getContext('2d'); g.drawImage(im, 0, 0, c.width, c.height);
    const d = g.getImageData(Math.round(r.x), Math.round(r.y), Math.max(1, Math.round(r.w)), Math.max(1, Math.round(r.h))).data;
    const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    let n = 0, light = 0, sum = 0;
    for (let i = 0; i < d.length; i += 16) { const L = 0.2126 * f(d[i]) + 0.7152 * f(d[i + 1]) + 0.0722 * f(d[i + 2]); n++; sum += L; if (L > 0.45) light++; }
    return { lightShare: +(light / n).toFixed(3), meanL: +(sum / n).toFixed(3), png: save ? c.toDataURL('image/png').split(',')[1] : null };
  }, [b64, mime, rect, save]);
}
try {
  for (const area of want) {
    const A = out.areas[area] = out.areas[area] || {};
    for (const sc of SCEN) for (const delay of (sc.delays || DELAYS)) {
      if (ONLY && !ONLY.includes(sc.id)) continue;
      const key = `${sc.id}-${delay}`;
      const R = { scenario: sc, delay };
      try {
        const p0 = profileFor(area);
        await L.apiAs(p0 === 'tv' ? 'eli' : p0, '/api/data/hub/theme?scope=person', { method: 'PUT', body: { value: sc.theme } });
        const d = await L.device({ device: deviceFor(area, 'ipad-portrait'), mode: sc.mode, profile: p0, localStorage: sc.theme === 'system' ? null : { 'hub.theme': JSON.stringify(sc.theme) } });
        const page = d.page; const vs = page.viewportSize();
        const shellArea = area === 'shell' || area === 'tv';
        // the tab starts on about:blank, which Chromium paints white on a light OS: replace it with a dark marker page first so
        // the frames held over from before the navigation cannot read as a flash
        if (shellArea) await page.setContent('<html style="background:#301030;height:100%"><body></body></html>');
        if (!shellArea) { await d.goto('#home'); await page.waitForFunction(() => window.hub && document.querySelector('#shell:not([hidden])'), null, { timeout: 15000 }).catch(() => {}); await sleep(1200); }
        if (delay) await d.ctx.route(/\/apps\/hub\.js(\?.*)?$/, async r => { const fr = r.request().frame(); if (shellArea ? fr === page.mainFrame() : fr !== page.mainFrame()) await sleep(delay); await r.continue(); });
        const frames = []; let t0 = 0; let cdp = null; let stop = false;
        if (engine === 'chromium') {
          cdp = await d.ctx.newCDPSession(page);
          cdp.on('Page.screencastFrame', async f => { frames.push({ t: Date.now(), data: f.data, mime: 'image/jpeg' }); try { await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch {} });
          await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 70, everyNthFrame: 1 });
        }
        const loop = engine === 'webkit' ? (async () => { while (!stop) { const b = await page.screenshot({ scale: 'css' }).catch(() => null); if (b) frames.push({ t: Date.now(), data: b.toString('base64'), mime: 'image/png' }); } })() : null;
        await sleep(150);
        t0 = Date.now();
        if (shellArea) await page.goto(L.site + '/index.html#home', { waitUntil: 'commit' });
        else await page.evaluate(id => { location.hash = '#' + id; }, area);
        await sleep(/dollywood/.test(area) ? 4500 : 2600);
        stop = true; if (loop) await loop;
        if (cdp) await cdp.send('Page.stopScreencast').catch(() => {});
        let rect = { x: 0, y: 0, w: vs.width, h: vs.height, vw: vs.width };
        if (!shellArea) { const b = await page.$eval('#frame', e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }).catch(() => null); if (b) rect = { ...b, vw: vs.width }; }
        const fr = frames.filter(f => f.t >= t0);
        R.frames = fr.length; R.rect = rect;
        const st = [];
        for (const f of fr) st.push({ ms: f.t - t0, ...(await stats(f.data, f.mime, rect, false)) });
        const settled = st[st.length - 1] || null;
        R.settled = settled && { lightShare: settled.lightShare, meanL: settled.meanL };
        R.appliedTheme = await (shellArea ? page.mainFrame() : (page.frames().find(x => x.url().includes(`/apps/${area}.html`)) || page.mainFrame())).evaluate(() => [document.documentElement.dataset.theme || '(none)', document.documentElement.dataset.scheme]).catch(() => null);
        const dark = settled && settled.lightShare < 0.35;
        let worst = null; for (const s of st) if (!worst || s.lightShare > worst.lightShare || (s.lightShare === worst.lightShare && s.meanL > worst.meanL)) worst = s;
        R.brightest = worst && { ms: worst.ms, lightShare: worst.lightShare, meanL: worst.meanL };
        R.flash = !!(dark && worst && worst.lightShare - settled.lightShare >= 0.35);
        R.paletteFlash = !!(settled && worst && worst.meanL - settled.meanL >= 0.15);
        let darkest = null; for (const s of st) if (!darkest || s.meanL < darkest.meanL) darkest = s;
        R.darkest = darkest && { ms: darkest.ms, lightShare: darkest.lightShare, meanL: darkest.meanL };
        R.darkFlash = !!(settled && darkest && settled.lightShare >= 0.35 && settled.meanL - darkest.meanL >= 0.3);
        R.flashFrames = dark ? st.filter(s => s.lightShare - settled.lightShare >= 0.35).length : 0;
        R.flashSpanMs = R.flashFrames ? (() => { const fl = st.filter(s => s.lightShare - settled.lightShare >= 0.35); return [fl[0].ms, fl[fl.length - 1].ms]; })() : null;
        R.series = st.map(s => [s.ms, s.lightShare, s.meanL]).slice(0, 80);
        if (R.flash || R.paletteFlash || R.darkFlash) {
          const wf = fr[st.indexOf(R.darkFlash ? darkest : worst)];
          const s = await stats(wf.data, wf.mime, rect, true);
          const file = path.join(EV, `flash-${engine}-${area}-${sc.id}-${delay}.png`); fs.writeFileSync(file, Buffer.from(s.png, 'base64')); R.shot = path.relative(ROOT, file).replace(/\\/g, '/');
        }
        await d.close();
      } catch (e) { R.error = String(e.message || e).split('\n')[0]; }
      A[key] = R;
      console.log(engine, area, key, JSON.stringify({ frames: R.frames, flash: R.flash, pal: R.paletteFlash, darkFlash: R.darkFlash, darkest: R.darkest, span: R.flashSpanMs, brightest: R.brightest, settled: R.settled, theme: R.appliedTheme, err: R.error }));
      fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
    }
    await L.apiAs(profileFor(area) === 'tv' ? 'eli' : profileFor(area), '/api/data/hub/theme?scope=person', { method: 'PUT', body: { value: 'system' } });
  }
} finally { await L.close(); }
console.log('wrote', path.relative(ROOT, OUT));
