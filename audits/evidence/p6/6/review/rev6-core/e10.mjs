// E10: Reset on Home, then a Switch to a kid (opens on tap) within the 6 s, then Undo on the toast still showing.
import { local, sleep } from 'file:///C:/Users/ex_bo/OneDrive/Claude%20Related/App%20Hub/audits/tools/lib/local.mjs';
const L = await local({ variant: 'typical', clock: 'real', engine: 'chromium' });
const rows = async pid => (((await L.apiAs(pid, `/api/data/timer?scope=person`)).body.items) || []).filter(i => /^timer:/.test(i.key) && i.value).map(i => i.key + ' ' + i.value.label);
const mir = async () => (((await L.apiAs('eli', '/api/data/timer?scope=family')).body.items) || []).filter(i => i.value).map(i => i.key + ' ' + i.value.label);
try {
  await L.reset('typical');
  const d = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  await d.goto('#home'); const p = d.page;
  await p.waitForFunction(() => window.hub && hub.sync.lastPull > 0 && hub.isLoaded('timer', 'person'), null, { timeout: 30000 });
  const r = await p.evaluate(async () => { const r = hub.timers.start({ total: 600000, label: 'Roast' }); await hub.flush(); return r; });
  await p.waitForSelector(`[data-timer-act="reset"][data-id="${r.id}"]`, { timeout: 15000 });
  await p.click(`[data-timer-act="reset"][data-id="${r.id}"]`); const t0 = Date.now();
  await p.click('.tab[data-tab=me]'); await p.click('#switch');
  await p.waitForSelector('.pcard[data-id=ezra]'); await p.click('.pcard[data-id=ezra]');
  await p.waitForFunction(() => window.hub && hub.profile && hub.profile.id === 'ezra', null, { timeout: 15000 });
  const toast = await p.evaluate(() => { const t = document.getElementById('hub-toast'); return t && !t.hidden ? t.textContent : null; });
  console.log(`${Date.now() - t0} ms after Reset, signed in as ${await p.evaluate(() => hub.profile.id)}; toast: ${JSON.stringify(toast)}`);
  if (toast) { await p.click('#hub-toast .toast-act'); await sleep(300); await p.evaluate(() => hub.flush()); await sleep(1500); }
  console.log('ezra timer rows on the house:', JSON.stringify(await rows('ezra')));
  console.log('eli timer rows on the house:', JSON.stringify(await rows('eli')));
  console.log('family mirrors:', JSON.stringify(await mir()));
} catch (e) { console.error(e); } finally { await L.close(); }
