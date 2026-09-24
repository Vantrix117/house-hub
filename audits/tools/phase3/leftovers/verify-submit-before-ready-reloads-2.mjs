// Skeptic #2 for finding "submit-before-ready-reloads" (Larder): does tapping Log (or pressing Enter) before
// `await hub.ready()` (apps/leftovers.html:172) has run and wired form.onsubmit (:289) natively submit the form,
// reload the frame and lose the typed name? And is the window real only on a cold device (no leftovers cache)?
// Slow network = every GET /api/data/* delayed DELAY ms on that context (shell + app share it).
//   A  cold device, tap Log 1.5 s after the frame loads (touch tap)
//   B  cold device, press Enter in the name field 1.5 s after load
//   C  control: warm device (Home already pulled the leftovers scope), then the slow network, tap Log at 1.5 s
// Run: node "audits/tools/phase3/leftovers/verify-submit-before-ready-reloads-2.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';

const EVID = path.resolve('audits/evidence/p3/leftovers');
fs.mkdirSync(EVID, { recursive: true });
const PFX = 'verify-submit-before-ready-reloads-2';
const DELAY = 8000;
const out = { delayMs: DELAY };
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });

async function serverNames() {
  const r = await L.apiAs('eli', '/api/data/leftovers?scope=family');
  const rows = r.body.items || r.body.rows || r.body.data || [];
  return rows.filter(x => x.value).map(x => x.value.name);
}
const slow = d => d.ctx.route(u => u.pathname.startsWith('/api/data/'), async r => {
  if (r.request().method() === 'GET') await sleep(DELAY);
  await r.continue().catch(() => {});
});

async function arm(label, { warm, action, name }) {
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli' });
  const navs = [];
  d.page.on('framenavigated', fr => { if (fr.url().includes('leftovers.html')) navs.push(fr.url().replace(/^.*\/apps\//, 'apps/')); });
  if (warm) {
    await d.goto('#home');
    await d.page.waitForFunction(() => window.hub && hub.sync.lastPull, null, { timeout: 15000 });
    await sleep(500);
    out[label + '_cacheSince'] = await d.page.evaluate(() => Object.keys(localStorage).filter(k => /leftovers/.test(k)).map(k => { try { return [k, JSON.parse(localStorage.getItem(k)).since]; } catch { return [k, '?']; } }));
  }
  await slow(d);
  const t0 = Date.now();
  const f = await d.openApp('leftovers');
  await sleep(1500);
  const pre = await f.evaluate(() => ({
    onsubmitWired: !!document.getElementById('add').onsubmit,
    logText: document.querySelector('#add .log').textContent,
    logRect: (r => ({ w: Math.round(r.width), h: Math.round(r.height) }))(document.querySelector('#add .log').getBoundingClientRect()),
    sizeOptions: document.getElementById('size').options.length,
    date: document.getElementById('date').value,
    formAction: document.getElementById('add').getAttribute('action'),
    inputNamed: !!document.getElementById('name').name,
  }));
  pre.msSinceOpen = Date.now() - t0;
  await f.fill('#name', name);
  if (action === 'tap') await f.tap('#add .log');
  else await f.press('#name', 'Enter');
  await sleep(900);
  const fr = d.frame('leftovers');
  const after = fr ? await fr.evaluate(() => ({ url: location.href.replace(/^.*\/apps\//, 'apps/'), name: document.getElementById('name').value })).catch(e => ({ err: String(e).slice(0, 200) })) : { err: 'no frame' };
  let shotPath = null;
  if (label === 'A') { shotPath = `audits/evidence/p3/leftovers/${PFX}-A-after-tap-iphone.png`; await d.page.screenshot({ path: path.resolve(shotPath), scale: 'css', animations: 'disabled', caret: 'hide' }); }
  // wait for the delayed pulls, then ask the server and the queue
  await sleep(DELAY + 3000);
  const queued = await d.page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('hub.queue.')).map(k => localStorage.getItem(k)).join(' ')).catch(() => '');
  const res = { preTap: pre, navigations: navs, afterTap: after, landedOnServer: (await serverNames()).includes(name), inLocalQueue: queued.includes(name), shot: shotPath };
  out[label] = res;
  console.log(label, JSON.stringify(res));
  await d.close();
}

try {
  await arm('A', { warm: false, action: 'tap', name: 'Early soup A' });
  await arm('B', { warm: false, action: 'enter', name: 'Early soup B' });
  await arm('C', { warm: true, action: 'tap', name: 'Warm soup C' });
  const f = path.join(EVID, PFX + '.json');
  fs.writeFileSync(f, JSON.stringify(out, null, 1));
  console.log('saved', path.relative(process.cwd(), f));
} finally { await L.close(); }
