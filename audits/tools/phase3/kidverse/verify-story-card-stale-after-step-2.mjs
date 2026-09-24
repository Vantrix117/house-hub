// Skeptic 2 for "story card stale after the week stepper".
//   node "audits/tools/phase3/kidverse/verify-story-card-stale-after-step-2.mjs"
// 1 Eli (iPad portrait, in the shell) taps + once. Verse card vs story card right after, and again after 35 s
//   (one 30 s pull cycle), then what "Read the story to me" would speak (the text its click handler builds).
// 2 Control: a second device (Mom, phone) steps the week back; Eli's open iPad pulls -> does the story card follow?
// 3 Reload: what the page shows fresh.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep } from '../../lib/local.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const EVID = path.resolve(HERE, '..', '..', '..', 'evidence', 'p3', 'kidverse');
fs.mkdirSync(EVID, { recursive: true });
const P = 'verify-story-card-stale-after-step-2';
const out = {};
const snap = f => f.evaluate(() => {
  const t = s => (document.querySelector(s) || {}).textContent || null;
  return { verseRef: t('#ref'), who: (t('#who') || '').trim(), weekNow: t('#week-now'), verseScene: document.querySelector('#art').dataset.scene,
    storyTitle: t('#story-title'), storySpan: t('#story-span'), storyScene: document.querySelector('#story-art').dataset.scene,
    storyLabel: document.querySelector('#story-say').getAttribute('aria-label'), familyWeek: (hub.get('week', { scope: 'family' }) || {}).week,
    lastPull: hub.sync.lastPull, sync: hub.sync.state };
});
const waitPull = async (f, after, ms = 40000) => { const u = Date.now() + ms; while (Date.now() < u) { const lp = await f.evaluate(() => hub.sync.lastPull || 0); if (lp > after) return lp; await sleep(250); } return null; };
const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
try {
  const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  await ipad.goto('#home');
  const f = await ipad.openApp('kidverse');
  await f.waitForSelector('#week-up', { timeout: 20000 });
  await waitPull(f, 0); await sleep(800);
  out.before = await snap(f);
  await f.click('#week-up'); await sleep(1500);
  out.afterPlus = await snap(f);
  await f.evaluate(() => document.querySelector('#story').scrollIntoView({ block: 'start' }));
  await ipad.page.screenshot({ path: path.join(EVID, P + '-after-plus-story.png'), scale: 'css' });
  const lp0 = out.afterPlus.lastPull || 0;
  out.nextPullAt = await waitPull(f, lp0); await sleep(500);
  out.afterOnePull = await snap(f);
  // WebKit on Windows has no speechSynthesis; the click handler (apps/kidverse.html:672) speaks STORIES[familyWeek() - 1] (:621), rebuilt here
  out.spoken = await f.evaluate(() => { const v = hub.get('week', { scope: 'family' }); const st = window.kidverse.STORIES[v.week - 1]; return "This week's story: " + st.t; });
  out.server = (await L.apiAs('eli', '/api/data/kidverse?scope=family&key=week')).body;
  // 2 control: another adult steps the week back from a second device
  const w = out.afterPlus.familyWeek;
  await L.apiAs('mom', '/api/data/kidverse/week?scope=family', { method: 'PUT', body: { value: { week: w - 1, by: 'mom', at: Date.now() }, updated_at: Date.now() + 5 } });
  const lp1 = await f.evaluate(() => hub.sync.lastPull || 0);
  await f.evaluate(() => hub.pull()); await waitPull(f, lp1, 10000); await sleep(600);
  out.afterRemoteStepBack = await snap(f);
  // 3 reload after a local + again
  await f.click('#week-up'); await sleep(1500);
  out.afterPlus2 = await snap(f);
  await ipad.page.reload(); await sleep(1500);
  const f2 = await ipad.openApp('kidverse'); await f2.waitForSelector('#week-up', { timeout: 20000 }); await waitPull(f2, 0); await sleep(800);
  out.afterReload = await snap(f2);
} finally { await L.close(); }
for (const k of ['before', 'afterPlus', 'afterOnePull', 'afterRemoteStepBack', 'afterPlus2', 'afterReload']) {
  const s = out[k]; console.log(k.padEnd(20), JSON.stringify({ familyWeek: s.familyWeek, verseRef: s.verseRef, weekNow: s.weekNow, verseScene: s.verseScene, storyTitle: s.storyTitle, storySpan: s.storySpan, storyScene: s.storyScene }));
}
console.log('next 30 s pull at', out.nextPullAt, 'spoken on "Read the story to me":', JSON.stringify(out.spoken && out.spoken.slice(0, 90)));
console.log('server week row', JSON.stringify(out.server && out.server.item && out.server.item.value));
fs.writeFileSync(path.join(EVID, P + '.json'), JSON.stringify(out, null, 1));
console.log('wrote', 'audits/evidence/p3/kidverse/' + P + '.json');
