// A first open with no cache on a slow network (apps/leftovers.html:120-131 form is live at first paint; form.onsubmit is
// only set after `await hub.ready()` at :172/:289; hub.ready waits up to 6 s for the first pull, apps/hub.js:334-337).
// GET /api/data/leftovers is delayed by DELAY ms for this device only (shell and app share it).
//   Arm A (tap early): type "Early soup" 1.5 s after the frame loads and tap Log -> does the frame reload, is the name lost?
//   Arm B (stall): no typing; what does the list say at 7 s (after ready gave up, before the pull lands) and at DELAY+2 s?
import { local, cards, serverItems, save, shot, sleep } from './_lib.mjs';
const DELAY = 9000;
const L = await local({ variant: 'typical', clock: 'demo' });
const out = {};
async function slowDevice() {
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli' });
  await d.ctx.route(u => u.pathname.startsWith('/api/data/leftovers') , async r => { if (r.request().method() === 'GET') await sleep(DELAY); await r.continue().catch(() => {}); });
  return d;
}
try {
  // A
  {
    const d = await slowDevice();
    const navs = [];
    d.page.on('framenavigated', fr => { if (fr.url().includes('leftovers.html')) navs.push(fr.url().replace(/^.*\/apps\//, 'apps/')); });
    const f = await d.openApp('leftovers');
    await sleep(1500);
    const pre = await f.evaluate(() => ({ tally: tally.textContent, logText: document.querySelector('.log').textContent, sizeOptions: document.getElementById('size').options.length, ready: !!window.__larder }));
    await f.fill('#name', 'Early soup');
    const s0 = await shot(d.page, 'before-ready-A-typed-iphone.png');
    await f.click('.log');
    await sleep(800);
    const fr = d.frame('leftovers');
    const after = await fr.evaluate(() => ({ url: location.href.replace(/^.*\/apps\//, 'apps/'), name: document.getElementById('name') && document.getElementById('name').value })).catch(e => ({ err: String(e) }));
    await sleep(DELAY + 2000);
    const landed = (await serverItems(L)).some(i => i.name === 'Early soup');
    out.A = { stateBeforeReady: pre, navigations: navs, afterTap: after, landedOnServer: landed, shotTyped: s0 };
    console.log('A tap Log before ready:', JSON.stringify(out.A));
    await d.close();
  }
  // B
  {
    await L.reset('typical');
    const d = await slowDevice();
    const f = await d.openApp('leftovers');
    await sleep(7000);
    const at7 = await f.evaluate(() => ({ tally: tally.textContent, empty: !!document.querySelector('.empty'), mode: document.getElementById('mode').hidden ? null : document.getElementById('mode').textContent, cards: document.querySelectorAll('.item').length }));
    const s1 = await shot(d.page, 'before-ready-B-stalled-7s-iphone.png');
    await sleep(DELAY - 7000 + 2500);
    const later = await f.evaluate(() => ({ tally: tally.textContent, cards: document.querySelectorAll('.item').length, mode: document.getElementById('mode').hidden ? null : document.getElementById('mode').textContent }));
    out.B = { at7s: at7, afterPull: later, shotStalled: s1, serverHas: (await serverItems(L)).length };
    console.log('B stall:', JSON.stringify(out.B));
    await d.close();
  }
  console.log('saved', save('before-ready.json', out));
} finally { await L.close(); }
