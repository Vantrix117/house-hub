// Skeptic #1 for "critic-empty-state-copy-review-day-wrong-4": Verses' empty state says a verse marked memorised in F260
// "will show up here on its review day" (apps/verses.html:129). Does a newly memorised verse instead appear at once?
// Independent reproduction: typical seed, demo clock, WebKit, iPhone PWA, profile niece (Mea, nothing memorised).
// One device reads the empty state, goes back to Home and opens F260 in the same shell (Plan tab, week 1),
// taps Genesis 1:27 round "memorised" button; a fresh device for Mea one minute later (same day) opens Verses. Server rows printed.
// Run: node "audits/tools/phase3/verses/verify-critic-empty-state-copy-review-day-wrong-4-1.mjs"
import fs from 'node:fs';
import { local, sleep, DEMO } from '../../lib/local.mjs';
const PFX = 'audits/evidence/p3/verses/verify-critic-empty-state-copy-review-day-wrong-4-1';
const VIEW = '#trainer:not([hidden]), #done:not([hidden]), #empty:not([hidden])';
const read = f => f.evaluate(() => {
  const q = s => document.querySelector(s), vis = s => !!q(s) && !q(s).hidden;
  return { who: q('#who').textContent.replace(/\s+/g, ' ').trim(), trainer: vis('#trainer'), done: vis('#done'), empty: vis('#empty'),
    emptyCopy: q('#empty p').textContent, ref: vis('#trainer') ? q('#ref').textContent : null, kick: q('#kick').textContent,
    due: vis('#stats') ? q('#st-due').textContent : null,
    queue: vis('#queue') ? [...document.querySelectorAll('#queue-list li')].map(li => li.textContent.replace(/\s+/g, ' ').trim()) : null,
    later: vis('#queue') ? [...document.querySelectorAll('#later-list li')].map(li => li.textContent.replace(/\s+/g, ' ').trim()) : null };
});
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const out = {};
try {
  const d = await L.device({ device: 'iphone-pwa', profile: 'niece', installClock: DEMO });
  await d.goto('#home');
  let f = await d.openApp('verses'); await f.waitForSelector(VIEW, { timeout: 15000 }); await sleep(500);
  out.before = await read(f);
  await d.page.screenshot({ path: PFX + '-before-iphone.png', scale: 'css' });
  out.serverBefore = { mem: (await L.apiAs('niece', '/api/data/f260?scope=person')).body.items?.filter(i => /^f260\.(mem|recall)$/.test(i.key)).map(i => ({ key: i.key, value: i.value })) };

  await d.goto('#home');
  const g = await d.openApp('f260');
  await g.waitForSelector('[data-mem="1-0"] .mkm', { state: 'attached', timeout: 15000 }); await sleep(600);
  if (!(await g.locator('[data-mem="1-0"] .mkm').first().isVisible().catch(() => false)) && await g.locator('#tabPlan').isVisible().catch(() => false)) { await g.click('#tabPlan'); await sleep(600); }
  if (!(await g.locator('[data-mem="1-0"] .mkm').first().isVisible().catch(() => false))) { await g.click('[data-toggle="1"]'); await sleep(600); }
  out.memButtonVisible = await g.locator('[data-mem="1-0"] .mkm').first().isVisible();
  await g.click('[data-mem="1-0"] .mkm'); await sleep(1500);
  out.f260Local = await g.evaluate(() => ({ mem: window.hub.get('f260.mem'), recall: window.hub.get('f260.recall') }));
  await sleep(2500);
  const items = (await L.apiAs('niece', '/api/data/f260?scope=person')).body.items || [];
  out.serverAfter = items.filter(i => /^f260\.(mem|recall)$/.test(i.key)).map(i => ({ key: i.key, value: i.value }));

  await d.close();
  // same person, a fresh shell a minute later (same demo day) so the frame is unambiguously Verses
  const d2 = await L.device({ device: 'iphone-pwa', profile: 'niece', installClock: DEMO + 60000 });
  await d2.goto('#home');
  f = await d2.openApp('verses'); await f.waitForSelector(VIEW, { timeout: 15000 }); await sleep(700);
  out.after = await read(f);
  out.today = await f.evaluate(() => new Date().toString());
  await d2.page.screenshot({ path: PFX + '-after-iphone.png', scale: 'css' });
  out.verdictHint = out.before.empty && out.after.trainer && out.after.ref === 'Genesis 1:27' ? 'newly memorised verse is due the same day it is marked' : 'NOT reproduced';
  console.log(JSON.stringify(out, null, 1));
  fs.writeFileSync(PFX + '.json', JSON.stringify(out, null, 1));
} finally { await L.close(); }
