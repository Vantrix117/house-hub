// Batch 11 copy of audits/tools/phase3/tally/audiences.mjs: changed on purpose. The display profile no longer draws +, - or Reset (P3-TALLY-09), so its tap is a DOM click (el.click()), which proves that even a forced click writes nothing. Everything else is the original.
// Taps from Home and every audience:
//   taps     Eli (iPhone) and Ezra (Kitchen iPad): #home -> Apps tab -> Tally tile -> + ; counts every tap; records
//            whether Home has any Tally card/button, and where the tile sits in the kid's Apps grid.
//   kid      Ezra: +, -, then Reset to zero -> server value, any dialog, any undo affordance.
//   kiosk    the TV profile: shell #tally deep link, then apps/tally.html opened directly; tap + -> toast, server row.
//   guest    a seeded guest (Grandma Jo) opens Tally and counts; pill text.
// Run: node "audits/tools/phase3/tally/audiences.mjs"  -> audits/evidence/p3/tally/audiences.json (+ PNGs)
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p6/11/p3copies';
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const res = { sessions: Object.keys(L.S.sessions) };
const server = async p => { const r = await L.apiAs(p, `/api/data/tally?scope=person`); const it = ((r.body && r.body.items) || []).find(i => i.key === 'count'); return { status: r.status, value: it ? it.value : null }; };
const ready = f => f.waitForFunction(() => document.getElementById('who').textContent.trim().length > 0, null, { timeout: 9000 });
try {
  // ── taps ──
  res.taps = {};
  for (const [profile, device] of [['eli', 'iphone-pwa'], ['ezra', 'ipad-portrait']]) {
    const d = await L.device({ device, profile, fixedTime: false });
    await d.goto('#home'); await sleep(1200);
    const homeHasTally = await d.page.evaluate(() => !!document.querySelector('#view-home [data-open="tally"], [data-open="tally"]'));
    const before = (await server(profile)).value;
    let taps = 0;
    await d.page.locator('.tabbar [data-tab="apps"]').click(); taps++;
    await sleep(500);
    const grid = await d.page.evaluate(() => [...document.querySelectorAll('.tile[data-id]')].filter(t => t.offsetParent).map((t, i) => { const r = t.getBoundingClientRect(); return { i, id: t.dataset.id, label: t.textContent.replace(/\s+/g, ' ').trim(), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; }));
    if (profile === 'ezra') await d.page.screenshot({ path: `${OUT}/kid-apps-grid-ipad-portrait.png`, scale: 'css', animations: 'disabled', caret: 'hide' });
    await d.page.locator('.tile[data-id="tally"]').click(); taps++;
    const f = await (async () => { for (let i = 0; i < 50; i++) { const fr = d.frame('tally'); if (fr) return fr; await sleep(100); } })();
    await ready(f);
    await f.locator('#plus').click(); taps++;
    await sleep(1500);
    res.taps[profile] = { device, homeHasTallyButton: homeHasTally, tapsHomeToCounted: taps, tapsHomeToSeeCount: 2, tapsHomeToReset: 3, before, after: (await server(profile)).value, appsGrid: grid };
    console.log('taps', profile, JSON.stringify({ ...res.taps[profile], appsGrid: grid.map(g => `${g.i}:${g.id}@${g.x},${g.y}`) }));
    await d.close();
  }
  // ── kid ──
  {
    const d = await L.device({ device: 'ipad-portrait', profile: 'ezra', fixedTime: false });
    const dialogs = []; d.page.on('dialog', dg => { dialogs.push(dg.message()); dg.dismiss(); });
    const f = await d.openApp('tally'); await ready(f);
    const start = (await server('ezra')).value;
    await f.locator('#plus').click(); await f.locator('#minus').click(); await sleep(600);
    const mid = (await server('ezra')).value;
    await f.locator('#reset').click(); await sleep(1500);
    const afterReset = (await server('ezra')).value;
    const ui = await f.evaluate(() => ({ count: document.getElementById('n').textContent, buttons: [...document.querySelectorAll('button')].map(b => ({ id: b.id, text: b.textContent.trim(), aria: b.getAttribute('aria-label'), hasIcon: !!b.querySelector('svg,img') })), toast: (document.getElementById('hub-toast') || {}).textContent || null, liveRegion: !!document.querySelector('[aria-live]') }));
    await d.page.screenshot({ path: `${OUT}/kid-after-reset-ipad-portrait.png`, scale: 'css', animations: 'disabled', caret: 'hide' });
    res.kid = { start, afterPlusMinus: mid, afterReset, dialogs, ui };
    console.log('kid', JSON.stringify(res.kid));
    await d.close();
  }
  // ── kiosk ──
  {
    const d = await L.device({ device: 'tv', profile: 'tv', fixedTime: false });
    await d.goto('#tally'); await sleep(2500);
    const deep = await d.page.evaluate(() => ({ frame: !![...document.querySelectorAll('iframe')].find(i => (i.src || '').includes('tally')), toast: (document.getElementById('hub-toast') || {}).textContent || null, hash: location.hash }));
    await d.page.goto(L.site + '/apps/tally.html'); await d.page.waitForFunction(() => document.getElementById('who').textContent.trim().length > 0, null, { timeout: 9000 });
    const posts = []; d.page.on('request', r => { if (r.method() === 'POST' && r.url().includes('/api/data/')) posts.push(r.url()); });
    const before = await d.page.evaluate(() => document.getElementById('n').textContent);
    await d.page.locator('#plus').evaluate(e => e.click()); await sleep(400);
    const toast = await d.page.evaluate(() => { const t = document.getElementById('hub-toast'); return t && !t.hidden ? t.textContent : null; });
    await d.page.screenshot({ path: `${OUT}/kiosk-standalone-tv.png`, scale: 'css', animations: 'disabled', caret: 'hide' });
    await sleep(1000);
    res.kiosk = { shellDeepLink: deep, standaloneShows: before, who: await d.page.evaluate(() => document.getElementById('who').textContent), afterTap: await d.page.evaluate(() => document.getElementById('n').textContent), toast, posts, serverTvRow: await server('tv') };
    console.log('kiosk', JSON.stringify(res.kiosk));
    await d.close();
  }
  // ── guest ──
  {
    const gid = res.sessions.find(s => s.startsWith('guest-grandmajo')) || res.sessions.find(s => s.startsWith('guest-'));
    if (gid) {
      const d = await L.device({ device: 'iphone-pwa', profile: gid, fixedTime: false });
      const f = await d.openApp('tally'); await ready(f);
      const start = await f.evaluate(() => document.getElementById('n').textContent);
      await f.locator('#plus').click(); await sleep(1200);
      res.guest = { id: gid, who: await f.evaluate(() => document.getElementById('who').textContent), start, server: await server(gid) };
      console.log('guest', JSON.stringify(res.guest));
      await d.close();
    } else { res.guest = 'no guest session in the rig'; console.log('guest: no session'); }
  }
} finally {
  fs.writeFileSync(`${OUT}/audiences.json`, JSON.stringify(res, null, 1));
  await L.close();
}
