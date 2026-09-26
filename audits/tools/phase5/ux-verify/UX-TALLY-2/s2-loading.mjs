// UX-TALLY-2 skeptic s2: how long are Tally's buttons dead, and is there any busy sign, in three conditions:
//   A first open on a fresh device, tally GET held 9 s (the investigator's case, recomputed)
//   B first open on a fresh device, no hold (a normal network, local)
//   C second open on the same device (tally cache present), tally GET held 9 s
// Polls every 100 ms: #n text, who pill, #plus wired, aria-busy/skeleton/disabled, the shell's sync state.
// Taps + three times while dead (A) and records the queue and the server.
// Run: node "audits/tools/phase5/ux-verify/UX-TALLY-2/s2-loading.mjs" -> audits/evidence/p5/ux-verify/UX-TALLY-2/s2/
import fs from 'node:fs';
import { local, sleep } from '../../../lib/local.mjs';
const OUT = 'audits/evidence/p5/ux-verify/UX-TALLY-2/s2';
fs.mkdirSync(OUT, { recursive: true });
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const res = {};
const server = async () => { const r = await L.apiAs('eli', '/api/data/tally?scope=person'); const it = ((r.body && r.body.items) || []).find(i => i.key === 'count'); return it ? it.value : null; };
const snapFn = () => {
  const p = document.getElementById('plus');
  return { n: document.getElementById('n').textContent, who: document.getElementById('who').textContent, wired: typeof p.onclick === 'function', disabled: p.disabled || p.getAttribute('aria-disabled') === 'true', busy: !!document.querySelector('[aria-busy="true"],.skeleton,.spinner,[role=progressbar]') };
};
async function watch(d, t0, untilMs, tapAt = []) {
  const f = await (async () => { for (let i = 0; i < 200; i++) { const fr = d.frame('tally'); if (fr) return fr; await sleep(50); } })();
  const trace = []; let last = '';
  const taps = [];
  while (Date.now() - t0 < untilMs) {
    const ms = Date.now() - t0;
    let s; try { s = await f.evaluate(snapFn); } catch { s = { err: 'not ready' }; }
    const shell = await d.page.evaluate(() => window.hub && hub.sync ? hub.sync.state : null).catch(() => null);
    const shellBusy = await d.page.evaluate(() => { const v = document.querySelector('.viewer, #viewer, [data-viewer]'); return v ? { busyAttr: v.getAttribute('aria-busy'), cls: v.className.slice(0, 80) } : null; }).catch(() => null);
    const key = JSON.stringify({ ...s, shell });
    if (key !== last) { trace.push({ ms, ...s, shell, shellBusy }); last = key; }
    while (tapAt.length && ms >= tapAt[0]) { tapAt.shift(); await f.locator('#plus').click({ timeout: 2000 }).catch(e => taps.push({ ms, err: String(e).slice(0, 80) })); taps.push({ ms, after: await f.evaluate(snapFn).catch(() => null) }); }
    await sleep(100);
  }
  return { f, trace, taps };
}
try {
  const dev = await L.newDevice({ name: 'New phone', profiles: ['eli'] });
  // A: fresh device, held 9 s
  {
    const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: dev });
    await d.ctx.route(u => u.href.includes('/api/data/tally?'), async r => { await sleep(9000); r.continue().catch(() => {}); });
    const t0 = Date.now();
    d.goto('#tally').catch(() => {});
    await sleep(300);
    const { f, trace, taps } = await watch(d, t0, 11000, [1500, 2100, 2700]);
    await d.page.screenshot({ path: `${OUT}/A-after-11s.png`, scale: 'css', animations: 'disabled', caret: 'hide' });
    res.A = { trace, taps, queueEnd: (await d.hub(f)).queue, server: await server() };
    console.log('A', JSON.stringify(res.A).slice(0, 2000));
    // C: same device, second open (cache present), held 9 s
    await d.goto('#home'); await sleep(800);
    const t1 = Date.now();
    d.goto('#tally').catch(() => {});
    await sleep(100);
    const c = await watch(d, t1, 3000);
    res.C = { trace: c.trace };
    console.log('C', JSON.stringify(res.C).slice(0, 1500));
    await d.close();
  }
  // B: another fresh device, no hold
  {
    const dev2 = await L.newDevice({ name: 'Other phone', profiles: ['eli'] });
    const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: dev2 });
    const t0 = Date.now();
    d.goto('#tally').catch(() => {});
    await sleep(100);
    const b = await watch(d, t0, 3000);
    res.B = { trace: b.trace };
    console.log('B', JSON.stringify(res.B).slice(0, 1500));
    await d.close();
  }
} finally {
  fs.writeFileSync(`${OUT}/loading.json`, JSON.stringify(res, null, 1));
  await L.close();
}
