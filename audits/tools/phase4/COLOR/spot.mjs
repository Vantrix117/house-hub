// Phase 4 COLOR: independent spot-check of the worst and newest pairs, without the rig's page-lib.
// For each case: set the theme the way the rig does (server row PUT as the profile + localStorage 'hub.theme'), open the
// screen, read the element's computed text colour and opacity chain, hide all text in its document, screenshot at 1x CSS,
// sample the pixels inside the element's first line box, blend the text colour over each, and report p10 / median ratio.
// Placeholders are read from ::placeholder. Usage: node audits/tools/phase4/COLOR/spot.mjs
import { local, sleep } from '../../lib/local.mjs';
import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib';
const EV = path.resolve('audits/evidence/p4/COLOR'); fs.mkdirSync(EV, { recursive: true });
const lin = v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; };
const lum = ([r, g, b]) => .2126 * lin(r) + .7152 * lin(g) + .0722 * lin(b);
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + .05) / (y + .05); };
function png(buf) { let o = 8, w, h, ct, idat = []; while (o < buf.length) { const len = buf.readUInt32BE(o), t = buf.toString('ascii', o + 4, o + 8), d = buf.subarray(o + 8, o + 8 + len); if (t === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); ct = d[9]; } if (t === 'IDAT') idat.push(d); o += 12 + len; }
  const bpp = ct === 6 ? 4 : 3, raw = zlib.inflateSync(Buffer.concat(idat)), px = Buffer.alloc(w * h * bpp), st = w * bpp;
  for (let y = 0; y < h; y++) { const f = raw[y * (st + 1)], line = raw.subarray(y * (st + 1) + 1, (y + 1) * (st + 1)); for (let x = 0; x < st; x++) { const a = x >= bpp ? px[y * st + x - bpp] : 0, b = y ? px[(y - 1) * st + x] : 0, c = x >= bpp && y ? px[(y - 1) * st + x - bpp] : 0; let v = line[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1; else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; } px[y * st + x] = v & 255; } }
  return { w, h, at: (x, y) => { const i = (Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))) * bpp; return [px[i], px[i + 1], px[i + 2]]; } }; }
const hex = c => '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();

async function measure(d, doc, sel, { placeholder = false, index = 0 } = {}) {
  const off = doc === d.page ? [0, 0] : await d.page.evaluate(() => { const b = document.querySelector('iframe#frame, iframe').getBoundingClientRect(); return [b.x, b.y]; });
  const info = await doc.evaluate(({ sel, placeholder, index }) => {
    const e = [...document.querySelectorAll(sel)].filter(x => x.getClientRects().length)[index]; if (!e) return null;
    e.scrollIntoView({ block: 'center' });
    const cs = getComputedStyle(e), col = placeholder ? getComputedStyle(e, '::placeholder').color : cs.color;
    let op = 1; for (let n = e; n && n.nodeType === 1; n = n.parentElement) op *= +getComputedStyle(n).opacity;
    let rect; if (placeholder || e.matches('input,select,textarea,button')) { const b = e.getBoundingClientRect(); rect = [b.x + 8, b.y + b.height * .3, Math.min(b.width - 16, 160), b.height * .4]; }
    else { const r = document.createRange(); r.selectNodeContents(e); const b = r.getClientRects()[0] || e.getBoundingClientRect(); rect = [b.x, b.y + b.height * .2, b.width, b.height * .6]; }
    return { text: (placeholder ? e.placeholder : (e.innerText || e.value || '')).trim().slice(0, 40), color: col, opacity: +op.toFixed(3), fs: cs.fontSize, fw: cs.fontWeight, disabled: !!e.disabled, rect, theme: document.documentElement.dataset.theme || 'system', scheme: document.documentElement.dataset.scheme };
  }, { sel, placeholder, index });
  if (!info) return { sel, error: 'not found' };
  await sleep(250);
  // re-read the rect after the scroll
  const rect2 = await doc.evaluate(({ sel, placeholder, index }) => { const e = [...document.querySelectorAll(sel)].filter(x => x.getClientRects().length)[index]; if (placeholder || e.matches('input,select,textarea,button')) { const b = e.getBoundingClientRect(); return [b.x + 8, b.y + b.height * .3, Math.min(b.width - 16, 160), b.height * .4]; } const r = document.createRange(); r.selectNodeContents(e); const b = r.getClientRects()[0] || e.getBoundingClientRect(); return [b.x, b.y + b.height * .2, b.width, b.height * .6]; }, { sel, placeholder, index });
  await doc.evaluate(() => { const s = document.createElement('style'); s.id = '__hide'; s.textContent = '*,*::placeholder{color:transparent!important;-webkit-text-fill-color:transparent!important;caret-color:transparent!important}'; document.head.append(s); });
  await sleep(120);
  const img = png(await d.page.screenshot({ scale: 'css', animations: 'disabled' }));
  await doc.evaluate(() => document.getElementById('__hide')?.remove());
  // WebKit reports color-mix() results as color(srgb r g b [/ a]) with 0-1 channels
  const srgb = /^color\(srgb/.test(info.color), m = info.color.replace(/^color\(srgb/, '').match(/[\d.]+/g).map(Number);
  const fg = m.slice(0, 3).map(v => srgb ? v * 255 : v), a = (m.length > 3 ? m[3] : 1) * info.opacity;
  const rs = [], bgs = []; const [x, y, w, h] = rect2;
  for (let yy = y; yy < y + h; yy += 1) for (let xx = x; xx < x + w; xx += 1) { const bg = img.at(Math.round(xx + off[0]), Math.round(yy + off[1])); const t = fg.map((v, i) => v * a + bg[i] * (1 - a)); rs.push(ratio(t, bg)); bgs.push(bg); }
  rs.sort((p, q) => p - q); bgs.sort((p, q) => lum(p) - lum(q));
  return { sel, ...info, alpha: +a.toFixed(3), bgMedian: hex(bgs[bgs.length >> 1]), p10: +rs[Math.floor(rs.length * .1)].toFixed(2), median: +rs[rs.length >> 1].toFixed(2), n: rs.length };
}
async function themed(L, profile, theme, mode, device = 'ipad-portrait') {
  await L.reset('typical');
  if (theme !== 'system') { const r = await L.apiAs(profile, '/api/data/hub/theme?scope=person', { method: 'PUT', body: { value: theme } }); if (r.status >= 300) throw new Error('theme PUT ' + r.status); }
  return L.device({ device, mode, profile, localStorage: theme !== 'system' ? { 'hub.theme': JSON.stringify(theme) } : {} });
}
const L = await local({ variant: 'typical', clock: 'demo' });
const res = [];
const log = (tag, r) => { res.push({ tag, ...r }); console.log(tag, JSON.stringify(r)); };
try {
  // 1. Me → Switch (the hero primary button) in dark, for an adult and both kids, plus Kiara in light
  for (const [p, th, mode] of [['eli', 'midnight', 'light'], ['kiara', 'midnight', 'light'], ['ezra', 'system', 'dark'], ['dad', 'forest', 'light'], ['kiara', 'system', 'light']]) {
    const d = await themed(L, p, th, mode); await d.goto('#me'); await d.page.waitForSelector('#switch', { timeout: 15000 }); await sleep(1500);
    log(`me-switch ${p} ${th}/${mode}os`, await measure(d, d.page, '#switch'));
    if (p === 'kiara' && th === 'midnight') await d.page.screenshot({ path: path.join(EV, 'spot-me-switch-kiara-midnight.png'), scale: 'css', clip: { x: 0, y: 0, width: 820, height: 520 } });
    await d.close();
  }
  // 2. The reminder field's placeholder (the field has no label) in Hearth, Frost, Midnight
  for (const [th, mode] of [['system', 'light'], ['frost', 'light'], ['midnight', 'light']]) {
    const d = await themed(L, 'eli', th, mode); await d.goto('#home'); await d.page.waitForSelector('#remtext', { timeout: 15000 }); await sleep(1500);
    log(`remtext-placeholder ${th}/${mode}os`, await measure(d, d.page, '#remtext', { placeholder: true }));
    await d.close();
  }
  // 3. Prayer kitchen view: category labels in the raw person colour (apps/prayer.html:359), Midnight and Hearth
  for (const [th, mode] of [['midnight', 'light'], ['system', 'light']]) {
    const d = await themed(L, 'eli', th, mode); await d.goto('#home'); const f = await d.openApp('prayer');
    await f.waitForSelector('#todayLine:not(:empty)', { timeout: 20000 }); await sleep(800);
    await f.click('#moreBtn'); await f.waitForSelector('#sheet.on', { timeout: 5000 }); await f.click('[data-more="kitchen"]'); await f.waitForSelector('#kitchen.on', { timeout: 5000 }); await sleep(600);
    log(`prayer-kitchen-kcat ${th}/${mode}os`, await measure(d, f, '#kitchen .k-cat'));
    if (th === 'midnight') await d.page.screenshot({ path: path.join(EV, 'spot-prayer-kitchen-midnight.png'), scale: 'css' });
    await d.close();
  }
  // 4. F260 gold text used as ink (the "This week" kicker / MV / chapter count) and the passcode placeholder, Hearth
  {
    const d = await themed(L, 'eli', 'system', 'light'); await d.goto('#home'); const f = await d.openApp('f260'); await sleep(3500);
    const golds = await f.evaluate(() => { const gold = getComputedStyle(document.documentElement).getPropertyValue('--gold').trim(); const p = document.createElement('i'); p.style.color = gold; document.body.append(p); const g = getComputedStyle(p).color; p.remove();
      return [...document.querySelectorAll('body *')].filter(e => e.childNodes.length && [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()) && getComputedStyle(e).color === g && e.getClientRects().length && e.getBoundingClientRect().top < innerHeight && e.getBoundingClientRect().bottom > 0).slice(0, 4).map((e, i) => { e.dataset.spot = 'g' + i; return '[data-spot="g' + i + '"]'; }); });
    for (const s of golds) log('f260-gold-text system/lightos', await measure(d, f, s));
    await d.close();
  }
} finally { await L.close(); }
fs.writeFileSync(path.join(EV, 'spot.json'), JSON.stringify({ note: 'Independent spot-check (not the rig page-lib): p10/median of the blended text colour over the rendered pixels of the first line box, text hidden, 1x CSS WebKit. disabled = the control is disabled (exempt from 1.4.3).', res }, null, 1));
console.log('saved audits/evidence/p4/COLOR/spot.json');
