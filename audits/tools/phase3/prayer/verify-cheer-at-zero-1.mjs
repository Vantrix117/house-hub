// Skeptic #1 for finding "cheer-at-zero" (Prayer): does the gold streak cheer (#cheer, apps/prayer.html:909) show when
// today's set is empty (0 of 0), under the headline "Nothing on the list today." (apps/prayer.html:885)?
// Fresh local instance, typical seed, demo clock (Tue 22 Sep 2026 08:40 NY), WebKit, Mae (christian) on iphone-pwa.
// Control: Eli (has items today) — the cheer should be empty while items are left.
// Run: node "audits/tools/phase3/prayer/verify-cheer-at-zero-1.mjs" -> audits/evidence/p3/prayer/verify-cheer-at-zero-1.json (+ PNG)
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p3/prayer';
fs.mkdirSync(OUT, { recursive: true });
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const res = {};
const probe = f => f.evaluate(() => {
  const set = todaySet(); const done = set.filter(p => p.lastPrayedAt === TODAY).length;
  return { activeList: D.activeList, plan: PL().name, planMode: PL().mode, showStreak: PL().show.streak,
    headline: document.getElementById('todayLine').textContent,
    cheer: document.getElementById('cheer').textContent,
    cheerVisible: (() => { const e = document.getElementById('cheer'); const r = e.getBoundingClientRect(); return r.height > 0 && getComputedStyle(e).display !== 'none' && e.textContent.length > 0; })(),
    strip: document.getElementById('todayStrip').textContent.replace(/\s+/g, ' ').trim(),
    empty: (document.querySelector('#todayList .empty') || {}).textContent || null,
    setLen: set.length, done, left: set.length - done,
    activePrayers: L().prayers.filter(p => p.status === 'active').length,
    prayedToday: L().prayerDays.includes(TODAY), streak: currentStreak(), milestone: milestone() };
});
try {
  for (const [who, profile] of [['mae', 'christian'], ['eli-control', 'eli']]) {
    const d = await L.device({ device: 'iphone-pwa', profile });
    const f = await d.openApp('prayer', { wait: '#todayLine' });
    await f.waitForFunction(() => document.getElementById('todayLine').textContent.trim().length > 0, null, { timeout: 10000 });
    await sleep(800);
    // make sure we look at the personal list ("Mine")
    await f.evaluate(() => { if (D.activeList !== 'personal') document.querySelector('#listSwitch [data-list="personal"]').click(); });
    await sleep(400);
    res[who] = await probe(f);
    console.log(who, '→', JSON.stringify(res[who]));
    if (who === 'mae') await d.shot(`${OUT}/verify-cheer-at-zero-1-mae-iphone.png`);
    await d.close();
  }
} finally { await L.close(); }
fs.writeFileSync(`${OUT}/verify-cheer-at-zero-1.json`, JSON.stringify(res, null, 2));
