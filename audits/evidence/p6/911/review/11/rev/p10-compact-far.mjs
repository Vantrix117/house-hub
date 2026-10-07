// Round 6: (A) compact layout: kid/adult XXL at small sizes: dial size, Reset's accessible name and box, + / - sizes, all in view.
// (B) room mode in landscape: the dial and + inside the frame, what is left to say whose counter it is; screenshots.
import fs from 'node:fs';
import { local, sleep } from '../../hub-audit/audits/tools/lib/local.mjs';
const OUT = 'C:/Users/ex_bo/b11/rev/shots8'; fs.mkdirSync(OUT, { recursive: true });
const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
const pref = (pid, v) => v ? L.apiAs(pid, '/api/data/hub/textSize?scope=person', { method: 'PUT', body: { value: v, updated_at: Date.now() } }) : L.apiAs(pid, '/api/data/hub/textSize?scope=person', { method: 'DELETE' });
const box = s => { const e = document.querySelector(s); const r = e.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), t: Math.round(r.top), b: Math.round(r.bottom), l: Math.round(r.left), r: Math.round(r.right) }; };
try {
  console.log('## (A) compact');
  for (const pid of ['ezra', 'eli']) for (const [w, h] of [[375, 667], [320, 568], [390, 844], [667, 375]]) {
    await pref(pid, 'xxl');
    const d = await L.device({ device: 'iphone-pwa', profile: pid, fixedTime: false, localStorage: { 'hub.prefs': { textSize: 'xxl' } } });
    await d.page.setViewportSize({ width: w, height: h });
    const f = await d.openApp('tally', { wait: '#plus' }); await f.waitForFunction(() => !document.getElementById('n').classList.contains('skeleton'), null, { timeout: 15000 }); await sleep(1500);
    const m = await f.evaluate(`(() => { const box = ${box.toString()}; const rs = document.getElementById('reset');
      return { compact: document.getElementById('main').classList.contains('compact'), ts: document.documentElement.getAttribute('data-text-size'), ih: innerHeight, iw: innerWidth, dial: box('.dial'), plus: box('#plus'), minus: box('#minus'), reset: box('#reset'),
        resetName: rs.getAttribute('aria-label') || rs.textContent.trim(), resetText: getComputedStyle(rs.querySelector('span') || rs).display, hs: document.documentElement.scrollWidth > innerWidth + 1 }; })()`);
    const min = pid === 'ezra' ? 64 : 44;
    const bad = m.plus.b > m.ih || m.reset.b > m.ih || m.reset.h < min - 0.5 || m.reset.w < min - 0.5 || m.minus.w < min - 0.5 || m.hs;
    console.log(`${bad ? 'FAIL' : 'ok  '} ${pid} XXL ${w}x${h} ${JSON.stringify(m)}`);
    if (w === 375 || w === 320) await d.page.screenshot({ path: `${OUT}/compact-${pid}-${w}x${h}.png` });
    await d.close(); await pref(pid, null);
  }
  console.log('\n## (B) room mode, landscape');
  for (const pid of ['eli', 'ezra']) for (const [w, h] of [[1180, 820], [1366, 1024], [1024, 768]]) {
    const d = await L.device({ device: 'ipad-portrait', profile: pid, fixedTime: false });
    await d.page.setViewportSize({ width: w, height: h });
    const f = await d.openApp('tally', { wait: '#plus' }); await f.waitForFunction(() => !document.getElementById('n').classList.contains('skeleton'), null, { timeout: 15000 }); await sleep(1000);
    await f.evaluate(() => window.__tally.far(true)); await sleep(1300);
    const m = await f.evaluate(`(() => { const box = ${box.toString()}; const who = document.getElementById('who');
      return { ih: innerHeight, iw: innerWidth, dial: box('.dial'), plus: box('#plus'), whoShown: getComputedStyle(who).display !== 'none' && who.getBoundingClientRect().height > 0,
        accent: document.documentElement.getAttribute('data-accent'), anyName: [...document.querySelectorAll('main *')].filter(e => e.offsetParent && /counter/i.test(e.textContent) && e.children.length === 0).map(e => e.textContent).slice(0, 3) }; })()`);
    const bad = m.dial.b > m.ih || m.dial.t < 0 || m.plus.b > m.ih || m.plus.r > m.iw;
    console.log(`${bad ? 'FAIL' : 'ok  '} ${pid} ${w}x${h} ${JSON.stringify(m)}`);
    await d.page.screenshot({ path: `${OUT}/far-${pid}-${w}x${h}.png` });
    await d.close();
  }
} finally { await L.close(); }
