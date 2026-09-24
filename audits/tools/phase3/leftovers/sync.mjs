// Two devices on the family list: the Kitchen iPad (Eli, Larder open) and Mae's phone (her own paired device).
//   1 Mae logs "Chicken soup" online -> how long until the open iPad shows it (no reload)?
//   2 Mae goes offline, logs "Offline chili" and finishes "Sunday pot roast": what her card shows (pending marker?), the
//     status line; back online -> both reach the server and the iPad.
import { local, openLarder, cards, serverItems, save, shot, sleep } from './_lib.mjs';
const L = await local({ variant: 'typical', clock: 'demo' });
const out = {};
try {
  const ph = await L.newDevice({ name: 'Mae phone', profiles: ['christian'] });
  const phone = await L.device({ device: 'iphone-pwa', profile: 'christian', fixedTime: false, as: ph });
  const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  const fi = await openLarder(ipad), fp = await openLarder(phone);
  await fp.fill('#name', 'Chicken soup'); await fp.click('.log');
  const t0 = Date.now(); let seen = null;
  while (Date.now() - t0 < 45000) { if ((await cards(fi)).some(c => c.name === 'Chicken soup')) { seen = Date.now() - t0; break; } await sleep(250); }
  out.onlineLatencyMs = seen;
  console.log('1 iPad shows Mae\'s item after', seen, 'ms (no reload)');
  await phone.setOffline(true);
  await fp.fill('#name', 'Offline chili'); await fp.click('.log');
  await fp.click('.item:has(.nm:text-is("Sunday pot roast")) .done');
  await sleep(1000);
  const offCard = await fp.evaluate(() => { const c = [...document.querySelectorAll('.item')].find(c => c.querySelector('.nm').textContent === 'Offline chili'); return c && { html: c.className + ' | ' + c.textContent.replace(/\s+/g, ' ').trim(), pendingMarker: !!c.querySelector('[class*=pend], [class*=queue]') }; });
  const mode = await fp.evaluate(() => { const m = document.getElementById('mode'); return m.hidden ? null : { text: m.textContent, fontPx: getComputedStyle(m).fontSize }; });
  out.offline = { card: offCard, mode, queue: (await phone.hub(fp)).queue, shot: await shot(phone.page, 'sync-offline-queued-iphone.png') };
  console.log('2 offline card:', JSON.stringify(offCard), '\n  status line:', JSON.stringify(mode));
  await phone.setOffline(false);
  const t1 = Date.now(); let both = null;
  while (Date.now() - t1 < 45000) { const c = (await cards(fi)).map(c => c.name); if (c.includes('Offline chili') && !c.includes('Sunday pot roast')) { both = Date.now() - t1; break; } await sleep(250); }
  out.afterReconnect = { iPadConvergedMs: both, server: (await serverItems(L)).map(i => i.name) };
  console.log('  back online: iPad converged after', both, 'ms; server:', JSON.stringify(out.afterReconnect.server));
  console.log('saved', save('sync.json', out));
} finally { await L.close(); }
