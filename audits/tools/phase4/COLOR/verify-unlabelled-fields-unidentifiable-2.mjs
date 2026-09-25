// Phase 4 COLOR skeptic #2 for "unlabelled-fields-unidentifiable". Independent of spot.mjs / components.mjs / skeptic 1.
// For each theme key (system on a light and a dark OS, and the five named palettes on a light OS), as Eli on iPad
// portrait (WebKit), it measures RENDERED pixels, not tokens:
//   shell  #remtext (Home reminder add row) and #chat-in (Chat composer)
//   f260   #pass1 (passcode modal, opened in-page by adding .on to #pass: inspection only)
//   prayer #f-title (Add a request; shown with the app's own go('add'))
//   leftovers #name (Larder add bar, the control case)
// Placeholder: two screenshots, with the placeholder attribute and with it emptied; pixels that change are the ink;
// background = median of the unchanged inner pixels; ratio = the ink pixel furthest in luminance from the bg (the
// glyph core) and the median ink pixel. Border: the median of the 1-2 px top/bottom border band versus the median of the
// band 3 px outside the box and 4 px inside it. Also records computed colours, labels (label[for], wrapping label,
// aria-label, aria-labelledby) and font size.
// Usage: node audits/tools/phase4/COLOR/verify-unlabelled-fields-unidentifiable-2.mjs
import { local, sleep } from '../../lib/local.mjs';
import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib';
const EV = path.resolve('audits/evidence/p4/COLOR'); fs.mkdirSync(EV, { recursive: true });
const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
const cr = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return +((x + .05) / (y + .05)).toFixed(2); };
const hex = c => '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
const med = arr => { const s = [...arr].sort((p, q) => lum(p) - lum(q)); return s[s.length >> 1]; };
function png(buf) { let o = 8, w, h, ct, idat = []; while (o < buf.length) { const len = buf.readUInt32BE(o), t = buf.toString('ascii', o + 4, o + 8), d = buf.subarray(o + 8, o + 8 + len); if (t === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); ct = d[9]; } if (t === 'IDAT') idat.push(d); o += 12 + len; }
  const bpp = ct === 6 ? 4 : 3, raw = zlib.inflateSync(Buffer.concat(idat)), px = Buffer.alloc(w * h * bpp), st = w * bpp;
  for (let y = 0; y < h; y++) { const f = raw[y * (st + 1)], line = raw.subarray(y * (st + 1) + 1, (y + 1) * (st + 1)); for (let x = 0; x < st; x++) { const a = x >= bpp ? px[y * st + x - bpp] : 0, b = y ? px[(y - 1) * st + x] : 0, c = x >= bpp && y ? px[(y - 1) * st + x - bpp] : 0; let v = line[x];
    if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1; else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; } px[y * st + x] = v & 255; } }
  return { w, h, at: (x, y) => { const i = (y * w + x) * bpp; return [px[i], px[i + 1], px[i + 2]]; } }; }

const CASES = [['system', 'light'], ['system', 'dark'], ['hearth', 'light'], ['parchment', 'light'], ['frost', 'light'], ['midnight', 'light'], ['forest', 'light']];
const out = { script: 'audits/tools/phase4/COLOR/verify-unlabelled-fields-unidentifiable-2.mjs', engine: 'webkit', device: 'ipad-portrait', profile: 'eli', runs: {} };

async function measureField(d, ctx, sel, off, shotName) {
  const info = await ctx.evaluate(s => { const e = document.querySelector(s); if (!e) return null; e.scrollIntoView({ block: 'center' });
    const c = getComputedStyle(e), b = e.getBoundingClientRect();
    let ph = null; try { ph = getComputedStyle(e, '::placeholder').color; } catch {}
    const lab = e.id && document.querySelector(`label[for="${e.id}"]`);
    const wrap = e.closest('label');
    const visibleLabel = (lab && lab.offsetParent !== null && lab.textContent.trim()) || (wrap && [...wrap.childNodes].filter(n => n !== e && (n.nodeType === 3 || !n.contains(e))).map(n => n.textContent).join('').trim()) || null;
    return { sel: s, placeholder: e.placeholder, visibleLabel, ariaLabel: e.getAttribute('aria-label'), ariaLabelledby: e.getAttribute('aria-labelledby'),
      fontSize: c.fontSize, color: c.color, bg: c.backgroundColor, border: `${c.borderTopWidth} ${c.borderTopStyle} ${c.borderTopColor}`, computedPlaceholder: ph,
      rect: [b.x, b.y, b.width, b.height] }; }, sel);
  if (!info) return { sel, missing: true };
  await sleep(300);
  const r2 = await ctx.evaluate(s => { const b = document.querySelector(s).getBoundingClientRect(); return [b.x, b.y, b.width, b.height]; }, sel); info.rect = r2;
  const on = png(await d.page.screenshot({ scale: 'css' }));
  if (shotName) await d.page.screenshot({ path: path.join(EV, shotName), scale: 'css', clip: { x: Math.max(0, r2[0] + off[0] - 24), y: Math.max(0, r2[1] + off[1] - 24), width: Math.min(r2[2] + 48, 900), height: r2[3] + 48 } });
  await ctx.evaluate(s => { const e = document.querySelector(s); e.dataset.ph = e.placeholder; e.placeholder = ''; }, sel); await sleep(250);
  const offShot = png(await d.page.screenshot({ scale: 'css' }));
  await ctx.evaluate(s => { const e = document.querySelector(s); e.placeholder = e.dataset.ph; }, sel);
  const [x, y, w, h] = r2, X = v => Math.round(v + off[0]), Y = v => Math.round(v + off[1]);
  const bg = [], ink = [];
  for (let yy = Math.ceil(y + 4); yy < y + h - 4; yy++) for (let xx = Math.ceil(x + 6); xx < x + w - 6; xx++) { const a = offShot.at(X(xx), Y(yy)), b = on.at(X(xx), Y(yy)); if (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) > 24) ink.push(b); else bg.push(a); }
  const B = med(bg); info.renderedFieldBg = hex(B);
  if (ink.length) { const core = ink.reduce((m, p) => Math.abs(lum(p) - lum(B)) > Math.abs(lum(m) - lum(B)) ? p : m); info.placeholderCore = hex(core); info.placeholderCoreRatio = cr(core, B); info.placeholderMedianRatio = cr(med(ink.sort((p, q) => Math.abs(lum(q) - lum(B)) - Math.abs(lum(p) - lum(B))).slice(0, Math.max(1, ink.length >> 2))), B); info.inkPixels = ink.length; }
  // border band: top and bottom edges across the middle 60 % of the width, avoiding rounded corners
  const band = (dy) => { const px = []; for (let xx = Math.ceil(x + w * .2); xx < x + w * .8; xx++) { px.push(offShot.at(X(xx), Y(y + dy))); px.push(offShot.at(X(xx), Y(y + h - 1 - dy))); } return med(px); };
  const outside = band(-3), edge = band(0), inside = band(4);
  info.border = { outside: hex(outside), edge: hex(edge), inside: hex(inside), edgeVsOutside: cr(edge, outside), edgeVsInside: cr(edge, inside), insideVsOutside: cr(inside, outside) };
  return info;
}

const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
try {
  for (const [theme, mode] of CASES) {
    const key = `${theme}-${mode}os`; const run = out.runs[key] = {};
    await L.apiAs('eli', '/api/data/hub/theme?scope=person', { method: 'PUT', body: { value: theme } });
    const d = await L.device({ device: 'ipad-portrait', mode, profile: 'eli', localStorage: { 'hub.theme': JSON.stringify(theme) } });
    try {
      await d.goto('#home'); await d.page.waitForSelector('#remtext', { timeout: 20000 }); await sleep(2500);
      run.resolved = await d.page.evaluate(() => ({ theme: document.documentElement.dataset.theme, scheme: document.documentElement.dataset.scheme,
        mutedDecor: getComputedStyle(document.documentElement).getPropertyValue('--muted-decor').trim(), line: getComputedStyle(document.documentElement).getPropertyValue('--line').trim(), surface: getComputedStyle(document.documentElement).getPropertyValue('--surface').trim() }));
      const shotH = ['system-lightos', 'midnight-lightos', 'frost-lightos'].includes(key) ? `verify-unlabelled-fields-unidentifiable-2-remtext-${key}.png` : null;
      run.remtext = await measureField(d, d.page, '#remtext', [0, 0], shotH);
      await d.goto('#chat'); await sleep(2500);
      const vis = await d.page.evaluate(() => { const f = document.getElementById('chat-form'); return f && !f.hidden; });
      run.chatIn = vis ? await measureField(d, d.page, '#chat-in', [0, 0], key === 'system-lightos' ? `verify-unlabelled-fields-unidentifiable-2-chatin-${key}.png` : null) : { hidden: true };
      if (['system-lightos', 'hearth-lightos', 'midnight-lightos', 'frost-lightos'].includes(key) || key === 'system-darkos') {
        const off = async () => d.page.evaluate(() => { const b = document.querySelector('iframe').getBoundingClientRect(); return [b.x, b.y]; });
        let f = await d.openApp('f260'); await sleep(2500);
        await f.evaluate(() => { document.getElementById('pass').classList.add('on'); document.getElementById('pass2').style.display = 'block'; });
        await sleep(400);
        run.f260pass1 = await measureField(d, f, '#pass1', await off(), key === 'system-lightos' ? `verify-unlabelled-fields-unidentifiable-2-f260pass-${key}.png` : null);
        await f.evaluate(() => document.getElementById('pass').classList.remove('on'));
        f = await d.openApp('prayer'); await sleep(2500);
        await f.evaluate(() => { try { go('add'); } catch { document.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === 's-add')); } });
        await sleep(600);
        run.prayerTitle = await measureField(d, f, '#f-title', await off(), key === 'system-lightos' ? `verify-unlabelled-fields-unidentifiable-2-prayer-${key}.png` : null);
        run.prayerFor = await measureField(d, f, '#f-for', await off(), null);
        f = await d.openApp('leftovers'); await sleep(2500);
        run.larderName = await measureField(d, f, '#name', await off(), null);
      }
    } finally { await d.close?.(); }
    console.log(key, JSON.stringify({ r: run.resolved, rem: run.remtext && [run.remtext.placeholderCoreRatio, run.remtext.border?.edgeVsOutside, run.remtext.border?.edgeVsInside], chat: run.chatIn && [run.chatIn.placeholderCoreRatio, run.chatIn.border?.edgeVsOutside, run.chatIn.border?.edgeVsInside],
      pass1: run.f260pass1 && [run.f260pass1.computedPlaceholder, run.f260pass1.placeholderCoreRatio, run.f260pass1.border?.edgeVsOutside], prayer: run.prayerTitle && [run.prayerTitle.visibleLabel, run.prayerTitle.computedPlaceholder, run.prayerTitle.placeholderCoreRatio, run.prayerTitle.border?.edgeVsOutside], larder: run.larderName && [run.larderName.placeholderCoreRatio, run.larderName.border?.edgeVsOutside] }));
  }
} finally { await L.close(); }
fs.writeFileSync(path.join(EV, 'verify-unlabelled-fields-unidentifiable-2.json'), JSON.stringify(out, null, 1));
console.log('wrote', path.join(EV, 'verify-unlabelled-fields-unidentifiable-2.json'));
