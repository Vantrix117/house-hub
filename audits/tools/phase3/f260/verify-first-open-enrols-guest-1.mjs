// Skeptic #1 for finding "first-open-enrols-guest": does merely opening F260 (no tap) create f260 rows for a guest / Mea,
// and does that put them on the 8 pm evening nudge list (and the Sunday "behind" list)? Also: does Home "gain" a card?
//   node "audits/tools/phase3/f260/verify-first-open-enrols-guest-1.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep, DEMO } from '../../lib/local.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EVID = path.resolve(HERE, '..', '..', '..', 'evidence', 'p3', 'f260');
fs.mkdirSync(EVID, { recursive: true });
const P = 'verify-first-open-enrols-guest-1';
const out = { profiles: {} };

const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const rowKeys = async pid => { const r = await L.apiAs(pid, '/api/data/f260?scope=person'); return (r.body.items || []).filter(i => i.value != null).map(i => i.key); };
const job = async name => { const r = await L.apiAs('eli', '/api/admin/cron/run', { method: 'POST', body: { job: name } }); const b = r.body; return [].concat(b.results || b).find(x => x && x.job === name) || b; };
const homeCard = async page => page.evaluate(() => { const h = [...document.querySelectorAll('h2')].find(e => /Today's reading/.test(e.textContent)); const c = h && h.closest('.card'); return c ? c.textContent.replace(/\s+/g, ' ').trim() : null; });
try {
  const ev0 = await job('evening');
  out.eveningBefore = (ev0.checked || []).map(c => c.profile + ':' + c.readToday);
  console.log('evening job BEFORE any open checks:', JSON.stringify(out.eveningBefore));
  for (const pid of ['guest-grandmajo', 'niece']) {
    const o = out.profiles[pid] = {};
    o.rowsBefore = await rowKeys(pid);
    const d = await L.device({ device: 'ipad-portrait', profile: pid, installClock: DEMO });
    const writes = [];
    d.page.on('request', r => { if (/\/api\/data\//.test(r.url()) && r.method() !== 'GET') { let b = null; try { b = r.postDataJSON(); } catch {} writes.push({ method: r.method(), path: r.url().replace(/^https?:\/\/[^/]+/, ''), keys: b && b.items ? b.items.map(i => i.app_id + '/' + i.key) : [] }); } });
    await d.goto('#home'); await sleep(3500);
    o.homeCardBeforeOpen = await homeCard(d.page);
    o.writesWhileOnHome = writes.length;
    const f = await d.openApp('f260');
    await f.waitForFunction(() => { const t = document.getElementById('todayTitle'); return t && t.textContent.trim(); }, null, { timeout: 15000 });
    await sleep(4000);   // no tap of any kind
    o.todayTitle = await f.evaluate(() => document.getElementById('todayTitle').textContent.trim());
    o.writesByOpening = writes.slice(o.writesWhileOnHome);
    o.rowsAfter = await rowKeys(pid);
    o.weekStart = (await L.apiAs(pid, '/api/data/f260?scope=person&key=f260.weekStart')).body.item?.value ?? null;
    await d.page.screenshot({ path: path.join(EVID, `${P}-${pid}-after-open-ipad.png`), scale: 'css' });
    await d.goto('#home'); await sleep(3000);
    o.homeCardAfter = await homeCard(d.page);
    await d.close();
    console.log(pid, '| rows before', JSON.stringify(o.rowsBefore), '| POSTs by opening', JSON.stringify(o.writesByOpening.map(w => w.keys).flat()), '| rows after', JSON.stringify(o.rowsAfter), '| weekStart', JSON.stringify(o.weekStart));
    console.log('   home card before open:', JSON.stringify(o.homeCardBeforeOpen));
    console.log('   home card after open :', JSON.stringify(o.homeCardAfter));
  }
  const ev1 = await job('evening');
  out.eveningAfter = (ev1.checked || []).map(c => c.profile + ':' + c.readToday);
  out.eveningAfterSkipped = ev1.skipped;
  console.log('evening job AFTER opens checks:', JSON.stringify(out.eveningAfter));
  console.log('   skipped:', JSON.stringify(ev1.skipped));
  const b1 = await job('behind');
  out.behindAfter = b1.checked;
  console.log('behind job AFTER opens checks:', JSON.stringify(b1.checked));
} finally { await L.close(); }
fs.writeFileSync(path.join(EVID, `${P}.json`), JSON.stringify(out, null, 1));
console.log('evidence -> audits/evidence/p3/f260/' + P + '.json');
