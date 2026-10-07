// Round 5: cold loads. A recorder (init script, every frame for 4 s from the document start) logs the dial's size and the +'s
// top; any change after the first painted layout is a jump. In the hub and standalone, adult and kid, default and XXL (XXL as a
// stored preference so it is there from the first paint), Reduce Motion too. Then 999,999 at the resting size: inside the ring?
import { local, sleep } from '../../hub-audit/audits/tools/lib/local.mjs';
const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
const REC = () => {
  if (!/tally\.html/.test(location.pathname)) return;
  const log = window.__rec = []; const t0 = performance.now();
  const tick = () => {
    const d = document.querySelector('.dial'), p = document.getElementById('plus');
    if (d && p) { const r = d.getBoundingClientRect(), q = p.getBoundingClientRect(); const k = Math.round(r.width) + 'x' + Math.round(r.top) + '|' + Math.round(q.top) + '|' + Math.round(q.left); if (!log.length || log[log.length - 1].k !== k) log.push({ t: Math.round(performance.now() - t0), k }); }
    if (performance.now() - t0 < 4000) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};
const pref = async (pid, k, v) => { if (v == null) await L.apiAs(pid, `/api/data/hub/${k}?scope=person`, { method: 'DELETE' }); else await L.apiAs(pid, `/api/data/hub/${k}?scope=person`, { method: 'PUT', body: { value: v, updated_at: Date.now() } }); };
const put = (pid, key, value) => L.apiAs(pid, `/api/data/tally/${encodeURIComponent(key)}?scope=person`, { method: 'PUT', body: { value, updated_at: Date.now() } });
try {
  const cases = [];
  for (const where of ['hub', 'standalone']) for (const pid of ['eli', 'ezra']) for (const [w, h] of [[390, 844], [844, 390], [820, 1180], [1180, 820], [1440, 900]]) for (const pref of ['default', 'xxl', 'reduce']) cases.push([where, pid, w, h, pref]);
  let jumps = 0;
  for (const [where, pid, w, h, pref_] of cases) {
    const extra = pref_ === 'xxl' ? { 'hub.prefs': { textSize: 'xxl' } } : pref_ === 'reduce' ? { 'hub.prefs': { motion: 'reduce' } } : null;
    await pref(pid, 'textSize', pref_ === 'xxl' ? 'xxl' : null); await pref(pid, 'motion', pref_ === 'reduce' ? 'reduce' : null);
    const d = await L.device({ device: 'iphone-pwa', profile: pid, fixedTime: false, localStorage: extra });
    await d.page.setViewportSize({ width: w, height: h });
    await d.ctx.addInitScript(REC);
    let f;
    if (where === 'hub') f = await d.openApp('tally', { wait: '#plus' });
    else { await d.page.goto(L.site + '/apps/tally.html', { waitUntil: 'load' }); f = d.page; }
    await sleep(4300);
    const log = await f.evaluate(() => window.__rec || []);
    const attr = await f.evaluate(() => document.documentElement.getAttribute('data-text-size') + '/' + document.documentElement.getAttribute('data-motion'));
    const changes = log.length - 1;
    if (changes > 0) jumps++;
    console.log(`${changes > 0 ? 'JUMP' : 'ok  '} ${where} ${pid} ${w}x${h} ${pref_} (${attr}) states=${log.length} ${JSON.stringify(log).slice(0, 300)}`);
    await d.close();
  }
  console.log('cases with a change after first paint:', jumps, 'of', cases.length);
  console.log('\n## 999,999 at the resting size');
  for (const pid of ['eli', 'ezra']) {
    await pref(pid, 'motion', null);
    await put(pid, 'reset', { epoch: 'big' + pid, at: Date.now() }); await put(pid, 'count:seed', { n: 999999, epoch: 'big' + pid });
    for (const [w, h] of [[375, 667], [390, 844], [844, 390], [820, 1180], [1180, 820], [1440, 900]]) for (const xxl of [false, true]) {
      await pref(pid, 'textSize', xxl ? 'xxl' : null);
      const d = await L.device({ device: 'iphone-pwa', profile: pid, fixedTime: false, localStorage: xxl ? { 'hub.prefs': { textSize: 'xxl' } } : null });
      await d.page.setViewportSize({ width: w, height: h });
      const f = await d.openApp('tally', { wait: '#plus' }); await f.waitForFunction(() => !document.getElementById('n').classList.contains('skeleton'), null, { timeout: 15000 }); await sleep(1500);
      const m = await f.evaluate(() => { const dial = document.querySelector('.dial').getBoundingClientRect(), n = document.getElementById('n'), r = document.createRange(); r.selectNodeContents(n); const t = r.getBoundingClientRect(); const inset = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sp-3')) || 12; const p = document.getElementById('plus').getBoundingClientRect(), rs = document.getElementById('reset').getBoundingClientRect();
        return { text: n.textContent, font: Math.round(parseFloat(getComputedStyle(n).fontSize)), dial: Math.round(dial.width), textW: Math.round(t.width), inside: t.left >= dial.left + inset && t.right <= dial.right - inset && t.top >= dial.top && t.bottom <= dial.bottom, plusIn: p.bottom <= innerHeight && p.right <= innerWidth, resetIn: rs.bottom <= innerHeight, hs: document.documentElement.scrollWidth > innerWidth + 1 };
      });
      const bad = !m.inside || !m.plusIn || m.hs;
      console.log(`${bad ? 'FAIL' : 'ok  '} ${pid} ${w}x${h}${xxl ? ' XXL' : ''} ${JSON.stringify(m)}`);
      if (pid === 'ezra' && xxl && (w === 844 || w === 1180)) await d.page.screenshot({ path: `C:/Users/ex_bo/b11/rev/shots6/big-ezra-xxl-${w}x${h}.png` }).catch(() => {});
      await d.close();
    }
  }
} finally { await L.close(); }
