// Skeptic #2, realism check for "tv-board-overflows-1080": the typical household with short names, on a day when all
// seven family members pray on the family list (Prayed today grows to two rows), with the seeded four reminders.
//   node "audits/tools/phase2/VIS/verify-tv-board-overflows-1080-2b.mjs"
import path from 'node:path';
import { local, sleep, DEMO } from '../../lib/local.mjs';

const L = await local({ variant: 'typical' });
try {
  const fam = await L.apiAs('eli', '/api/data/prayer?scope=family');
  const rows = (fam.body.items || []).filter(r => r.key.startsWith('prayer:') && r.value && r.value.prayedBy);
  const row = rows.find(r => Object.keys(r.value.prayedBy).length) || rows[0];
  const today = new Date(DEMO).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  console.log('family prayer row', row.key, 'prayedBy keys', Object.keys(row.value.prayedBy).slice(-3), '→ using', today);
  const value = { ...row.value, prayedBy: { ...row.value.prayedBy, [today]: ['Eli', 'Mae', 'Elizabeth', 'David', 'Mea', 'Ezra', 'Kiara'] } };
  const put = await L.apiAs('eli', `/api/data/prayer/${row.key}?scope=family`, { method: 'PUT', body: { value, updated_at: Date.now() } });
  console.log('PUT', put.status);
  const d = await L.device({ device: 'tv', profile: 'tv' });
  await d.goto('#home'); await d.page.waitForSelector('#tv');
  for (let i = 0; i < 75 && !(await d.page.evaluate(() => !!(window.hub && hub.sync && hub.sync.lastPull))); i++) await sleep(200);
  await sleep(1500);
  const m = await d.page.evaluate(() => {
    const v = document.querySelector('#views'); const b = s => { const r = document.querySelector(s).getBoundingClientRect(); return [Math.round(r.top), Math.round(r.bottom)]; };
    const rows = [...document.querySelectorAll('#tv #remlist .rem-row')];
    return { prayedFaces: document.querySelectorAll('#tv-prayed .tv-face').length, viewsScrollHeight: v.scrollHeight, viewsClientHeight: v.clientHeight, hiddenPx: v.scrollHeight - v.clientHeight,
      prayed: b('#tv .tv-prayed'), feed: b('#tv .tv-feed'), rem: b('#tv-rem-card'), reminders: rows.length, remindersFullyOnScreen: rows.filter(r => r.getBoundingClientRect().bottom <= innerHeight).length };
  });
  console.log(JSON.stringify(m));
  const f = path.resolve('audits/evidence/p2/VIS/verify-tv-overflow-2-allprayed.png');
  await d.page.screenshot({ path: f, scale: 'css', animations: 'disabled', caret: 'hide' });
  console.log('shot', path.relative(process.cwd(), f).split(path.sep).join('/'));
} finally { await L.close(); }
