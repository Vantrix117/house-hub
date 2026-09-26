// tb tie-breaker, UX-HOME-8: after one ✓ tap on the Kitchen iPad, when does the "Cleared the reminder" trace reach Home's feed
// without anyone pressing refresh, and is anything restorable? Also the vertical gap between neighbouring ✓ targets.
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../../lib/local.mjs';
const OUT = path.join(ROOT, 'audits/evidence/p5/ux-verify/UX-HOME-8/tb');
fs.mkdirSync(OUT, { recursive: true });
const L = await local({ variant: 'typical', clock: 'demo' });
const res = {};
try {
  const d = await L.device({ device: 'ipad-portrait', profile: 'christian', fixedTime: false });
  await d.goto('#home');
  await d.page.waitForFunction(() => hub.sync.lastPull > 0 && document.querySelector('#remlist [data-done]'), null, { timeout: 15000 });
  await sleep(500);
  res.buttons = await d.page.evaluate(() => [...document.querySelectorAll('#remlist [data-done]')].map(b => { const r = b.getBoundingClientRect(); return { top: Math.round(r.top), h: Math.round(r.height), w: Math.round(r.width) }; }));
  res.gapsBetweenChecks = res.buttons.slice(1).map((b, i) => b.top - (res.buttons[i].top + res.buttons[i].h));
  const target = await d.page.evaluate(() => { const b = document.querySelectorAll('#remlist [data-done]')[2]; return { id: b.dataset.done, text: b.closest('.rem-row').querySelector('.rem-text').textContent }; });
  res.target = target.text;
  await d.page.tap(`#remlist [data-done="${target.id}"]`);
  const t0 = Date.now(); res.feedTimeline = [];
  for (const at of [300, 3000, 10000, 20000, 35000, 45000]) {
    await sleep(at - (Date.now() - t0));
    res.feedTimeline.push(await d.page.evaluate(([at, txt]) => { const f = (document.querySelector('#feed') || {}).innerText || ''; return { at, lastPull: hub.sync.lastPull, traceOnHome: f.includes('Cleared the reminder: ' + txt), undoOrRestore: [...document.querySelectorAll('button,[role=button],a')].filter(b => /undo|restore|bring back/i.test(b.textContent + (b.getAttribute('aria-label') || ''))).length, reminders: document.querySelectorAll('#remlist .rem-row').length }; }, [at, target.text]));
  }
  await d.shot(path.join(OUT, 'after-45s-ipad-portrait.png'));
  await d.close();
} finally { await L.close(); }
fs.writeFileSync(path.join(OUT, 'feed-trace.json'), JSON.stringify(res, null, 1));
console.log(JSON.stringify(res, null, 1));
