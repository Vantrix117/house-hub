// Skeptic #2 for "empty state says a newly memorised verse shows up 'on its review day', but it is due at once".
// Independent reproduction: Mea (niece) starts with nothing memorised; read the empty-state copy; write f260.mem {"1-0":true}
// to her person scope on the local server (the same row F260's memorised tap writes); reopen Verses on a fresh device
// at the same demo instant and read what it shows.
// Run: node "audits/tools/phase3/verses/verify-critic-empty-state-copy-review-day-wrong-4-2.mjs"
import fs from 'node:fs';
import { local, sleep, DEMO } from '../../lib/local.mjs';
const P = 'audits/evidence/p3/verses/verify-critic-empty-state-copy-review-day-wrong-4-2';
const read = f => f.evaluate(() => {
  const q = s => document.querySelector(s), vis = s => !!q(s) && !q(s).hidden;
  const d = new Date(), today = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  return { today, who: q('#who') && q('#who').textContent.trim(), empty: vis('#empty'), emptyCopy: q('#empty p').textContent,
    trainer: vis('#trainer'), done: vis('#done'), ref: vis('#trainer') ? q('#ref').textContent : null,
    due: vis('#stats') ? q('#st-due').textContent : null,
    queue: [...document.querySelectorAll('#queue-list li')].map(li => li.textContent.replace(/\s+/g, ' ').trim()),
    recall: JSON.stringify(window.hub.get('f260.recall', { app: 'f260', scope: 'person' }) || null) };
});
const open = async d => { const f = await d.openApp('verses'); await f.waitForSelector('#trainer:not([hidden]), #done:not([hidden]), #empty:not([hidden])', { timeout: 15000 }); await sleep(500); return f; };
const L = await local({ variant: 'typical', clock: 'demo' });
const out = {};
try {
  out.memBefore = ((await L.apiAs('niece', '/api/data/f260?scope=person')).body.items || []).filter(i => i.key === 'f260.mem');
  const d1 = await L.device({ device: 'iphone-pwa', profile: 'niece', installClock: DEMO });
  out.before = await read(await open(d1));
  await d1.page.screenshot({ path: P + '-before.png', scale: 'css' });
  await d1.close();
  const w = await L.apiAs('niece', '/api/data/f260/batch?scope=person', { method: 'POST', body: { items: [{ key: 'f260.mem', value: { '1-0': true }, updated_at: DEMO + 1000 }] } });
  out.write = { status: w.status, body: w.body };
  out.memAfter = ((await L.apiAs('niece', '/api/data/f260?scope=person')).body.items || []).filter(i => i.key === 'f260.mem').map(i => i.value);
  const d2 = await L.device({ device: 'iphone-pwa', profile: 'niece', installClock: DEMO + 60000 });
  out.after = await read(await open(d2));
  await d2.page.screenshot({ path: P + '-after.png', scale: 'css' });
  await d2.close();
  console.log(JSON.stringify(out, null, 1));
  fs.writeFileSync(P + '.json', JSON.stringify(out, null, 1));
} finally { await L.close(); }
