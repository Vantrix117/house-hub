// s1 skeptic for UX-TALLY-3: count the real taps Home -> counted for Eli (iPhone PWA) and Ezra (iPad portrait),
// check whether Home shows anything of Tally, and whether a hash-restored shell reopens straight into Tally.
// Run: node audits/tools/phase5/ux-verify/UX-TALLY-3/s1-taps.mjs -> audits/evidence/p5/ux-verify/UX-TALLY-3/s1/
import fs from 'node:fs';
import { local, sleep } from '../../../lib/local.mjs';
const OUT = 'audits/evidence/p5/ux-verify/UX-TALLY-3/s1';
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const res = {};
try {
  for (const [profile, device] of [['eli', 'iphone-pwa'], ['ezra', 'ipad-portrait']]) {
    const d = await L.device({ device, profile, mode: 'light' });
    await d.goto('');
    await sleep(1500);
    const home = await d.page.evaluate(() => {
      const h = document.querySelector('[data-tab="home"]'); const tab = document.documentElement.dataset.tab;
      const sec = document.getElementById('home') || document.querySelector('#tab-home, [data-panel="home"], main');
      const txt = (sec ? sec.innerText : document.body.innerText);
      return { tab, mentionsTally: /tally/i.test(txt), openTargets: [...document.querySelectorAll('[data-open]')].filter(e => e.offsetParent).map(e => e.dataset.open) };
    });
    await d.shot(`${OUT}/${profile}-home.png`);
    const taps = [];
    await d.page.click('[data-tab="apps"]'); taps.push('Apps tab'); await sleep(600);
    await d.page.click('.tile[data-id="tally"]'); taps.push('Tally tile');
    let f; for (let i = 0; i < 100 && !f; i++) { f = d.frame('tally'); if (!f) await sleep(100); }
    await f.waitForFunction(() => document.getElementById('who').textContent.trim().length > 0, null, { timeout: 10000 });
    await sleep(500);
    const before = Number(await f.textContent('#n'));
    await f.click('#plus'); taps.push('+'); await sleep(300);
    const after = Number(await f.textContent('#n'));
    await d.shot(`${OUT}/${profile}-counted.png`);
    // reopen the shell with the hash it left (a warm PWA resume keeps it; a reload with the hash shows restore behaviour)
    const hash = await d.page.evaluate(() => location.hash);
    await d.page.reload({ waitUntil: 'load' }); await sleep(1500);
    const reopened = !!d.frame('tally');
    res[profile] = { device, home, taps, tapCount: taps.length, before, after, hashAfterOpen: hash, reloadWithHashReopensTally: reopened };
    console.log(profile, JSON.stringify(res[profile]));
    await d.close();
  }
} finally {
  fs.writeFileSync(`${OUT}/taps.json`, JSON.stringify(res, null, 1));
  await L.close();
}
