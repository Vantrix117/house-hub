// Phase 4 DARK, skeptic #2 for "hearth-dark-os-per-app": re-measure on the local instance (WebKit, iPad portrait, dark OS)
// Hearth (server row + localStorage) against System, same profile (eli), same screen. For each target: the document's
// data-theme/data-scheme, resolved tokens, the element's computed colour and opacity chain; the backdrop is sampled from a
// 1x CSS screenshot with all text and svg hidden (p10 and median ratio over the label box); solid buttons also get the
// plain computed fg/bg ratio. Usage: node audits/tools/phase4/DARK/verify-hearth-dark-os-per-app-2.mjs
import { local, sleep } from '../../lib/local.mjs';
import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib';
const EV = path.resolve('audits/evidence/p4/DARK');
const lin = v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; };
const lum = ([r, g, b]) => .2126 * lin(r) + .7152 * lin(g) + .0722 * lin(b);
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + .05) / (y + .05); };
const hex = c => '#' + c.slice(0, 3).map(v => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
function png(buf) { let o = 8, w, h, ct, idat = []; while (o < buf.length) { const len = buf.readUInt32BE(o), t = buf.toString('ascii', o + 4, o + 8), d = buf.subarray(o + 8, o + 8 + len); if (t === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); ct = d[9]; } if (t === 'IDAT') idat.push(d); o += 12 + len; }
  const bpp = ct === 6 ? 4 : 3, raw = zlib.inflateSync(Buffer.concat(idat)), px = Buffer.alloc(w * h * bpp), st = w * bpp;
  for (let y = 0; y < h; y++) { const f = raw[y * (st + 1)], line = raw.subarray(y * (st + 1) + 1, (y + 1) * (st + 1)); for (let x = 0; x < st; x++) { const a = x >= bpp ? px[y * st + x - bpp] : 0, b = y ? px[(y - 1) * st + x] : 0, c = x >= bpp && y ? px[(y - 1) * st + x - bpp] : 0; let v = line[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1; else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; } px[y * st + x] = v & 255; } }
  return { w, h, at: (x, y) => { const i = (Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))) * bpp; return [px[i], px[i + 1], px[i + 2]]; } }; }
const parse = s => { const srgb = /^color\(srgb/.test(s); const m = s.replace(/^color\(srgb/, '').match(/[\d.]+/g).map(Number); const c = m.slice(0, 3).map(v => srgb ? v * 255 : v); return [...c, m.length > 3 ? m[3] : 1]; };

async function probe(d, doc, sel, idx = 0) {
  const off = await d.page.evaluate(() => { const b = document.querySelector('iframe')?.getBoundingClientRect(); return b ? [b.x, b.y] : [0, 0]; });
  const q = ({ sel, idx }) => {
    const e = [...document.querySelectorAll(sel)].filter(x => x.getClientRects().length)[idx]; if (!e) return null;
    const cs = getComputedStyle(e); let op = 1; for (let n = e; n && n.nodeType === 1; n = n.parentElement) op *= +getComputedStyle(n).opacity;
    const r = document.createRange(); const tn = [...e.childNodes].find(n => n.nodeType === 3 && n.textContent.trim()); if (tn) r.selectNodeContents(tn); else r.selectNodeContents(e);
    const b = r.getClientRects()[0] || e.getBoundingClientRect();
    const root = document.documentElement, rs = getComputedStyle(root), tok = n => rs.getPropertyValue(n).trim();
    return { text: (e.innerText || '').trim().slice(0, 30), color: cs.color, bg: cs.backgroundColor, fs: cs.fontSize, fw: cs.fontWeight, opacity: +op.toFixed(3), rect: [b.x, b.y + b.height * .15, b.width, b.height * .7],
      theme: root.dataset.theme || null, scheme: root.dataset.scheme, tokens: { bg: tok('--bg'), surface: tok('--surface'), text: tok('--text'), muted: tok('--muted'), dim: tok('--dim'), onSolid: tok('--on-solid') } };
  };
  await doc.evaluate(({ sel, idx }) => { const e = [...document.querySelectorAll(sel)].filter(x => x.getClientRects().length)[idx]; if (e) e.scrollIntoView({ block: 'nearest' }); }, { sel, idx });
  await sleep(300);
  const info = await doc.evaluate(q, { sel, idx });
  if (!info) return { sel, error: 'not found' };
  await doc.evaluate(() => { const s = document.createElement('style'); s.id = '__v2hide'; s.textContent = '*{color:transparent!important;-webkit-text-fill-color:transparent!important}svg{visibility:hidden!important}'; document.head.append(s); });
  await sleep(150);
  const img = png(await d.page.screenshot({ scale: 'css', animations: 'disabled' }));
  await doc.evaluate(() => document.getElementById('__v2hide')?.remove());
  const fg = parse(info.color), a = fg[3] * info.opacity, rs = [];
  const [x, y, w, h] = info.rect;
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) { const bg = img.at(Math.round(xx + off[0]), Math.round(yy + off[1])); rs.push([ratio(fg.slice(0, 3).map((v, i) => v * a + bg[i] * (1 - a)), bg), bg]); }
  const mean = rs.length ? [0, 1, 2].map(i => rs.reduce((t, r) => t + r[1][i], 0) / rs.length) : null;
  rs.sort((p, q2) => p[0] - q2[0]);
  const bgc = parse(info.bg); const solid = bgc[3] > .99 ? +ratio(fg.slice(0, 3), bgc.slice(0, 3)).toFixed(2) : null;
  return { sel, idx, text: info.text, fs: info.fs, fw: info.fw, theme: info.theme, scheme: info.scheme, fg: hex(fg), alpha: +a.toFixed(3), bgCss: info.bg, solidRatio: solid,
    p10: rs.length ? +rs[Math.floor(rs.length * .1)][0].toFixed(2) : null, median: rs.length ? +rs[rs.length >> 1][0].toFixed(2) : null, bgMedian: rs.length ? hex(rs[rs.length >> 1][1]) : null, bgMean: mean && hex(mean), meanRatio: mean && +ratio(fg.slice(0, 3).map((v, i) => v * a + mean[i] * (1 - a)), mean).toFixed(2), n: rs.length, tokens: info.tokens };
}

const out = { note: 'eli, ipad-portrait, WebKit, OS dark. hearth = server row + localStorage hub.theme "hearth"; system = no row. Ratio p10/median over the first text line box, backdrop from a 1x screenshot with text and svg hidden (WebKit/Windows paints no backdrop blur, so p10 over the map picks unblurred terrain). solidRatio = computed fg/bg when the element has an opaque background.', cases: [] };
const MAP_ONLY = process.argv.includes('map');
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const log = r => { out.cases.push(r); console.log(JSON.stringify(r).slice(0, 360)); };
try {
  for (const theme of ['hearth', 'system']) {
    const mk = async () => { await L.reset('typical'); if (theme !== 'system') { const r = await L.apiAs('eli', '/api/data/hub/theme?scope=person', { method: 'PUT', body: { value: theme } }); if (r.status >= 300) throw new Error('PUT ' + r.status); }
      return L.device({ device: 'ipad-portrait', mode: 'dark', profile: 'eli', localStorage: theme !== 'system' ? { 'hub.theme': JSON.stringify(theme) } : {} }); };
    // park map: pane tabs
    { const d = await mk(); await d.goto('#home'); const f = await d.openApp('dollywood-live'); await f.waitForSelector('#lv-family', { timeout: 20000 }); await sleep(4000);
      for (const s of ['#loc-near', '#lv-family', '#lv-search', '#lv-layers-tab']) log({ theme, app: 'dollywood-live', ...(await probe(d, f, s)) });
      await d.page.screenshot({ path: path.join(EV, `verify-hearth-dark-os-per-app-2-parkmap-${theme}.png`), scale: 'css', clip: { x: 0, y: 1080, width: 820, height: 100 } });
      // the Family pane (tap the tab: showPane + half sheet, template.html:1600)
      await f.click('#lv-family'); await sleep(2500);
      for (const s of ['#loc-near', '#lv-family', '#lv-search', '#lv-layers-tab']) log({ theme, app: 'dollywood-live', state: 'family-half', ...(await probe(d, f, s)) });
      await d.page.screenshot({ path: path.join(EV, `verify-hearth-dark-os-per-app-2-parkmap-family-${theme}.png`), scale: 'css', clip: { x: 0, y: 640, width: 820, height: 260 } });
      await d.close(); }
    if (MAP_ONLY) continue;
    // build guide: .oi .k and dl.kv dt
    { const d = await mk(); await d.goto('#home'); const f = await d.openApp('dollywood'); await sleep(5000);
      for (const s of ['.oi .k', 'dl.kv dt']) log({ theme, app: 'dollywood', ...(await probe(d, f, s)) });
      await d.close(); }
    // F260: Done, the confirm modal's Reset (shown by adding .on as confirmModal() does, apps/f260.html:1758) and Replace and restore
    { const d = await mk(); await d.goto('#home'); const f = await d.openApp('f260'); await sleep(5000);
      const btns = await f.evaluate(() => [...document.querySelectorAll('button')].filter(b => b.getClientRects().length && /^(Done|Mark)/i.test(b.innerText.trim())).map(b => ({ id: b.id, cls: b.className, t: b.innerText.trim().slice(0, 20) })));
      log({ theme, app: 'f260', doneCandidates: btns });
      const dn = btns.find(b => b.id); if (dn) log({ theme, app: 'f260', ...(await probe(d, f, '#' + dn.id)) });
      await f.evaluate(() => document.getElementById('confirm').classList.add('on')); await sleep(600);
      log({ theme, app: 'f260', ...(await probe(d, f, '#doConfirm')) });
      await d.page.screenshot({ path: path.join(EV, `verify-hearth-dark-os-per-app-2-f260-confirm-${theme}.png`), scale: 'css' });
      await f.evaluate(() => document.getElementById('confirm').classList.remove('on'));
      const rs = await f.evaluate(() => { const b = document.getElementById('restoreOk'); const cs = getComputedStyle(b); return { color: cs.color, bg: cs.backgroundColor, inModal: !!b.closest('.modal') }; });
      const fg = parse(rs.color), bg = parse(rs.bg); log({ theme, app: 'f260', sel: '#restoreOk (computed, not shown)', ...rs, solidRatio: bg[3] > .99 ? +ratio(fg.slice(0, 3), bg.slice(0, 3)).toFixed(2) : null });
      await d.close(); }
  }
} finally { await L.close(); }
fs.writeFileSync(path.join(EV, MAP_ONLY ? 'verify-hearth-dark-os-per-app-2-map.json' : 'verify-hearth-dark-os-per-app-2.json'), JSON.stringify(out, null, 1));
