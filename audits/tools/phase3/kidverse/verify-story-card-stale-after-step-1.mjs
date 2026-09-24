// Skeptic #1 for "story-card-stale-after-step": after an adult taps the week stepper, does the story card stay on the old week?
//   node "audits/tools/phase3/kidverse/verify-story-card-stale-after-step-1.mjs"     (about 1.5 min)
// Independent of adult-week.mjs / _kv.mjs. Steps (Eli, iphone-pwa, real clock, Kid Verse in the shell viewer):
//   1 before: verse ref, week pill, story title/span, both art scenes
//   2 tap + (#week-up) once; wait for the flush; snapshot again (+ screenshot of the story card)
//   3 wait 35 s (one full 30 s periodic pull) and snapshot again: does the pull ever repaint the story card?
//   4 tap "Read it to me" on the story (speech stubbed) and record what would be spoken
//   5 control: a *remote* write of the family week (API as Mae) -> after the next pull, does renderStory run?
//   6 reload: what the page shows fresh
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const EV = path.join(ROOT, 'audits', 'evidence', 'p3', 'kidverse');
fs.mkdirSync(EV, { recursive: true });
const out = {};
const L = await local({ variant: 'typical', clock: 'real' });
const snap = f => f.evaluate(() => {
  const t = s => { const e = document.querySelector(s); return e ? e.textContent.replace(/\s+/g, ' ').trim() : null; };
  return { ref: t('#ref'), who: t('#who'), weekNow: t('#week-now'), storyTitle: t('#story-title'), storySpan: t('#story-span'),
    verseScene: document.querySelector('#art').dataset.scene, storyScene: document.querySelector('#story-art').dataset.scene,
    storySayLabel: document.querySelector('#story-say').getAttribute('aria-label'),
    familyWeekRow: (window.hub.get('week', { scope: 'family' }) || null), sync: window.hub.sync.state };
});
const waitSynced = async f => { for (let i = 0; i < 40; i++) { const s = await f.evaluate(() => hub.sync.state); if (s === 'synced') return s; await sleep(250); } return 'not synced'; };
try {
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
  // speech stub in every frame: record what "Read it to me" would say
  await d.ctx.addInitScript(() => {
    try {
      class U { constructor(t) { this.text = t; } }
      Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: U, configurable: true, writable: true });
      Object.defineProperty(window, 'speechSynthesis', { value: { speak(u) { window.__spoken = u.text; setTimeout(() => u.onend && u.onend(), 10); }, cancel() {}, getVoices() { return []; } }, configurable: true });
    } catch (e) {}
  });
  const f = await d.openApp('kidverse', { wait: '#week-up' });
  await waitSynced(f); await sleep(1000);
  out.server0 = (await L.apiAs('eli', '/api/data/kidverse?scope=family')).body.items.find(i => i.key === 'week') || null;
  out.s1_before = await snap(f);
  await f.click('#week-up'); await sleep(800); await f.evaluate(() => hub.flush()); out.flushState = await waitSynced(f);
  out.s2_afterPlus = await snap(f);
  out.server2 = (await L.apiAs('eli', '/api/data/kidverse?scope=family')).body.items.find(i => i.key === 'week') || null;
  await f.evaluate(() => document.querySelector('#story').scrollIntoView({ block: 'start' }));
  await sleep(300);
  await d.page.screenshot({ path: path.join(EV, 'verify-story-card-stale-after-step-1-after-plus.png'), scale: 'css', animations: 'disabled', caret: 'hide' });
  await sleep(35000);
  out.s3_after35s = await snap(f);
  await f.click('#story-say'); await sleep(300);
  out.s4_spoken = await f.evaluate(() => window.__spoken || null);
  // control: remote change of the family week (as Mae, a different adult) -> pulled -> onChange -> renderStory?
  const w3 = (out.s2_afterPlus.familyWeekRow && out.s2_afterPlus.familyWeekRow.week) + 1;
  out.remotePut = (await L.apiAs('christian', '/api/data/kidverse/week?scope=family', { method: 'PUT', body: { value: { week: w3, by: 'christian', at: Date.now() }, updated_at: Date.now() + 5000 } })).status;
  await f.evaluate(() => { document.dispatchEvent(new Event('visibilitychange')); });
  await sleep(4000);
  let s5 = await snap(f);
  if (!s5.familyWeekRow || s5.familyWeekRow.week !== w3) { await sleep(31000); s5 = await snap(f); }
  out.s5_afterRemote = s5;
  await f.evaluate(() => location.reload()); await sleep(3000);
  const f2 = d.frame('kidverse'); await waitSynced(f2); await sleep(800);
  out.s6_afterReload = await snap(f2);
  out.logs = d.logs.filter(l => /error/i.test(l)).slice(0, 10);
  // restore week 38 for anyone rerunning on the same seeded instance (the instance is thrown away at close anyway)
  await d.close();
} catch (e) { out.error = String(e && e.stack || e); }
finally { await L.close(); }
out.verdictHints = {
  verseMoved: out.s1_before && out.s2_afterPlus && out.s1_before.ref !== out.s2_afterPlus.ref,
  storyStaleAfterPlus: out.s1_before && out.s2_afterPlus && out.s1_before.storySpan === out.s2_afterPlus.storySpan,
  storyStaleAfter35s: out.s1_before && out.s3_after35s && out.s1_before.storySpan === out.s3_after35s.storySpan,
  spokenIsNewWeek: out.s4_spoken && out.s2_afterPlus && !out.s4_spoken.includes(out.s2_afterPlus.storyTitle),
  remoteRepaintsStory: out.s5_afterRemote && out.s5_afterRemote.storySpan && out.s5_afterRemote.storySpan.startsWith('Week ' + (out.s5_afterRemote.familyWeekRow || {}).week),
};
fs.writeFileSync(path.join(EV, 'verify-story-card-stale-after-step-1.json'), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
