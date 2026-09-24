// Skeptic #1 for finding "family-tick-shared" (Phase 3, Prayer). Independent reproduction.
// Claim: on the family list an adult row's tick is the shared lastPrayedAt (apps/prayer.html:841, 884), so rows others
// prayed show as done for someone who prayed nothing, and one tap (setPrayed, 1595-1596) clears it for the whole house
// while leaving the tapper's name out of prayedBy (1598-1602). Kid cards use per-person prayedBy (729), so they disagree.
// Different path from the investigator: Eli on the iPhone PWA (not the iPad), Elizabeth on the Kitchen iPad, and we also
// look at Ezra's kid view after Eli unticks s001 (prayed by Elizabeth and Ezra).
// Run: node "audits/tools/phase3/prayer/verify-family-tick-shared-1.mjs"
//   -> audits/evidence/p3/prayer/verify-family-tick-shared-1.json (+ -eli-before.png, -mom-after.png, -ezra-after.png)
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p3/prayer';
const P = 'verify-family-tick-shared-1';
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const res = {};
const view = f => f.evaluate(() => ({
  me: hub.profile && hub.profile.name, kid: !!hub.isKid,
  headline: document.getElementById('todayLine').textContent,
  strip: document.getElementById('todayStrip').textContent.replace(/\s+/g, ' '),
  rows: [...document.querySelectorAll('#todayList [data-pray], #todayList [data-kpray]')].map(b => {
    const id = b.dataset.pray || b.dataset.kpray; const p = D.lists.shared.prayers.find(q => q.id === id);
    return { id, title: p.title, ticked: b.getAttribute('aria-pressed') === 'true', lastPrayedAt: p.lastPrayedAt, prayedByToday: (p.prayedBy || {})[TODAY] || [] };
  }),
}));
const openFamily = async (d) => {
  const f = await d.openApp('prayer', { wait: '#todayLine' });
  await f.waitForFunction(() => document.getElementById('todayLine').textContent.trim().length > 0); await sleep(800);
  const sw = await f.$('#listSwitch [data-list="shared"]'); if (sw && await sw.isVisible()) { await sw.click(); await sleep(500); }
  return f;
};
const srv = async id => { const r = await L.apiAs('mom', '/api/data/prayer?scope=family'); const it = r.body.items.find(i => i.key === 'prayer:' + id);
  const v = it.value; return { lastPrayedAt: v.lastPrayedAt, prayedBy: v.prayedBy }; };
try {
  const ph = await L.newDevice({ name: 'Eli phone', profiles: ['eli'] });
  const E = await L.device({ device: 'iphone-pwa', profile: 'eli', as: ph });
  const fe = await openFamily(E);
  res.eliBefore = await view(fe);
  await fe.click('#startPray'); await sleep(300);
  res.eliPrayNowQueue = await fe.evaluate(() => prayList.map(p => p.id + ' ' + p.title)); await fe.click('#prayShut'); await sleep(300);
  await E.shot(`${OUT}/${P}-eli-before.png`);
  console.log('ELI BEFORE (prayed nothing):', res.eliBefore.headline, '|', res.eliBefore.strip);
  for (const r of res.eliBefore.rows) console.log('  ', r.id, r.ticked ? '[x]' : '[ ]', r.title, JSON.stringify(r.prayedByToday), r.lastPrayedAt);
  console.log('ELI PRAY NOW QUEUE:', res.eliPrayNowQueue);
  res.srvBefore = { s001: await srv('s001'), s002: await srv('s002') };
  // Eli taps s002 (Elizabeth only) and s001 (Elizabeth + Ezra) once each
  await fe.click('#todayList [data-pray="s002"]'); await sleep(600);
  await fe.click('#todayList [data-pray="s001"]'); await sleep(2000);
  res.eliAfterTap = await view(fe);
  res.srvAfterTap = { s001: await srv('s001'), s002: await srv('s002') };
  console.log('SERVER AFTER ONE TAP EACH:', JSON.stringify(res.srvAfterTap));
  console.log('ELI AFTER TAP:', res.eliAfterTap.headline, res.eliAfterTap.rows.filter(r => ['s001','s002'].includes(r.id)).map(r => r.id + ':' + r.ticked).join(' '));
  // Elizabeth on the Kitchen iPad
  const M = await L.device({ device: 'ipad-portrait', profile: 'mom' });
  const fm = await openFamily(M);
  res.momAfter = await view(fm);
  await M.shot(`${OUT}/${P}-mom-after.png`);
  console.log('ELIZABETH SEES:', res.momAfter.headline, '|', res.momAfter.strip, res.momAfter.rows.filter(r => ['s001','s002'].includes(r.id)).map(r => r.id + ':' + (r.ticked ? 'ticked' : 'unticked') + ' by ' + JSON.stringify(r.prayedByToday)).join(' '));
  // Ezra (kid) on another device
  const kz = await L.newDevice({ name: 'Ezra tablet', profiles: ['ezra'] });
  const Z = await L.device({ device: 'ipad-portrait', profile: 'ezra', as: kz });
  const fz = await openFamily(Z);
  res.ezraAfter = await view(fz);
  await Z.shot(`${OUT}/${P}-ezra-after.png`);
  console.log('EZRA (kid) SEES:', res.ezraAfter.headline, res.ezraAfter.rows.filter(r => ['s001','s002'].includes(r.id)).map(r => r.id + ':' + (r.ticked ? 'done' : 'not done')).join(' '));
  // Eli taps s002 a second time
  await fe.click('#todayList [data-pray="s002"]'); await sleep(2000);
  res.srvAfterTap2 = { s002: await srv('s002') };
  console.log('SERVER AFTER SECOND TAP s002:', JSON.stringify(res.srvAfterTap2));
} catch (e) { console.error(e); res.error = String(e.stack || e); }
finally { fs.writeFileSync(`${OUT}/${P}.json`, JSON.stringify(res, null, 1)); await L.close(); }
