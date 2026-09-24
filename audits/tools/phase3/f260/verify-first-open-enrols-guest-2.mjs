// Skeptic #2 for finding "first-open-enrols-guest": does merely opening F260 (no tap) write person rows for a guest and
// for Mea, and does that put them on the 8 pm evening job (and the Sunday behind job)? Does Home change?
//   node "audits/tools/phase3/f260/verify-first-open-enrols-guest-2.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep, DEMO } from '../../lib/local.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const EVID = path.join(ROOT, 'audits', 'evidence', 'p3', 'f260'); fs.mkdirSync(EVID, { recursive: true });
const PFX = 'verify-first-open-enrols-guest-2';
const rowsOf = async (L, pid) => { const r = await L.apiAs(pid, '/api/data/f260?scope=person'); const o = {}; for (const it of (r.body.items || [])) o[it.key] = it.value; return o; };
const job = async (L, name) => { const r = await L.apiAs('eli', '/api/admin/cron/run', { method: 'POST', body: { job: name } }); return [].concat(r.body.results || r.body).find(x => x && x.job === name) || r.body; };
const homeCard = async page => page.evaluate(() => { const h = [...document.querySelectorAll('.gcard h2')].find(e => /Today's reading/.test(e.textContent)); return h ? h.closest('.gcard').innerText.replace(/\s+/g, ' ').trim() : '(no Today\'s reading card)'; });

const out = { profiles: {} };
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
try {
  const ev0 = await job(L, 'evening'), bh0 = await job(L, 'behind');
  out.eveningCheckedBefore = (ev0.checked || []).map(c => c.profile + ':' + c.readToday);
  out.behindCheckedBefore = (bh0.checked || []).map(c => c.profile + ':' + c.why);
  console.log('evening job checks BEFORE:', JSON.stringify(out.eveningCheckedBefore));
  for (const pid of ['guest-grandmajo', 'niece']) {
    const r = { rowsBefore: Object.keys(await rowsOf(L, pid)) };
    const d = await L.device({ device: 'ipad-portrait', profile: pid, installClock: DEMO });
    const writes = [];
    d.page.on('request', q => { if (/\/api\/data\//.test(q.url()) && q.method() !== 'GET') { let b = null; try { b = q.postDataJSON(); } catch {} writes.push({ method: q.method(), keys: b && Array.isArray(b.items) ? b.items.map(i => i.key) : (b && b.key) || q.url().split('/').pop() }); } });
    await d.goto('#home'); await sleep(3500);
    r.homeCardBefore = await homeCard(d.page);
    const f = await d.openApp('f260');
    await f.waitForFunction(() => { const t = document.getElementById('todayTitle'); return t && t.textContent.trim(); }, null, { timeout: 15000 });
    await sleep(4000);                                    // no tap at all
    r.writesByOpening = writes;
    r.rowsAfter = await rowsOf(L, pid);
    await d.goto('#home'); await sleep(3500);
    r.homeCardAfter = await homeCard(d.page);
    await d.page.screenshot({ path: path.join(EVID, `${PFX}-${pid}-home-after-ipad.png`), scale: 'css', animations: 'disabled' });
    await d.close();
    out.profiles[pid] = r;
    console.log(pid, '| before', JSON.stringify(r.rowsBefore), '| POSTed by opening', JSON.stringify(writes), '| after', JSON.stringify(Object.keys(r.rowsAfter)));
    console.log('   Home card before:', r.homeCardBefore.slice(0, 160));
    console.log('   Home card after :', r.homeCardAfter.slice(0, 160));
  }
  const ev1 = await job(L, 'evening'), bh1 = await job(L, 'behind');
  out.eveningCheckedAfter = (ev1.checked || []).map(c => c.profile + ':' + c.readToday);
  out.eveningSkippedAfter = ev1.skipped; out.eveningNotifiedAfter = ev1.notified;
  out.behindCheckedAfter = (bh1.checked || []).map(c => c.profile + ':' + c.why);
  console.log('evening job checks AFTER :', JSON.stringify(out.eveningCheckedAfter));
  console.log('behind job checks AFTER  :', JSON.stringify(out.behindCheckedAfter));
  out.note = 'push delivery needs a push subscription on that profile; none in the demo seed, so notified[] stays empty';
} finally { await L.close(); }
fs.writeFileSync(path.join(EVID, PFX + '.json'), JSON.stringify(out, null, 1));
console.log('evidence -> audits/evidence/p3/f260/' + PFX + '.json');
