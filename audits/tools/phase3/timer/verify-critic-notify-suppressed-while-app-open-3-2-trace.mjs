// Debug trace for verify-critic-notify-suppressed-while-app-open-3-2 (why one 62 s runFor with no real-time yield left the app reset to 1:00 — a rig artefact; the main script steps 1 s at a time): steps a 1-min timer (desktop, Chromium, app open,
// visible) in 5 s chunks and prints the app's time and timer.active as the shell and the app see it.
// Run: node "audits/tools/phase3/timer/verify-critic-notify-suppressed-while-app-open-3-2-trace.mjs"
import { local, sleep } from '../../lib/local.mjs';
import { audioProbe, notifyProbe } from './_util.mjs';
const L = await local({ variant: 'typical', clock: 'real', engine: 'chromium' });
try {
  for (const dev of ['desktop', 'iphone-pwa']) {
    const d = await L.device({ device: dev, profile: 'eli', installClock: Date.now() });
    await audioProbe(d.ctx); await notifyProbe(d.ctx);
    await d.goto('#home'); await d.page.waitForFunction(() => window.hub && hub.profile); await d.ctx.clock.runFor(800);
    await d.page.click('.tab[data-tab="apps"]'); await d.page.click('.tile[data-id="timer"]');
    let f; for (let i = 0; i < 60 && !(f = d.frame('timer')); i++) await sleep(100);
    await f.waitForFunction(() => window.hub && document.getElementById('go') && window.__audio);
    await d.ctx.clock.runFor(700);
    await f.evaluate(() => { window.__ch = []; hub.onChange(c => window.__ch.push({ at: Date.now(), app: c.app, keys: JSON.stringify(c).slice(0, 200), active: hub.get('timer.active') })); });
    await f.click('[data-s="60"]'); await f.click('#go');
    for (let s = 0; s <= 65; s += 5) {
      const st = await f.evaluate(() => ({ t: document.getElementById('t').textContent, done: document.body.classList.contains('done'), active: hub.get('timer.active'), now: Date.now(), ch: window.__ch.length }));
      const sh = await d.page.evaluate(() => ({ active: hub.get('timer.active', { app: 'timer', scope: 'person' }), sync: hub.sync && hub.sync.state }));
      console.log(dev, 's+' + s, JSON.stringify(st), 'shell', JSON.stringify(sh));
      await d.ctx.clock.runFor(5000); await sleep(300);
    }
    console.log(dev, 'changes', JSON.stringify(await f.evaluate(() => window.__ch)).slice(0, 1500));
    await d.close();
    await L.apiAs('eli', '/api/data/timer/batch?scope=person', { method: 'POST', body: { items: [{ key: 'timer.active', value: null, updated_at: Date.now() + 1 }] } });
  }
} finally { await L.close(); }
