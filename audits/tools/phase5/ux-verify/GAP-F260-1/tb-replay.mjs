// tb: Node replay of apps/f260.html nextReading() (PLAN and function text read from the app).
// Scenario A: weeks 1-37 read except 30-2, 38-0/38-1 read, curWeek 38 -> ticks until 30-2 offered.
// Scenario B: week stepper '+' once at 38 (38-2..4 unread) -> curWeek 39 -> ticks until 38-2 offered.
// Scenario C: accidental untick of a past day (row tap in an old week; no confirm/undo) at curWeek 38, weeks 1-37 + 38-0/1 read, 12-2 unticked.
import fs from 'node:fs';
const src = fs.readFileSync(new URL('../../../../../apps/f260.html', import.meta.url), 'utf8');
const ps = src.indexOf('const PLAN = [');
let i = src.indexOf('[', ps), depth = 0, j = i;
for (; j < src.length; j++) { const c = src[j]; if (c === '[') depth++; else if (c === ']') { depth--; if (!depth) break; } }
const PLAN = eval(src.slice(i, j + 1));
const fs0 = src.indexOf('function nextReading()'), fe = src.indexOf('\nfunction updateStats', fs0);
const nextReading = new Function('PLAN', 'done', 'curWeek', 'DAY_CH', src.slice(fs0, fe) + '\nreturn nextReading();');
function run(done, cur, target) {
  const first = nextReading(PLAN, done, cur, {}); let n = 0, nx;
  while ((nx = nextReading(PLAN, done, cur, {})) && nx.id !== target) { done[nx.id] = true; n++; }
  return { firstOffered: first.id + ' ' + first.ref, ticksBeforeTarget: n, target: nx && nx.id + ' ' + nx.ref };
}
const base = () => { const d = {}; for (let w = 1; w <= 37; w++) for (let k = 0; k < 5; k++) d[w + '-' + k] = true; d['38-0'] = d['38-1'] = true; return d; };
const A = base(); delete A['30-2'];
const B = base();
const C = base(); delete C['12-2'];
// Row-tap handler: does a tap anywhere on a [data-day] row toggle done, with no confirm?
const h = src.indexOf("const day = e.target.closest('[data-day]');");
const handler = src.slice(h, h + 260);
const out = { A: run(A, 38, '30-2'), B: run(B, 39, '38-2'), C: run(C, 38, '12-2'),
  rowTapTogglesWithoutConfirm: /done\[id\] = !done\[id\]/.test(handler) && !/confirm\(/.test(handler),
  stepperPlusSetsCurrentWithoutConfirm: /\$\('wkPlus'\)\.onclick = \(\) => \{ setCurrent\(curWeek \+ 1\); jump\(\); \};/.test(src) };
console.log(JSON.stringify(out, null, 1));
fs.writeFileSync(new URL('../../../../evidence/p5/ux-verify/GAP-F260-1/tb/replay.json', import.meta.url), JSON.stringify(out, null, 1));
