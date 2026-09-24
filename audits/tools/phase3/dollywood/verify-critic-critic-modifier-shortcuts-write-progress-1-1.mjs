// Skeptic #1 for "critic-critic-modifier-shortcuts-write-progress-1": do Ctrl/Cmd+D, Ctrl+P, Ctrl+= reach the guide's
// single-key shortcuts (apps/dollywood.html:852-857) and write progress / post a feed line / cancel the browser action?
//   node "audits/tools/phase3/dollywood/verify-critic-critic-modifier-shortcuts-write-progress-1-1.mjs" [webkit|chromium]
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';
const engine = process.argv[2] || 'webkit';
const NAME = 'verify-critic-critic-modifier-shortcuts-write-progress-1-1';
const EV = path.resolve('audits/evidence/p3/dollywood');
const out = { engine };
const L = await local({ variant: 'typical', engine });
const prog = async () => {
  const r = await L.apiAs('eli', '/api/data/dollywood?scope=person&since=0');
  const it = (r.body.items || []).find(i => i.key === 'progress');
  return { ticks: Object.values((it && it.value) || {}).filter(Boolean).length, updated_at: it && it.updated_at };
};
const feedIds = async () => ((await L.apiAs('eli', '/api/activity?limit=50')).body.activity || []);
try {
  const d = await L.device({ device: 'desktop', profile: 'eli', fixedTime: false });
  const f = await d.openApp('dollywood', { wait: '#b-count' });
  await f.waitForFunction(() => /of \d+ done/.test(document.getElementById('b-count').textContent) && window.hub && hub.sync && hub.sync.state === 'synced', null, { timeout: 30000 });
  await sleep(1000);
  const st = () => f.evaluate(() => ({ mode, idx: curIdx, sec: curSec, count: document.getElementById('b-count').textContent, active: document.activeElement && (document.activeElement.id || document.activeElement.tagName), view: view.map(v => Math.round(v)) }));
  const before0 = (await feedIds()).map(a => a.id);
  // focus the app document on a non-input element (the h1)
  const h1 = await f.$('h1'); const bb = await h1.boundingBox(); await d.page.mouse.click(bb.x + 4, bb.y + 4);
  await f.evaluate(() => { window.__kd = []; document.addEventListener('keydown', e => setTimeout(() => window.__kd.push({ key: e.key, ctrl: e.ctrlKey, meta: e.metaKey, alt: e.altKey, prevented: e.defaultPrevented }), 0)); });
  const rows = [];
  const step = async (combo, wait = 2500) => {
    const b = { ui: await st(), server: await prog() };
    await d.page.keyboard.press(combo); await sleep(wait);
    const a = { ui: await st(), server: await prog() };
    rows.push({ combo, before: b, after: a });
    console.log(combo, 'step', b.ui.idx, '->', a.ui.idx, '| count', JSON.stringify(b.ui.count), '->', JSON.stringify(a.ui.count), '| server ticks', b.server.ticks, '->', a.server.ticks, '| view', b.ui.view.join(','), '->', a.ui.view.join(','));
  };
  await step('Control+d');
  await step('Meta+d');
  await step('Control+p', 800);
  await step('Control+Equal', 800);
  await step('Alt+d');           // Alt as well
  const kd = await f.evaluate(() => window.__kd);
  console.log('keydowns', JSON.stringify(kd));
  const newFeed = (await feedIds()).filter(a => !before0.includes(a.id)).map(a => `${a.profile_id || a.by || ''} ${a.app_id}: ${a.text}`);
  console.log('new feed lines', JSON.stringify(newFeed));
  const png = path.join(EV, NAME + '-' + engine + '.png');
  await d.page.screenshot({ path: png, scale: 'css', animations: 'disabled' });
  Object.assign(out, { rows, keydowns: kd, newFeed, png: path.relative(process.cwd(), png).split(path.sep).join('/') });
  await d.close();
} finally {
  fs.writeFileSync(path.join(EV, NAME + '-' + engine + '.json'), JSON.stringify(out, null, 1));
  await L.close();
}
