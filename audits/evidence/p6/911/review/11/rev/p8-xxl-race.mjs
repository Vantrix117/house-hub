// Round 4: tally-claims-11 failed once: ezra, 2 counters, XXL set after load, 1440x900 -> + 24 px below the frame.
// Repeat that case 6 times; read + at 400 ms (as the claims script does) and again at 3 s; then a resize to see if fit() recovers.
import { local, sleep } from '../../hub-audit/audits/tools/lib/local.mjs';
const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
const now = Date.now();
const put = (key, value) => L.apiAs('ezra', `/api/data/tally/${encodeURIComponent(key)}?scope=person`, { method: 'PUT', body: { value, updated_at: Date.now() } });
const names = ['Laps around the garden', 'Glasses of water today'];
for (let i = 0; i < 2; i++) await put('counter:k' + i, { name: names[i], at: now - 100000 + i });
for (let i = 0; i < 5; i++) await put('resetlog:' + (now - 5000 * (i + 1)), { cid: i % 2 ? 'k' + i : null, from: 123456 - i, at: now - 5000 * (i + 1) });
const m = f => f.evaluate(() => { const p = document.getElementById('plus').getBoundingClientRect(); return { plusBottom: Math.round(p.bottom), ih: innerHeight, disc: Math.round(document.querySelector('.dial').getBoundingClientRect().width), room: document.documentElement.style.getPropertyValue('--room') }; });
try {
  for (const [w, h] of [[1440, 900], [1180, 820], [1024, 768]]) for (let k = 0; k < 4; k++) {
    const d = await L.device({ device: 'iphone-pwa', profile: 'ezra', mode: 'light', fixedTime: false });
    await d.page.setViewportSize({ width: w, height: h });
    const f = await d.openApp('tally', { wait: '#plus' }); await sleep(900);
    await f.evaluate(() => document.documentElement.setAttribute('data-text-size', 'xxl'));
    await sleep(400); const a = await m(f);
    await sleep(2600); const b = await m(f);
    const bad = x => x.plusBottom > x.ih;
    console.log(`${w}x${h} run ${k}: at 0.4 s ${JSON.stringify(a)} ${bad(a) ? 'OFF' : 'in'} | at 3 s ${JSON.stringify(b)} ${bad(b) ? 'OFF' : 'in'}`);
    await d.close();
  }
} finally { await L.close(); }
