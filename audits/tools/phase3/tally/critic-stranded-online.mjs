// Completeness critic, companion to critic-stranded.mjs: ONLINE on a slow link. Each POST /api/data/tally/batch is
// delayed 1.5 s before it reaches the server (a slow uplink). Eli taps + 3 times and taps the viewer's Hub button
// 0.4 s after the last tap. closeViewer sets the frame to about:blank 220 ms later (index.html:729-734), which cancels
// the frame's in-flight flush; the shell's own flush has no tally channel. Control: Hub tapped 3 s after the last tap.
// Run: node "audits/tools/phase3/tally/critic-stranded-online.mjs"  -> audits/evidence/p3/tally/critic-stranded-online.json
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p3/tally';
const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
const res = {};
const server = async () => { const r = await L.apiAs('eli', '/api/data/tally?scope=person'); const it = (r.body.items || []).find(i => i.key === 'count'); return it ? it.value : null; };
try {
  for (const [key, wait] of [['quick', 400], ['control', 3000]]) {
    const phDev = await L.newDevice({ name: 'Eli phone ' + key, profiles: ['eli'] });
    const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: phDev });
    const f = await d.openApp('tally'); await f.waitForFunction(() => document.getElementById('who').textContent.trim().length > 0, null, { timeout: 9000 }); await sleep(1500);
    let posts = 0, delivered = 0;
    await d.ctx.route(u => u.href.includes('/api/data/tally/batch'), async r => { posts++; await sleep(1500); try { await r.continue(); delivered++; } catch {} });
    const start = await server();
    for (let i = 0; i < 3; i++) { await f.locator('#plus').click(); await sleep(120); }
    await sleep(wait);
    await d.page.click('#pill-home');
    await sleep(35000);
    res[key] = { start, posts, deliveredToServer: delivered, server35sAfterClose: await server(), expected: start + 3, shellSync: await d.page.evaluate(() => ({ ...hub.sync })),
      tallyQueueLeft: await d.page.evaluate(() => localStorage.getItem('hub.queue.tally.person.eli')) };
    console.log(key, JSON.stringify(res[key]));
    await d.close(); await L.reset('typical');
  }
} finally {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(OUT + '/critic-stranded-online.json', JSON.stringify(res, null, 2));
  await L.close();
}
