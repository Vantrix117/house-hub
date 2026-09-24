// Skeptic #2: "Practise one anyway" (apps/verses.html:366-371) makes the practice verse read as due.
// Elizabeth (mom) on an iPhone PWA, typical household, demo clock. Records the pill, stats, Due today, Coming up
// before and after the tap, the summary row the app would write (writeSummary, 239-245), and what happens after rating.
// Batch writes are aborted so nothing leaves the page. Run: node "audits/tools/phase3/verses/verify-practise-anyway-counts-as-due-2.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, DEMO } from '../../lib/local.mjs';
const EV = path.resolve('audits/evidence/p3/verses'); fs.mkdirSync(EV, { recursive: true });
const P = 'verify-practise-anyway-counts-as-due-2';
const L = await local({ variant: 'typical', clock: 'demo' });
const out = {};
const snap = f => f.evaluate(() => {
  const q = s => document.querySelector(s), vis = s => !!q(s) && !q(s).hidden, t = s => q(s) ? q(s).textContent.replace(/\s+/g, ' ').trim() : null;
  return { who: t('#who'), trainer: vis('#trainer'), done: vis('#done'), ref: vis('#trainer') ? t('#ref') : null, kick: vis('#trainer') ? t('#kick') : null,
    doneBig: vis('#done') ? t('#done-big') : null, again: vis('#again') ? t('#again') : null,
    statDue: vis('#stats') ? t('#st-due') : null, dueHeading: t('#queue h2'),
    dueList: [...document.querySelectorAll('#queue-list li')].map(li => li.textContent.replace(/\s+/g, ' ').trim()),
    later: [...document.querySelectorAll('#later-list li')].slice(0, 3).map(li => li.textContent.replace(/\s+/g, ' ').trim()),
    realDue: window.verses.dueIds(), summaryDue: window.verses.summary() && window.verses.summary().due };
});
try {
  const mom = await L.device({ device: 'iphone-pwa', profile: 'mom', installClock: DEMO });
  await mom.ctx.route(u => /\/api\/data\/[^/]+\/batch$/.test(u.pathname), r => r.abort('internetdisconnected'));
  await mom.goto('#home');
  const f = await mom.openApp('verses');
  await f.waitForSelector('#trainer:not([hidden]), #done:not([hidden]), #empty:not([hidden])', { timeout: 12000 });
  await sleep(400);
  out.before = await snap(f);
  await f.click('#again'); await sleep(400);
  out.afterTap = await snap(f);
  await f.evaluate(() => document.getElementById('stats').scrollIntoView()); await sleep(200);
  await mom.page.screenshot({ path: path.join(EV, P + '-after-tap-iphone.png'), scale: 'css', animations: 'disabled', caret: 'hide' });
  await f.click('#show'); await f.waitForSelector('#act-rate:not([hidden])');
  await f.click('#act-rate [data-rate="got"]'); await sleep(400);
  out.afterRate = await snap(f);
  await mom.close();
  fs.writeFileSync(path.join(EV, P + '.json'), JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out, null, 1));
} finally { await L.close(); }
