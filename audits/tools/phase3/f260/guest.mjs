// F260 — a guest (Grandma Jo, PIN-less, stay ends in 6 days) opens F260 once: what she sees and what is written to her
// person scope without any tap. Also Mea (an adult who has never opened F260) for comparison.
//   node "audits/tools/phase3/f260/guest.mjs"
import { local, sleep, DEMO, save, shot, rows, texts, ready, watchWrites } from './_lib.mjs';

const out = {};
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
try {
  for (const pid of ['guest-grandmajo', 'niece']) {
    const before = await rows(L, pid);
    const d = await L.device({ device: 'ipad-portrait', profile: pid, installClock: DEMO });
    const writes = watchWrites(d.page);
    const f = await d.openApp('f260'); await ready(f); await sleep(4000);
    const ui = await texts(f, ['#todayKind', '#todayTitle', '#todayMeta', '#todayKids', '#heroPace', '.foot']);
    const after = await rows(L, pid);
    out[pid] = { rowsBefore: Object.keys(before), rowsAfter: after, writes: writes.map(w => w.keys).flat(), ui };
    await shot(d.page, `guest-${pid}-first-open-ipad.png`);
    await d.close();
    console.log(pid, '| rows before', JSON.stringify(Object.keys(before)), '| written by opening:', JSON.stringify(out[pid].writes), '| server now', JSON.stringify(Object.keys(after)));
    console.log('   ui', JSON.stringify(ui).slice(0, 400));
  }
  const ev = await L.apiAs('eli', '/api/admin/cron/run', { method: 'POST', body: { job: 'evening' } });
  const evOut = [].concat(ev.body.results || ev.body).find(x => x && x.job === 'evening') || ev.body;
  out.eveningJobChecked = (evOut.checked || []).map(c => c.profile + ':' + c.readToday);
  console.log('8 pm F260 nudge now checks:', JSON.stringify(out.eveningJobChecked));
} finally { await L.close(); }
console.log('evidence →', save('guest.json', out));
