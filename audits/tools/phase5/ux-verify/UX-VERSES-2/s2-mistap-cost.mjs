// s2: recompute the cost of a mis-tapped rating from the rate() rules in apps/verses.html:290-304 (pure, no browser).
import fs from 'node:fs';
const src = fs.readFileSync('apps/verses.html', 'utf8');
const INTERVALS = JSON.parse(src.match(/const INTERVALS = (\[[^\]]+\])/)[1]);
const rate = (prev, kind) => { const box = kind === 'got' ? Math.min(5, prev.box + 1) : kind === 'not' ? Math.max(1, prev.box - 1) : prev.box;
  return { box, dueIn: INTERVALS[box - 1], streak: kind === 'got' ? prev.streak + 1 : kind === 'almost' ? prev.streak : 0 }; };
const rows = [];
for (let b = 1; b <= 5; b++) { const prev = { box: b, streak: 3 };
  for (const [meant, tapped] of [['got', 'not'], ['got', 'almost'], ['not', 'got'], ['almost', 'got'], ['almost', 'not']]) {
    const m = rate(prev, meant), t = rate(prev, tapped); rows.push({ fromBox: b, meant, tapped, meantBox: m.box, tappedBox: t.box, meantDueIn: m.dueIn, tappedDueIn: t.dueIn, dueShiftDays: t.dueIn - m.dueIn, streakMeant: m.streak, streakTapped: t.streak }); } }
const streakShown = /streak/.test(src.slice(src.indexOf('function render'), src.indexOf('function whenLabel'))) ? 'render mentions streak (dayStreak from log only?)' : 'no';
const out = { INTERVALS, rows, recallStreakDisplayedInRender: /\.streak\b/.test(src.slice(src.indexOf('function render'), src.indexOf('function whenLabel'))), streakShown,
  toastNotYetSaysTomorrow: /'Not yet — ' \+ ref \+ ' again tomorrow'/.test(src), undoInCode: /undo/i.test(src) };
fs.mkdirSync('audits/evidence/p5/ux-verify/UX-VERSES-2/s2', { recursive: true });
fs.writeFileSync('audits/evidence/p5/ux-verify/UX-VERSES-2/s2/mistap-cost.json', JSON.stringify(out, null, 1));
console.log(JSON.stringify({ ...out, rows: rows.filter(r => r.fromBox === 5 || r.fromBox === 3) }, null, 0));
