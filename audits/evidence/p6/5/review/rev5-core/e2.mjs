// rev5-core: E3b kitchen write; E4 private F260 paste in the editor; E7 the new family channel never pulled + offline.
import { local, sleep } from 'file:///C:/Users/ex_bo/OneDrive/Claude%20Related/App%20Hub/audits/tools/lib/local.mjs';
const L = await local({ variant: 'empty', clock: 'real' });
const put = (who, app, key, value, scope = 'person', updated_at = Date.now()) => L.apiAs(who, `/api/data/${app}/${encodeURIComponent(key)}?scope=${scope}`, { method: 'PUT', body: { value, updated_at } });
const out = {};
try {
  // E3b: the kitchen device
  const kd = await L.newDevice({ name: 'Kitchen iPad', profiles: ['kitchen'] });
  const role = await L.apiAs('eli', `/api/admin/devices/${kd.device.id}/role`, { method: 'PUT', body: { role: 'kitchen' } });
  out.e3_role = role.status + ' ' + JSON.stringify(role.body).slice(0, 80);
  const tv = { text: 'PLACEHOLDER', by: 'kitchen', at: Date.now() };
  const kw = await L.apiAs(null, '/api/data/verses/text:1-0?scope=family', { method: 'PUT', body: { value: tv, updated_at: Date.now() }, deviceToken: kd.device.token, profileToken: kd.sessions.kitchen });
  out.e3_kitchen_write = kw.status + ' ' + JSON.stringify(kw.body).slice(0, 120);
  const kr = await L.apiAs(null, '/api/data/verses?scope=family', { deviceToken: kd.device.token, profileToken: kd.sessions.kitchen });
  out.e3_kitchen_read = kr.status;

  // E4: Mae has her own F260 paste for 2-0, the house has none
  await put('christian', 'f260', 'mem:2-0', true);
  await put('christian', 'f260', 'f260.verses', { '2-0': 'MAE PRIVATE PASTE' });
  const M = await L.device({ device: 'iphone-pwa', profile: 'christian', fixedTime: false });
  await M.page.goto(L.site + '/apps/verses.html');
  await M.page.waitForFunction(() => window.verses && hub.isLoaded() && hub.isLoaded('f260', 'person') && verses.current() === '2-0', null, { timeout: 20000 });
  out.e4_beforeShow = await M.page.evaluate(() => ({ add: !document.querySelector('#addtext').hidden, edit: !document.querySelector('#edittext').hidden }));
  await M.page.click('#show');
  out.e4_afterShow = await M.page.evaluate(() => ({ add: !document.querySelector('#addtext').hidden, edit: !document.querySelector('#edittext').hidden, editLabel: document.querySelector('#edittext').textContent.trim() }));
  await M.page.click('#edittext');
  out.e4_editor = await M.page.evaluate(() => ({ value: document.querySelector('#text-input').value, note: document.querySelector('#text-note').textContent, clear: !document.querySelector('#text-clear').hidden }));
  await M.page.focus('#text-input'); await M.page.keyboard.press('Enter');
  await sleep(1500);
  const fam = await L.apiAs('niece', '/api/data/verses?scope=family');
  out.e4_familyRows = (fam.body.items || []).filter(i => i.value).map(i => [i.key, i.value.text]);
  await M.close();

  // E7: Eli's device has opened Verses before (person + f260 cached) but never the new family channel; offline
  await put('eli', 'f260', 'mem:1-0', true);
  const A = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
  await A.page.goto(L.site + '/apps/verses.html');
  await A.page.waitForFunction(() => window.verses && hub.isLoaded() && verses.current() === '1-0', null, { timeout: 20000 });
  await A.page.evaluate(() => { for (const k of Object.keys(localStorage)) if (/^hub\.cache\.verses\.family/.test(k)) localStorage.removeItem(k); });
  await A.setOffline(true);
  await A.page.reload({ waitUntil: 'load' });
  await sleep(2500);
  out.e7 = await A.page.evaluate(() => ({ loaded: hub.isLoaded(), personLoaded: hub.isLoaded('verses', 'person'), cur: verses.current(), rate: verses.rate('got'), hint: document.querySelector('#hint').textContent, who: document.querySelector('#who').textContent, busy: document.querySelector('#trainer').getAttribute('aria-busy'), queue: Object.keys(localStorage).filter(k => k.startsWith('hub.queue.')) }));
  await A.setOffline(false);
  await sleep(4000);
  out.e7_online = await A.page.evaluate(() => ({ loaded: hub.isLoaded(), cur: verses.current(), busy: document.querySelector('#trainer').getAttribute('aria-busy') }));
  await A.close();
} catch (e) { console.error(e); }
console.log(JSON.stringify(out, null, 1));
await L.close();
