// UX-VERSES-2, skeptic s1: what a mis-tapped rating costs Eli on the iPhone and whether anything lets him take it back.
// Measures the rating buttons (order, gaps), rates the first card "Not yet" (as if meant "Got it"), records the recall row
// before/after, the toast (any control in it?), which parts of the UI show the per-verse streak, and what
// "Practise one anyway" offers once the queue is empty. Outputs only to audits/evidence/p5/ux-verify/UX-VERSES-2/s1/.
import fs from 'node:fs';
import path from 'node:path';
import { local, DEMO, sleep, ROOT } from '../../../lib/local.mjs';
const OUT = path.join(ROOT, 'audits/evidence/p5/ux-verify/UX-VERSES-2/s1');
fs.mkdirSync(OUT, { recursive: true });
const L = await local({ variant: 'typical', clock: 'demo' });
const out = {};
const recallRow = async () => { const r = await L.apiAs('eli', '/api/data/f260?scope=person'); const it = (r.body.items || []).find(i => i.key === 'f260.recall'); return it ? it.value : null; };
try {
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: DEMO });
  const f = await d.openApp('verses', { wait: '#trainer:not([hidden]), #done:not([hidden]), #empty:not([hidden])' });
  await sleep(500);
  const cur = await f.evaluate(() => window.verses.current());
  out.queue = await f.evaluate(() => window.verses.dueIds());
  out.current = cur;
  out.localBefore = await f.evaluate(id => (hub.get('f260.recall', { app: 'f260', scope: 'person' }) || {})[id] || null, cur);
  await f.click('#show'); await sleep(200);
  out.buttons = await f.evaluate(() => [...document.querySelectorAll('#act-rate [data-rate]')].map(b => { const r = b.getBoundingClientRect(); return { rate: b.dataset.rate, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; }));
  const bs = out.buttons; out.gaps = bs.slice(1).map((b, i) => (b.y > bs[i].y + bs[i].h - 1) ? b.y - (bs[i].y + bs[i].h) : b.x - (bs[i].x + bs[i].w));
  await f.click('#act-rate [data-rate="not"]'); await sleep(150);
  out.toast = await f.evaluate(() => { const t = document.getElementById('hub-toast'); return t ? { text: t.textContent, hidden: t.hidden, controls: t.querySelectorAll('button, a, [role=button]').length } : null; });
  await d.shot(path.join(OUT, 'after-not-yet-iphone.png'));
  out.localAfter = await f.evaluate(id => (hub.get('f260.recall', { app: 'f260', scope: 'person' }) || {})[id] || null, cur);
  out.nextCard = await f.evaluate(() => window.verses.current());
  out.undoControls = await f.evaluate(() => [...document.querySelectorAll('button')].filter(b => b.offsetParent && /undo|back|change/i.test(b.textContent)).map(b => b.textContent.trim()));
  // finish the rest with Got it
  for (let i = 0; i < 12; i++) {
    const c = await f.evaluate(() => window.verses.current()); if (!c) break;
    await f.click('#show'); await sleep(120); await f.click('#act-rate [data-rate="got"]'); await sleep(200);
  }
  await sleep(2500);
  out.done = await f.evaluate(() => ({ big: document.querySelector('#done-big').textContent, sub: document.querySelector('#done-sub').textContent, again: document.querySelector('#again').hidden ? null : document.querySelector('#again').textContent.trim() }));
  if (out.done.again) {
    await f.click('#again'); await sleep(300);
    out.againOffers = await f.evaluate(() => window.verses.current());
    out.againOffersMisrated = out.againOffers === cur;
  }
  await sleep(2000);
  const srv = await recallRow(); out.serverAfter = srv ? srv[cur] : null;
  await d.close();
} finally { await L.close(); }
fs.writeFileSync(path.join(OUT, 'undo.json'), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
