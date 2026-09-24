// Skeptic 1 for "critic-prayedby-keyed-by-name-8": family prayed marks are keyed by display name (apps/prayer.html:729,
// 1557-1566, 1593-1603; index.html:1057-1061; worker/src/chat.js:246; apps/kidverse.html:427-433, 474).
// Fresh local instance (typical seed, demo clock, WebKit). Two parts:
//  A  A guest "David" with his OWN emoji/colour (not Dad's, so the face shown is unambiguous) ticks an unprayed family row.
//     -> server prayedBy, Elizabeth's faces (which emoji/tint), the TV board's "who prayed today" faces.
//  B  A guest named like a kid ("Ezra") ticks another unprayed family row.
//     -> kid Ezra's own Prayer card state (mePrayed), and whether Kid Verse credits Ezra a "prayed" star for today.
// Run: node "audits/tools/phase3/prayer/verify-critic-prayedby-keyed-by-name-8-1.mjs"
//   -> audits/evidence/p3/prayer/verify-critic-prayedby-keyed-by-name-8-1.json (+ -mom.png, -tv.png, -ezra.png)
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p3/prayer';
const P = `${OUT}/verify-critic-prayedby-keyed-by-name-8-1`;
const res = {};
const log = (k, v) => { res[k] = v; console.log(k, '->', JSON.stringify(v).slice(0, 600)); };
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });

async function prayerAs(profile, device = 'iphone-pwa', extra = {}) {
  const d = await L.device({ device, profile, ...extra });
  const f = await d.openApp('prayer', { wait: '#todayLine' });
  await f.waitForFunction(() => document.getElementById('todayLine').textContent.trim().length > 0, null, { timeout: 12000 });
  await sleep(800);
  return { d, f };
}
async function guestTicks(name, emoji, color, exclude = []) {
  const g = await L.apiAs('mom', '/api/profiles', { method: 'POST', body: { name, emoji, color } });
  const gid = g.body && g.body.profile && g.body.profile.id;
  await L.sessions();
  const dev = await L.newDevice({ name: `Guest ${name} phone`, profiles: [gid] });
  const { d, f } = await prayerAs(gid, 'iphone-pwa', { as: dev });
  await f.click('#listSwitch [data-list="shared"]'); await sleep(600);
  const target = await f.evaluate(ex => {
    const ids = [...document.querySelectorAll('#todayList [data-pray]')].map(b => b.dataset.pray);
    const p = D.lists.shared.prayers.find(x => ids.includes(x.id) && !ex.includes(x.id) && x.lastPrayedAt !== TODAY && !((x.prayedBy || {})[TODAY] || []).length);
    return p && { id: p.id, title: p.title, today: TODAY };
  }, exclude);
  await f.click(`#todayList [data-pray="${target.id}"]`); await sleep(3500);
  const who = await f.evaluate(() => hub.profile && { id: hub.profile.id, name: hub.profile.name });
  await d.close();
  const srv = await L.apiAs('mom', '/api/data/prayer?scope=family');
  const row = (srv.body.items || []).find(i => i.key === 'prayer:' + target.id);
  return { created: { status: g.status, id: gid, name, emoji, color }, signedInAs: who, target, serverPrayedBy: row && row.value.prayedBy, serverLastPrayedAt: row && row.value.lastPrayedAt };
}

try {
  const profs = await L.apiAs('mom', '/api/profiles');
  const list = (profs.body.profiles || profs.body || []);
  log('householdDavid', list.filter(p => p.name === 'David').map(p => ({ id: p.id, emoji: p.emoji, color: p.color })));

  // ── A: guest "David" ────────────────────────────────────────────────
  const A = await guestTicks('David', '\u{1F9E2}', '#7A3E9D');
  log('A_guestTick', A);
  const { d: md, f: mf } = await prayerAs('mom');
  await mf.click('#listSwitch [data-list="shared"]'); await sleep(700);
  log('A_momSeesFaces', await mf.evaluate(id => {
    const b = document.querySelector(`#todayList [data-pray="${id}"]`); const w = b && b.closest('li').querySelector('.who');
    return w ? { label: w.getAttribute('aria-label'), html: w.innerHTML.slice(0, 300) } : null;
  }, A.target.id));
  await md.shot(`${P}-mom.png`); await md.close();
  const tv = await L.device({ device: 'tv', profile: 'tv' }); await tv.goto(''); await sleep(4500);
  log('A_tvPrayedFaces', await tv.page.evaluate(() => {
    const out = []; for (const el of document.querySelectorAll('[class*="avatar"], .face')) { const t = el.getAttribute('title') || el.getAttribute('aria-label') || ''; if (/David/.test(t) || /\u{1F9E2}|\u{1F3A3}/u.test(el.textContent)) out.push({ title: t, text: el.textContent.trim(), style: el.getAttribute('style') }); } return out.slice(0, 10);
  }));
  await tv.shot(`${P}-tv.png`); await tv.close();

  // ── B: guest named like a kid ───────────────────────────────────────
  const starsBefore = await L.apiAs('ezra', '/api/data/kidverse?scope=person');
  const sb = ((starsBefore.body.items || []).find(i => i.key === 'stars') || {}).value || null;
  log('B_ezraStarsBefore', sb && { total: sb.total, earned: sb.earned, count: sb.count, creditedPrayed: sb.credited && sb.credited.prayed });
  const famBefore = await L.apiAs('mom', '/api/data/prayer?scope=family');
  const ezraAlready = (famBefore.body.items || []).filter(i => i.key.startsWith('prayer:') && i.value && i.value.prayedBy && Object.values(i.value.prayedBy).some(a => Array.isArray(a) && a.includes('Ezra'))).map(i => ({ key: i.key, prayedBy: i.value.prayedBy }));
  log('B_ezraNameAlreadyInPrayedBy', ezraAlready);
  const B = await guestTicks('Ezra', '\u{1F3A9}', '#1F6FB2', [A.target.id]);
  log('B_guestTick', B);
  // kid Ezra opens Prayer: is the guest's row shown as his own?
  const { d: ed, f: ef } = await prayerAs('ezra', 'ipad-portrait');
  log('B_ezraPrayer', await ef.evaluate(id => {
    const b = document.querySelector(`[data-kpray="${id}"]`);
    return { todayLine: document.getElementById('todayLine').textContent.trim(), card: b && { pressed: b.getAttribute('aria-pressed'), label: b.getAttribute('aria-label'), liDone: b.closest('li').classList.contains('done') } };
  }, B.target.id));
  await ed.shot(`${P}-ezra.png`);
  // kid Ezra opens Kid Verse: does it credit a "prayed" star for today?
  await ed.openApp('kidverse'); await sleep(6000);
  await ed.close();
  const starsAfter = await L.apiAs('ezra', '/api/data/kidverse?scope=person');
  const sa = ((starsAfter.body.items || []).find(i => i.key === 'stars') || {}).value || null;
  log('B_ezraStarsAfter', sa && { total: sa.total, earned: sa.earned, count: sa.count, creditedPrayed: sa.credited && sa.credited.prayed, earnedAtPrayed: sa.earnedAt && Object.keys(sa.earnedAt).filter(k => k.startsWith('prayed')) });
} catch (e) { log('error', String(e.stack || e)); }
finally { fs.writeFileSync(`${P}.json`, JSON.stringify(res, null, 2)); await L.close(); }
