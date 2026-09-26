// Batch 0b follow-up: one "Got it" tap on a loaded Verses card must rate exactly one card, and the next card must show its
// veiled text. (The recapture's verses/rated screen showed two cards moved and no veil after one tap.)
//   node "audits/tools/phase6/0b/verses-one-tap.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits', 'evidence', 'p6', '0b'); fs.mkdirSync(OUT, { recursive: true });
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const res = {};
try {
  const d = await L.device({ device: 'desktop', profile: 'eli' });
  const f = await d.openApp('verses');
  await f.waitForFunction(() => window.hub && hub.isLoaded() && !document.getElementById('show').disabled, null, { timeout: 20000 });
  await sleep(500);
  const state = () => f.evaluate(() => ({
    ref: document.getElementById('ref').textContent.trim(),
    veil: (document.querySelector('#veil, .veil, [data-veil]') || {}).textContent ? document.querySelector('#veil, .veil, [data-veil]').textContent.trim().slice(0, 40) : null,
    pill: (document.querySelector('.pill') || {}).textContent ? document.querySelector('.pill').textContent.trim() : null,
    recall: Object.keys((hub.get('f260.recall', { app: 'f260', scope: 'person' }) || {})).length,
    queued: Object.keys(JSON.parse(localStorage.getItem('hub.queue.f260.person.eli') || '{}')),
  }));
  res.before = await state();
  const rateCalls = [];
  await f.evaluate(() => { const r = window.verses && window.verses.rate; window.__rates = 0; if (r) window.verses.rate = (...a) => { window.__rates++; return r(...a); }; });
  await f.locator('#show').click();
  await f.waitForSelector('#act-rate:not([hidden])', { timeout: 3000 });
  await f.locator('#act-rate [data-rate="got"]').click();
  await sleep(1500);
  res.after = await state();
  res.toast = await f.evaluate(() => (document.getElementById('hub-toast') || {}).textContent || null);
  res.html = await f.evaluate(() => document.getElementById('trainer').outerHTML.slice(0, 1500));
  await d.page.screenshot({ path: path.join(OUT, 'verses-one-tap-after.png'), scale: 'css' });
  console.log(JSON.stringify(res, null, 1));
} finally { await L.close(); }
fs.writeFileSync(path.join(OUT, 'verses-one-tap.json'), JSON.stringify(res, null, 1));
