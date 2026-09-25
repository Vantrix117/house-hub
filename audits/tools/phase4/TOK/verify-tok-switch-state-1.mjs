// Phase 4 TOK skeptic #1: re-measure the .switch (apps/design.css:455-462) as it renders on the shell's Me → Notifications card.
// Per theme: computed tokens, then PIXELS from a 1x screenshot of each switch (off and on) decoded in the page:
// track vs the card pixels just outside it (what the eye compares), knob vs track. The Notifications card is .card.glass
// (index.html:1262), so the switch does not sit on --surface; the pixel sample shows what it really sits on.
// Measurement-only DOM tweaks inside the test page: un-hide #notif-prefs (hidden until push is set up), enable #notif-toggle
// and set its aria-checked=false so one switch is off and one on. No app code is changed.
//   node audits/tools/phase4/TOK/verify-tok-switch-state-1.mjs  → audits/evidence/p4/TOK/verify-tok-switch-state-1.json (+ PNGs)
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';
import { OUT } from './lib-tok.mjs';

const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const cr = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return +((x + 0.05) / (y + 0.05)).toFixed(2); };
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));

const THEMES = [['system', 'light'], ['system', 'dark'], ['hearth', 'light'], ['parchment', 'light'], ['frost', 'light'], ['midnight', 'dark'], ['forest', 'dark']];
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const res = { note: 'pixel samples from a 1x WebKit screenshot; track = inside the track clear of the knob; outside = card pixel 6 px left of the switch; knob = knob centre', runs: [] };
try {
  for (const [theme, mode] of THEMES) {
    await L.apiAs('eli', '/api/data/hub/theme?scope=person', { method: 'PUT', body: { value: theme, updated_at: Date.now() } });
    const d = await L.device({ device: 'ipad-portrait', mode, profile: 'eli', localStorage: theme === 'system' ? {} : { 'hub.theme': JSON.stringify(theme) } });
    await d.goto('#me'); await sleep(2500);
    const prep = await d.page.evaluate(() => {
      const prefs = document.querySelector('#notif-prefs'); const wasHidden = prefs && prefs.hidden; if (prefs) prefs.hidden = false;
      const t = document.querySelector('#notif-toggle'); const wasDisabled = t && t.disabled;
      if (t) { t.disabled = false; t.setAttribute('aria-checked', 'false'); }
      const root = getComputedStyle(document.documentElement);
      const tok = n => root.getPropertyValue(n).trim();
      const card = document.querySelector('#notif'); const ccs = card && getComputedStyle(card);
      const sw = [...document.querySelectorAll('.switch')];
      document.querySelector('#notif')?.scrollIntoView({ block: 'center' });
      return { dataTheme: document.documentElement.dataset.theme || null, scheme: document.documentElement.dataset.scheme, wasHidden, wasDisabled,
        tokens: { line: tok('--line'), surface: tok('--surface'), ok: tok('--ok'), glass: tok('--glass') },
        card: ccs && { bg: ccs.backgroundColor, bgImage: ccs.backgroundImage.slice(0, 120), backdrop: ccs.backdropFilter || ccs.webkitBackdropFilter },
        switches: sw.map(s => ({ id: s.id || s.dataset.pref, checked: s.getAttribute('aria-checked'), bg: getComputedStyle(s).backgroundColor, opacity: getComputedStyle(s).opacity, knob: getComputedStyle(s, '::after').backgroundColor })) };
    });
    await sleep(700);   // switch background transition
    const boxes = await d.page.evaluate(() => [...document.querySelectorAll('.switch')].map(s => { const r = s.getBoundingClientRect(); return { id: s.id || s.dataset.pref, checked: s.getAttribute('aria-checked'), x: r.x, y: r.y, w: r.width, h: r.height }; }));
    const tag = `${theme}-${mode}`;
    const b0 = boxes[0], bl = boxes[boxes.length - 1];
    const clip = { x: Math.max(0, b0.x - 400), y: Math.max(0, b0.y - 20), width: 470, height: Math.min(900 , bl.y + bl.h + 20 - (b0.y - 20)) };
    const png = await d.page.screenshot({ scale: 'css', animations: 'disabled', caret: 'hide' });
    const file = path.join(OUT, `verify-tok-switch-state-1-${tag}.png`);
    await d.page.screenshot({ path: file, scale: 'css', animations: 'disabled', caret: 'hide', clip });
    const samples = await d.page.evaluate(async ({ b64, boxes }) => {
      const img = await createImageBitmap(await (await fetch('data:image/png;base64,' + b64)).blob());
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
      const px = (x, y) => [...g.getImageData(Math.round(x), Math.round(y), 1, 1).data].slice(0, 3);
      return boxes.map(b => { const cy = b.y + b.h / 2; const off = b.checked !== 'true';
        return { id: b.id, checked: b.checked, track: px(off ? b.x + b.w - 8 : b.x + 8, cy), outsideLeft: px(b.x - 6, cy), outsideAbove: px(b.x + b.w / 2, b.y - 3), knob: px(off ? b.x + 16 : b.x + 36, cy) }; });
    }, { b64: png.toString('base64'), boxes });
    const m = samples.map(s => ({ ...s, trackVsOutside: cr(s.track, s.outsideLeft), trackVsAbove: cr(s.track, s.outsideAbove), knobVsTrack: cr(s.knob, s.track) }));
    const tokenPairs = { lineVsSurface: cr(hex(prep.tokens.line), hex(prep.tokens.surface)), whiteVsOk: cr([255, 255, 255], hex(prep.tokens.ok)), okVsSurface: cr(hex(prep.tokens.ok), hex(prep.tokens.surface)), whiteVsLine: cr([255, 255, 255], hex(prep.tokens.line)) };
    const run = { theme, mode, ...prep, tokenPairs, measured: m, png: path.relative(process.cwd(), file).split(path.sep).join('/') };
    res.runs.push(run);
    const offS = m.find(x => x.checked !== 'true'), onS = m.find(x => x.checked === 'true');
    console.log(`${tag.padEnd(16)} data-theme=${run.dataTheme} scheme=${run.scheme} tokens line/surface ${tokenPairs.lineVsSurface} white/ok ${tokenPairs.whiteVsOk} ok/surface ${tokenPairs.okVsSurface} white/line ${tokenPairs.whiteVsLine}` +
      ` | PIXELS off: track ${offS?.track} vs card ${offS?.outsideLeft} = ${offS?.trackVsOutside} (above ${offS?.trackVsAbove}), knob/track ${offS?.knobVsTrack}` +
      ` | on: track vs card ${onS?.trackVsOutside}, knob ${onS?.knob}/track ${onS?.track} = ${onS?.knobVsTrack} | switches ${m.length} card bg ${prep.card?.bg}`);
    await d.ctx.close();
  }
} finally { await L.close(); }
fs.writeFileSync(path.join(OUT, 'verify-tok-switch-state-1.json'), JSON.stringify(res, null, 1));
console.log('wrote audits/evidence/p4/TOK/verify-tok-switch-state-1.json');
