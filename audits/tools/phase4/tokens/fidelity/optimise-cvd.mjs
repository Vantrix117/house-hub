// Phase 4 · token proposal "fidelity" · lightness tiers for the person "strong" (graphic) tone.
// At one fixed luminance the eight house hues collapse under protanopia/deuteranopia (gen.mjs: sky/periwinkle 0.1 dE00).
// This searches, per scheme, one luminance (light) or OKLCH L (dark) per hue, hue nudged by at most ±MAXDH degrees,
// within the contrast constraints, to maximise the minimum pairwise CIEDE2000 over normal, protan and deutan vision.
// node audits/tools/phase4/tokens/fidelity/optimise-cvd.mjs [seed]
import { parseHex, fromOklch, oklch, lum, contrast, hex, de2000, simulate } from './colour-lib.mjs';
import { HOUSE } from './gen.mjs';

const EXCLUDE = (process.argv[3] || "").split(",").filter(Boolean);
const KEYS = Object.keys(HOUSE).filter(k => !EXCLUDE.includes(k));
const BASEH = Object.fromEntries(KEYS.map(k => [k, oklch(parseHex(HOUSE[k].fill)).H]));
const MAXDH = 10;
const DYMIN = Number(process.env.DYMIN || 0.26), DLMAX = Number(process.env.DLMAX || 0.87);   // dark: graphic only may go to 0.20 (>= 3:1 on every dark surface)
const YMAX = Number(process.env.YMAX || 0.175);   // 0.175: white label >= 4.5 (button fill); 0.21: graphic only, >= 3:1 on the Parchment page
const VISIONS = ['normal', 'protan', 'deutan'];
let seed = Number(process.argv[2] || 7);
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);

function solveL(target, C, H) { let lo = 0.05, hi = 0.99; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (lum(fromOklch(m, C, H)) < target) lo = m; else hi = m; } return fromOklch((lo + hi) / 2, C, H); }
const make = {
  light: (v, k) => solveL(v.y, 0.21, BASEH[k] + v.dh),          // v.y = WCAG luminance
  dark: (v, k) => fromOklch(v.L, 0.16, BASEH[k] + v.dh),
};
// vibrancy guards: a graphic tone must stay a clear, saturated member of its family (no browns, olives or near-whites)
const LIGHT_YMIN = { pink: 0.06, peach: 0.115, butter: 0.12, mint: 0.06, aqua: 0.06, sky: 0.06, periwinkle: 0.05, lavender: 0.06 };
const HUE_WIN = { butter: [72, 98], peach: [38, 62], sky: [238, 262], periwinkle: [268, 284], lavender: [292, 312] };
const CMIN = { light: { sky: 0.11, peach: 0.12 }, dark: { peach: 0.1 } };
const DARK_LMIN = { peach: 0.7 };
const hueOk = (k, H) => !HUE_WIN[k] || (H >= HUE_WIN[k][0] && H <= HUE_WIN[k][1]);
const ok = {
  light: (c, k) => { const y = lum(c), o = oklch(c); return y >= LIGHT_YMIN[k] && y <= YMAX && o.C >= (CMIN.light[k] ?? 0.085) && hueOk(k, o.H); },   // white label >= 4.5 needs y <= 0.183
  dark: (c, k) => { const y = lum(c), o = oklch(c); return y >= DYMIN && o.L <= DLMAX && o.L >= (DARK_LMIN[k] ?? 0) && o.C >= (CMIN.dark[k] ?? 0.085) && hueOk(k, o.H); },          // dark on-ink >= 4.5 needs y >= ~0.23
};
function score(sch, V) {
  const cs = KEYS.map(k => make[sch](V[k], k));
  let min = 1e9;
  for (const vis of VISIONS) {
    const sim = cs.map(c => simulate(c, vis));
    for (let i = 0; i < sim.length; i++) for (let j = i + 1; j < sim.length; j++) min = Math.min(min, de2000(sim[i], sim[j]));
  }
  const bad = cs.filter((c, i) => !ok[sch](c, KEYS[i])).length;
  return bad ? -bad : min;   // infeasible: count violations so the climb can walk out of them
}
function search(sch) {
  const init = () => Object.fromEntries(KEYS.map(k => [k, sch === 'light' ? { y: 0.13 + rnd() * 0.04, dh: (rnd() - 0.5) * 6 } : { L: 0.74 + rnd() * 0.08, dh: (rnd() - 0.5) * 6 }]));
  let best = null, bestS = -1, redraws = 0;
  for (let restart = 0; restart < Number(process.env.RESTARTS || 45); restart++) {
    let V = init(), s = score(sch, V);
    for (let it = 0; it < 900; it++) {
      const k = KEYS[Math.floor(rnd() * KEYS.length)];
      const W = structuredClone(V);
      if (rnd() < 0.6) { if (sch === 'light') W[k].y = Math.min(YMAX, Math.max(0.045, W[k].y + (rnd() - 0.5) * 0.04)); else W[k].L = Math.min(DLMAX, Math.max(0.6, W[k].L + (rnd() - 0.5) * 0.08)); }
      else W[k].dh = Math.max(-MAXDH, Math.min(MAXDH, W[k].dh + (rnd() - 0.5) * 8));
      const t = score(sch, W);
      if (t >= s) { V = W; s = t; }
    }
    if (s > bestS) { bestS = s; best = V; }
    if (s < 0 && ++redraws < 60) restart--; // infeasible start: draw again (at most 60 redraws)
  }
  return { best, bestS };
}
for (const sch of (process.env.SCHEMES || "light,dark").split(",")) {
  const { best, bestS } = search(sch);
  console.log(`${sch}: min dE00 over normal/protan/deutan = ${bestS.toFixed(2)}`);
  for (const k of KEYS) {
    const c = make[sch](best[k], k), o = oklch(c);
    console.log(`  ${k.padEnd(10)} ${hex(c)} y=${lum(c).toFixed(3)} L=${o.L.toFixed(3)} C=${o.C.toFixed(3)} H=${o.H.toFixed(1)} (dh ${best[k].dh.toFixed(1)}) vsWhite ${contrast(c, parseHex('#FFFFFF')).toFixed(2)} vsDark ${contrast(c, parseHex('#1C1B1F')).toFixed(2)}`);
  }
}
