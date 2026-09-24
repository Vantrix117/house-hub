// Skeptic #1 for finding 'scale-copy-info-tab' (apps/dollywood.html:660 tab list, :672 Scale copy, :1074 gameLine).
// Does the Scale tab's copy name an "Info tab" that the UI does not have, and where do the game-metre figures really appear?
//   node "audits/tools/phase3/dollywood/verify-scale-copy-info-tab-1.mjs"
// Typical seed, iPad portrait, WebKit, Eli in the shell. Opens the Scale tab, reads every tab/button label in the app,
// the Scale paragraph, and which element holds the "In game" line.
// Writes audits/evidence/p3/dollywood/verify-scale-copy-info-tab-1.json and .png.
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';
const EV = path.resolve('audits/evidence/p3/dollywood'); fs.mkdirSync(EV, { recursive: true });
let out = {};
const L = await local({ variant: 'typical', engine: 'webkit' });
try {
  const d = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  const f = await d.openApp('dollywood', { wait: '.tabs button[data-tab=scale]' });
  await sleep(1500);
  await f.click('.tabs button[data-tab=scale]'); await sleep(500);
  out = await f.evaluate(() => {
    const vis = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const tabs = [...document.querySelectorAll('[role=tab]')].map(b => b.textContent.trim());
    const lvTabs = [...document.querySelectorAll('.lv-tabs button')].map(b => b.textContent.trim());
    const p = document.querySelector('#tab-scale p');
    const infoLabelled = [...document.querySelectorAll('button,[role=tab],summary,h1,h2,h3,label')]
      .filter(e => /^\s*info\s*$/i.test(e.textContent) || /\binfo\b/i.test(e.getAttribute('aria-label') || '')).map(e => ({ tag: e.tagName, text: e.textContent.trim().slice(0, 60), aria: e.getAttribute('aria-label'), visible: vis(e) }));
    const g = document.querySelector('.meas.game');
    let host = null; if (g) { let e = g; while (e && !e.id) e = e.parentElement; host = e && e.id; }
    return { tabs, lvTabs, scaleTabVisible: vis(document.getElementById('tab-scale')), scaleCopy: p && p.textContent.replace(/\s+/g, ' ').trim(),
      mentionsInfoTab: !!(p && /Info tab/.test(p.textContent)), elementsLabelledInfo: infoLabelled,
      gameLineHostId: host, gameLine: g ? g.textContent.replace(/\s+/g, ' ').trim().slice(0, 160) : null };
  });
  const png = path.join(EV, 'verify-scale-copy-info-tab-1.png');
  await d.page.screenshot({ path: png, scale: 'css', animations: 'disabled', caret: 'hide' });
  out.png = path.relative(process.cwd(), png).split(path.sep).join('/');
  console.log(JSON.stringify(out, null, 1));
  await d.close();
} finally {
  fs.writeFileSync(path.join(EV, 'verify-scale-copy-info-tab-1.json'), JSON.stringify(out, null, 1));
  await L.close();
}
