// Skeptic #2 for critic-prayedby-keyed-by-name-8: family prayedBy marks are keyed by display name, so a guest who
// shares a household member's name is shown as (and merges with) that member.
// Fresh local instance (typical, demo clock, WebKit). Steps:
//   A  Elizabeth adds a guest "David" (distinct emoji/colour from Dad) through the same endpoint Me → Add a guest uses.
//   B  The guest ticks an unprayed family row. Server row, Elizabeth's faces on that row, the TV "who prayed" faces.
//   C  Dad ticks a second family row; then the guest taps the same row (a mis-tap / "I prayed too"). Server row after.
//   D  Control: Eli taps a row Dad prayed — does Dad's name survive? (separates the name collision from the shared
//      lastPrayedAt toggle, which is a separate finding).
// Run: node "audits/tools/phase3/prayer/verify-critic-prayedby-keyed-by-name-8-2.mjs"
//   -> audits/evidence/p3/prayer/verify-critic-prayedby-keyed-by-name-8-2.json (+ -mom.png, -tv.png)
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p3/prayer';
const PFX = `${OUT}/verify-critic-prayedby-keyed-by-name-8-2`;
const res = {}; const log = (k, v) => { res[k] = v; console.log(k, '->', JSON.stringify(v).slice(0, 600)); };

async function openPrayer(d) {
  const f = await d.openApp('prayer', { wait: '#todayLine' });
  await f.waitForFunction(() => document.getElementById('todayLine').textContent.trim().length > 0, null, { timeout: 12000 });
  await sleep(800);
  await f.click('#listSwitch [data-list="shared"]'); await sleep(600);
  return f;
}
const serverRow = async id => {
  const srv = await L.apiAs('mom', '/api/data/prayer?scope=family');
  const r = (srv.body.items || []).find(i => i.key === 'prayer:' + id);
  return r && { prayedBy: r.value.prayedBy, lastPrayedAt: r.value.lastPrayedAt };
};

const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
try {
  // A
  const g = await L.apiAs('mom', '/api/profiles', { method: 'POST', body: { name: 'David', emoji: '\u{1F3B8}', color: '#1F6FB2' } });
  const gid = g.body && g.body.profile && g.body.profile.id;
  log('A_guestCreated', { status: g.status, id: gid, name: g.body && g.body.profile && g.body.profile.name, emoji: g.body && g.body.profile && g.body.profile.emoji });
  const profs = await L.apiAs('mom', '/api/profiles');
  log('A_profilesNamedDavid', (profs.body.profiles || []).filter(p => p.name === 'David').map(p => ({ id: p.id, emoji: p.emoji, color: p.color })));
  await L.sessions();

  // B
  const gdev = await L.newDevice({ name: 'Guest David phone', profiles: [gid] });
  const gd = await L.device({ device: 'iphone-pwa', profile: gid, as: gdev });
  let gf = await openPrayer(gd);
  const rows = await gf.evaluate(() => { const ids = [...document.querySelectorAll('#todayList [data-pray]')].map(b => b.dataset.pray);
    return D.lists.shared.prayers.filter(x => ids.includes(x.id) && !((x.prayedBy || {})[TODAY] || []).length && x.lastPrayedAt !== TODAY).map(p => ({ id: p.id, title: p.title })); });
  log('B_unprayedRows', rows);
  const [r1, r2, r3] = rows;
  await gf.click(`#todayList [data-pray="${r1.id}"]`); await sleep(3000);
  log('B_serverAfterGuestTick', { row: r1, ...(await serverRow(r1.id)) });

  const mdev = await L.newDevice({ name: 'Mom phone', profiles: ['mom'] });
  const md = await L.device({ device: 'iphone-pwa', profile: 'mom', as: mdev });
  const mf = await openPrayer(md);
  log('B_momSeesFace', await mf.evaluate(id => { const b = document.querySelector(`#todayList [data-pray="${id}"]`); const w = b && b.closest('li').querySelector('.who');
    return w ? { label: w.getAttribute('aria-label'), faceHtml: w.innerHTML.slice(0, 240) } : null; }, r1.id));
  await md.shot(`${PFX}-mom.png`);
  await md.close();

  const tv = await L.device({ device: 'tv', profile: 'tv' }); await tv.goto(''); await sleep(4500);
  log('B_tvPrayedFaces', await tv.page.evaluate(() => { const out = []; document.querySelectorAll('*').forEach(e => { if (e.children.length === 0 && /Prayed today/i.test(e.textContent)) out.push(e.parentElement.innerHTML.slice(0, 500)); }); return out.slice(0, 2); }));
  await tv.shot(`${PFX}-tv.png`);
  await tv.close();

  // C: Dad ticks r2, then the guest taps r2
  const ddev = await L.newDevice({ name: 'Dad phone', profiles: ['dad'] });
  const dd = await L.device({ device: 'iphone-pwa', profile: 'dad', as: ddev });
  const df = await openPrayer(dd);
  await df.click(`#todayList [data-pray="${r2.id}"]`); await sleep(3000);
  log('C_serverAfterDadTick', { row: r2, ...(await serverRow(r2.id)) });
  await dd.close();
  await gd.close();
  const gd2 = await L.device({ device: 'iphone-pwa', profile: gid, as: gdev });
  gf = await openPrayer(gd2); await sleep(1500);
  log('C_guestSeesRow', await gf.evaluate(id => { const p = D.lists.shared.prayers.find(x => x.id === id); return { lastPrayedAt: p.lastPrayedAt, prayedBy: p.prayedBy[TODAY] }; }, r2.id));
  await gf.click(`#todayList [data-pray="${r2.id}"]`); await sleep(3000);
  log('C_serverAfterGuestTapsSameRow', { row: r2, ...(await serverRow(r2.id)) });
  await gd2.close();

  // D control: Dad ticks r3, Eli taps r3
  const dd2 = await L.device({ device: 'iphone-pwa', profile: 'dad', as: ddev });
  const df2 = await openPrayer(dd2);
  await df2.click(`#todayList [data-pray="${r3.id}"]`); await sleep(3000);
  log('D_serverAfterDadTick', { row: r3, ...(await serverRow(r3.id)) });
  await dd2.close();
  const edev = await L.newDevice({ name: 'Eli phone', profiles: ['eli'] });
  const ed = await L.device({ device: 'iphone-pwa', profile: 'eli', as: edev });
  const ef = await openPrayer(ed); await sleep(1500);
  await ef.click(`#todayList [data-pray="${r3.id}"]`); await sleep(3000);
  log('D_serverAfterEliTapsSameRow', { row: r3, ...(await serverRow(r3.id)) });
  await ed.close();
} catch (e) { log('error', String(e.stack || e)); }
finally { fs.writeFileSync(`${PFX}.json`, JSON.stringify(res, null, 2)); await L.close(); }
