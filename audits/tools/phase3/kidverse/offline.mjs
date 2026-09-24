// KV: offline in Kid Verse — does anything on screen say the star is not saved yet?
//   node "audits/tools/phase3/kidverse/offline.mjs"
// Ezra's phone opens Kid Verse online, goes offline, taps Done ★. We read the frame and the shell's visible chrome for any
// offline / pending wording or indicator, and the queued write; then reconnect and confirm it lands.
import { local, sleep, log, saveJson, shot, pulled, flushed, row } from './_kv.mjs';

const out = {};
const L = await local({ variant: 'typical', clock: 'real' });
try {
  const d = await L.device({ device: 'iphone-pwa', profile: 'ezra', fixedTime: false });
  const f = await d.openApp('kidverse', { wait: '#done:not([hidden])' }); await pulled(f); await sleep(1000);
  await d.setOffline(true); await sleep(500);
  await f.evaluate(() => document.querySelector('#done').scrollIntoView({ block: 'center' }));
  await f.click('#done'); await sleep(1200);
  out.offline = {
    frameState: await f.evaluate(() => hub.sync.state),
    frameWords: await f.evaluate(() => (document.body.innerText.match(/offline|not saved|waiting|pending|sync/gi) || [])),
    shellWords: await d.page.evaluate(() => { const vis = [...document.querySelectorAll('body *')].filter(e => e.offsetParent && !e.closest('iframe') && e.children.length === 0); return vis.map(e => e.textContent.trim()).filter(t => /offline|not saved|waiting|pending|sync/i.test(t)).slice(0, 10); }),
    syncDotVisible: await d.page.evaluate(() => { const e = document.querySelector('#syncdot'); if (!e) return null; const r = e.getBoundingClientRect(); return { display: getComputedStyle(e).display, inViewport: r.width > 0 && r.top < innerHeight && r.bottom > 0, cls: e.className }; }),
    tabbarVisible: await d.page.evaluate(() => { const t = document.querySelector('#tabbar'); return t ? getComputedStyle(t).display !== 'none' && t.getBoundingClientRect().height > 0 && !t.hidden : null; }),
    done: await f.textContent('#done'), count: await f.textContent('#star-count'),
    queued: await f.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('hub.queue.kidverse.person.ezra') || '{}'))),
    server: (await row(L, 'ezra', 'person', 'stars')).value.days,
  };
  out.shot = await shot(d.page, 'offline-kid-after-done.png');
  await d.setOffline(false); await sleep(1500); await flushed(f);
  out.online = { server: (await row(L, 'ezra', 'person', 'stars')).value.days, state: await f.evaluate(() => hub.sync.state) };
  await d.close();
} finally { await L.close(); }
log('offline', JSON.stringify(out.offline));
log('back online', JSON.stringify(out.online));
saveJson('offline.json', out);
