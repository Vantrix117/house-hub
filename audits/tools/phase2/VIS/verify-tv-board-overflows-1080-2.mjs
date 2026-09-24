// Skeptic #2 for finding "tv-board-overflows-1080": does the kiosk TV board (1920×1080) run off the bottom, and do
// reminders drop out of sight once there are a few more than the typical four?
// Independent of leads.mjs: fresh local instance per variant, the kiosk profile 'tv' on the rig's TV device.
//   node "audits/tools/phase2/VIS/verify-tv-board-overflows-1080-2.mjs"
// Prints one JSON block per measurement; writes 1× PNGs to audits/evidence/p2/VIS/verify-tv-overflow-2-*.png
import path from 'node:path';
import fs from 'node:fs';
import { local, sleep, DEMO } from '../../lib/local.mjs';

const EVID = path.resolve('audits/evidence/p2/VIS');
fs.mkdirSync(EVID, { recursive: true });
const shot = async (page, name) => { const f = path.join(EVID, name); await page.screenshot({ path: f, scale: 'css', animations: 'disabled', caret: 'hide' }); return path.relative(process.cwd(), f).replace(/\\/g, '/'); };
const out = {};
const log = (k, v) => { out[k] = v; console.log(`\n## ${k}\n` + JSON.stringify(v)); };

async function openTv(L, mode = 'light') {
  const d = await L.device({ device: 'tv', profile: 'tv', mode });
  await d.goto('#home');
  await d.page.waitForSelector('#tv');
  const until = Date.now() + 15000;
  while (Date.now() < until && !(await d.page.evaluate(() => !!(window.hub && hub.sync && hub.sync.lastPull)))) await sleep(200);
  await sleep(1500);
  return d;
}

const measure = d => d.page.evaluate(() => {
  const v = document.querySelector('#views');
  const vr = v.getBoundingClientRect();
  const rows = [...document.querySelectorAll('#tv #remlist .rem-row')];
  const card = document.querySelector('#tv-rem-card');
  const cr = card && !card.hidden ? card.getBoundingClientRect() : null;
  const box = s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return [Math.round(r.top), Math.round(r.bottom)]; };
  return {
    viewport: [innerWidth, innerHeight],
    dataKind: document.documentElement.dataset.kind,
    viewsScrollHeight: v.scrollHeight, viewsClientHeight: v.clientHeight, hiddenPx: v.scrollHeight - v.clientHeight,
    viewsOverflowY: getComputedStyle(v).overflowY, scrollbarWidthPx: v.offsetWidth - v.clientWidth,
    panes: { hero: box('#tv .tv-hero'), verse: box('#tv .tv-verse'), prayed: box('#tv .tv-prayed'), stars: box('#tv .tv-stars'), feed: box('#tv .tv-feed'), read: box('#tv .tv-read'), rem: box('#tv #tv-rem-card') },
    remCardBottom: cr && Math.round(cr.bottom),
    reminders: rows.length,
    remindersFullyOnScreen: rows.filter(r => r.getBoundingClientRect().bottom <= vr.bottom).length,
    remindersPartlyOnScreen: rows.filter(r => r.getBoundingClientRect().top < vr.bottom && r.getBoundingClientRect().bottom > vr.bottom).length,
    rows: rows.map(r => ({ text: r.querySelector('.rem-text').textContent.slice(0, 50), top: Math.round(r.getBoundingClientRect().top), bottom: Math.round(r.getBoundingClientRect().bottom) })),
    moreIndicator: !!document.querySelector('#tv .more, #tv [data-more], #tv .rem-more'),
    fonts: getComputedStyle(document.body).fontFamily.slice(0, 80),
  };
});

async function addReminders(L, n, tag) {
  const people = [['eli', 'Eli'], ['christian', 'Mae'], ['mom', 'Elizabeth'], ['dad', 'David']];
  for (let i = 0; i < n; i++) {
    const [by, byName] = people[i % people.length];
    const id = `${tag}${i}`;
    const createdAt = DEMO + 60_000 * (i + 1);   // after the seeded four (so they list last: sorted oldest first)
    const r = await L.apiAs('eli', `/api/data/reminders/item:${id}?scope=family`, { method: 'PUT', body: { value: { id, text: `Skeptic reminder ${i + 1}: pick up the prescription`, by, byName, createdAt }, updated_at: Date.now() } });
    if (r.status !== 200) console.log('PUT failed', r.status, JSON.stringify(r.body).slice(0, 200));
  }
}

// 1) typical household, WebKit then Chromium: the baseline and +1, +2, +4 reminders
for (const engine of ['webkit', 'chromium']) {
  const L = await local({ variant: 'typical', engine });
  try {
    let d = await openTv(L);
    log(`${engine} typical (seeded reminders)`, { ...(await measure(d)), shot: engine === 'webkit' ? await shot(d.page, 'verify-tv-overflow-2-typical.png') : undefined });
    await d.close();
    let added = 0;
    for (const extra of [1, 2, 4]) {
      await addReminders(L, extra - added, `sk${extra}-`); added = extra;
      d = await openTv(L);
      const m = await measure(d);
      log(`${engine} typical + ${extra} reminder(s) (total ${m.reminders})`, { ...m, rows: m.rows.slice(-3), shot: engine === 'webkit' && extra !== 4 ? await shot(d.page, `verify-tv-overflow-2-typical-plus${extra}.png`) : undefined });
      // can the kiosk scroll it? keyboard (a remote's arrow/page keys) and wheel
      if (extra === 2) {
        await d.page.keyboard.press('PageDown'); await sleep(300);
        const afterKey = await d.page.evaluate(() => document.querySelector('#views').scrollTop);
        await d.page.mouse.move(960, 540); await d.page.mouse.wheel(0, 600); await sleep(400);
        const afterWheel = await d.page.evaluate(() => document.querySelector('#views').scrollTop);
        log(`${engine} typical +2: scrollTop after PageDown / wheel`, { afterKey, afterWheel, activeElement: await d.page.evaluate(() => document.activeElement && (document.activeElement.id || document.activeElement.tagName)) });
      }
      await d.close();
    }
  } finally { await L.close(); }
}

// 2) overflow household, WebKit
{
  const L = await local({ variant: 'overflow' });
  try {
    for (const mode of ['light']) {
      const d = await openTv(L, mode);
      const m = await measure(d);
      log(`webkit overflow (${mode})`, { ...m, rows: m.rows.slice(0, 2).concat(m.rows.slice(-1)), shot: await shot(d.page, `verify-tv-overflow-2-overflow-${mode}.png`) });
      await d.close();
    }
  } finally { await L.close(); }
}
fs.writeFileSync(path.join(EVID, 'verify-tv-overflow-2.json'), JSON.stringify(out, null, 1));
console.log('\nwrote audits/evidence/p2/VIS/verify-tv-overflow-2.json');
