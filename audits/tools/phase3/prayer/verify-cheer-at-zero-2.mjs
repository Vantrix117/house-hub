// Skeptic #2 for finding "cheer-at-zero": does the gold streak cheer (#cheer, milestone()) show when today's set is empty (0 of 0)?
// Demo clock (Tue 22 Sep 2026 08:40 New York), typical seed, WebKit. Fresh local instance.
// Run: node "audits/tools/phase3/prayer/verify-cheer-at-zero-2.mjs" -> audits/evidence/p3/prayer/verify-cheer-at-zero-2.json (+ PNG)
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p3/prayer';
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const res = {};
const log = (k, v) => { res[k] = v; console.log(k, '→', JSON.stringify(v)); };
const probe = f => f.evaluate(() => {
  const set = todaySet(); const done = set.filter(p => p.lastPrayedAt === TODAY).length;
  return { profile: hub.profile.id, list: D.activeList, plan: PL().name, mode: PL().mode, showStreak: PL().show.streak,
    set: set.length, done, left: set.length - done, streak: currentStreak(), prayedToday: L().prayerDays.includes(TODAY),
    headline: document.getElementById('todayLine').textContent, cheer: document.getElementById('cheer').textContent,
    cheerVisible: (() => { const c = document.getElementById('cheer'); const r = c.getBoundingClientRect(); return r.height > 0 && getComputedStyle(c).display !== 'none' && c.textContent.length > 0; })(),
    strip: document.getElementById('todayStrip').textContent.replace(/\s+/g, ' ').trim(),
    empty: (document.querySelector('#todayList .empty') || {}).textContent || null,
    activeRequests: L().prayers.filter(p => p.status === 'active').length };
});
try {
  // A: Mae (christian) — the finding's case
  {
    const d = await L.device({ device: 'iphone-pwa', profile: 'christian' });
    const f = await d.openApp('prayer', { wait: '#todayLine' });
    await f.waitForFunction(() => document.getElementById('todayLine').textContent.trim().length > 0, null, { timeout: 10000 }); await sleep(700);
    log('A-mae-unscheduled', await probe(f));
    await d.shot(`${OUT}/verify-cheer-at-zero-2-mae-iphone.png`);
    // B: same page, control — force a non-empty unfinished set by switching Mae's plan to one that picks everything (in-memory render only, no save)
    log('B-control-unfinished-same-streak', await f.evaluate(() => {
      const orig = todaySet; window.todaySet = () => L().prayers.filter(p => p.status === 'active').map(p => ({ ...p, lastPrayedAt: null }));
      try { renderToday(); return { headline: document.getElementById('todayLine').textContent, cheer: document.getElementById('cheer').textContent, streak: currentStreak() }; }
      finally { window.todaySet = orig; renderToday(); }
    }));
    await d.close();
  }
  // C: Eli — ordinary day, is the cheer shown mid-list? (context: cheer is meant for "done")
  {
    const d = await L.device({ device: 'iphone-pwa', profile: 'eli' });
    const f = await d.openApp('prayer', { wait: '#todayLine' });
    await f.waitForFunction(() => document.getElementById('todayLine').textContent.trim().length > 0, null, { timeout: 10000 }); await sleep(700);
    log('C-eli-typical', await probe(f));
    await d.close();
  }
} finally {
  fs.writeFileSync(`${OUT}/verify-cheer-at-zero-2.json`, JSON.stringify(res, null, 1));
  await L.close();
}
