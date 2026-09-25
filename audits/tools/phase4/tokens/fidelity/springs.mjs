// Phase 4 · token proposal "fidelity" · spring easings as CSS linear() approximations.
// Model: SwiftUI-style spring(response, dampingFraction): omega = 2*pi/response, zeta = dampingFraction.
// Duration = time until the motion stays within 0.3 % of the target. The curve is sampled at N points
// over that duration; linear() (Safari 17.2+, Chrome 113+, Firefox 112+) interpolates between them.
// node audits/tools/phase4/tokens/fidelity/springs.mjs  -> prints the tokens and their overshoot / 90 % time
export const SPRINGS = {
  snappy: { response: 0.2, damping: 0.84, use: 'presses, toggles, selection, chips' },
  gentle: { response: 0.27, damping: 0.94, use: 'sheets, viewer, navigation, toasts (no overshoot)' },
  bouncy: { response: 0.3, damping: 0.6, use: 'celebrations only (stars, badges, the done pop)' },
};
function x(t, { response, damping }) {
  const w = (2 * Math.PI) / response, z = damping;
  if (z >= 1) return 1 - Math.exp(-w * t) * (1 + w * t);
  const wd = w * Math.sqrt(1 - z * z);
  return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + ((z * w) / wd) * Math.sin(wd * t));
}
export function build(name, N = 28) {
  const s = SPRINGS[name];
  let T = 0.01; // settle time
  for (let t = 0.01; t < 3; t += 0.001) { let settled = true; for (let u = t; u < t + 0.5; u += 0.005) if (Math.abs(x(u, s) - 1) > 0.003) { settled = false; break; } if (settled) { T = t; break; } }
  const pts = [];
  for (let i = 0; i <= N; i++) { const t = (i / N) * T; pts.push(i === N ? 1 : x(t, s)); }
  const over = Math.max(...pts) - 1;
  let t90 = 0; for (let i = 0; i <= N; i++) if (pts[i] >= 0.9) { t90 = i / N; break; }
  return { name, ms: Math.round((T * 1000) / 10) * 10, overshoot: over, t90, css: `linear(${pts.map(v => +v.toFixed(4)).join(', ')})` };
}
if (process.argv[1] && process.argv[1].endsWith('springs.mjs')) {
  for (const k of Object.keys(SPRINGS)) { const b = build(k); console.log(`--spring-${k}: ${b.css}; /* ${b.ms} ms, overshoot ${(b.overshoot * 100).toFixed(1)} %, 90 % at ${(b.t90 * 100).toFixed(0)} % */`); }
}
