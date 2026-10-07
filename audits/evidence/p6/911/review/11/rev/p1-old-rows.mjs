// Reviewer probe 1: a 0f-era device row with a NEGATIVE net (that device pressed - more than +) is legitimate data.
// Pre-batch code summed it (A +10, B -3 -> 7). Does batch 11 still read 7 (app, Home card, chat get_data)?
import { local, sleep } from '../../hub-audit/audits/tools/lib/local.mjs';
import { toolCall } from '../../hub-audit/audits/tools/phase2/CHAT/lib.mjs';
const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
const put = (key, value) => L.apiAs('eli', `/api/data/tally/${encodeURIComponent(key)}?scope=person`, { method: 'PUT', body: { value, updated_at: Date.now() } });
try {
  // wipe what the seed has
  const cur = await L.apiAs('eli', '/api/data/tally?scope=person');
  for (const it of (cur.body.items || [])) await L.apiAs('eli', `/api/data/tally/${encodeURIComponent(it.key)}?scope=person`, { method: 'DELETE' });
  console.log('seed rows before:', JSON.stringify(cur.body.items || []).slice(0, 300));
  // exactly what the pre-batch (0f) app wrote: count:<device> = { n: mine() + d, epoch }
  console.log(await put('reset', { epoch: 'e0f', at: Date.now() - 60000 }).then(r => r.status));
  console.log(await put('count:devA', { n: 10, epoch: 'e0f' }).then(r => r.status));
  console.log(await put('count:devB', { n: -3, epoch: 'e0f' }).then(r => r.status));
  console.log('pre-batch formula: 10 + (-3) = 7');
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
  const f = await d.openApp('tally', { wait: '#plus' });
  await f.waitForFunction(() => !document.getElementById('n').classList.contains('skeleton'), null, { timeout: 15000 });
  await sleep(800);
  console.log('Tally app shows:', await f.evaluate(() => document.getElementById('n').textContent));
  await d.goto('#home'); await sleep(2500);
  console.log('Home card shows:', await d.page.evaluate(() => { const e = document.querySelector('#home-tally [data-tally-n]'); return e && e.textContent; }));
  const g = await toolCall(L, 'eli', 'get_data', { app_id: 'tally', scope: 'person', key: 'count' }, { message: 'what is my tally' });
  console.log('chat get_data result:', JSON.stringify(g.toolResult || g).slice(0, 300));
  // now device A (this phone, a NEW device id) taps + once: the real count should become 8
  const f2 = await d.openApp('tally', { wait: '#plus' }); await sleep(1500);
  await f2.locator('#plus').click(); await sleep(1500);
  console.log('after one + :', await f2.evaluate(() => document.getElementById('n').textContent), '(pre-batch would read 8)');
} finally { await L.close(); }
