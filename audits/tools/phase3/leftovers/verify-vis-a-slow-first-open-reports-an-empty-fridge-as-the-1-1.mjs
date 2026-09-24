// Skeptic #1 for "A slow first open reports an empty fridge as the 'last copy saved here'".
// A fresh device (no cache) opens the Larder while GET /api/data/leftovers is slow. Three arms, each on a fresh local reset:
//   HOLD  : the GET never answers (hub.request aborts it at 12 s, apps/hub.js:128-132)
//   SLOW9 : the GET is answered after 9 s (slower than hub.ready's 6 s wait, apps/hub.js:337)
//   CTRL  : no delay
//   SLOW9-long-1..3 : as SLOW9, watched for 45 s (past the 30 s poll): does the list fill in after the pull lands?
// Samples the frame every 500 ms: hub.sync.state, navigator.onLine, #tally, .empty present, #mode text, card count,
// and counts every non-GET request to /api/data/leftovers (does the stall write anything?).
// Run: node "audits/tools/phase3/leftovers/verify-vis-a-slow-first-open-reports-an-empty-fridge-as-the-1-1.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';

const PREFIX = 'verify-vis-a-slow-first-open-reports-an-empty-fridge-as-the-1-1';
const EVID = path.resolve('audits/evidence/p3/leftovers');
fs.mkdirSync(EVID, { recursive: true });
const rel = n => 'audits/evidence/p3/leftovers/' + n;
const L = await local({ variant: 'typical', clock: 'demo' });
const out = {};
const snap = f => f.evaluate(() => ({
  sync: window.hub && hub.sync && hub.sync.state,
  onLine: navigator.onLine,
  tally: (document.getElementById('tally') || {}).textContent || '',
  empty: !!document.querySelector('.empty'),
  emptyText: (document.querySelector('.empty p') || {}).textContent || null,
  mode: document.getElementById('mode').hidden ? null : document.getElementById('mode').textContent,
  cards: document.querySelectorAll('.item').length,
})).catch(e => ({ err: String(e).slice(0, 120) }));

async function arm(name, mode, until = 13000, shotsAt = [7500]) {
  await L.reset('typical');
  const server = await L.apiAs('eli', '/api/data/leftovers?scope=family');
  const serverLive = (server.body.items || server.body.rows || []).filter(r => r.value).length;
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli' });
  const writes = [];
  d.page.on('request', r => { if (r.url().includes('/api/data/leftovers') && r.method() !== 'GET' && r.method() !== 'OPTIONS') writes.push(r.method() + ' ' + r.url().replace(/^.*\/api\//, '/api/')); });
  if (mode === 'hold') await d.ctx.route(u => u.pathname.startsWith('/api/data/leftovers'), async r => { if (r.request().method() === 'GET') return; await r.continue().catch(() => {}); });
  if (mode === 'slow') await d.ctx.route(u => u.pathname.startsWith('/api/data/leftovers'), async r => { if (r.request().method() === 'GET') await sleep(9000); await r.continue().catch(() => {}); });
  const cacheBefore = await d.page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('hub.cache')).length).catch(() => null);
  const f = await d.openApp('leftovers');
  const t0 = Date.now();
  const series = [];
  const shots = {};
  const pending = [...shotsAt];
  while (Date.now() - t0 < until) {
    const t = Date.now() - t0;
    const s = await snap(f);
    series.push({ t, ...s });
    if (pending.length && t >= pending[0]) { const at = pending.shift(); const n = `${PREFIX}-${name}-${at}ms-iphone.png`; await d.page.screenshot({ path: path.join(EVID, n), scale: 'css', animations: 'disabled', caret: 'hide' }); shots[at] = rel(n); }
    await sleep(500);
  }
  // compress the series to state changes
  const changes = series.filter((s, i) => i === 0 || JSON.stringify({ ...s, t: 0 }) !== JSON.stringify({ ...series[i - 1], t: 0 }));
  out[name] = { serverLive, cacheKeysBeforeOpen: cacheBefore, changes, at7500: series.find(s => s.t >= 7500) || null, final: series[series.length - 1], writes, shots };
  console.log(`\n== ${name} (server has ${serverLive} live items; cache keys before open: ${cacheBefore})`);
  for (const c of changes) console.log(`  t=${c.t}ms sync=${c.sync} onLine=${c.onLine} tally="${c.tally}" empty=${c.empty} "${c.emptyText}" cards=${c.cards} mode=${JSON.stringify(c.mode)}`);
  console.log('  writes to /api/data/leftovers:', writes.length, JSON.stringify(writes));
  await d.close();
}

try {
  await arm('HOLD', 'hold', 14000, [7500, 13000]);
  await arm('SLOW9', 'slow', 12500, [7500, 11500]);
  await arm('CTRL', 'none', 4000, []);
  // Follow-up: after the 9 s pull lands, does the list ever fill in? (3 runs, 45 s each, past the 30 s poll)
  for (const i of [1, 2, 3]) await arm('SLOW9-long-' + i, 'slow', 45000, [20000]);
  fs.writeFileSync(path.join(EVID, PREFIX + '.json'), JSON.stringify(out, null, 1));
  console.log('\nsaved', rel(PREFIX + '.json'));
} finally { await L.close(); }
