// KV: Done ★ on a first open whose first pull is slow or fails overwrites the kid's whole stars row (person + family mirror).
//   node "audits/tools/phase3/kidverse/award-first-pull.mjs"            all three scenarios (about 2 min)
//   node "audits/tools/phase3/kidverse/award-first-pull.mjs" hold|fail|control
// hold:    a new phone paired with Ezra (no cache) deep-links #kidverse; every GET /api/data/* is held 10 s. At ~7 s (after
//          hub.ready's 6 s race, apps/hub.js:334-337) Ezra taps Done ★. Then the hold is released.
// fail:    the same phone, but every GET /api/data/* answers 503 for the first 8 s (one failed pull; hub.ready resolves at once).
// control: no hold; Ezra taps Done ★ once the first pull has landed.
// Then a second device (the rig's Kitchen iPad, Ezra) opens Kid Verse and we read what it shows.
// Prints the server's stars row (person) and mirror (family stars:ezra) before and after, and the phone's toasts.
import { local, sleep, log, stars, saveJson, shot, ui, pulled, flushed } from './_kv.mjs';

async function run(name) {
  const L = await local({ variant: 'typical', clock: 'real' });
  const out = { name };
  try {
    out.before = await stars(L, 'ezra');
    const ph = await L.newDevice({ name: 'Ezra new phone ' + name, profiles: ['ezra'] });
    const phone = await L.device({ device: 'iphone-pwa', profile: 'ezra', fixedTime: false, as: ph });
    let mode = name; const t0 = Date.now();
    await phone.ctx.route(/\/api\/data\/[^/?]+\?/, async route => {
      if (route.request().method() === 'GET') {
        if (mode === 'hold') await sleep(10000);
        else if (mode === 'fail' && Date.now() - t0 < 8000) return route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"unavailable"}' });
      }
      route.continue().catch(() => {});
    });
    const posts = [];
    phone.page.on('request', r => {
      if (r.method() === 'POST' && /\/api\/data\/kidverse\/batch/.test(r.url())) {
        try { const b = JSON.parse(r.postData()); posts.push({ ms: Date.now() - t0, items: b.items.map(i => i.key + (i.value && typeof i.value === 'object' && 'total' in i.value ? ` (total ${i.value.total}, earned ${i.value.earned}, badges ${Object.keys(i.value.badges || {}).length}, applied ${Object.keys(i.value.applied || {}).length})` : '')) }); } catch {}
      }
    });
    const f = await phone.openApp('kidverse', { wait: '#done:not([hidden])' });
    if (name === 'hold') await sleep(Math.max(0, 7000 - (Date.now() - t0)));
    else if (name === 'fail') await sleep(1500);
    else { await pulled(f); await sleep(1200); }
    out.atTap = { ms: Date.now() - t0, lastPull: await f.evaluate(() => hub.sync.lastPull), state: await f.evaluate(() => hub.sync.state), ui: await ui(f) };
    await f.evaluate(() => { window.__toasts = []; const o = hub.toast; hub.toast = (m, ms) => { window.__toasts.push(String(m)); return o.call(hub, m, ms); }; });
    await f.click('#done');
    out.tapMs = Date.now() - t0;
    await sleep(600);
    out.shotAfterTap = await shot(phone.page, `award-first-pull-${name}-phone-after-tap.png`);
    mode = 'none';                                     // release (a held request finishes its 10 s)
    await sleep(name === 'hold' ? 11000 : 9000);
    await flushed(f, 8000);
    out.phoneAfter = await ui(f);
    out.phoneToasts = await f.evaluate(() => window.__toasts);
    out.posts = posts;
    out.after = await stars(L, 'ezra');
    await phone.close();
    // a second device: the rig's Kitchen iPad as Ezra
    const ipad = await L.device({ device: 'ipad-portrait', profile: 'ezra', fixedTime: false });
    const g = await ipad.openApp('kidverse', { wait: '#done:not([hidden])' });
    await pulled(g); await sleep(1500);
    out.ipad = await ui(g);
    await g.evaluate(() => document.querySelector('#rewards').scrollIntoView());
    out.shotIpad = await shot(ipad.page, `award-first-pull-${name}-ipad-after.png`);
    out.afterIpad = await stars(L, 'ezra');
  } finally { await L.close(); }
  log(`[${name}] before  ${JSON.stringify(out.before.person)}`);
  log(`[${name}] at tap  ${JSON.stringify({ ms: out.atTap.ms, lastPull: out.atTap.lastPull, state: out.atTap.state, starCount: out.atTap.ui.starCount, mineSub: out.atTap.ui.mineSub, who: out.atTap.ui.who, rwTotal: out.atTap.ui.rwTotal, rwEarned: out.atTap.ui.rwEarned })}`);
  log(`[${name}] POSTs   ${JSON.stringify(out.posts)}`);
  log(`[${name}] toasts  ${JSON.stringify(out.phoneToasts)}`);
  log(`[${name}] after   person ${JSON.stringify(out.after.person)}`);
  log(`[${name}] after   mirror ${JSON.stringify(out.after.mirror)}`);
  log(`[${name}] iPad    ${JSON.stringify({ starCount: out.ipad.starCount, mineSub: out.ipad.mineSub, rwTotal: out.ipad.rwTotal, rwEarned: out.ipad.rwEarned, badgesOn: out.ipad.badgesOn, paid: out.ipad.paid })}`);
  return out;
}

const which = process.argv[2] ? [process.argv[2]] : ['hold', 'fail', 'control'];
const res = {};
for (const w of which) res[w] = await run(w);
saveJson('award-first-pull' + (process.argv[2] ? '-' + process.argv[2] : '') + '.json', res);
