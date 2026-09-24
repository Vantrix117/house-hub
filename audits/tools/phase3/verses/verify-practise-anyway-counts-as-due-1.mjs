// Skeptic #1 for "practise-anyway-counts-as-due": as Elizabeth (mom) on the typical household, open Verses with nothing
// due, tap "Practise one anyway" (#again, apps/verses.html:366-371) and read the pill, stats, Due today and Coming up.
// Also reads the summary row the app writes (writeSummary uses dueIds, apps/verses.html:242) and the rated follow-up.
import fs from 'node:fs';
import path from 'node:path';
import { local, DEMO, sleep } from '../../lib/local.mjs';
const EV = path.resolve('audits/evidence/p3/verses'); fs.mkdirSync(EV, { recursive: true });
const read = f => f.evaluate(() => {
  const q = s => document.querySelector(s), vis = s => !!q(s) && !q(s).hidden;
  const li = s => [...document.querySelectorAll(s)].map(e => e.textContent.replace(/\s+/g, ' ').trim());
  return { who: q('#who').textContent.trim(), trainer: vis('#trainer'), done: vis('#done'), ref: vis('#trainer') ? q('#ref').textContent : null,
    kick: q('#kick').textContent, doneBig: vis('#done') ? q('#done-big').textContent : null, doneSub: vis('#done') ? q('#done-sub').textContent : null,
    again: vis('#again') ? q('#again').textContent.trim() : null, stDue: vis('#stats') ? q('#st-due').textContent : null,
    queueSub: q('#queue-sub').textContent, queue: li('#queue-list li'), laterSub: q('#later-sub').textContent, later: li('#later-list li').slice(0, 3),
    dueIdsNow: window.verses && window.verses.dueIds() };
});
const L = await local({ variant: 'typical', clock: 'demo' });
const out = {};
try {
  const d = await L.device({ device: 'iphone-pwa', profile: 'mom', installClock: DEMO });
  await d.goto('#home');
  const f = await d.openApp('verses');
  await f.waitForSelector('#trainer:not([hidden]), #done:not([hidden]), #empty:not([hidden])', { timeout: 12000 }); await sleep(500);
  out.before = await read(f);
  await f.click('#again'); await sleep(400);
  out.after = await read(f);
  out.summaryRow = await f.evaluate(() => hub.get('summary'));
  await f.evaluate(() => document.getElementById('queue').scrollIntoView()); await sleep(200);
  await d.page.screenshot({ path: path.join(EV, 'verify-practise-anyway-counts-as-due-1-iphone.png'), scale: 'css', animations: 'disabled', caret: 'hide' });
  // rate it Got it and see what the pill/stats go back to
  await f.click('#show'); await f.waitForSelector('#act-rate:not([hidden])', { timeout: 3000 });
  await f.click('#act-rate [data-rate="got"]'); await sleep(400);
  out.afterRate = await read(f);
  await d.close();
} catch (e) { out.error = String(e && e.stack || e); }
finally { await L.close(); }
fs.writeFileSync(path.join(EV, 'verify-practise-anyway-counts-as-due-1.json'), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
