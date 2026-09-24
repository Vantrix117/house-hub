// Skeptic #2 for finding "day-dots-vs-count": do the seven day dots disagree with the ★ count and its aria-label?
//   node "audits/tools/phase3/kidverse/verify-day-dots-vs-count-2.mjs"
// V1 (shipped UI only): typical variant, real clock. Ezra opens Kid Verse, taps Done ★, then "I heard it". After each step:
//     #star-count, lit dots in #mine .days, the .days aria-label, the server's stars row. Then Mom (adult) opens Kid Verse:
//     the Kids' stars panel text + lit dots for Ezra and Kiara.
// V2 (fixture, hand-made API write as Ezra into his own person row, only to show the rendering at a late-week count):
//     every day this week so far has verse + story + prayed credited → what the dot row and its aria-label say.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep } from '../../lib/local.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const EVID = path.join(ROOT, 'audits', 'evidence', 'p3', 'kidverse');
const P = 'verify-day-dots-vs-count-2';
const out = {};
const dom = f => f.evaluate(() => {
  const d = document.querySelector('#mine .days');
  return { starCount: document.querySelector('#star-count')?.textContent, sub: document.querySelector('#mine .sub')?.textContent,
    aria: d?.getAttribute('aria-label'), litDots: document.querySelectorAll('#mine .days span.on').length,
    dots: [...document.querySelectorAll('#mine .days span')].map(s => s.title + (s.classList.contains('on') ? '*' : '')),
    kids: [...document.querySelectorAll('#kids li[data-kid]')].map(li => ({ kid: li.dataset.kid, text: li.textContent.replace(/\s+/g, ' ').trim(), lit: li.querySelectorAll('.days span.on').length, aria: li.querySelector('.days')?.getAttribute('aria-label') })) };
});
const srv = async (L, kid) => { const r = await L.apiAs(kid, '/api/data/kidverse?scope=person&key=stars'); const v = r.body?.item?.value; return v && { count: v.count, days: v.days, story: v.credited?.story, prayed: v.credited?.prayed }; };
const waitPull = async f => { for (let i = 0; i < 100; i++) { if (await f.evaluate(() => !!(window.hub && hub.sync && hub.sync.lastPull)).catch(() => false)) return; await sleep(150); } };
const shot = async (page, n) => { const f = path.join(EVID, `${P}-${n}.png`); await page.screenshot({ path: f, scale: 'css', animations: 'disabled', fullPage: false }); return path.relative(ROOT, f).split(path.sep).join('/'); };

const L = await local({ variant: 'typical', clock: 'real' });
try {
  out.srv0 = { ezra: await srv(L, 'ezra'), kiara: await srv(L, 'kiara') };
  const d = await L.device({ device: 'iphone-pwa', profile: 'ezra', fixedTime: false });
  const f = await d.openApp('kidverse', { wait: '#story' }); await waitPull(f); await sleep(1500);
  out.V1_open = await dom(f);
  await f.click('#done'); await sleep(1500);
  out.V1_afterVerse = await dom(f);
  await f.click('#story-heard'); await sleep(2000);
  out.V1_afterStory = await dom(f);
  await f.evaluate(() => document.querySelector('#mine')?.scrollIntoView({ block: 'center' })); await sleep(300);
  out.V1_shot = await shot(d.page, 'ezra-after-verse-and-story');
  await sleep(2500); out.srv1 = await srv(L, 'ezra');
  await d.close();

  const m = await L.device({ device: 'iphone-pwa', profile: 'mom', fixedTime: false });
  const mf = await m.openApp('kidverse', { wait: '#kids' }); await waitPull(mf); await sleep(2000);
  out.V1_mom = (await dom(mf)).kids;
  await mf.evaluate(() => document.querySelector('#kids')?.scrollIntoView({ block: 'center' })); await sleep(300);
  out.V1_momShot = await shot(m.page, 'mom-kids-panel');
  await m.close();

  // V2 fixture: every day of this ISO week up to today has all three sources credited
  const cur = (await L.apiAs('ezra', '/api/data/kidverse?scope=person&key=stars')).body.item.value;
  const pad = n => String(n).padStart(2, '0'); const dk = x => x.getFullYear() + '-' + pad(x.getMonth() + 1) + '-' + pad(x.getDate());
  const now = new Date(); const mon = new Date(now.getFullYear(), now.getMonth(), now.getDate()); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
  const days = []; for (let x = new Date(mon); x <= now; x.setDate(x.getDate() + 1)) days.push(dk(x));
  const v = JSON.parse(JSON.stringify(cur)); v.credited = v.credited || {}; v.credited.story = { ...(v.credited.story || {}) }; v.credited.prayed = { ...(v.credited.prayed || {}) }; v.days = { ...(v.days || {}) };
  for (const k of days) { v.credited.story[k] = true; v.credited.prayed[k] = true; }
  // verse ★ only on today (as a kid who does the story and prays daily but skips the verse most days)
  out.V2_fixtureDays = days;
  const w = await L.apiAs('ezra', '/api/data/kidverse/stars?scope=person', { method: 'PUT', body: { value: v, updated_at: Date.now() } });
  out.V2_write = { status: w.status, body: w.body };
  const d2 = await L.device({ device: 'iphone-pwa', profile: 'ezra', fixedTime: false });
  const f2 = await d2.openApp('kidverse', { wait: '#story' }); await waitPull(f2); await sleep(2000);
  out.V2 = await dom(f2);
  await f2.evaluate(() => document.querySelector('#mine')?.scrollIntoView({ block: 'center' })); await sleep(300);
  out.V2_shot = await shot(d2.page, 'fixture-late-week');
  await d2.close();
} finally { await L.close(); }
fs.writeFileSync(path.join(EVID, `${P}.json`), JSON.stringify(out, null, 1));
for (const k of ['srv0', 'V1_open', 'V1_afterVerse', 'V1_afterStory', 'srv1', 'V1_mom', 'V2_write', 'V2']) console.log(k, JSON.stringify(out[k]));
