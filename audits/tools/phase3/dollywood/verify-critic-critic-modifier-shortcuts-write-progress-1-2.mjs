// Skeptic #2: do Ctrl/Cmd-modified browser shortcuts fire the guide's single-key bindings (apps/dollywood.html:852-857)?
//   node "audits/tools/phase3/dollywood/verify-critic-critic-modifier-shortcuts-write-progress-1-2.mjs"
// Runs on WebKit and Chromium, desktop 1440x900, Eli, typical seed. For each engine: baseline plain 'x' (unbound),
// Ctrl+D, Meta+D, Ctrl+P then Ctrl+D (unticks a done step?), Ctrl+Minus, Ctrl+0, Alt+D. Reads curIdx, #b-count, the
// server progress row and new feed lines; records defaultPrevented for each keydown.
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';
const EV = path.resolve('audits/evidence/p3/dollywood');
const PFX = 'verify-critic-critic-modifier-shortcuts-write-progress-1-2';
const out = {};
for (const engine of ['webkit', 'chromium']) {
  const L = await local({ variant: 'typical', engine });
  try {
    const prog = async () => { const r = await L.apiAs('eli', '/api/data/dollywood?scope=person&since=0'); const it = (r.body.items || []).find(i => i.key === 'progress'); const v = (it && it.value) || {}; return Object.values(v).filter(Boolean).length; };
    const feedIds = async () => ((await L.apiAs('eli', '/api/activity?limit=40')).body.activity || []);
    const d = await L.device({ device: 'desktop', profile: 'eli', fixedTime: false });
    const f = await d.openApp('dollywood', { wait: '#b-count' });
    await f.waitForFunction(() => /of \d+ done/.test(document.getElementById('b-count').textContent) && window.hub && hub.sync && hub.sync.state === 'synced', null, { timeout: 30000 });
    await sleep(800);
    const before = (await feedIds()).map(a => a.id);
    const h1 = await f.$('h1'); const b = await h1.boundingBox(); await d.page.mouse.click(b.x + 5, b.y + 5);
    await f.evaluate(() => { window.__kd = []; document.addEventListener('keydown', e => setTimeout(() => window.__kd.push({ key: e.key, ctrl: e.ctrlKey, meta: e.metaKey, alt: e.altKey, prevented: e.defaultPrevented }), 0)); });
    const st = async () => ({ ...(await f.evaluate(() => ({ mode, step: curIdx, count: document.getElementById('b-count').textContent, curDone: !!doneMap[(stepsOf(curSec)[curIdx] || {}).id], view: view.map(v => Math.round(v)), active: document.activeElement && document.activeElement.tagName }))), serverTicks: await prog() });
    const steps = [];
    steps.push({ at: 'start', ...(await st()) });
    for (const k of ['x', 'Control+d', 'Meta+d', 'Control+p', 'Control+d', 'Control+Minus', 'Control+0', 'Alt+d']) {
      await d.page.keyboard.press(k); await sleep(2200);
      steps.push({ at: k, ...(await st()) });
    }
    const kd = await f.evaluate(() => window.__kd);
    const newFeed = (await feedIds()).filter(a => !before.includes(a.id)).map(a => `${a.app_id}: ${a.text}`);
    if (engine === 'webkit') await d.page.screenshot({ path: path.join(EV, PFX + '-webkit-desktop.png'), scale: 'css', animations: 'disabled' });
    out[engine] = { steps, keydown: kd, newFeed };
    console.log(engine, JSON.stringify(out[engine], null, 1));
    await d.close();
  } finally { await L.close(); }
}
fs.writeFileSync(path.join(EV, PFX + '.json'), JSON.stringify(out, null, 1));
