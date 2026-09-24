// Completeness critic, Verses: the empty state says a verse marked memorised in F260 "will show up here on its review day"
// (apps/verses.html:129), but a memorised verse with no recall row is due at once (apps/verses.html:218-219, 229).
// Mea (niece) has nothing memorised: read the empty state on one device, mark Genesis 1:27 (1-0) memorised in F260 with its
// real control (the round .mkm button, apps/f260.html:1648-1653) on a second device, then open Verses there.
// Run: node "audits/tools/phase3/verses/critic-empty-copy.mjs"
import fs from 'node:fs';
import { local, sleep, DEMO } from '../../lib/local.mjs';
import { openVerses, state } from './_lib.mjs';
const L = await local({ variant: 'typical', clock: 'demo' });
const out = {};
try {
  const d1 = await L.device({ device: 'iphone-pwa', profile: 'niece', installClock: DEMO });
  const f0 = await openVerses(d1);
  const s0 = await state(f0);
  out.before = { who: s0.who, empty: s0.empty, copy: await f0.evaluate(() => document.querySelector('#empty p').textContent) };
  await d1.close();

  const d2 = await L.device({ device: 'iphone-pwa', profile: 'niece', installClock: DEMO });
  const g = await d2.openApp('f260');
  await g.waitForSelector('[data-toggle]', { state: 'attached', timeout: 15000 }); await sleep(800);
  if (!(await g.locator('[data-mem="1-0"]').first().isVisible().catch(() => false))) {
    const plan = g.locator('[data-view="plan"], [data-go="plan"], #tabPlan').first();
    if (await plan.isVisible().catch(() => false)) { await plan.click(); await sleep(400); }
  }
  if (!(await g.locator('[data-mem="1-0"]').first().isVisible().catch(() => false))) { await g.click('[data-toggle="1"]'); await sleep(500); }
  await g.click('[data-mem="1-0"] .mkm'); await sleep(800);
  out.memAfter = await g.evaluate(() => JSON.stringify(window.hub.get('f260.mem')));
  await d2.close();

  const d3 = await L.device({ device: 'iphone-pwa', profile: 'niece', installClock: DEMO + 60000 });
  const f = await openVerses(d3);
  const s1 = await state(f);
  out.after = { today: s1.today, who: s1.who, trainer: s1.trainer, empty: s1.empty, ref: s1.ref, kick: s1.kick, stats: s1.stats, queue: s1.queue };
  await d3.page.screenshot({ path: 'audits/evidence/p3/verses/critic-empty-copy-after-iphone.png', scale: 'css' });
  console.log(JSON.stringify(out, null, 1));
  fs.writeFileSync('audits/evidence/p3/verses/critic-empty-copy.json', JSON.stringify(out, null, 1));
} finally { await L.close(); }
