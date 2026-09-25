// Phase 4 · synthesized token proposal · colour maths (no dependencies; copied from fidelity/colour-lib.mjs).
// sRGB <-> OKLab/OKLCH, WCAG 2.x relative luminance and contrast, CIE Lab (D65) and CIEDE2000,
// Machado et al. 2009 colour-vision-deficiency simulation (severity 1.0, applied in linear RGB),
// alpha compositing. Used by gen.mjs (derives the hue scales) and contrast.mjs (verifies tokens.css).

export const clamp01 = x => Math.min(1, Math.max(0, x));
const toLin = c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toGam = c => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

export function parseHex(h) {
  let s = h.trim().replace('#', '');
  if (s.length === 3 || s.length === 4) s = [...s].map(c => c + c).join('');
  const n = parseInt(s.slice(0, 6), 16);
  const a = s.length === 8 ? parseInt(s.slice(6, 8), 16) / 255 : 1;
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255, a };
}
export function parseColour(str) {
  const s = str.trim().toLowerCase();
  if (s.startsWith('#')) return parseHex(s);
  let m = s.match(/^rgba?\(([^)]+)\)$/);
  if (m) {
    const p = m[1].split(/[\s,/]+/).filter(Boolean);
    const v = p.slice(0, 3).map(x => (x.endsWith('%') ? parseFloat(x) * 2.55 : parseFloat(x)) / 255);
    const a = p[3] == null ? 1 : p[3].endsWith('%') ? parseFloat(p[3]) / 100 : parseFloat(p[3]);
    return { r: v[0], g: v[1], b: v[2], a };
  }
  if (s === 'white') return { r: 1, g: 1, b: 1, a: 1 };
  if (s === 'black') return { r: 0, g: 0, b: 0, a: 1 };
  if (s === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
  throw new Error('unparsed colour: ' + str);
}
export const hex = c => '#' + [c.r, c.g, c.b].map(v => Math.round(clamp01(v) * 255).toString(16).padStart(2, '0')).join('').toUpperCase();

// composite fg (with alpha) over an opaque bg
export function over(fg, bg) {
  const a = fg.a ?? 1;
  return { r: fg.r * a + bg.r * (1 - a), g: fg.g * a + bg.g * (1 - a), b: fg.b * a + bg.b * (1 - a), a: 1 };
}
export function lum(c) { return 0.2126 * toLin(c.r) + 0.7152 * toLin(c.g) + 0.0722 * toLin(c.b); }
export function contrast(a, b) {
  const la = lum(a), lb = lum(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// OKLab / OKLCH
export function oklabToRgbLin(L, a, b) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  return {
    r: 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    g: -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    b: -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  };
}
export function rgbToOklab(c) {
  const r = toLin(c.r), g = toLin(c.g), b = toLin(c.b);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
}
export function oklch(c) { const o = rgbToOklab(c); return { L: o.L, C: Math.hypot(o.a, o.b), H: ((Math.atan2(o.b, o.a) * 180) / Math.PI + 360) % 360 }; }
const inGamut = v => v.r >= -1e-6 && v.r <= 1 + 1e-6 && v.g >= -1e-6 && v.g <= 1 + 1e-6 && v.b >= -1e-6 && v.b <= 1 + 1e-6;
// OKLCH -> sRGB, reducing chroma until in gamut (CSS Color 4 style chroma reduction, simplified)
export function fromOklch(L, C, H) {
  const h = (H * Math.PI) / 180;
  let lo = 0, hi = C, best = null;
  const tryC = c => oklabToRgbLin(L, c * Math.cos(h), c * Math.sin(h));
  if (inGamut(tryC(C))) best = C;
  else {
    for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (inGamut(tryC(mid))) lo = mid; else hi = mid; }
    best = lo;
  }
  const v = tryC(best);
  return { r: clamp01(toGam(clamp01(v.r))), g: clamp01(toGam(clamp01(v.g))), b: clamp01(toGam(clamp01(v.b))), a: 1 };
}

// CIE Lab (D65) and CIEDE2000
export function lab(c) {
  const r = toLin(c.r), g = toLin(c.g), b = toLin(c.b);
  let X = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047;
  let Y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  let Z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883;
  const f = t => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  X = f(X); Y = f(Y); Z = f(Z);
  return { L: 116 * Y - 16, a: 500 * (X - Y), b: 200 * (Y - Z) };
}
export function de2000(c1, c2) {
  const p = lab(c1), q = lab(c2);
  const rad = Math.PI / 180, deg = 180 / Math.PI;
  const C1 = Math.hypot(p.a, p.b), C2 = Math.hypot(q.a, q.b), Cb = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)));
  const a1 = (1 + G) * p.a, a2 = (1 + G) * q.a;
  const C1p = Math.hypot(a1, p.b), C2p = Math.hypot(a2, q.b);
  const h1 = C1p === 0 ? 0 : (Math.atan2(p.b, a1) * deg + 360) % 360;
  const h2 = C2p === 0 ? 0 : (Math.atan2(q.b, a2) * deg + 360) % 360;
  const dL = q.L - p.L, dC = C2p - C1p;
  let dh = 0;
  if (C1p * C2p !== 0) { dh = h2 - h1; if (dh > 180) dh -= 360; else if (dh < -180) dh += 360; }
  const dH = 2 * Math.sqrt(C1p * C2p) * Math.sin((dh / 2) * rad);
  const Lb = (p.L + q.L) / 2, Cbp = (C1p + C2p) / 2;
  let hb = h1 + h2;
  if (C1p * C2p !== 0) { if (Math.abs(h1 - h2) > 180) hb += h1 + h2 < 360 ? 360 : -360; hb /= 2; }
  const T = 1 - 0.17 * Math.cos((hb - 30) * rad) + 0.24 * Math.cos(2 * hb * rad) + 0.32 * Math.cos((3 * hb + 6) * rad) - 0.2 * Math.cos((4 * hb - 63) * rad);
  const dTh = 30 * Math.exp(-(((hb - 275) / 25) ** 2));
  const Rc = 2 * Math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7));
  const Sl = 1 + (0.015 * (Lb - 50) ** 2) / Math.sqrt(20 + (Lb - 50) ** 2);
  const Sc = 1 + 0.045 * Cbp, Sh = 1 + 0.015 * Cbp * T;
  const Rt = -Math.sin(2 * dTh * rad) * Rc;
  return Math.sqrt((dL / Sl) ** 2 + (dC / Sc) ** 2 + (dH / Sh) ** 2 + Rt * (dC / Sc) * (dH / Sh));
}

// Machado, Oliveira & Fernandes 2009, severity 1.0
const CVD = {
  protan: [0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116, 1.051998],
  deutan: [0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.01182, 0.04294, 0.968881],
  tritan: [1.255528, -0.076749, -0.178779, -0.078411, 0.930809, 0.147602, 0.004733, 0.691367, 0.3039],
};
export function simulate(c, kind) {
  if (!kind || kind === 'normal') return c;
  const M = CVD[kind];
  const r = toLin(c.r), g = toLin(c.g), b = toLin(c.b);
  const R = M[0] * r + M[1] * g + M[2] * b, G = M[3] * r + M[4] * g + M[5] * b, B = M[6] * r + M[7] * g + M[8] * b;
  return { r: toGam(clamp01(R)), g: toGam(clamp01(G)), b: toGam(clamp01(B)), a: 1 };
}
