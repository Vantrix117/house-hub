// Probe 4: F260 streakInfo, index.html logStreak and worker chat.js logStreak agree on random logs and on the edge cases.
const fs = require('fs');
const R = 'C:/Users/ex_bo/OneDrive/Claude Related/App Hub/';
const f260 = fs.readFileSync(R + 'apps/f260.html', 'utf8'), idx = fs.readFileSync(R + 'index.html', 'utf8'), chat = fs.readFileSync(R + 'worker/src/chat.js', 'utf8');
const TODAY = '2026-09-22';
const addDays = (k, n) => new Date(Date.parse(k + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);
// F260
const fsrc = f260.slice(f260.indexOf('function streakInfo(days)'), f260.indexOf('// P3-F260-02: a reading day taken back'));
const streakInfo = new Function('dayKey', 'shiftDay', 'daysBetween', fsrc + '; return streakInfo;')(() => TODAY, addDays, daysBetween);
// index
const ism = /const logStreak = days => \{[^\n]*\};/.exec(idx)[0];
const hub = { today: () => TODAY, addDays };
const idxStreak = new Function('hub', ism + '; return logStreak;')(hub);
// chat
const csm = /const logStreak = log => \{[^\n]*\};/.exec(chat)[0];
const chatStreak = new Function('today', csm + '; return logStreak;')(() => TODAY);
let bad = 0; const cases = [];
const rel = arr => Object.fromEntries(arr.map(n => [addDays(TODAY, -n), true]));
const named = { 'only yesterday': [1], 'two rest days, today unread': [3], 'gap of three, today unread': [4], 'today + 2 rest': [0, 3], 'today + 3 gap': [0, 4], 'today only': [0], 'empty': [], 'future day': [-1, 1] };
for (const [n, a] of Object.entries(named)) { const d = rel(a); const s = streakInfo(d); cases.push([n, s.streak, idxStreak(d), chatStreak(d), s.atRisk]); }
for (let t = 0; t < 20000; t++) { const d = {}; for (let i = 0; i < 40; i++) if (Math.random() < 0.55) d[addDays(TODAY, -i)] = true; const a = streakInfo(d).streak, b = idxStreak(d), c = chatStreak(d); if (a !== b || b !== c) { bad++; if (bad < 4) console.log('disagree', a, b, c, Object.keys(d).sort().slice(-6)); } }
console.table(cases); console.log('random disagreements:', bad);
