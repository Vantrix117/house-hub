// Round 7: the name pill. (A) room mode, landscape iPad: its text, font size vs the number, position, with "Count" and with a long
// named counter. (B) normal mode on phones with the long named counter (24 chars) and a long person name: clipped? one line?
import fs from 'node:fs';
import { local, sleep } from '../../hub-audit/audits/tools/lib/local.mjs';
const OUT = 'C:/Users/ex_bo/b11/rev/shots8'; fs.mkdirSync(OUT, { recursive: true });
const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
const put = (pid, key, value) => L.apiAs(pid, `/api/data/tally/${encodeURIComponent(key)}?scope=person`, { method: 'PUT', body: { value, updated_at: Date.now() } });
const pill = () => { const w = document.getElementById('who'), r = w.getBoundingClientRect(), n = w.querySelector('.who-name') || w; const cs = getComputedStyle(n);
  return { text: w.textContent.trim(), font: Math.round(parseFloat(cs.fontSize)), num: Math.round(parseFloat(getComputedStyle(document.getElementById('n')).fontSize)), box: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)], clipped: n.scrollWidth > n.clientWidth + 1, iw: innerWidth, avatar: Math.round((w.querySelector('.avatar') || w).getBoundingClientRect().width) }; };
try {
  for (const pid of ['eli', 'ezra']) await put(pid, 'counter:kL', { name: 'Glasses of water today!!', at: Date.now() - 1000 });
  console.log('## (A) room mode');
  for (const pid of ['eli', 'ezra']) for (const sel of ['', 'kL']) for (const [w, h] of [[1180, 820], [1366, 1024], [820, 1180]]) {
    const d = await L.device({ device: 'ipad-portrait', profile: pid, fixedTime: false, localStorage: { ['hub.tally.sel.' + pid]: sel } });
    await d.page.setViewportSize({ width: w, height: h });
    const f = await d.openApp('tally', { wait: '#plus' }); await f.waitForFunction(() => !document.getElementById('n').classList.contains('skeleton'), null, { timeout: 15000 }); await sleep(900);
    await f.evaluate(() => window.__tally.far(true)); await sleep(1300);
    const m = await f.evaluate(`(${pill.toString()})()`);
    console.log(`${pid} ${sel || 'Count'} ${w}x${h} ${JSON.stringify(m)}`);
    if (w === 1180) await d.page.screenshot({ path: `${OUT}/far-pill-${pid}-${sel || 'count'}.png` });
    await d.close();
  }
  console.log('\n## (B) normal mode, phones, long named counter');
  for (const pid of ['eli', 'ezra']) for (const xxl of [false, true]) for (const [w, h] of [[320, 568], [375, 667], [390, 844], [844, 390]]) {
    await L.apiAs(pid, '/api/data/hub/textSize?scope=person', { method: xxl ? 'PUT' : 'DELETE', body: xxl ? { value: 'xxl', updated_at: Date.now() } : undefined });
    const d = await L.device({ device: 'iphone-pwa', profile: pid, fixedTime: false, localStorage: { ['hub.tally.sel.' + pid]: 'kL', ...(xxl ? { 'hub.prefs': { textSize: 'xxl' } } : {}) } });
    await d.page.setViewportSize({ width: w, height: h });
    const f = await d.openApp('tally', { wait: '#plus' }); await f.waitForFunction(() => !document.getElementById('n').classList.contains('skeleton'), null, { timeout: 15000 }); await sleep(1500);
    const m = await f.evaluate(`(${pill.toString()})()`);
    const ts = await f.evaluate(() => document.documentElement.getAttribute('data-text-size'));
    console.log(`${pid} ${xxl ? 'XXL(' + ts + ')' : 'default'} ${w}x${h} ${JSON.stringify(m)}`);
    if (w <= 375 && xxl) await d.page.screenshot({ path: `${OUT}/pill-${pid}-xxl-${w}.png` });
    await d.close();
  }
} finally { await L.close(); }
