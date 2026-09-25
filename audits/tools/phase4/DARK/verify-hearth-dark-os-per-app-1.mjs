// Phase 4 DARK, skeptic 1 for "hearth-dark-os-per-app": re-measure, independently of hearth-dark-os.mjs (which reads the
// measure rig's raw files), what Hearth-on-a-dark-OS does to the park map tabs, the build guide's list labels and F260's
// danger buttons, against System on the same dark OS. WebKit, iPad portrait, OS dark, Eli, park variant.
// Method: set the theme (PUT hub/theme as Eli + localStorage hub.theme; System = no row), open the app in the shell, read
// each target's computed colour, font and rect plus the document's data-theme/data-scheme and resolved tokens, then hide
// all text in the frame (color/fill transparent), take a 1x screenshot and sample the painted background inside each
// target's rect. Contrast = text colour (alpha-blended over the median background) against every sampled background pixel:
// min, p10 and median reported.
//   node audits/tools/phase4/DARK/verify-hearth-dark-os-per-app-1.mjs
// Writes audits/evidence/p4/DARK/verify-hearth-dark-os-per-app-1.json and a few 1x crops.
import { local, sleep } from '../../lib/local.mjs';
import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib';
const EV = path.resolve('audits/evidence/p4/DARK'); fs.mkdirSync(EV, { recursive: true });
const PFX = 'verify-hearth-dark-os-per-app-1';
const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
const cr = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + .05) / (y + .05); };
const parse = s => { const m = (s.match(/[\d.]+/g) || []).map(Number); return { rgb: m.slice(0, 3), a: m.length > 3 ? m[3] : 1 }; };
const hex = c => '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
function png(buf) { let o = 8, w, h, ct, idat = []; while (o < buf.length) { const len = buf.readUInt32BE(o), t = buf.toString('ascii', o + 4, o + 8), d = buf.subarray(o + 8, o + 8 + len); if (t === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); ct = d[9]; } if (t === 'IDAT') idat.push(d); o += 12 + len; }
  const bpp = ct === 6 ? 4 : 3, raw = zlib.inflateSync(Buffer.concat(idat)), px = Buffer.alloc(w * h * bpp), st = w * bpp;
  for (let y = 0; y < h; y++) { const f = raw[y * (st + 1)], line = raw.subarray(y * (st + 1) + 1, (y + 1) * (st + 1)); for (let x = 0; x < st; x++) { const a = x >= bpp ? px[y * st + x - bpp] : 0, b = y ? px[(y - 1) * st + x] : 0, c = x >= bpp && y ? px[(y - 1) * st + x - bpp] : 0; let v = line[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1; else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; } px[y * st + x] = v & 255; } }
  return { w, h, at: (x, y) => { x = Math.max(0, Math.min(w - 1, x)); y = Math.max(0, Math.min(h - 1, y)); const i = (y * w + x) * bpp; return [px[i], px[i + 1], px[i + 2]]; } }; }

const click = async (f, s) => { const l = f.locator(s).first(); await l.scrollIntoViewIfNeeded().catch(() => {}); try { await l.tap({ timeout: 4000 }); } catch { await l.click({ timeout: 4000, force: true }); } };

// measure the targets (selector -> first N matches) in frame f of device d
async function measure(d, f, targets, crop) {
  const info = await f.evaluate(targets => {
    const r = document.documentElement, cs = getComputedStyle(r), tok = n => cs.getPropertyValue(n).trim();
    const items = [];
    for (const [sel, n] of targets) {
      const els = [...document.querySelectorAll(sel)].filter(e => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 && b.bottom > 0 && b.top < innerHeight; }).slice(0, n);
      for (const e of els) { const c = getComputedStyle(e), b = e.getBoundingClientRect(); items.push({ sel, text: (e.innerText || e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 30), color: c.color, bgDecl: c.backgroundColor, fontSize: c.fontSize, fontWeight: c.fontWeight, rect: [b.x, b.y, b.width, b.height] }); }
    }
    return { theme: r.dataset.theme || null, scheme: r.dataset.scheme, tokens: { bg: tok('--bg'), surface: tok('--surface'), text: tok('--text'), text2: tok('--text-2'), muted: tok('--muted'), dim: tok('--dim'), onSolid: tok('--on-solid'), onAccent: tok('--on-accent'), olive: tok('--olive'), terra: tok('--terra') }, bodyBg: getComputedStyle(document.body).backgroundColor, items };
  }, targets);
  const off = await d.page.evaluate(() => { const b = document.querySelector('iframe').getBoundingClientRect(); return [b.x, b.y]; });
  if (crop) await d.page.screenshot({ path: crop.file, scale: 'css', clip: crop.clip(off) });
  await f.evaluate(() => { const s = document.createElement('style'); s.id = 'vhide'; s.textContent = '*,*::before,*::after{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important;caret-color:transparent!important}svg,svg *{stroke:transparent!important}'; document.head.append(s); });
  await sleep(200);
  const img = png(await d.page.screenshot({ scale: 'css' }));
  await f.evaluate(() => document.getElementById('vhide').remove());
  for (const it of info.items) {
    const [x, y, w, h] = it.rect, px = [];
    for (let yy = Math.ceil(y + 2); yy < y + h - 2; yy += 1) for (let xx = Math.ceil(x + 2); xx < x + w - 2; xx += 2) px.push(img.at(Math.round(xx + off[0]), Math.round(yy + off[1])));
    if (!px.length) continue;
    px.sort((a, b) => lum(a) - lum(b)); const med = px[px.length >> 1];
    const { rgb, a } = parse(it.color); const fg = rgb.map((v, i) => v * a + med[i] * (1 - a));
    const crs = px.map(p => cr(fg, p)).sort((p, q) => p - q);
    it.fg = hex(fg); it.bgMedian = hex(med); it.bgDarkest = hex(px[0]); it.bgLightest = hex(px[px.length - 1]);
    it.min = +crs[0].toFixed(2); it.p10 = +crs[Math.floor(crs.length * .1)].toFixed(2); it.median = +crs[crs.length >> 1].toFixed(2);
    const large = parseFloat(it.fontSize) >= 24 || (parseFloat(it.fontSize) >= 18.66 && +it.fontWeight >= 700); it.aaNeed = large ? 3 : 4.5; it.aa = it.p10 >= it.aaNeed;
  }
  return info;
}

const out = { method: 'WebKit, ipad-portrait, OS dark, Eli, variant park. Theme set via PUT hub/theme + localStorage (System: none). Text colour vs painted background sampled from a 1x screenshot with all frame text hidden; min/p10/median contrast over the element rect.', cases: {} };
const L = await local({ variant: 'park', clock: 'demo', engine: 'webkit' });
try {
  for (const theme of ['system', 'hearth']) {
    await L.reset('park');
    if (theme !== 'system') { const r = await L.apiAs('eli', '/api/data/hub/theme?scope=person', { method: 'PUT', body: { value: theme } }); if (r && r.status >= 300) throw new Error('theme PUT ' + r.status); }
    const ls = theme !== 'system' ? { 'hub.theme': JSON.stringify(theme) } : {};
    const C = out.cases[theme] = {};
    // ── park map: sheet tabs (Family pane open), then Search pane list labels
    { const d = await L.device({ device: 'ipad-portrait', mode: 'dark', profile: 'eli', localStorage: ls });
      await d.goto('#home'); const f = await d.openApp('dollywood-live');
      await f.waitForSelector('#lv-pill[data-state]', { timeout: 15000 }); await sleep(2500);
      await click(f, '#lv-family'); await f.waitForSelector('#lv-sheet[data-state="half"]', { timeout: 4000 }).catch(() => {}); await sleep(800);
      C.parkFamily = await measure(d, f, [['#loc-near', 1], ['#lv-family', 1], ['#lv-search', 1], ['#lv-layers-tab', 1]], { file: path.join(EV, `${PFX}-${theme}-parkmap-tabs.png`), clip: off => ({ x: 0, y: Math.max(0, off[1] + (1180 - 620)), width: 820, height: 560 }) });
      await click(f, '#lv-search'); await sleep(900);
      C.parkSearch = await measure(d, f, [['#tab-list > h3', 4], ['#tab-list .oi .k', 6], ['#tab-list span.t > span > em', 4]]);
      await d.close(); }
    // ── build guide: side panel Listings tab labels, then a listing card if one opens from a list row
    { const d = await L.device({ device: 'ipad-portrait', mode: 'dark', profile: 'eli', localStorage: ls });
      await d.goto('#home'); const f = await d.openApp('dollywood', { wait: '#chips button' });
      await f.waitForSelector('#map .mk', { state: 'attached', timeout: 15000 }).catch(() => {}); await sleep(2000);
      await f.evaluate(() => { const a = document.querySelector('aside.side'); if (a) a.scrollIntoView({ block: 'start' }); }); await sleep(500);
      C.guideList = await measure(d, f, [['#tab-list > h3', 4], ['#tab-list .oi .k', 8], ['#tab-list > div > label', 2]]);
      // open a listing card: click the first list row (rows open the card on the map)
      await click(f, '#tab-list .oi'); await f.waitForSelector('#pop.show', { timeout: 4000 }).catch(() => {}); await sleep(900);
      await f.evaluate(() => { const p = document.querySelector('#pop.show'); if (p) p.scrollIntoView({ block: 'center' }); }); await sleep(400);
      C.guideCard = await measure(d, f, [['#pop.show dl.kv dt', 6], ['#pop.show p.fact', 1]]);
      await d.close(); }
    // ── F260: Done, Reset confirm, Restore
    { const d = await L.device({ device: 'ipad-portrait', mode: 'dark', profile: 'eli', localStorage: ls });
      await d.goto('#home'); const f = await d.openApp('f260', { wait: '#todayTitle:not(:empty)' }); await sleep(1500);
      C.f260Today = await measure(d, f, [['#todayDone', 1]]);
      await click(f, '#settingsBtn'); await f.waitForSelector('#sheet.on', { timeout: 4000 }).catch(() => {});
      await click(f, '#resetBtn'); await f.waitForSelector('#confirm.on', { timeout: 4000 }).catch(() => {}); await sleep(400);
      C.f260Reset = await measure(d, f, [['#doConfirm', 1]], { file: path.join(EV, `${PFX}-${theme}-f260-reset.png`), clip: () => ({ x: 0, y: 0, width: 820, height: 1180 }) });
      await d.close();
      const d2 = await L.device({ device: 'ipad-portrait', mode: 'dark', profile: 'eli', localStorage: ls });
      await d2.goto('#home'); const f2 = await d2.openApp('f260', { wait: '#todayTitle:not(:empty)' }); await sleep(1500);
      await click(f2, '#settingsBtn'); await f2.waitForSelector('#sheet.on', { timeout: 4000 }).catch(() => {});
      await click(f2, '#restoreBtn'); await f2.waitForSelector('#restore.on', { timeout: 4000 }).catch(() => {}); await sleep(400);
      C.f260Restore = await measure(d2, f2, [['#restoreOk', 1]]);
      await d2.close(); }
    for (const [k, v] of Object.entries(C)) console.log(theme.padEnd(7), k.padEnd(12), 'theme', v.theme, 'scheme', v.scheme, 'bg', v.tokens.bg, 'dim', v.tokens.dim, 'onSolid', v.tokens.onSolid, '\n   ' + v.items.map(i => `${i.sel.slice(-22)} «${i.text.slice(0, 14)}» ${i.fg}/${i.bgMedian} p10 ${i.p10} min ${i.min} med ${i.median}${i.aa ? '' : ' FAIL'}`).join('\n   '));
  }
} finally { await L.close(); }
fs.writeFileSync(path.join(EV, PFX + '.json'), JSON.stringify(out, null, 1));
console.log('saved', path.join('audits/evidence/p4/DARK', PFX + '.json'));
