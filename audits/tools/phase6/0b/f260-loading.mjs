// Batch 0b, F260 (UX-F260-5 / P2-SYNC-17): the loading state on a new phone whose first f260 pull is held 9 s.
// While held: Done must be disabled "Loading your progress…", the stats blank wells (no "0 of 0 chapters"), a tap must write
// nothing. After the pull lands: the real plan and a live Done.
//   node "audits/tools/phase6/0b/f260-loading.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep } from '../../lib/local.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const OUT = path.join(ROOT, 'audits', 'evidence', 'p6', '0b'); fs.mkdirSync(OUT, { recursive: true });
const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
const res = {};
try {
  const ph = await L.newDevice({ name: 'F260 loading phone', profiles: ['eli'] });
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: ph });
  let hold = true; const posts = [];
  await d.ctx.route(/\/api\/data\/f260\?/, async r => { if (r.request().method() === 'GET') while (hold) await sleep(100); r.continue().catch(() => {}); });
  d.page.on('request', r => { if (r.method() === 'POST' && /\/api\/data\/f260\/batch/.test(r.url())) { try { posts.push(JSON.parse(r.postData()).items.map(i => i.key)); } catch {} } });
  const f = await d.openApp('f260', { wait: '#todayDone' });
  await sleep(7000);                                            // past hub.ready's 6 s race
  const look = () => f.evaluate(() => { const b = document.getElementById('todayDone');
    return { done: b.textContent.trim(), disabled: b.disabled, aria: b.getAttribute('aria-disabled'), title: document.getElementById('todayTitle').textContent,
      strip: document.querySelector('.strip').innerText.replace(/\s+/g, ' '), bodyLoading: document.body.classList.contains('f-loading'),
      busy: document.getElementById('planView').getAttribute('aria-busy'), weeks: document.querySelectorAll('#weeks .week').length }; });
  res.held = await look();
  await d.page.screenshot({ path: path.join(OUT, 'f260-loading-held-iphone.png') });
  await f.evaluate(() => document.getElementById('todayDone').click());   // a forced tap on the disabled button
  await sleep(1500); res.postsWhileHeld = posts.slice();
  hold = false;
  await f.waitForFunction(() => !document.getElementById('todayDone').disabled, null, { timeout: 20000 });
  await sleep(1000);
  res.after = await look(); res.postsAfter = posts.slice();
  await d.page.screenshot({ path: path.join(OUT, 'f260-loading-after-iphone.png') });
  res.logs = d.logs.filter(l => /error/i.test(l)).slice(0, 5);
} finally { await L.close(); }
fs.writeFileSync(path.join(OUT, 'f260-loading.json'), JSON.stringify(res, null, 1));
console.log(JSON.stringify(res, null, 1));
