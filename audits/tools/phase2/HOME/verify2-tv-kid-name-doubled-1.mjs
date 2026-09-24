// Skeptic #1 for "tv-kid-name-doubled": does the TV feed print a kid's name twice for Kid Verse lines?
// Real flow on the local rig (empty variant, real clock, WebKit), no seeded feed lines:
//   1. Ezra (kid, iPad portrait) opens Kid Verse and taps "Done ★" (award) and "I heard it" (story) — the actual buttons.
//   2. What the server stored in /api/activity (raw text, name columns).
//   3. The Downstairs TV (kiosk, 1920x1080) opens Home → read #tv-feed lines (.who + .txt), screenshot.
//   4. Control: Eli's adult Home feed (header name + line) on iPad portrait, and an adult app line (Larder) for contrast.
// Run: node "audits/tools/phase2/HOME/verify2-tv-kid-name-doubled-1.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';

const OUT = path.resolve('audits/evidence/p2/HOME');
fs.mkdirSync(OUT, { recursive: true });
const L = await local({ variant: 'empty', clock: 'real', engine: 'webkit' });
const res = {};
try {
  // 1. Ezra earns the verse star and marks the story heard, by tapping the buttons
  const kid = await L.device({ device: 'ipad-portrait', profile: 'ezra', fixedTime: false });
  const f = await kid.openApp('kidverse', { wait: '#done:not([hidden])' });
  res.kidProfile = await f.evaluate(() => hub.profile && { id: hub.profile.id, name: hub.profile.name, kind: hub.profile.kind });
  await f.click('#done');
  await sleep(1500);
  const heard = await f.$('#story-heard:not([hidden])');
  if (heard) { await heard.scrollIntoViewIfNeeded(); await heard.click(); await sleep(1500); }
  res.storyButtonPresent = !!heard;
  // let hub.js flush its activity queue
  for (let i = 0; i < 20; i++) { const q = await f.evaluate(() => JSON.parse(localStorage.getItem('hub.activityQueue') || '[]').length); if (!q) break; await sleep(500); }
  console.log('kid profile:', JSON.stringify(res.kidProfile), 'story button:', res.storyButtonPresent);

  // 2. raw feed rows
  const act = await L.apiAs('eli', '/api/activity?limit=10');
  res.serverRows = (act.body.activity || []).map(a => ({ profile_id: a.profile_id, name: a.name, app_id: a.app_id, text: a.text }));
  console.log('server rows:', JSON.stringify(res.serverRows, null, 1));

  // 3. the TV board
  const tv = await L.device({ device: 'tv', profile: 'tv', fixedTime: false });
  await tv.goto('#home');
  await tv.page.waitForSelector('#tv-feed li .who', { timeout: 15000 });
  await sleep(1000);
  res.tvLines = await tv.page.$$eval('#tv-feed li', lis => lis.map(li => ({
    who: (li.querySelector('.who') || {}).textContent || null,
    txt: (li.querySelector('.txt') || {}).textContent || null,
    rendered: li.innerText.replace(/\s+/g, ' ').trim(),
  })));
  console.log('TV feed lines:', JSON.stringify(res.tvLines, null, 1));
  await tv.shot(path.join(OUT, 'verify2-tv-kid-name-doubled-1-tv.png'));
  const feedBox = await tv.page.$('.tv-feed');
  if (feedBox) await feedBox.screenshot({ path: path.join(OUT, 'verify2-tv-kid-name-doubled-1-tv-feed.png'), animations: 'disabled', caret: 'hide' });

  // 4. control: the adult Home feed on an iPad
  const eli = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  await eli.goto('#home');
  await eli.page.waitForSelector('#feed li .fwho', { timeout: 15000 });
  await sleep(800);
  res.homeGroups = await eli.page.$$eval('#feed li', lis => lis.filter(li => li.querySelector('.fwho')).map(li => ({
    who: li.querySelector('.fwho').textContent, lines: [...li.querySelectorAll('.ftxt')].map(x => x.textContent),
  })));
  console.log('adult Home feed:', JSON.stringify(res.homeGroups, null, 1));
  const hf = await eli.page.$('#feed');
  if (hf) { await hf.scrollIntoViewIfNeeded(); await hf.screenshot({ path: path.join(OUT, 'verify2-tv-kid-name-doubled-1-home-feed.png'), animations: 'disabled', caret: 'hide' }); }

  res.doubled = res.tvLines.filter(l => l.who && l.txt && l.txt.startsWith(l.who + ' ')).map(l => l.rendered);
  console.log('TV lines whose text repeats the .who name:', JSON.stringify(res.doubled));
  res.pageerrors = [...kid.logs, ...tv.logs, ...eli.logs].filter(l => l.startsWith('pageerror'));
  console.log('pageerrors:', JSON.stringify(res.pageerrors));
  fs.writeFileSync(path.join(OUT, 'verify2-tv-kid-name-doubled-1.json'), JSON.stringify(res, null, 2));
} finally {
  await L.close();
}
