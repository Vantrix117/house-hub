// Screenshot of the "Not yet" toast on a box-5 verse: the toast says "again tomorrow" (apps/verses.html:302) while the row
// moves to box 4, due in 7 days (295-296). Setup (local rig): Eli's 6-0 (Genesis 50:20) set to box 5, due today.
import { local, DEMO, sleep } from '../../lib/local.mjs';
import { openVerses, rate, serverRow, save, shot, waitQueueEmpty } from './_lib.mjs';
const L = await local({ variant: 'typical', clock: 'demo' });
try {
  const rc = { ...(await serverRow(L, 'eli', 'f260', 'f260.recall')).value, '6-0': { s: 'got', t: 1, box: 5, due: '2026-09-22', last: '2026-09-08', streak: 4 } };
  const now = (await L.apiAs('eli', '/api/data/f260?scope=person')).body.now;
  await L.apiAs('eli', '/api/data/f260/batch?scope=person', { method: 'POST', body: { items: [{ key: 'f260.recall', value: rc, updated_at: now + 1 }] } });
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: DEMO });
  const f = await openVerses(d);
  const first = await f.evaluate(() => window.verses.current());
  await rate(f, 'not'); await sleep(250);
  const toast = await d.page.evaluate(() => { const t = document.getElementById('hub-toast'); return t && !t.hidden ? t.textContent : null; }) || await f.evaluate(() => { const t = document.getElementById('hub-toast'); return t ? t.textContent : null; });
  const file = await shot(d.page, 'toast-not-yet-box5-iphone.png');
  await waitQueueEmpty(d);
  const row = (await serverRow(L, 'eli', 'f260', 'f260.recall')).value['6-0'];
  const label = await f.evaluate(() => [...document.querySelectorAll('#later-list li')].map(li => li.textContent.replace(/\s+/g, ' ').trim()).find(t => t.startsWith('Genesis 50:20')) || 'not in the first 12 of Coming up');
  const out = { rated: first, toast, row, comingUpLabel: label, shot: file };
  console.log(JSON.stringify(out, null, 1)); save('toast-not-yet.json', out);
} finally { await L.close(); }
