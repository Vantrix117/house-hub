// Phase 2 / PWA — install metadata: manifest.json fields, the icons' pixels, iOS head tags, and the live site's cache headers.
//   node "audits/tools/phase2/PWA/manifest.mjs"            (add --no-live to skip the read-only header GETs)
// No browser. Decodes the PNG icons with zlib (8-bit RGB/RGBA only, which is what icons/ holds) to report alpha at the
// corners and where the maskable icon's artwork sits against the 80 % safe zone. The live check sends plain GETs to the
// public GitHub Pages site and prints only status + caching headers (the body is discarded); it never calls the API.
// Writes audits/evidence/p2/PWA/manifest-run.json.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const OUT = path.join(ROOT, 'audits/evidence/p2/PWA');
const out = {};

// ── manifest ──────────────────────────────────────────────────────────────────
const man = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
const LIVE = 'https://vantrix117.github.io/house-hub/manifest.json';
const want = ['id', 'name', 'short_name', 'start_url', 'scope', 'display', 'display_override', 'orientation', 'background_color', 'theme_color', 'icons', 'shortcuts', 'screenshots', 'lang', 'dir', 'categories', 'launch_handler'];
out.manifest = Object.fromEntries(want.map(k => [k, k in man ? (k === 'icons' ? man.icons.map(i => `${i.src} ${i.sizes} ${i.purpose || '(any)'}`) : man[k]) : 'MISSING']));
out.resolved = { start_url: new URL(man.start_url, LIVE).href, scope: new URL(man.scope, LIVE).href, id_effective: new URL(man.id || man.start_url, LIVE).href };
out.iconPurposes = [...new Set(man.icons.map(i => i.purpose || 'any'))];

// ── theme colours vs the palettes ───────────────────────────────────────────
const css = fs.readFileSync(path.join(ROOT, 'apps/design.css'), 'utf8');
const bgs = {}; let theme = 'hearth (:root)';
css.split('\n').forEach((l, i) => {
  const t = /^:root\[data-theme="(\w+)"\]/.exec(l); if (t) theme = t[1];
  const b = /--bg:\s*(#[0-9A-Fa-f]{6})/.exec(l); if (b && theme) { bgs[theme] ||= `${b[1]} (apps/design.css:${i + 1})`; theme = null; }
});
out.paletteBackgrounds = bgs;

// ── index.html head tags ──────────────────────────────────────────────────────
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const lines = html.split('\n');
const grab = re => lines.map((l, i) => re.test(l) ? `index.html:${i + 1} ${l.trim()}` : null).filter(Boolean);
out.headTags = [...grab(/theme-color|apple-mobile-web-app|mobile-web-app-capable|apple-touch-icon|rel="manifest"|viewport/), ...(grab(/apple-touch-startup-image/).length ? grab(/apple-touch-startup-image/) : ['apple-touch-startup-image: NOT FOUND IN CODE'])];

// ── PNG icons ─────────────────────────────────────────────────────────────────
function decodePNG(file) {
  const b = fs.readFileSync(file);
  let o = 8; const idat = []; let w, h, depth, ct;
  while (o < b.length) {
    const len = b.readUInt32BE(o), type = b.toString('latin1', o + 4, o + 8), data = b.subarray(o + 8, o + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); depth = data[8]; ct = data[9]; }
    if (type === 'IDAT') idat.push(data);
    o += 12 + len;
  }
  if (depth !== 8 || (ct !== 6 && ct !== 2)) return { w, h, depth, ct, unsupported: true };
  const bpp = ct === 6 ? 4 : 3, stride = w * bpp, raw = zlib.inflateSync(Buffer.concat(idat)), px = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? px[y * stride + x - bpp] : 0, up = y ? px[(y - 1) * stride + x] : 0, c = (x >= bpp && y) ? px[(y - 1) * stride + x - bpp] : 0;
      let v = line[x];
      if (f === 1) v += a; else if (f === 2) v += up; else if (f === 3) v += (a + up) >> 1;
      else if (f === 4) { const p = a + up - c, pa = Math.abs(p - a), pb = Math.abs(p - up), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? up : c; }
      px[y * stride + x] = v & 255;
    }
  }
  const at = (x, y) => { const i = y * stride + x * bpp; return { r: px[i], g: px[i + 1], b: px[i + 2], a: bpp === 4 ? px[i + 3] : 255 }; };
  return { w, h, ct, bpp, at };
}
out.icons = {};
for (const f of ['icons/apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-512-maskable.png']) {
  const p = decodePNG(path.join(ROOT, f));
  if (p.unsupported) { out.icons[f] = p; continue; }
  let transparent = 0; for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (p.at(x, y).a < 250) transparent++;
  const c = p.at(0, 0), mid = p.at(p.w >> 1, p.h >> 1);
  const r = { size: `${p.w}x${p.h}`, alphaChannel: p.bpp === 4, transparentPixelShare: +(transparent / (p.w * p.h)).toFixed(3), cornerPixel: c, centrePixel: mid };
  if (f.includes('maskable')) {
    // the artwork is a rounded tile on a flat margin colour: find the tile's extent along the middle row/column
    const bg = p.at(2, p.h >> 1), diff = q => Math.abs(q.r - bg.r) + Math.abs(q.g - bg.g) + Math.abs(q.b - bg.b) > 12;
    let l = 0; while (l < p.w && !diff(p.at(l, p.h >> 1))) l++;
    let t = 0; while (t < p.h && !diff(p.at(p.w >> 1, t))) t++;
    r.marginColour = bg; r.tileStartsAt = { left: l, top: t, share: +(l / p.w).toFixed(3) };
    r.safeZone = 'W3C maskable safe zone = circle of radius 40 % of the size centred (starts 10 % in on each axis); tile begins ' + (100 * l / p.w).toFixed(1) + ' % in';
  }
  out.icons[f] = r;
}

// ── live cache headers (read-only GETs, body discarded) ───────────────────────
if (!process.argv.includes('--no-live')) {
  out.live = {};
  for (const p of ['', 'index.html', 'sw.js', 'manifest.json', 'apps/hub.js', 'apps/design.css']) {
    try {
      const r = await fetch('https://vantrix117.github.io/house-hub/' + p, { method: 'GET', redirect: 'manual' });
      out.live['/house-hub/' + p] = { status: r.status, 'cache-control': r.headers.get('cache-control'), 'last-modified': r.headers.get('last-modified') };
      await r.body?.cancel();
    } catch (e) { out.live['/house-hub/' + p] = { error: String(e.message || e) }; }
  }
}

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'manifest-run.json'), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, (k, v) => (k === 'at' ? undefined : v), 1));
console.log('\nwrote audits/evidence/p2/PWA/manifest-run.json');
