// Skeptic #1: does F260's Unlock dialog say "encrypted on this iPad" on an iPhone and on desktop?
// Fresh local rig; on each device: open F260, Journal tab -> set a throwaway passcode, Lock, Journal tab again -> read #passText.
//   node "audits/tools/phase3/f260/verify-vis-unlock-dialog-says-encrypted-on-this-ipad-on-an--1-1.mjs"
import { local, sleep, save, shot, ready } from './_lib.mjs';

const PASS = '8642';   // throwaway, local demo database only
const NAME = 'verify-vis-unlock-dialog-says-encrypted-on-this-ipad-on-an--1-1';
const out = {};
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const dlg = f => f.evaluate(() => ({ on: document.getElementById('pass').classList.contains('on'), title: document.getElementById('passTitle').textContent, text: document.getElementById('passText').textContent, ua: navigator.userAgent, w: innerWidth }));
async function run(device, profile, asDev) {
  const d = await L.device({ device, profile, fixedTime: false, ...(asDev ? { as: asDev } : {}) });
  const f = await d.openApp('f260'); await ready(f);
  const tap = sel => device.startsWith('desktop') ? f.locator(sel).click() : f.locator(sel).tap();
  await tap('#tabJournal'); await f.waitForSelector('#pass.on', { timeout: 6000 }); await sleep(150);
  const first = await dlg(f);
  if (first.title.startsWith('Set')) {
    await f.fill('#pass1', PASS); await f.fill('#pass2', PASS); await tap('#passOk');
    await f.waitForFunction(() => !document.getElementById('pass').classList.contains('on'), null, { timeout: 10000 }); await sleep(300);
  }
  await f.evaluate(() => document.getElementById('jLock').click()); await sleep(400);   // Journal view's Lock button
  await tap('#tabPlan'); await sleep(200);
  await tap('#tabJournal'); await f.waitForSelector('#pass.on', { timeout: 6000 }); await sleep(250);
  const unlock = await dlg(f);
  const png = await shot(d.page, `${NAME}-${device}.png`);
  await f.locator('#passCancel').click();
  return { firstDialog: { title: first.title }, unlockDialog: unlock, png };
}
try {
  const ph = await L.newDevice({ name: 'Eli phone', profiles: ['eli'] });
  out.iphone = await run('iphone-pwa', 'eli', ph);
  const pc = await L.newDevice({ name: 'Mae desktop', profiles: ['christian'] });
  out.desktop = await run('desktop', 'christian', pc);
  for (const k of ['iphone', 'desktop']) console.log(k, '| title:', out[k].unlockDialog.title, '| text:', out[k].unlockDialog.text, '| width:', out[k].unlockDialog.w, '| UA:', out[k].unlockDialog.ua.slice(0, 90), '|', out[k].png);
  save(`${NAME}.json`, out);
} finally { await L.close(); }
