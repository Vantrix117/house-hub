// reviewer-7 probes (batch 7 Kid Verse), on the local rig. Writes nothing in the repo; prints findings.
import { local, sleep } from 'file:///C:/Users/ex_bo/OneDrive/Claude%20Related/App%20Hub/audits/tools/lib/local.mjs';
const out = {}; const log = (...a) => console.log(...a);
const pulled = async (f, ms = 15000) => { const u = Date.now() + ms; while (Date.now() < u) { if (await f.evaluate(() => !!(window.hub && hub.sync && hub.sync.lastPull && hub.isLoaded())).catch(() => false)) return true; await sleep(150); } return false; };
const flushed = async (f, ms = 15000) => { const u = Date.now() + ms; while (Date.now() < u) { if (await f.evaluate(() => window.hub && hub.sync.state === 'synced' && !Object.keys(localStorage).some(k => k.startsWith('hub.queue.') && Object.keys(JSON.parse(localStorage.getItem(k) || '{}')).length)).catch(() => false)) return true; await sleep(150); } return false; };
const which = process.argv[2] || 'ABCD';

// A: no family week: does an open Kid Verse write a star or the mirror?
if (which.includes('A')) {
  const L = await local({ variant: 'empty', clock: 'real', engine: 'chromium' });
  try {
    const d0 = await L.device({ device: 'iphone-pwa', profile: 'ezra', fixedTime: false }); await d0.goto(); await sleep(1500);
    const today = await d0.page.evaluate(() => hub.today()); await d0.close();
    const before = await L.apiAs('eli', '/api/data/kidverse?scope=family');
    log('A family kidverse rows before:', JSON.stringify((before.body.items || []).map(r => r.key)));
    const pr = { id: 'rv7', title: 'Grandma', by: 'eli', createdAt: Date.now(), prayedBy: { [today]: ['ezra'] } };
    const w = await L.apiAs('eli', '/api/data/prayer/' + encodeURIComponent('prayer:rv7') + '?scope=family', { method: 'PUT', body: { value: pr, updated_at: Date.now() } });
    log('A prayer row written', w.status, JSON.stringify(w.body).slice(0, 120));
    const d = await L.device({ device: 'iphone-pwa', profile: 'ezra', fixedTime: false });
    const f = await d.openApp('kidverse'); await pulled(f); await sleep(4000); await flushed(f);
    const uiA = await f.evaluate(() => ({ noWeekKid: !document.querySelector('#no-week-kid').hidden, done: !document.querySelector('#done').hidden, stars: !document.querySelector('#mine').hidden, mineText: document.querySelector('#mine').textContent.replace(/\s+/g, ' ').trim(), rewards: !document.querySelector('#rewards').hidden, rewardsText: document.querySelector('#rewards').textContent.replace(/\s+/g, ' ').trim().slice(0, 120) }));
    const person = await L.apiAs('ezra', '/api/data/kidverse?scope=person');
    const fam = await L.apiAs('eli', '/api/data/kidverse?scope=family');
    out.A = { ui: uiA, personRows: (person.body.items || []).map(r => r.key + '=' + JSON.stringify(r.value).slice(0, 80)), familyRows: (fam.body.items || []).map(r => r.key + '=' + JSON.stringify(r.value).slice(0, 100)) };
    log('A', JSON.stringify(out.A, null, 1));
    await d.close();
  } finally { await L.close(); }
}

// B: the Move offer on the real app: week set Sunday 4 pm, asked Friday 4:15 pm
if (which.includes('B')) {
  const L = await local({ variant: 'typical', clock: 'real', engine: 'chromium' });
  try {
    const d = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
    const f = await d.openApp('kidverse'); await pulled(f); await sleep(1500);
    const r = await f.evaluate(() => {
      const NYF = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' });
      const NYH = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', hourCycle: 'h23' });
      const ny = (day, h) => { const [y, m, dd] = day.split('-').map(Number); for (const off of [4, 5]) { const t = Date.UTC(y, m - 1, dd, h + off); if (NYF.format(new Date(t)) === day && Number(NYH.format(new Date(t))) === h) return t; } };
      const setAt = ny('2026-10-04', 16);
      hub.set('week', { week: 38, by: 'eli', at: setAt }, { scope: 'family' });
      const at = t => { const o = window.kidverse.moveOffer(t); return o ? `offer ${o.from}->${o.to}` : 'none'; };
      return { setAt: new Date(setAt).toISOString(), 'Sun Oct 4 4:30pm (same day)': at(setAt + 1800000), 'Fri Oct 9 4:15pm': at(ny('2026-10-09', 16) + 900000), 'Sat Oct 10 noon': at(ny('2026-10-10', 12)), 'Sun Oct 11 5:00pm': at(ny('2026-10-11', 17)) };
    });
    out.B = r; log('B', JSON.stringify(r, null, 1));
    await d.close();
  } finally { await L.close(); }
}

// C: the marker a reset spends meets a star another device stamped AFTER the reset
if (which.includes('C')) {
  const L = await local({ variant: 'typical', clock: 'real', engine: 'chromium' });
  try {
    const d = await L.device({ device: 'iphone-pwa', profile: 'ezra', fixedTime: false });
    const f = await d.openApp('kidverse'); await pulled(f); await sleep(2000); await flushed(f);
    const r = await f.evaluate(() => {
      const rw = window.kidverse.rewards, today = hub.today(), now = Date.now() + (hub.skew || 0);
      const before = rw.deriveStars(false);
      const key = 'ledger:ezra:' + now.toString(36) + '-rv7a';
      hub.set('star:prayed:' + today, { at: now + 60000 }, { scope: 'person' });
      hub.set('reset:prayed:' + today, { by: key, at: now }, { scope: 'person' });
      hub.set('applied:' + key, { kind: 'reset', date: today, by: 'eli', at: now }, { scope: 'person' });
      const after = rw.deriveStars(false);
      hub.set('star:story:' + today, { at: now + 60000 }, { scope: 'person' }); hub.set('reset:story:' + today, { by: key }, { scope: 'person' });
      const old = rw.deriveStars(false).credited.story[today];
      return { prayedBefore: before.credited.prayed[today] || null, prayedAfter: after.credited.prayed[today], totalBefore: before.total, totalAfter: after.total, earnedBefore: before.earned, earnedAfter: after.earned, oldMarkerStillTakes: old };
    });
    out.C = r; log('C', JSON.stringify(r));
    await d.close();
  } finally { await L.close(); }
}

// D: a week change from ANOTHER device while the kid's verse is being read
if (which.includes('D')) {
  const L = await local({ variant: 'typical', clock: 'real', engine: 'chromium' });
  try {
    const d = await L.device({ device: 'iphone-pwa', profile: 'ezra', fixedTime: false });
    const f = await d.openApp('kidverse'); await pulled(f); await sleep(1500);
    await f.evaluate(() => { window.__u = null; speechSynthesis.speak = u => { window.__u = u; }; speechSynthesis.cancel = () => { const u = window.__u; window.__u = null; if (u && u.onerror) u.onerror({ error: 'canceled' }); }; });
    const w0 = await f.evaluate(() => hub.get('week', { scope: 'family' }));
    await f.click('#say'); await sleep(300);
    const reading = await f.evaluate(() => ({ label: document.querySelector('#say span').textContent, words: document.querySelector('#words').textContent }));
    const next = (w0 && w0.week ? w0.week : 38) % 52 + 1;
    const put = await L.apiAs('eli', '/api/data/kidverse/week?scope=family', { method: 'PUT', body: { value: { week: next, by: 'eli', at: Date.now() }, updated_at: Date.now() } });
    await f.evaluate(() => hub.pull()); await sleep(1500);
    const mid = await f.evaluate(() => ({ ref: document.querySelector('#ref').textContent, words: document.querySelector('#words').textContent, label: document.querySelector('#say span').textContent }));
    await f.evaluate(() => { const u = window.__u; window.__u = null; if (u && u.onend) u.onend({}); }); await sleep(300);
    const after = await f.evaluate(n => ({ ref: document.querySelector('#ref').textContent, words: document.querySelector('#words').textContent, expected: window.kidverse.VERSES[n - 1].words }), next);
    out.D = { w0, next, putStatus: put.status, reading, mid, after, stale: after.words !== after.expected };
    log('D', JSON.stringify(out.D, null, 1));
    await d.close();
  } finally { await L.close(); }
}
process.exit(0);
