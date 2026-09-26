// Tie-breaker, UX-LEFTOVERS-2: measure the kid page (Kiara, iPhone PWA) and test the residual harm apart from the ✓
// (owned by P3-LEFTOVERS-13): a kid's junk add reaches the family list, and how an adult undoes it. Local rig only.
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../../lib/local.mjs';
const OUT = path.resolve('audits/evidence/p5/ux-verify/UX-LEFTOVERS-2/tb');
fs.mkdirSync(OUT, { recursive: true });
const SEL = ['h1', '.lede', '.alert', '.group h2', '.nm', '.meta', '.status', '.done', '.hearth p', '#name', '.log', '.mic', 'form[id="add"]', '.item'];
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const out = {};
const names = rows => (rows.rows || rows.data || rows).filter?.(r => r.key?.startsWith('item:') && r.value && !r.deleted).map(r => r.value.name);
try {
  const k = await L.device({ device: 'iphone-pwa', profile: 'kiara' });
  const f = await k.openApp('leftovers');
  await f.waitForFunction(() => window.__larder && document.getElementById('tally').textContent.length > 0);
  await sleep(1000);
  out.kid = await f.evaluate(SEL => {
    const o = { kind: document.documentElement.dataset.kind, canWrite: hub.canWrite, tap: getComputedStyle(document.documentElement).getPropertyValue('--tap').trim(), fsMd: getComputedStyle(document.documentElement).getPropertyValue('--fs-md').trim(), el: {} };
    for (const s of SEL) { const e = document.querySelector(s); if (!e) { o.el[s] = null; continue; } const cs = getComputedStyle(e), r = e.getBoundingClientRect(); o.el[s] = { fs: cs.fontSize, radius: cs.borderTopLeftRadius, w: Math.round(r.width), h: Math.round(r.height), shown: cs.display !== 'none' && !e.hidden }; }
    o.done = document.querySelectorAll('.done').length; o.items = document.querySelectorAll('.item').length;
    o.pictures = document.querySelectorAll('.item img, .item picture').length;
    return o;
  }, SEL);
  await k.shot(path.join(OUT, 'kiara-larder-iphone.png'));
  // kid logs junk through the real form
  await f.fill('#name', 'asdfgh');
  await f.click('.log');
  await sleep(4000);
  const raw1 = await L.apiAs('eli', '/api/data/leftovers?scope=family');
  out.serverAfterKidAdd = JSON.stringify(raw1).includes('asdfgh');
  await k.close();
  // adult sees it and undoes it with one ✓
  const a = await L.device({ device: 'iphone-pwa', profile: 'eli' });
  const g = await a.openApp('leftovers');
  await g.waitForFunction(() => window.__larder && document.getElementById('tally').textContent.length > 0);
  await sleep(1500);
  out.adultSeesJunk = await g.evaluate(() => [...document.querySelectorAll('.nm')].some(n => n.textContent === 'asdfgh'));
  const btn = g.locator('button[aria-label="Mark asdfgh used up"]');
  out.adultUndoTaps = (await btn.count()) ? 1 : null;
  if (out.adultUndoTaps) { await btn.click(); await sleep(4000); }
  const raw2 = await L.apiAs('eli', '/api/data/leftovers?scope=family');
  const live = JSON.stringify(raw2).match(/"name":"asdfgh"[^}]*/g) || [];
  out.afterAdultRemove = await g.evaluate(() => [...document.querySelectorAll('.nm')].some(n => n.textContent === 'asdfgh'));
  await a.close();
  console.log(JSON.stringify(out, null, 1));
  fs.writeFileSync(path.join(OUT, 'residual.json'), JSON.stringify(out, null, 1));
} finally { await L.close(); }
