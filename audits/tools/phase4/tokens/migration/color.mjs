// Colour maths for the Phase 4 "migration" token proposal. No dependencies.
// sRGB <-> linear, WCAG 2.x relative luminance and contrast, OKLab/OKLCH, CIE Lab (D65) and CIEDE2000,
// Machado, Oliveira & Fernandes 2009 CVD simulation at severity 1.0 in linear RGB (same matrices as
// audits/tools/phase4/ACCENT/tokens.mjs:109-110), CSS color-mix() in srgb and oklab, alpha compositing.
export const clamp01 = x => Math.min(1, Math.max(0, x));
const toLin = c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toGam = c => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

// colours are {r,g,b,a} with r,g,b in 0..1 (sRGB, gamma encoded)
export function parseHex(h) {
  let s = h.replace('#', '').trim();
  if (s.length === 3 || s.length === 4) s = [...s].map(c => c + c).join('');
  const n = i => parseInt(s.slice(i, i + 2), 16) / 255;
  return { r: n(0), g: n(2), b: n(4), a: s.length === 8 ? n(6) : 1 };
}
export function toHex(c) {
  const h = x => Math.round(clamp01(x) * 255).toString(16).padStart(2, '0').toUpperCase();
  return '#' + h(c.r) + h(c.g) + h(c.b) + (c.a !== undefined && c.a < 0.999 ? h(c.a) : '');
}
export const lin = c => [toLin(c.r), toLin(c.g), toLin(c.b)];
export const fromLin = ([r, g, b], a = 1) => ({ r: clamp01(toGam(r)), g: clamp01(toGam(g)), b: clamp01(toGam(b)), a });
export function lum(c) { const [r, g, b] = lin(c); return 0.2126 * r + 0.7152 * g + 0.0722 * b; }
export function contrast(a, b) { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
// source-over compositing of fg (with alpha) on an opaque bg
export function over(fg, bg) {
  const a = fg.a ?? 1;
  return { r: fg.r * a + bg.r * (1 - a), g: fg.g * a + bg.g * (1 - a), b: fg.b * a + bg.b * (1 - a), a: 1 };
}

// OKLab (Björn Ottosson)
export function toOklab(c) {
  const [r, g, b] = lin(c);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return { L: 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s, a: 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s, b: 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s, alpha: c.a ?? 1 };
}
export function fromOklab({ L, a, b, alpha = 1 }) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;
  const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bb = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;
  return fromLin([r, g, bb], alpha);
}
export function oklch(c) { const o = toOklab(c); return { L: o.L, C: Math.hypot(o.a, o.b), H: ((Math.atan2(o.b, o.a) * 180) / Math.PI + 360) % 360 }; }
export function fromOklch(L, C, H, alpha = 1) { const h = (H * Math.PI) / 180; return fromOklab({ L, a: C * Math.cos(h), b: C * Math.sin(h), alpha }); }
export function inGamut(L, C, H) {
  const h = (H * Math.PI) / 180, a = C * Math.cos(h), b = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;
  const rgb = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s];
  return rgb.every(v => v >= -1e-4 && v <= 1 + 1e-4);
}

// CSS color-mix(in <space>, a p%, b q%) with premultiplied alpha, per CSS Color 5
export function mix(space, c1, p1, c2, p2) {
  if (p1 == null && p2 == null) { p1 = 50; p2 = 50; } else if (p1 == null) p1 = 100 - p2; else if (p2 == null) p2 = 100 - p1;
  const sum = p1 + p2; let w1 = p1 / sum, w2 = p2 / sum; const mult = sum < 100 ? sum / 100 : 1;
  const a1 = c1.a ?? 1, a2 = c2.a ?? 1; const a = a1 * w1 + a2 * w2;
  let out;
  if (space === 'oklab') {
    const o1 = toOklab(c1), o2 = toOklab(c2);
    const k = x => (a ? x : 0);
    out = fromOklab({ L: (o1.L * a1 * w1 + o2.L * a2 * w2) / (a || 1), a: (o1.a * a1 * w1 + o2.a * a2 * w2) / (a || 1), b: (o1.b * a1 * w1 + o2.b * a2 * w2) / (a || 1), alpha: a });
    void k;
  } else if (space === 'srgb-linear') {
    const l1 = lin(c1), l2 = lin(c2);
    out = fromLin(l1.map((v, i) => (v * a1 * w1 + l2[i] * a2 * w2) / (a || 1)), a);
  } else { // srgb
    out = { r: (c1.r * a1 * w1 + c2.r * a2 * w2) / (a || 1), g: (c1.g * a1 * w1 + c2.g * a2 * w2) / (a || 1), b: (c1.b * a1 * w1 + c2.b * a2 * w2) / (a || 1), a };
  }
  out.a = (out.a ?? 1) * mult;
  return out;
}

// CIE Lab D65 + CIEDE2000
export function toLab(c) {
  const [r, g, b] = lin(c);
  const X = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047;
  const Y = 0.2126729 * r + 0.7151522 * g + 0.0721750 * b;
  const Z = (0.0193339 * r + 0.1191920 * g + 0.9503041 * b) / 1.08883;
  const f = t => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const fx = f(X), fy = f(Y), fz = f(Z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
export function de00(c1, c2) {
  const [L1, a1, b1] = toLab(c1), [L2, a2, b2] = toLab(c2);
  const rad = Math.PI / 180, deg = 180 / Math.PI;
  const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2), Cb = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)));
  const a1p = (1 + G) * a1, a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2);
  const h = (b, a) => { if (b === 0 && a === 0) return 0; const x = Math.atan2(b, a) * deg; return x < 0 ? x + 360 : x; };
  const h1p = h(b1, a1p), h2p = h(b2, a2p);
  const dLp = L2 - L1, dCp = C2p - C1p;
  let dhp = 0; if (C1p * C2p !== 0) { dhp = h2p - h1p; if (dhp > 180) dhp -= 360; else if (dhp < -180) dhp += 360; }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp / 2) * rad);
  const Lbp = (L1 + L2) / 2, Cbp = (C1p + C2p) / 2;
  let hbp = h1p + h2p; if (C1p * C2p !== 0) { if (Math.abs(h1p - h2p) > 180) hbp += h1p + h2p < 360 ? 360 : -360; hbp /= 2; }
  const T = 1 - 0.17 * Math.cos((hbp - 30) * rad) + 0.24 * Math.cos(2 * hbp * rad) + 0.32 * Math.cos((3 * hbp + 6) * rad) - 0.2 * Math.cos((4 * hbp - 63) * rad);
  const dTh = 30 * Math.exp(-(((hbp - 275) / 25) ** 2));
  const RC = 2 * Math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7));
  const SL = 1 + (0.015 * (Lbp - 50) ** 2) / Math.sqrt(20 + (Lbp - 50) ** 2), SC = 1 + 0.045 * Cbp, SH = 1 + 0.015 * Cbp * T;
  const RT = -Math.sin(2 * dTh * rad) * RC;
  return Math.sqrt((dLp / SL) ** 2 + (dCp / SC) ** 2 + (dHp / SH) ** 2 + RT * (dCp / SC) * (dHp / SH));
}
const CVD = {
  protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
  tritan: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.303900]],
};
export function simulate(c, kind) {
  if (!kind || kind === 'normal') return c;
  const m = CVD[kind], v = lin(c);
  return fromLin(m.map(row => row[0] * v[0] + row[1] * v[1] + row[2] * v[2]), c.a);
}
