// Reviewer probe 4: across-the-room mode (IMP-TALLY-I1) for an adult and a kid on the iPad: does the count grow?
import { local, sleep } from '../../hub-audit/audits/tools/lib/local.mjs';
const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
try {
  for (const profile of ['eli', 'ezra']) for (const [w, h] of [[820, 1180], [1180, 820], [1366, 1024]]) {
    const d = await L.device({ device: 'ipad-portrait', profile, fixedTime: false });
    await d.page.setViewportSize({ width: w, height: h });
    const f = await d.openApp('tally', { wait: '#plus' });
    await f.waitForFunction(() => !document.getElementById('n').classList.contains('skeleton'), null, { timeout: 15000 }); await sleep(800);
    const m = () => f.evaluate(() => ({ disc: Math.round(document.querySelector('.dial').getBoundingClientRect().width), font: getComputedStyle(document.getElementById('n')).fontSize, reset: getComputedStyle(document.getElementById('reset')).display, plusBottom: Math.round(document.getElementById('plus').getBoundingClientRect().bottom), ih: innerHeight }));
    const before = await m();
    await f.evaluate(() => window.__tally.far(true)); await sleep(1200);
    const after = await m();
    console.log(profile, `${w}x${h}`, 'before', JSON.stringify(before), 'far', JSON.stringify(after));
    await d.close();
  }
} finally { await L.close(); }
