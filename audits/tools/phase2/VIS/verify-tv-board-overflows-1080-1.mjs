// Skeptic #1 for finding "tv-board-overflows-1080": does the kiosk TV board at 1920x1080 run past the bottom of the
// screen, clip reminders, and give no sign of it? Independent re-measure on a fresh local instance.
//   node "audits/tools/phase2/VIS/verify-tv-board-overflows-1080-1.mjs"
// For each engine (WebKit = the rig default; Chromium = the installed Chrome, to rule out WebKit-on-Windows font metrics):
//   A. typical board (4 reminders): #views scrollHeight vs clientHeight, what the hidden pixels contain
//   B. typical + 1, + 2, + 3 reminders (added as Eli through the local API; the kiosk cannot write): is the 5th row on screen?
//   C. overflow board (15 reminders, long names, guests): hidden px, reminders on screen, any "+N more" cue
//   D. can the board be scrolled without touch (wheel, keyboard arrows / PageDown, as a remote d-pad would send)?
// Evidence: audits/evidence/p2/VIS/verify-tv-overflow-1-*.png (1x) and verify-tv-overflow-1.json. Only reads, except the
// added reminders in B, which go to the rig's in-memory database.
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, DEMO } from '../../lib/local.mjs';

const EVID = path.resolve('audits/evidence/p2/VIS');
fs.mkdirSync(EVID, { recursive: true });
const out = {};
const log = (k, v) => { out[k] = v; console.log(`\n## ${k}\n` + JSON.stringify(v)); };

const measure = page => page.evaluate(() => {
  const v = document.querySelector('#views'), tv = document.querySelector('#tv'), H = innerHeight;
  const rows = [...document.querySelectorAll('#tv #remlist .rem-row')].map(r => { const b = r.getBoundingClientRect(); return { t: r.querySelector('.rem-text').textContent.slice(0, 32), top: Math.round(b.top), bottom: Math.round(b.bottom), on: b.bottom <= H ? 'full' : b.top < H ? 'partial' : 'off' }; });
  const panes = [...document.querySelectorAll('#tv .tv-pane')].map(p => { const b = p.getBoundingClientRect(); return [p.className.split(' ').pop(), Math.round(b.top), Math.round(b.bottom), p.hidden ? 'hidden' : '']; });
  const cs = getComputedStyle(v);
  const txt = tv.innerText;
  return {
    viewport: [innerWidth, H], cols: getComputedStyle(tv).gridTemplateColumns.split(' ').length,
    viewsScrollHeight: v.scrollHeight, viewsClientHeight: v.clientHeight, hiddenPx: v.scrollHeight - v.clientHeight,
    viewsPadBottom: cs.paddingBottom, overflowY: cs.overflowY, tvBottom: Math.round(tv.getBoundingClientRect().bottom),
    remindersInData: hub.list('item:', { app: 'reminders', scope: 'family' }).length,
    remRows: rows.length, remFull: rows.filter(r => r.on === 'full').length, remPartial: rows.filter(r => r.on === 'partial').length, remOff: rows.filter(r => r.on === 'off').length,
    rows, panes, moreCue: (txt.match(/\+\s?\d+\s+more|\d+\s+more|see all|scroll/i) || [null])[0],
  };
});

async function openTv(L, mode = 'light') {
  const d = await L.device({ device: 'tv', profile: 'tv', mode });
  await d.goto('#home'); await d.page.waitForSelector('#tv');
  const until = Date.now() + 15000;
  while (Date.now() < until && !(await d.page.evaluate(() => !!(window.hub && hub.sync && hub.sync.lastPull)))) await sleep(200);
  await sleep(1500);
  await d.page.evaluate(() => window.__tv && window.__tv.paint && window.__tv.paint());
  await sleep(300);
  return d;
}
const shot = async (d, name) => { const f = path.join(EVID, name); await d.page.screenshot({ path: f, scale: 'css', animations: 'disabled', caret: 'hide' }); return path.relative(process.cwd(), f).replace(/\\/g, '/'); };

for (const engine of ['webkit', 'chromium']) {
  // A + B: typical board, then add reminders one at a time
  {
    const L = await local({ variant: 'typical', engine });
    try {
      let d = await openTv(L);
      const a = await measure(d.page);
      // what fills the hidden pixels: the #views bottom padding, or content?
      a.contentBottomInScroll = await d.page.evaluate(() => { const v = document.querySelector('#views'); return Math.round(document.querySelector('#tv').getBoundingClientRect().bottom + v.scrollTop); });
      log(`${engine} A typical`, { ...a, shot: engine === 'webkit' ? await shot(d, 'verify-tv-overflow-1-typical.png') : undefined });
      await d.close();
      const extra = ['Water the tomatoes before church', 'Grandma Jo arrives Saturday at noon', 'Soccer photos Wednesday: wear the blue jersey'];
      for (let i = 0; i < extra.length; i++) {
        const id = 'skeptic' + (i + 1), at = DEMO - (10 - i) * 60000;
        const r = await L.apiAs('eli', `/api/data/reminders/${encodeURIComponent('item:' + id)}?scope=family`, { method: 'PUT', body: { value: { id, text: extra[i], by: 'eli', byName: 'Eli', createdAt: at }, updated_at: at } });
        if (r.status !== 200) console.log('PUT failed', r.status, JSON.stringify(r.body));
        d = await openTv(L);
        const b = await measure(d.page);
        log(`${engine} B typical + ${i + 1} reminder(s)`, { ...b, rows: b.rows.slice(-3), shot: engine === 'webkit' && i === 0 ? await shot(d, 'verify-tv-overflow-1-typical-plus1.png') : undefined });
        await d.close();
      }
    } finally { await L.close(); }
  }
  // C + D: overflow board
  {
    const L = await local({ variant: 'overflow', engine });
    try {
      const d = await openTv(L);
      const c = await measure(d.page);
      log(`${engine} C overflow`, { ...c, rows: c.rows.slice(0, 2).concat(c.rows.slice(-1)), shot: engine === 'webkit' ? await shot(d, 'verify-tv-overflow-1-overflow.png') : undefined });
      // D: no-touch scrolling: keyboard (a remote d-pad arrives as arrow keys) and a wheel
      const st = () => d.page.evaluate(() => document.querySelector('#views').scrollTop);
      const res = { start: await st() };
      await d.page.mouse.click(960, 540).catch(() => {});      // focus the page like a pointer remote would (nothing on the board reacts)
      await d.page.keyboard.press('ArrowDown'); await sleep(400); res.afterArrowDown = await st();
      await d.page.keyboard.press('PageDown'); await sleep(600); res.afterPageDown = await st();
      await d.page.keyboard.press('Space'); await sleep(600); res.afterSpace = await st();
      await d.page.evaluate(() => { document.querySelector('#views').scrollTop = 0; }); await sleep(200);
      await d.page.mouse.move(960, 540); await d.page.mouse.wheel(0, 600); await sleep(600); res.afterWheel600 = await st();
      res.activeElement = await d.page.evaluate(() => { const a = document.activeElement; return a ? a.tagName + (a.id ? '#' + a.id : '') : null; });
      log(`${engine} D no-touch scroll on the overflow board`, res);
      await d.close();
    } finally { await L.close(); }
  }
}
// E (WebKit): a plausible day on the typical board — the whole household (7 people, short names) prayed on the family
// list — with the typical 4 reminders. Where do the reminders land?
{
  const L = await local({ variant: 'typical' });
  try {
    let d = await openTv(L);
    const today = await d.page.evaluate(() => { const x = new Date(); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); });
    await d.close();
    const names = (L.S.profiles || []).filter(p => p.kind === 'adult' || p.kind === 'kid').filter(p => !p.guest && !p.expires_at).map(p => p.name);
    const at = DEMO - 5 * 60000;
    const r = await L.apiAs('eli', `/api/data/prayer/${encodeURIComponent('prayer:skeptic-all')}?scope=family`, { method: 'PUT', body: { value: { id: 'skeptic-all', title: 'Family prayer time', prayedBy: { [today]: names } }, updated_at: at } });
    if (r.status !== 200) console.log('PUT failed', r.status, JSON.stringify(r.body));
    d = await openTv(L);
    const e = await measure(d.page);
    log('webkit E typical + everyone prayed today', { today, names, prayedFaces: await d.page.evaluate(() => document.querySelectorAll('#tv-prayed .tv-face').length), ...e, shot: await shot(d, 'verify-tv-overflow-1-all-prayed.png') });
    await d.close();
  } finally { await L.close(); }
}
const f = path.join(EVID, 'verify-tv-overflow-1.json');
fs.writeFileSync(f, JSON.stringify(out, null, 1));
console.log('\nwrote', path.relative(process.cwd(), f));
