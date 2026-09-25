// Skeptic #1 for the TELL finding "named-theme-cold-load-flash". Independent of flash.mjs.
//   node audits/tools/phase4/TELL/verify-named-theme-cold-load-flash-1.mjs chromium|webkit [hold|timing] [area…]
// HOLD test (both engines, deterministic): light OS, Midnight stored (localStorage 'hub.theme' + the person row).
//   hub.js for the target document is HELD (the route never answers until released). 900 ms after the trigger we read, in the
//   target document: data-theme / data-scheme, the computed background of <body> and <html>, whether window.hub exists, and a
//   screenshot of the target box (mean relative luminance). Then hub.js is released and the same values are read again.
//   Control: the same with hub.js not held.
// TIMING test (Chromium only): hub.js delayed 400 ms; CDP screencast; flash duration = time from the first frame that is
//   "light" (mean luminance >= settled + 0.3) to the first later frame that is not (a screencast frame persists until the next).
// Evidence: audits/evidence/p4/TELL/verify-named-theme-cold-load-flash-1-<engine>.json (+ -<area>-held.png for a few areas).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep } from '../../lib/local.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const EV = path.join(ROOT, 'audits/evidence/p4/TELL');
const engine = process.argv[2] === 'webkit' ? 'webkit' : 'chromium';
const test = process.argv[3] || 'hold';
const ALL = ['shell', 'tv', 'f260', 'leftovers', 'prayer', 'tally', 'timer', 'kidverse', 'verses'];
const want = process.argv.slice(4).length ? process.argv.slice(4) : ALL;
const OUT = path.join(EV, `verify-named-theme-cold-load-flash-1-${engine}.json`);
const out = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : { engine, hold: {}, timing: {} };
out.hold ||= {}; out.timing ||= {};
const SAVE = new Set(['shell', 'f260', 'tally']);
const prof = a => a === 'tv' ? 'tv' : a === 'kidverse' ? 'ezra' : 'eli';
const L = await local({ variant: 'typical', engine });
const dec = await L.browser.newPage();
const lum = (b64, rect) => dec.evaluate(async ([b64, r]) => {
  const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode();
  const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0);
  const k = im.width / r.vw; const d = g.getImageData(Math.round(r.x * k), Math.round(r.y * k), Math.max(1, Math.round(r.w * k)), Math.max(1, Math.round(r.h * k))).data;
  const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  let n = 0, s = 0; for (let i = 0; i < d.length; i += 20) { n++; s += 0.2126 * f(d[i]) + 0.7152 * f(d[i + 1]) + 0.0722 * f(d[i + 2]); }
  return +(s / n).toFixed(3);
}, [b64, rect]);
const probe = doc => doc.evaluate(() => ({ theme: document.documentElement.dataset.theme || '(none)', scheme: document.documentElement.dataset.scheme || '(none)', hub: !!window.hub,
  bodyBg: document.body ? getComputedStyle(document.body).backgroundColor : null, htmlBg: getComputedStyle(document.documentElement).backgroundColor,
  bgToken: getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || null })).catch(e => ({ err: String(e.message).split('\n')[0] }));

async function setup(area, delayMode) {
  await L.apiAs(prof(area) === 'tv' ? 'eli' : prof(area), '/api/data/hub/theme?scope=person', { method: 'PUT', body: { value: 'midnight' } });
  const d = await L.device({ device: area === 'tv' ? 'tv' : 'ipad-portrait', mode: 'light', profile: prof(area), localStorage: { 'hub.theme': JSON.stringify('midnight') } });
  const shellArea = area === 'shell' || area === 'tv';
  if (!shellArea) { await d.goto('#home'); await d.page.waitForFunction(() => window.hub && document.querySelector('#shell:not([hidden])'), null, { timeout: 15000 }).catch(() => {}); await sleep(1000); }
  else await d.page.setContent('<html style="background:#301030;height:100%"><body></body></html>');
  let release = null; const gate = new Promise(r => { release = r; });
  if (delayMode) await d.ctx.route(/\/apps\/hub\.js(\?.*)?$/, async r => { const fr = r.request().frame(); const target = shellArea ? fr === d.page.mainFrame() : fr !== d.page.mainFrame(); if (target) { if (delayMode === 'hold') await gate; else await sleep(delayMode); } await r.continue(); });
  const trigger = async () => { if (shellArea) await d.page.goto(L.site + '/index.html#home', { waitUntil: 'commit' }); else await d.page.evaluate(id => { location.hash = '#' + id; }, area); };
  const docOf = () => shellArea ? d.page.mainFrame() : (d.page.frames().find(x => x.url().includes(`/apps/${area}.html`)) || null);
  const rectOf = async () => { const vs = d.page.viewportSize(); if (shellArea) return { x: 0, y: 0, w: vs.width, h: vs.height, vw: vs.width }; const b = await d.page.$eval('#frame', e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }).catch(() => null); return b ? { ...b, vw: vs.width } : { x: 0, y: 0, w: vs.width, h: vs.height, vw: vs.width }; };
  return { d, trigger, docOf, rectOf, release: () => release() };
}
try {
  for (const area of want) {
    if (test === 'hold') {
      const R = {};
      for (const mode of ['hold', 0]) {
        const s = await setup(area, mode);
        await s.trigger(); await sleep(900);
        const doc = s.docOf(); const rect = await s.rectOf();
        const shot = await s.d.page.screenshot({ scale: 'css', timeout: 4000 }).catch(() => null);
        const before = { ...(doc ? await probe(doc) : { err: 'no frame' }), meanL: shot ? await lum(shot.toString('base64'), rect) : 'screenshot timed out (WebKit waits for fonts while the document is held)' };
        if (mode === 'hold' && SAVE.has(area) && shot) { const b = await s.d.page.screenshot({ scale: 'css', timeout: 4000, clip: { x: rect.x, y: rect.y, width: rect.w, height: rect.h } }).catch(() => null); if (b) fs.writeFileSync(path.join(EV, `verify-named-theme-cold-load-flash-1-${engine}-${area}-held.png`), b); }
        s.release(); await sleep(1500);
        const doc2 = s.docOf(); const shot2 = await s.d.page.screenshot({ scale: 'css', timeout: 8000 }).catch(() => null);
        const after = { ...(doc2 ? await probe(doc2) : { err: 'no frame' }), meanL: shot2 ? await lum(shot2.toString('base64'), rect) : null };
        R[mode === 'hold' ? 'held' : 'immediate'] = { before, after };
        await s.d.close();
      }
      out.hold[area] = R; console.log(engine, 'hold', area, JSON.stringify(R));
    } else if (engine === 'chromium') {
      const R = {};
      for (const delay of [400, 0]) {
        const s = await setup(area, delay || null);
        const frames = []; const cdp = await s.d.ctx.newCDPSession(s.d.page);
        cdp.on('Page.screencastFrame', async f => { frames.push({ t: Date.now(), data: f.data }); try { await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch {} });
        await cdp.send('Page.startScreencast', { format: 'png', everyNthFrame: 1 });
        await sleep(200); const t0 = Date.now(); await s.trigger(); await sleep(2600); const t1 = Date.now();
        await cdp.send('Page.stopScreencast').catch(() => {});
        const rect = await s.rectOf();
        const st = []; for (const f of frames.filter(f => f.t >= t0)) st.push([f.t - t0, await lum(f.data, rect)]);
        const settled = st.length ? st[st.length - 1][1] : null;
        let start = null, end = null;
        for (const [ms, m] of st) { if (start === null && m >= settled + 0.3) start = ms; else if (start !== null && end === null && m < settled + 0.3) end = ms; }
        R['d' + delay] = { frames: st.length, settled, maxL: st.length ? Math.max(...st.map(x => x[1])) : null, flashStartMs: start, flashEndMs: end, flashMs: start !== null ? (end ?? (t1 - t0)) - start : 0, series: st.slice(0, 40) };
        await s.d.close();
      }
      out.timing[area] = R; console.log(engine, 'timing', area, JSON.stringify({ d400: { ...R.d400, series: undefined }, d0: { ...R.d0, series: undefined } }));
    }
    fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
  }
  for (const p of ['eli', 'ezra']) await L.apiAs(p, '/api/data/hub/theme?scope=person', { method: 'PUT', body: { value: 'system' } }).catch(() => {});
} finally { await L.close(); }
console.log('wrote', path.relative(ROOT, OUT));
