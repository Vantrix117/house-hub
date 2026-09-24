// Skeptic #1 for finding "day-dots-vs-count": do the seven day dots in Kid Verse light only verse days while the
// star count also counts story and prayed stars?   node "audits/tools/phase3/kidverse/verify-day-dots-vs-count-1.mjs"
// A: typical variant, real clock. Ezra (kid, iphone-pwa) opens Kid Verse: record count, lit dots, aria-label.
//    Taps Done ★ then "I heard it": record again. Kiara opens: record. Mom (adult) opens: record the Kids' stars panel.
// B: overflow variant: Mom's Kids' stars panel aria-labels (can it read "N of 7 days" with N > 7?).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep } from '../../lib/local.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const EV = path.join(ROOT, 'audits', 'evidence', 'p3', 'kidverse'); fs.mkdirSync(EV, { recursive: true });
const out = {};
const state = f => f.evaluate(() => {
  const q = s => document.querySelector(s);
  const mine = q('#mine .days');
  const raw = (() => { try { return hub.get('stars', { scope: 'person' }); } catch { return null; } })();
  return {
    starCount: q('#star-count') && q('#star-count').textContent, mineSub: q('#mine .sub') && q('#mine .sub').textContent.trim(),
    litDots: document.querySelectorAll('#mine .days span.on').length, dotsAria: mine && mine.getAttribute('aria-label'),
    dots: mine ? [...mine.querySelectorAll('span')].map(s => (s.title || '') + (s.classList.contains('on') ? ':on' : ':off') + (s.classList.contains('today') ? ':today' : '')) : null,
    kids: [...document.querySelectorAll('#kids li[data-kid]')].map(li => ({ id: li.dataset.kid, text: li.textContent.replace(/\s+/g, ' ').trim(), lit: li.querySelectorAll('.days span.on').length, aria: (li.querySelector('.days') || {}).getAttribute ? li.querySelector('.days').getAttribute('aria-label') : null })),
    rawDays: raw && raw.days, rawStory: raw && raw.credited && raw.credited.story, rawPrayed: raw && raw.credited && raw.credited.prayed, rawCount: raw && raw.count,
  };
});
const waitPull = async f => { for (let i = 0; i < 100; i++) { if (await f.evaluate(() => !!(window.hub && hub.sync && hub.sync.lastPull)).catch(() => false)) return; await sleep(150); } };
const shot = async (page, name) => { const p = path.join(EV, name); await page.screenshot({ path: p, scale: 'css', animations: 'disabled' }); return path.relative(ROOT, p).split(path.sep).join('/'); };

{
  const L = await local({ variant: 'typical', clock: 'real' });
  try {
    const d = await L.device({ device: 'iphone-pwa', profile: 'ezra', fixedTime: false });
    const f = await d.openApp('kidverse', { wait: '#story' }); await waitPull(f); await sleep(2000);
    out.A_ezra_open = await state(f);
    await f.click('#done'); await sleep(1500);
    out.A_ezra_afterDone = await state(f);
    await f.click('#story-heard'); await sleep(1500);
    out.A_ezra_afterStory = await state(f);
    out.A_ezra_shot = await shot(d.page, 'verify-day-dots-vs-count-1-ezra-after-verse-story.png');
    await sleep(2500); await d.close();
    const k = await L.device({ device: 'iphone-pwa', profile: 'kiara', fixedTime: false });
    const kf = await k.openApp('kidverse', { wait: '#story' }); await waitPull(kf); await sleep(2500);
    out.A_kiara_open = await state(kf);
    out.A_kiara_shot = await shot(k.page, 'verify-day-dots-vs-count-1-kiara-open.png');
    await k.close();
    const m = await L.device({ device: 'iphone-pwa', profile: 'mom', fixedTime: false });
    const mf = await m.openApp('kidverse', { wait: '#kids' }); await waitPull(mf); await sleep(2500);
    out.A_mom_panel = (await state(mf)).kids;
    await mf.evaluate(() => document.querySelector('#kids') && document.querySelector('#kids').scrollIntoView());
    out.A_mom_shot = await shot(m.page, 'verify-day-dots-vs-count-1-mom-kids-panel.png');
    await m.close();
  } finally { await L.close(); }
}
{
  const L = await local({ variant: 'overflow', clock: 'real' });
  try {
    const m = await L.device({ device: 'iphone-pwa', profile: 'mom', fixedTime: false });
    const mf = await m.openApp('kidverse', { wait: '#kids' }); await waitPull(mf); await sleep(2500);
    out.B_mom_panel_overflow = (await state(mf)).kids;
    await m.close();
  } finally { await L.close(); }
}
fs.writeFileSync(path.join(EV, 'verify-day-dots-vs-count-1.json'), JSON.stringify(out, null, 1));
const brief = o => o && { starCount: o.starCount, litDots: o.litDots, aria: o.dotsAria, sub: o.mineSub, rawDays: o.rawDays, rawStory: o.rawStory, rawPrayed: o.rawPrayed };
console.log(JSON.stringify({ ezraOpen: brief(out.A_ezra_open), ezraDone: brief(out.A_ezra_afterDone), ezraStory: brief(out.A_ezra_afterStory), kiara: brief(out.A_kiara_open), momPanel: out.A_mom_panel, overflowPanel: out.B_mom_panel_overflow }, null, 1));
