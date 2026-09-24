// KV: a kid's second device holding an older copy of the stars row erases a star the kid earned on the first device.
//   node "audits/tools/phase3/kidverse/stale-device.mjs"            offline (default) and online-race scenarios
//   node "audits/tools/phase3/kidverse/stale-device.mjs" offline|online
// offline: Ezra's phone (a second paired device) has opened Kid Verse before, so its cache is warm, then goes offline
//          (car, park). On the Kitchen iPad Ezra taps Done ★ (today's verse star, reaches the server). On the phone, still
//          offline, Ezra taps "I heard it" for the story. The phone reconnects.
// online:  both online; the phone taps "I heard it" within its 30 s poll window after the iPad's Done ★, before it pulls.
// Prints the server row after each step and what the iPad shows after its next pull.
import { local, sleep, log, stars, saveJson, shot, ui, pulled, flushed } from './_kv.mjs';

const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

async function run(name) {
  const L = await local({ variant: 'typical', clock: 'real' });
  const out = { name, today: today() };
  try {
    out.s0 = (await stars(L, 'ezra')).person;
    const ph = await L.newDevice({ name: 'Mom phone (Ezra)', profiles: ['ezra'] });
    const phone = await L.device({ device: 'iphone-pwa', profile: 'ezra', fixedTime: false, as: ph });
    const fp = await phone.openApp('kidverse', { wait: '#story-heard:not([hidden])' });
    await pulled(fp); await sleep(1500);
    out.phoneWarm = await ui(fp);
    if (name === 'offline') await phone.setOffline(true);
    // the Kitchen iPad: today's verse star
    const ipad = await L.device({ device: 'ipad-portrait', profile: 'ezra', fixedTime: false });
    const fi = await ipad.openApp('kidverse', { wait: '#done:not([hidden])' });
    await pulled(fi); await sleep(1200);
    await fi.click('#done'); await sleep(500); await flushed(fi);
    out.s1_afterIpadStar = (await stars(L, 'ezra')).person;
    out.ipadAfterStar = await ui(fi);
    // the phone: "I heard it" from its older copy
    await fp.click('#story-heard'); await sleep(800);
    out.phoneQueue = await fp.evaluate(() => { const q = JSON.parse(localStorage.getItem('hub.queue.kidverse.person.ezra') || '{}'); return Object.fromEntries(Object.entries(q).map(([k, v]) => [k, v.value && v.value.days ? { days: v.value.days, total: v.value.total, earned: v.value.earned } : v.value])); });
    if (name === 'offline') { await sleep(1500); await phone.setOffline(false); }
    await sleep(2500); await flushed(fp);
    out.s2_afterPhone = (await stars(L, 'ezra')).person;
    // the iPad's next routine pull (hub.js polls every 30 s; triggered here)
    await fi.evaluate(() => hub.pull()); await sleep(1500);
    out.ipadAfterPull = await ui(fi);
    await fi.evaluate(() => document.querySelector('#done').scrollIntoView({ block: 'center' }));
    out.shot = await shot(ipad.page, `stale-device-${name}-ipad-after-pull.png`);
  } finally { await L.close(); }
  const d = s => s && { total: s.total, earned: s.earned, count: s.count, verseToday: !!(s.days && s.days[out.today]), days: s.days, storyCredited: s.storyCredited };
  log(`[${name}] start           ${JSON.stringify(d(out.s0))}`);
  log(`[${name}] iPad Done ★      server ${JSON.stringify(d(out.s1_afterIpadStar))} | iPad shows ${out.ipadAfterStar.done} ★${out.ipadAfterStar.starCount}`);
  log(`[${name}] phone queue      ${JSON.stringify(out.phoneQueue)}`);
  log(`[${name}] phone flushed    server ${JSON.stringify(d(out.s2_afterPhone))}`);
  log(`[${name}] iPad after pull  ${JSON.stringify({ done: out.ipadAfterPull.done, doneToday: out.ipadAfterPull.doneToday, starCount: out.ipadAfterPull.starCount, rwTotal: out.ipadAfterPull.rwTotal, rwEarned: out.ipadAfterPull.rwEarned })}`);
  return out;
}
const which = process.argv[2] ? [process.argv[2]] : ['offline', 'online'];
const res = {}; for (const w of which) res[w] = await run(w);
saveJson('stale-device' + (process.argv[2] ? '-' + process.argv[2] : '') + '.json', res);
