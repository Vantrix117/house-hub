// Phase 4 MOTION — what the motion tokens actually do. Evaluates the cubic-bezier easings in apps/design.css:105-109
// (and the curves apps hand-roll) numerically: overshoot (max progress), time to 90 % of the change, and how far a press
// scale has travelled after a 60 / 100 / 150 ms tap for the durations in use. A bezier with fixed duration cannot carry
// velocity from an interrupted gesture (CSS restarts the curve from the current value), which is the difference from a
// spring. Pure maths, no browser.
//   node "audits/tools/phase4/MOTION/curves.mjs"  → audits/evidence/p4/MOTION/curves.json
import fs from 'node:fs';
import path from 'node:path';
const bez = (x1, y1, x2, y2) => {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const X = t => ((ax * t + bx) * t + cx) * t, Y = t => ((ay * t + by) * t + cy) * t;
  return x => { let lo = 0, hi = 1; for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (X(m) < x) lo = m; else hi = m; } return Y((lo + hi) / 2); };
};
const CURVES = {
  '--ease (design.css:105)': [.2, .7, .2, 1], '--ease-in-out (design.css:107)': [.65, 0, .35, 1], '--spring (design.css:108)': [.34, 1.4, .64, 1],
  'f260/prayer cubic-bezier(.3,1.6,.5,1)': [.3, 1.6, .5, 1], 'f260/prayer cubic-bezier(.3,.9,.3,1)': [.3, .9, .3, 1], 'prayer cubic-bezier(.22,.9,.3,1)': [.22, .9, .3, 1],
  'dollywood cubic-bezier(.2,.8,.2,1)': [.2, .8, .2, 1], 'CSS ease': [.25, .1, .25, 1],
};
const out = {};
for (const [k, c] of Object.entries(CURVES)) {
  const f = bez(...c); let max = 0, t90 = null;
  for (let i = 0; i <= 1000; i++) { const x = i / 1000, y = f(x); if (y > max) max = y; if (t90 == null && y >= 0.9) t90 = x; }
  out[k] = { overshootPct: +((max - 1) * 100).toFixed(1), reach90AtFraction: t90 };
}
// press depth after a quick tap: .btn transform uses var(--dur-2) 220 ms with --spring (design.css:357), .tile 220 ms spring (index.html:224)
const spring = bez(.34, 1.4, .64, 1), ease = bez(.25, .1, .25, 1);
const press = {};
for (const [name, dur, f, scale] of [['.btn 220ms --spring → .96', 220, spring, .96], ['.tile 220ms --spring → .93', 220, spring, .93], ['prayer .mark 180ms ease → .86', 180, ease, .86], ['prayer .act 160ms ease → translateY(1px)', 160, ease, null], ['dollywood-live .fab 150ms --ease → .92', 150, bez(.2, .7, .2, 1), .92]]) {
  press[name] = {};
  for (const tap of [60, 100, 150]) { const p = f(Math.min(1, tap / dur)); press[name][tap + 'ms'] = scale == null ? `${(p * 1).toFixed(2)}px of 1px` : `scale ${(1 - (1 - scale) * p).toFixed(3)} (${Math.round(p * 100)}% of the press)`; }
}
const res = { curves: out, pressAfterTap: press, note: 'A CSS transition interrupted mid-way restarts a new fixed-duration curve from the current value with zero initial velocity; a spring keeps velocity. None of the curves is a spring.' };
fs.mkdirSync(path.resolve('audits/evidence/p4/MOTION'), { recursive: true });
fs.writeFileSync(path.resolve('audits/evidence/p4/MOTION/curves.json'), JSON.stringify(res, null, 1));
console.log(JSON.stringify(res, null, 1));
