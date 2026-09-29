// Batch 0g check: what the Phase 2/3 scripts cannot see now that prayedBy holds profile ids and the house merges who prayed.
//   A  two adults, one stale copy: Mom ticks a family request; Dad's device (not pulled since) ticks it seconds later.
//      Then Dad goes offline and ticks another; Mom ticks it online; Dad reconnects. Both ticks must stay on both rows.
//   B  a missed midnight: Eli's page still thinks it is yesterday (TODAY held back, as when the midnight timer never ran);
//      his tap must land on today and leave yesterday's mark alone.
//   C  a guest named "Kiara" and an old name tick: a row whose yesterday lists the NAME "Kiara" (a pre-0g device); real
//      Kiara ticks today. The house must not turn the name into Kiara's id, and must add her id today.
//   D  Kid Verse credits a prayed day by id: Kiara taps Prayed on the family list, then opens Kid Verse -> star:prayed:<today>.
//   E  the TV: a row listing both "Eli" (old name) and "eli" shows one Eli face; an unknown id reads "Someone".
//   F  "Put back on the list" then Undo: the answer, its date and the updates are exactly as before.
//   H  Eli's own phone, not yet pulled, edits a request he just ticked on the iPad: the tick stays; his untick then removes it.
//   G  Import: Eli's backup brings back his deleted family request, leaves Mae's deleted request deleted, and a reused old
//      id (same id, another start date) comes back under a new id without replacing the request that has the id now.
// Run from the repo root: node audits/tools/phase6/0g/prayer-merge-check.mjs -> audits/evidence/p6/0g/prayer-merge-check.json
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p6/0g';
fs.mkdirSync(OUT, { recursive: true });
const res = {}; const log = (k, v) => { res[k] = v; console.log(k, '->', JSON.stringify(v).slice(0, 500)); };
const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
const nyDay = (off = 0) => new Date(Date.now() + off * 864e5).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
const TODAY = nyDay(0), YESTERDAY = nyDay(-1);
const row = (id, title, extra = {}) => ({ id, title, for: '', phone: '', detail: '', category: 'Family', cadence: 'daily', days: [], status: 'active',
  createdAt: YESTERDAY, lastPrayedAt: null, answeredAt: null, answerNote: null, updates: [], sharedFrom: null, prayedBy: {}, by: 'eli', updatedAt: new Date().toISOString(), ...extra });
const put = (as, id, value, scope = 'family') => L.apiAs(as, `/api/data/prayer/prayer:${id}?scope=${scope}`, { method: 'PUT', body: { value, updated_at: Date.now() } });
const get = async (id, as = 'eli', scope = 'family') => { const r = await L.apiAs(as, `/api/data/prayer?scope=${scope}&key=prayer:${id}`); return r.body && r.body.item ? r.body.item.value : null; };
async function prayerAs(profile, device = 'iphone-pwa', extra = {}) {
  const d = await L.device({ device, profile, fixedTime: false, ...extra });
  const f = await d.openApp('prayer', { wait: '#todayLine' });
  await f.waitForFunction(() => typeof D !== 'undefined' && D && document.getElementById('todayLine').textContent.trim().length > 0, null, { timeout: 15000 });
  await sleep(1200);
  return { d, f };
}
const toShared = async f => { await f.evaluate(() => { if (D.activeList !== 'shared') { D.activeList = 'shared'; renderAllScreens(); } }); await sleep(300); };
const tap = (f, id) => f.evaluate(id => { const b = document.querySelector(`#todayList [data-pray="${id}"]`); if (!b) return false; b.click(); return true; }, id);
const flushed = f => f.evaluate(() => hub.flush ? hub.flush() : null).catch(() => null);
const pass = {};
try {
  // ── A ──
  await put('eli', 'g0ga', row('g0ga', 'Check A: the roof'));
  await put('eli', 'g0gb', row('g0gb', 'Check A: the car'));
  const mom = await prayerAs('mom', 'iphone-pwa'), dadDev = await L.newDevice({ name: 'Dad iPad', profiles: ['dad'] });
  const dad = await prayerAs('dad', 'ipad-portrait', { as: dadDev });
  await toShared(mom.f); await toShared(dad.f);
  log('A.momTap', await tap(mom.f, 'g0ga')); await flushed(mom.f); await sleep(800);
  log('A.dadTapStale', await tap(dad.f, 'g0ga')); await flushed(dad.f); await sleep(800);
  const a1 = await get('g0ga'); log('A.rowAfterBoth', a1.prayedBy);
  await dad.d.setOffline(true);
  await tap(dad.f, 'g0gb'); await sleep(500);
  await tap(mom.f, 'g0gb'); await flushed(mom.f); await sleep(800);
  await dad.d.setOffline(false); await sleep(2500); await flushed(dad.f); await sleep(800);
  const a2 = await get('g0gb'); log('A.rowAfterOffline', a2.prayedBy);
  await dad.f.evaluate(() => hub.pull()); await sleep(1500);
  log('A.dadSeesMomFace', await dad.f.evaluate(() => { const b = document.querySelector('#todayList [data-pray="g0ga"]'); const w = b && b.closest('li').querySelector('.who'); return w ? w.getAttribute('aria-label') : null; }));
  const both = pb => Array.isArray(pb[TODAY]) && pb[TODAY].includes('mom') && pb[TODAY].includes('dad');
  pass.A = both(a1.prayedBy) && both(a2.prayedBy);
  await mom.d.close(); await dad.d.close();

  // ── B ──
  await put('eli', 'g0gc', row('g0gc', 'Check B: the night shift', { prayedBy: { [YESTERDAY]: ['eli'] }, lastPrayedAt: YESTERDAY }));
  const eli = await prayerAs('eli', 'ipad-portrait');
  await toShared(eli.f);
  await eli.f.evaluate(y => { TODAY = y; renderAllScreens(); }, YESTERDAY);    // the midnight timer has not run
  log('B.shownDoneBeforeTap', await eli.f.evaluate(() => document.querySelector('#todayList [data-pray="g0gc"]').getAttribute('aria-pressed')));
  await tap(eli.f, 'g0gc'); await flushed(eli.f); await sleep(800);
  const b = await get('g0gc'); log('B.row', { prayedBy: b.prayedBy, lastPrayedAt: b.lastPrayedAt, pageToday: await eli.f.evaluate(() => TODAY) });
  pass.B = (b.prayedBy[TODAY] || []).includes('eli') && (b.prayedBy[YESTERDAY] || []).includes('eli') && b.lastPrayedAt === TODAY;

  // ── H ── Eli's own stale phone edits a request he ticked on the iPad: the tick stays; then a real untick takes it away
  await put('eli', 'g0gh', row('g0gh', 'Check H: the long drive'));
  const ph = await L.newDevice({ name: 'Eli phone', profiles: ['eli'] });
  const phone = await prayerAs('eli', 'iphone-pwa', { as: ph }); await toShared(phone.f);
  await eli.f.evaluate(() => hub.pull()); await sleep(1500);
  await tap(eli.f, 'g0gh'); await flushed(eli.f); await sleep(800);
  await phone.f.evaluate(() => { const p = D.lists.shared.prayers.find(x => x.id === 'g0gh'); p.updates.push({date:TODAY, note:'Leaving at six.'}); stamp(p); save(); }); await flushed(phone.f); await sleep(800);
  const h1 = await get('g0gh');
  await eli.f.evaluate(() => hub.pull()); await sleep(1500);
  await tap(eli.f, 'g0gh'); await flushed(eli.f); await sleep(800);
  const h2 = await get('g0gh');
  log('H', { afterStaleEdit: { prayedBy: h1.prayedBy, updates: h1.updates.length, unprayed: h1.unprayed }, afterUntick: { prayedBy: h2.prayedBy, unprayed: h2.unprayed } });
  pass.H = (h1.prayedBy[TODAY] || []).includes('eli') && h1.updates.length === 1 && !(h2.prayedBy[TODAY] || []).includes('eli') && h1.unprayed === undefined && h2.unprayed === undefined;
  await phone.d.close();
  // ── F ── (Eli's page is open)
  await put('eli', 'g0gf', row('g0gf', 'Check F: a job for Luke', { status: 'answered', answeredAt: YESTERDAY, answerNote: 'He starts in October.', updates: [{ date: YESTERDAY, note: 'Second interview.' }] }));
  await eli.f.evaluate(() => hub.pull()); await sleep(1500);
  const before = await get('g0gf');
  await eli.f.evaluate(() => sheetFor('g0gf')); await sleep(400);
  await eli.f.click('[data-reopen="g0gf"]'); await sleep(500); await flushed(eli.f); await sleep(600);
  const reopened = await get('g0gf');
  await eli.f.click('#toastAct'); await sleep(500); await flushed(eli.f); await sleep(800);
  const undone = await get('g0gf');
  log('F', { reopened: { status: reopened.status, updates: reopened.updates }, undone: { status: undone.status, answeredAt: undone.answeredAt, answerNote: undone.answerNote, updates: undone.updates } });
  pass.F = reopened.status === 'active' && reopened.updates.some(u => /He starts in October/.test(u.note))
    && undone.status === 'answered' && undone.answeredAt === before.answeredAt && undone.answerNote === before.answerNote && JSON.stringify(undone.updates) === JSON.stringify(before.updates);

  // ── G ── (Eli's page is open)
  await put('eli', 'g0gg1', row('g0gg1', 'Check G: Eli asks for rain'));
  await put('christian', 'g0gg2', row('g0gg2', 'Check G: Mae asks for patience', { by: 'christian' }));
  await put('eli', 's901', row('s901', 'Check G: the old request under s901', { createdAt: '2026-01-05' }));
  await eli.f.evaluate(() => hub.pull()); await sleep(1500);
  const backup = await eli.f.evaluate(() => JSON.stringify(D));
  await L.apiAs('eli', '/api/data/prayer/prayer:g0gg1?scope=family', { method: 'DELETE' });
  await L.apiAs('christian', '/api/data/prayer/prayer:g0gg2?scope=family', { method: 'DELETE' });
  await put('eli', 's901', row('s901', 'Check G: a newer request that reused s901', { createdAt: TODAY }));
  await eli.f.evaluate(() => hub.pull()); await sleep(1500);
  await eli.f.evaluate(() => go('more')); await sleep(400);
  await eli.f.click('#f-import'); await sleep(300);
  await eli.f.fill('#askIn', backup); await eli.f.click('#askSave'); await sleep(1500); await flushed(eli.f); await sleep(1200);
  log('G.local', await eli.f.evaluate(() => ({ g1: D.lists.shared.prayers.some(p => p.id === 'g0gg1'), hubRow: hub.get('prayer:g0gg1', {scope:'family'}) ? 'value' : 'none', sync: hub.sync.state, queue: Object.keys(localStorage).filter(k => k.startsWith('hub.queue.')).map(k => [k, Object.keys(JSON.parse(localStorage.getItem(k) || '{}'))]) })));
  log('G.logs', eli.d.logs.filter(l => /error|reject|could not/i.test(l)).slice(0, 8));
  const fam = ((await L.apiAs('eli', '/api/data/prayer?scope=family')).body.items || []).filter(r => r.value && /^Check G/.test(r.value.title)).map(r => ({ key: r.key, title: r.value.title, createdAt: r.value.createdAt }));
  log('G.toast', await eli.f.evaluate(() => document.getElementById('toast').textContent));
  log('G.family', fam);
  pass.G = fam.some(r => r.key === 'prayer:g0gg1') && !fam.some(r => r.key === 'prayer:g0gg2')
    && fam.some(r => r.key === 'prayer:s901' && /newer request/.test(r.title)) && fam.some(r => r.key !== 'prayer:s901' && /old request under s901/.test(r.title));
  await eli.d.close();

  // ── C ── a guest named Kiara exists; the row's yesterday holds the old name "Kiara"
  const g = await L.apiAs('mom', '/api/profiles', { method: 'POST', body: { name: 'Kiara', emoji: '\u{1F338}', color: '#3A6E8F' } });
  log('C.guest', g.body && g.body.profile && g.body.profile.id);
  await L.sessions();
  await put('eli', 'g0gk', row('g0gk', 'Check C: the play', { prayedBy: { [YESTERDAY]: ['Kiara'] }, lastPrayedAt: YESTERDAY }));
  const kid = await prayerAs('kiara', 'ipad-portrait');
  log('C.cardShowsDoneFromGuestName', await kid.f.evaluate(() => { const b = document.querySelector('[data-kpray="g0gk"]'); return b && b.getAttribute('aria-pressed'); }));
  await kid.f.evaluate(() => document.querySelector('[data-kpray="g0gk"]').click()); await sleep(600); await flushed(kid.f); await sleep(800);
  const c = await get('g0gk'); log('C.row', c.prayedBy);
  pass.C = (c.prayedBy[YESTERDAY] || []).join() === 'Kiara' && (c.prayedBy[TODAY] || []).includes('kiara');

  // ── D ── Kid Verse credits today's prayed day by id
  const kv = await kid.d.openApp('kidverse', { wait: '#done' }); await sleep(5000);
  const rows = ((await L.apiAs('kiara', '/api/data/kidverse?scope=person')).body.items || []).map(r => r.key);
  log('D.kiaraStarRows', rows.filter(k => k.startsWith('star:prayed:')));
  pass.D = rows.includes('star:prayed:' + TODAY);
  await kid.d.close();

  // ── E ── the TV
  await put('eli', 'g0ge', row('g0ge', 'Check E: faces', { prayedBy: { [TODAY]: ['Eli', 'eli', 'guest-Zq9XyW1kPq'] }, lastPrayedAt: TODAY }));
  const tv = await L.device({ device: 'tv', profile: 'tv' }); await tv.goto(''); await sleep(5000);
  const faces = await tv.page.evaluate(() => [...document.querySelectorAll('#tv-prayed .tv-face')].map(f => f.lastElementChild.textContent.trim()));
  log('E.tvFaces', faces);
  pass.E = faces.filter(n => n === 'Eli').length === 1 && faces.includes('Someone') && !faces.some(n => /guest-/.test(n));
  await tv.close();
} catch (e) { log('error', String(e && e.stack || e)); }
finally { await L.close(); }
res.pass = pass;
console.log('PASS', JSON.stringify(pass));
fs.writeFileSync(OUT + '/prayer-merge-check.json', JSON.stringify(res, null, 1));
