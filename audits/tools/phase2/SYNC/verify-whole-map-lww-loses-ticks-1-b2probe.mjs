// Skeptic #1 probe: in the iPad-reconnects-first offline case, why does the phone keep painting its own (lost) tick?
//   node "audits/tools/phase2/SYNC/verify-whole-map-lww-loses-ticks-1-b2probe.mjs"
import { local, sleep } from '../../lib/local.mjs';
const L = await local({ variant: 'typical', clock: 'real' });
try {
  const ph = await L.newDevice({ name: 'Eli phone (probe)', profiles: ['eli'] });
  const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: ph });
  const fi = await ipad.openApp('f260', { wait: '#todayDone' });
  const fp = await phone.openApp('f260', { wait: '#todayDone' });
  await sleep(4000);
  await fp.evaluate(() => { window.__chg = []; hub.onChange(e => window.__chg.push({ key: e.key, bulk: !!e.bulk, t: Date.now() })); });
  const idPhone = await fp.evaluate(() => document.getElementById('todayDone').dataset.target);
  await phone.setOffline(true); await ipad.setOffline(true);
  await fp.click('#todayDone'); await sleep(1100);
  await fi.evaluate(() => document.querySelector('[data-day="38-3"] .mark').click());
  await sleep(500);
  await ipad.setOffline(false); await sleep(2500);
  await phone.setOffline(false); await sleep(4000);
  const probe = await fp.evaluate(id => ({
    store: !!(hub.get('f260.done') || {})[id], ui: document.querySelector('[data-day="' + id + '"]').classList.contains('done'),
    active: document.activeElement && document.activeElement.tagName + '#' + document.activeElement.id,
    modalOrSheet: [...document.querySelectorAll('.modal.on, .sheet.on')].map(e => e.id || e.className),
    changes: window.__chg }), idPhone);
  const shellFlushed = await phone.page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('hub.queue.')).map(k => k + '=' + localStorage.getItem(k)));
  console.log('phone frame after reconnect:', JSON.stringify(probe));
  console.log('queues:', JSON.stringify(shellFlushed));
} finally { await L.close(); }
