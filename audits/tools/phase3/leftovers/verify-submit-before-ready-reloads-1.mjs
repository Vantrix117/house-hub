// Skeptic #1 for finding "submit-before-ready-reloads" (Larder). Independent re-run.
// Claim: the #add form is live from first paint (apps/leftovers.html:119-130) but form.onsubmit is only assigned after
// `await hub.ready()` (:172 -> :289); on a device with no leftovers cache hub.ready waits up to 6 s for the first pull
// (apps/hub.js:334-335), and a tap on Log / Enter in the name field in that window natively GET-submits the form.
// Arms (GET /api/data/leftovers* delayed DELAY ms for the whole browser context = shell + app, as on a slow link):
//   A  cold device, tap Log 1.5 s after the frame loads           A2  same, press Enter in the name field
//   W  warm device (the shell has already pulled leftovers once on normal network), then the slow link: tap Log at 1.5 s
//   N  cold device, normal network: how long until form.onsubmit is set (size of the window without a slow link)
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';
const EVID = path.resolve('audits/evidence/p3/leftovers'); fs.mkdirSync(EVID, { recursive: true });
const PFX = 'verify-submit-before-ready-reloads-1';
const DELAY = 9000;
const L = await local({ variant: 'typical', clock: 'demo' });
const out = {};
const slow = async d => d.ctx.route(u => u.pathname.startsWith('/api/data/leftovers'), async r => { if (r.request().method() === 'GET') await sleep(DELAY); await r.continue().catch(() => {}); });
const server = async name => { const r = await L.apiAs('eli', '/api/data/leftovers?scope=family'); const rows = r.body.items || r.body.rows || []; return rows.some(x => x.value && x.value.name === name); };
const probe = f => f.evaluate(() => ({ onsubmitSet: typeof document.getElementById('add').onsubmit === 'function', logText: document.querySelector('.log').textContent, sizeOptions: document.getElementById('size').options.length, date: document.getElementById('date').value, ready: !!window.__larder, url: location.href.replace(/^.*\/apps\//, 'apps/') }));
async function tapArm(label, d, how, name) {
  const navs = [];
  d.page.on('framenavigated', fr => { if (fr.url().includes('leftovers.html')) navs.push(fr.url().replace(/^.*\/apps\//, 'apps/')); });
  const f = await d.openApp('leftovers');
  const t0 = Date.now();
  await sleep(1500);
  const pre = await probe(f);
  await f.fill('#name', name);
  if (label === 'A') await d.page.screenshot({ path: path.join(EVID, PFX + '-A-typed-iphone.png'), scale: 'css', animations: 'disabled', caret: 'hide' });
  if (how === 'click') await f.click('.log'); else await f.press('#name', 'Enter');
  const tapAtMs = Date.now() - t0;
  await sleep(1000);
  const fr = d.frame('leftovers');
  const after = fr ? await fr.evaluate(() => ({ url: location.href.replace(/^.*\/apps\//, 'apps/'), name: document.getElementById('name').value, localRow: (window.hub && hub.list('item:').some(r => r.value && r.value.name === document.getElementById('name').dataset.x)) })).catch(e => ({ err: String(e).slice(0, 200) })) : { err: 'no frame' };
  const localHasItem = fr ? await fr.evaluate(n => { try { return Object.keys(localStorage).filter(k => k.includes('leftovers')).some(k => (localStorage.getItem(k) || '').includes(n)); } catch { return null; } }, name).catch(() => null) : null;
  await sleep(DELAY + 3000);
  const r = { stateAtTap: pre, tapAtMs, navigations: navs, afterTap: { url: after.url, name: after.name, err: after.err }, itemInLocalStorage: localHasItem, landedOnServer: await server(name) };
  console.log(label, JSON.stringify(r));
  return r;
}
try {
  { const d = await L.device({ device: 'iphone-pwa', profile: 'eli' }); await slow(d); out.A = await tapArm('A', d, 'click', 'Early soup'); await d.close(); }
  { await L.reset('typical'); const d = await L.device({ device: 'iphone-pwa', profile: 'eli' }); await slow(d); out.A2 = await tapArm('A2', d, 'enter', 'Enter soup'); await d.close(); }
  { await L.reset('typical');
    const d = await L.device({ device: 'iphone-pwa', profile: 'eli' });
    await d.goto('#home'); await sleep(4000);
    const warm = await d.page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('hub.cache.') && k.includes('leftovers')).map(k => [k, JSON.parse(localStorage.getItem(k)).since]));
    await slow(d);
    out.W = { warmCache: warm, ...(await tapArm('W', d, 'click', 'Warm soup')) }; await d.close(); }
  { await L.reset('typical');
    const d = await L.device({ device: 'iphone-pwa', profile: 'eli' });
    await d.page.goto(L.site + '/index.html#leftovers', { waitUntil: 'commit' });
    const t0 = Date.now(); let fr = null, tFrame = null, tSubmit = null;
    while (Date.now() - t0 < 15000 && tSubmit == null) {
      fr = d.frame('leftovers');
      if (fr) { if (tFrame == null) tFrame = Date.now() - t0; const s = await fr.evaluate(() => !!document.getElementById('add') && typeof document.getElementById('add').onsubmit === 'function').catch(() => false); if (s) tSubmit = Date.now() - t0; }
      await sleep(25);
    }
    out.N = { frameSeenMs: tFrame, onsubmitSetMs: tSubmit, windowMs: tSubmit != null && tFrame != null ? tSubmit - tFrame : null };
    console.log('N', JSON.stringify(out.N)); await d.close(); }
  fs.writeFileSync(path.join(EVID, PFX + '.json'), JSON.stringify(out, null, 1));
  console.log('saved audits/evidence/p3/leftovers/' + PFX + '.json');
} finally { await L.close(); }
