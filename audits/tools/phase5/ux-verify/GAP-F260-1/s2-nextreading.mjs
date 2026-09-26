// s2: pure-Node replay of apps/f260.html nextReading() (PLAN + function text lifted verbatim from the app, no browser).
// State: weeks 1..37 read except 30-2, week 38 days 0-1 read, curWeek 38. Ticks whatever nextReading offers until 30-2 comes up.
import fs from 'node:fs';
const src = fs.readFileSync(new URL('../../../../../apps/f260.html', import.meta.url), 'utf8');
const planStart = src.indexOf('const PLAN = [');
let i = src.indexOf('[', planStart), depth = 0, j = i;
for (; j < src.length; j++) { const c = src[j]; if (c === '[') depth++; else if (c === ']') { depth--; if (!depth) break; } }
const PLAN = eval(src.slice(i, j + 1));
const fnStart = src.indexOf('function nextReading()');
const fnEnd = src.indexOf('\nfunction updateStats', fnStart);
const fnText = src.slice(fnStart, fnEnd);
const done = {}; const curWeek = 38; const DAY_CH = {};
for (let w = 1; w <= 37; w++) for (let d = 0; d < 5; d++) done[w + '-' + d] = true;
delete done['30-2']; done['38-0'] = done['38-1'] = true;
const nextReading = new Function('PLAN', 'done', 'curWeek', 'DAY_CH', fnText + '\nreturn nextReading();');
const first = nextReading(PLAN, done, curWeek, DAY_CH);
let n = 0, nx;
while ((nx = nextReading(PLAN, done, curWeek, DAY_CH)) && nx.id !== '30-2') { done[nx.id] = true; n++; }
const out = { planWeeks: PLAN.length, firstOffered: first.id + ' ' + first.ref, readingsTickedBefore30_2Offered: n, offeredThen: nx && (nx.id + ' ' + nx.ref) };
console.log(JSON.stringify(out, null, 1));
fs.writeFileSync(new URL('../../../../evidence/p5/ux-verify/GAP-F260-1/s2/nextreading.json', import.meta.url), JSON.stringify(out, null, 1));
