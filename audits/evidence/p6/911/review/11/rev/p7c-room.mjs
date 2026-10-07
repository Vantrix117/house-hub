// Round 3: (A) the counters sheet past three: keyboard (Tab stays inside? Escape closes, focus back on #cpick), kid row heights,
// landscape phone + XXL (every row reachable, nothing off screen), a row tap picks the counter. (B) room mode with 999,999 / 999
// / 7 / 1,000 etc.: the number stays inside the dial's tick ring at iPad sizes, adult and kid.
import fs from 'node:fs';
import { local, sleep } from '../../hub-audit/audits/tools/lib/local.mjs';
const OUT = 'C:/Users/ex_bo/b11/rev/shots3'; fs.mkdirSync(OUT, { recursive: true });
const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
const now = Date.now();
async function seed(pid) {
  const put = (key, value) => L.apiAs(pid, `/api/data/tally/${encodeURIComponent(key)}?scope=person`, { method: 'PUT', body: { value, updated_at: Date.now() } });
  const names = ['Laps around the garden', 'Glasses of water today', 'Pages read this evening', 'Push-ups before dinner', 'Words of kindness given', 'Birds seen at the feeder'];
  for (let i = 0; i < 6; i++) await put('counter:k' + i, { name: names[i], at: now - 100000 + i });
}
await seed('eli'); await seed('ezra');
const open = async (pid, w, h, xxl) => {
  const d = await L.device({ device: 'iphone-pwa', profile: pid, fixedTime: false });
  await d.page.setViewportSize({ width: w, height: h });
  const f = await d.openApp('tally', { wait: '#plus' });
  await f.waitForFunction(() => !document.getElementById('n').classList.contains('skeleton'), null, { timeout: 15000 }); await sleep(800);
  if (xxl) { await f.evaluate(() => document.documentElement.setAttribute('data-text-size', 'xxl')); await sleep(600); }
  return { d, f };
};
try {
  console.log('\n## (B) room mode');
  for (const pid of ['eli', 'ezra']) for (const [w, h] of [[820, 1180], [1180, 820], [1024, 768], [768, 1024]]) for (const v of [999999, 99999, 999, 1000, 37]) {
    await L.apiAs(pid, '/api/data/tally/reset?scope=person', { method: 'PUT', body: { value: { epoch: 'r' + v + w, at: Date.now() }, updated_at: Date.now() } });
    await L.apiAs(pid, '/api/data/tally/count%3Aseed?scope=person', { method: 'PUT', body: { value: { n: v, epoch: 'r' + v + w }, updated_at: Date.now() } });
    const { d, f } = await open(pid, w, h, false);
    await f.evaluate(() => localStorage.setItem('x', '1'));
    await f.evaluate(() => { const b = document.querySelector('#cpick'); });
    // make sure the default counter is on the dial
    await f.evaluate(() => { try { localStorage.setItem('hub.tally.sel.' + hub.profile.id, ''); } catch {} });
    await f.evaluate(() => window.__tally.far(true)); await sleep(1200);
    const m = await f.evaluate(() => { const dial = document.querySelector('.dial').getBoundingClientRect(), n = document.getElementById('n'), r = document.createRange(); r.selectNodeContents(n); const t = r.getBoundingClientRect(); const inset = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sp-3')) || 12;
      return { text: n.textContent, font: Math.round(parseFloat(getComputedStyle(n).fontSize)), dial: Math.round(dial.width), textW: Math.round(t.width), inside: t.left >= dial.left + inset && t.right <= dial.right - inset, plusIn: document.getElementById('plus').getBoundingClientRect().bottom <= innerHeight };
    });
    if (!m.inside || !m.plusIn || v === 999999 && w === 820) console.log(`${m.inside && m.plusIn ? 'ok  ' : 'FAIL'} ${pid} ${w}x${h} ${JSON.stringify(m)}`);
    if (v === 999999 && w === 820) await d.page.screenshot({ path: `${OUT}/far-${pid}-999999.png` });
    await d.close();
  }
  console.log('room mode done');
} finally { await L.close(); }
