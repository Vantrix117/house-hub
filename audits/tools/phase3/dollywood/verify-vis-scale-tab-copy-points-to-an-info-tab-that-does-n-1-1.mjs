// Skeptic #1 for 'vis-scale-tab-copy-points-to-an-info-tab-that-does-n-1' (apps/dollywood.html:660 tabs, :672 Scale copy).
//   node "audits/tools/phase3/dollywood/verify-vis-scale-tab-copy-points-to-an-info-tab-that-does-n-1-1.mjs"
// Evidence PNGs are the side panel (tab bar + Scale pane) only.
// Typical seed, WebKit, Eli. iPad portrait + iPhone PWA. Opens the Scale tab, reads its copy and every tab-like control,
// searches the whole document for anything named "Info", then sets a plot width (local demo DB only) and reports where
// "in game" figures actually render (step card .meas.game, popover gameDim).
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';
const EV = path.resolve('audits/evidence/p3/dollywood'); fs.mkdirSync(EV, { recursive: true });
const NAME = 'verify-vis-scale-tab-copy-points-to-an-info-tab-that-does-n-1-1';
const out = {};
const L = await local({ variant: 'typical', engine: 'webkit' });
try {
  for (const dev of ['ipad-portrait', 'iphone-pwa']) {
    const d = await L.device({ device: dev, profile: 'eli', fixedTime: false });
    const f = await d.openApp('dollywood', { wait: '.tabs button[data-tab=scale]' });
    await sleep(1500);
    await f.evaluate(() => document.querySelector('.tabs button[data-tab=scale]').click()); await sleep(400);
    const r = await f.evaluate(async () => {
      const vis = el => { const b = el.getBoundingClientRect(); return b.width > 0 && b.height > 0; };
      const tabs = [...document.querySelectorAll('[role=tab]')].map(b => b.textContent.trim());
      const p = document.querySelector('#tab-scale p');
      const allText = document.body.innerText;
      const infoControls = [...document.querySelectorAll('button,a,[role=tab],summary,label,h1,h2,h3,h4,legend')]
        .filter(e => /\binfo\b/i.test(e.textContent + ' ' + (e.getAttribute('aria-label') || '') + ' ' + (e.title || '')))
        .map(e => ({ tag: e.tagName, text: e.textContent.trim().slice(0, 60), aria: e.getAttribute('aria-label'), title: e.title, visible: vis(e) }));
      const idsInfo = [...document.querySelectorAll('[id]')].filter(e => /info/i.test(e.id)).map(e => e.id);
      const before = { scaleCopy: p && p.textContent.replace(/\s+/g, ' ').trim(), scaleVisible: vis(document.getElementById('tab-scale')) };
      const inp = document.getElementById('sc-plot'); inp.value = '400'; inp.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise(r => setTimeout(r, 300));
      const fac = document.getElementById('sc-fac').textContent;
      // re-render the step card so .meas.game uses the new factor: step forward then back if possible
      const g = document.querySelector('.meas.game');
      let host = null; if (g) { let e = g; while (e && !e.id) e = e.parentElement; host = e && e.id; }
      return { tabs, ...before, infoControls, idsContainingInfo: idsInfo, bodyMentionsInfoTab: (allText.match(/Info tab/g) || []).length,
        facAfterPlot400: fac, gameLineHostId: host, gameLine: g ? g.textContent.replace(/\s+/g, ' ').trim().slice(0, 200) : null };
    });
    const png = path.join(EV, `${NAME}-${dev}.png`);
    await f.locator('#tab-scale').evaluate(e => e.scrollIntoView({ block: 'center' })); await sleep(300); await f.locator('.tabs').locator('..').screenshot({ path: png, scale: 'css', animations: 'disabled', caret: 'hide' });
    r.png = path.relative(process.cwd(), png).split(path.sep).join('/');
    out[dev] = r;
    await d.close();
  }
  console.log(JSON.stringify(out, null, 1));
} finally {
  fs.writeFileSync(path.join(EV, NAME + '.json'), JSON.stringify(out, null, 1));
  await L.close();
}
