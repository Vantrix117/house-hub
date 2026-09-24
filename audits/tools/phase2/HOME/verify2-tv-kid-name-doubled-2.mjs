// Skeptic #2 for finding "tv-kid-name-doubled": does a Kid Verse feed line show the kid's name twice on the TV board
// (and on adult Home)? Fresh from the app itself: 'empty' variant (no seeded feed lines), real clock, Ezra taps the ★
// and "I heard it" in Kid Verse on his iPad, then the TV kiosk board and Eli's Home read the feed.
//   node "audits/tools/phase2/HOME/verify2-tv-kid-name-doubled-2.mjs"
// Evidence → audits/evidence/p2/HOME/verify2-tv-kid-name-doubled-2.json + -tv.png + -adult.png
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/HOME');
fs.mkdirSync(OUT, { recursive: true });
const res = {};

const L = await local({ variant: 'empty', clock: 'real', engine: 'webkit' });
try {
  res.feedBefore = (await L.apiAs('eli', '/api/activity?limit=10')).body;

  // 1. Ezra earns today's verse star and marks the story heard, through the real buttons
  const kid = await L.device({ device: 'ipad-portrait', profile: 'ezra', fixedTime: false });
  const f = await kid.openApp('kidverse', { wait: '#done' });
  await f.waitForFunction(() => window.hub && hub.profile && hub.profile.id === 'ezra', null, { timeout: 15000 });
  await sleep(800);
  await f.click('#done'); await sleep(600);
  const heardBtn = await f.$('#story-heard');
  if (heardBtn) { await heardBtn.scrollIntoViewIfNeeded().catch(() => {}); await heardBtn.click().catch(e => { res.heardErr = String(e.message).slice(0, 200); }); }
  await sleep(600);
  // let hub.js flush the activity queue
  const until = Date.now() + 15000;
  while (Date.now() < until) { const q = await f.evaluate(() => JSON.parse(localStorage.getItem('hub.activityQueue') || '[]').length); if (!q) break; await sleep(300); }
  res.kidQueueLeft = await f.evaluate(() => JSON.parse(localStorage.getItem('hub.activityQueue') || '[]'));
  await kid.close();

  const feed = (await L.apiAs('eli', '/api/activity?limit=10')).body;
  res.feedAfter = (feed.activity || feed).map(a => ({ profile_id: a.profile_id, name: a.name, app_id: a.app_id, text: a.text }));

  // 2. the TV kiosk board
  const tv = await L.device({ device: 'tv', profile: 'tv', fixedTime: false });
  await tv.goto('#home');
  await tv.page.waitForFunction(() => document.querySelector('.tv-lines li .who'), null, { timeout: 20000 }).catch(() => {});
  await sleep(1500);
  res.tv = await tv.page.evaluate(() => [...document.querySelectorAll('.tv-lines li')].map(li => ({
    who: li.querySelector('.who') && li.querySelector('.who').textContent,
    txt: li.querySelector('.txt') && li.querySelector('.txt').textContent,
    rendered: li.innerText.replace(/\s+/g, ' ').trim(),
  })));
  await tv.page.screenshot({ path: path.join(OUT, 'verify2-tv-kid-name-doubled-2-tv.png'), scale: 'css', animations: 'disabled', caret: 'hide' });
  await tv.close();

  // 3. an adult's Home feed (for scope: is it only the TV?)
  const e = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  await e.goto('#home');
  await e.page.waitForFunction(() => document.querySelector('#feed .fwho'), null, { timeout: 20000 }).catch(() => {});
  await sleep(1000);
  res.adult = await e.page.evaluate(() => [...document.querySelectorAll('#feed > li')].map(li => ({
    who: li.querySelector('.fwho') && li.querySelector('.fwho').textContent,
    lines: [...li.querySelectorAll('.ftxt')].map(x => x.textContent),
  })));
  const feedEl = await e.page.$('#feed');
  if (feedEl) { await feedEl.scrollIntoViewIfNeeded(); await sleep(300); await feedEl.screenshot({ path: path.join(OUT, 'verify2-tv-kid-name-doubled-2-adult.png'), scale: 'css', animations: 'disabled', caret: 'hide' }); }
  await e.close();
} finally {
  fs.writeFileSync(path.join(OUT, 'verify2-tv-kid-name-doubled-2.json'), JSON.stringify(res, null, 1));
  await L.close();
}

console.log('feed before (empty variant):', JSON.stringify((res.feedBefore && (res.feedBefore.activity || res.feedBefore)) || []).slice(0, 200));
console.log('server feed after Ezra:', JSON.stringify(res.feedAfter));
console.log('TV lines:'); for (const l of res.tv || []) console.log('  who="' + l.who + '" txt="' + l.txt + '" → ' + l.rendered);
console.log('Adult Home feed:'); for (const g of res.adult || []) console.log('  ' + g.who + ' | ' + g.lines.join(' | '));
