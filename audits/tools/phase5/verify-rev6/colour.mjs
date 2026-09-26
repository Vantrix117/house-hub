// Revision-6 verifier: an independent colour library (written from the specs, not from the author's colour-lib.mjs).
//   WCAG 2.x relative luminance and contrast ratio, source-over alpha compositing in gamma-encoded sRGB (what browsers paint),
//   CIE Lab (D65) and CIEDE2000 (Sharma, Wu, Dalal 2005), and a minimal PNG decoder for engine screenshots.
import zlib from 'node:zlib';

export function parse(s) {
  s = String(s).trim();
  let m = s.match(/^#([0-9a-f]{6})([0-9a-f]{2})?$/i);
  if (m) {
    const n = parseInt(m[1], 16);
    return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255, a: m[2] ? parseInt(m[2], 16) / 255 : 1 };
  }
  m = s.match(/^rgba?\(\s*([^)]*)\)$/i);
  if (m) {
    const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    return { r: p[0] / 255, g: p[1] / 255, b: p[2] / 255, a: p.length > 3 ? p[3] : 1 };
  }
  m = s.match(/^color\(\s*srgb\s+([^)]*)\)$/i);
  if (m) {
    const p = m[1].split(/[\s/]+/).filter(Boolean).map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  }
  if (s === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
  throw new Error('colour not understood: ' + s);
}

export const hex = c => '#' + [c.r, c.g, c.b].map(v => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0')).join('').toUpperCase();

const toLinear = v => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));   // WCAG 2.x uses 0.03928; the difference is < 1e-4 in L

export function luminance(c) {
  if (c.a < 0.999) throw new Error('luminance of a translucent colour: composite it first');
  return 0.2126 * toLinear(c.r) + 0.7152 * toLinear(c.g) + 0.0722 * toLinear(c.b);
}

export function contrast(a, b) {
  const la = luminance(a), lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// source-over: top painted over bottom, in gamma-encoded sRGB (CSS compositing)
export function over(top, bottom) {
  const a = top.a + bottom.a * (1 - top.a);
  if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
  const ch = k => (top[k] * top.a + bottom[k] * bottom.a * (1 - top.a)) / a;
  return { r: ch('r'), g: ch('g'), b: ch('b'), a };
}

// CIE Lab under D65 from sRGB
export function lab(c) {
  const R = toLinear(c.r), G = toLinear(c.g), B = toLinear(c.b);
  const X = 0.4124564 * R + 0.3575761 * G + 0.1804375 * B;
  const Y = 0.2126729 * R + 0.7151522 * G + 0.0721750 * B;
  const Z = 0.0193339 * R + 0.1191920 * G + 0.9503041 * B;
  const f = t => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const fx = f(X / 0.95047), fy = f(Y / 1.0), fz = f(Z / 1.08883);
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

// CIEDE2000, kL = kC = kH = 1
export function de2000(c1, c2) {
  const p = lab(c1), q = lab(c2);
  const rad = Math.PI / 180;
  const C1 = Math.hypot(p.a, p.b), C2 = Math.hypot(q.a, q.b);
  const Cm = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Math.pow(Cm, 7) / (Math.pow(Cm, 7) + Math.pow(25, 7))));
  const a1 = (1 + G) * p.a, a2 = (1 + G) * q.a;
  const C1p = Math.hypot(a1, p.b), C2p = Math.hypot(a2, q.b);
  const h = (b, a) => { if (a === 0 && b === 0) return 0; let v = Math.atan2(b, a) / rad; return v < 0 ? v + 360 : v; };
  const h1 = h(p.b, a1), h2 = h(q.b, a2);
  const dL = q.L - p.L, dC = C2p - C1p;
  let dh = 0;
  if (C1p * C2p !== 0) { dh = h2 - h1; if (dh > 180) dh -= 360; else if (dh < -180) dh += 360; }
  const dH = 2 * Math.sqrt(C1p * C2p) * Math.sin(dh * rad / 2);
  const Lm = (p.L + q.L) / 2, Cmp = (C1p + C2p) / 2;
  let hm;
  if (C1p * C2p === 0) hm = h1 + h2;
  else if (Math.abs(h1 - h2) <= 180) hm = (h1 + h2) / 2;
  else hm = h1 + h2 < 360 ? (h1 + h2 + 360) / 2 : (h1 + h2 - 360) / 2;
  const T = 1 - 0.17 * Math.cos((hm - 30) * rad) + 0.24 * Math.cos(2 * hm * rad) + 0.32 * Math.cos((3 * hm + 6) * rad) - 0.2 * Math.cos((4 * hm - 63) * rad);
  const dTheta = 30 * Math.exp(-Math.pow((hm - 275) / 25, 2));
  const RC = 2 * Math.sqrt(Math.pow(Cmp, 7) / (Math.pow(Cmp, 7) + Math.pow(25, 7)));
  const SL = 1 + (0.015 * Math.pow(Lm - 50, 2)) / Math.sqrt(20 + Math.pow(Lm - 50, 2));
  const SC = 1 + 0.045 * Cmp, SH = 1 + 0.015 * Cmp * T;
  const RT = -Math.sin(2 * dTheta * rad) * RC;
  return Math.sqrt(Math.pow(dL / SL, 2) + Math.pow(dC / SC, 2) + Math.pow(dH / SH, 2) + RT * (dC / SC) * (dH / SH));
}

// round DOWN to n decimals (a stated minimum is never above the true value)
export const floor = (v, n = 2) => Math.floor(v * 10 ** n + 1e-9) / 10 ** n;

// minimal PNG decoder: 8-bit, colour type 2 (RGB) or 6 (RGBA), not interlaced (what Playwright writes)
export function decodePng(buf) {
  let off = 8, w = 0, h = 0, ct = 0, bd = 0, il = 0; const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off), type = buf.toString('ascii', off + 4, off + 8), data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); bd = data[8]; ct = data[9]; il = data[12]; }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  if (bd !== 8 || (ct !== 2 && ct !== 6) || il) throw new Error(`PNG not supported: depth ${bd}, type ${ct}, interlace ${il}`);
  const bpp = ct === 6 ? 4 : 3, stride = w * bpp, raw = zlib.inflateSync(Buffer.concat(idat));
  const out = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)), row = y * stride;
    for (let x = 0; x < stride; x++) {
      const A = x >= bpp ? out[row + x - bpp] : 0, B = y ? out[row - stride + x] : 0, C = x >= bpp && y ? out[row - stride + x - bpp] : 0;
      let v = src[x];
      if (f === 1) v += A; else if (f === 2) v += B; else if (f === 3) v += (A + B) >> 1;
      else if (f === 4) { const p = A + B - C, pa = Math.abs(p - A), pb = Math.abs(p - B), pc = Math.abs(p - C); v += pa <= pb && pa <= pc ? A : pb <= pc ? B : C; }
      out[row + x] = v & 255;
    }
  }
  return { w, h, bpp, px: (x, y) => { const i = y * stride + x * bpp; return { r: out[i] / 255, g: out[i + 1] / 255, b: out[i + 2] / 255, a: 1 }; } };
}
