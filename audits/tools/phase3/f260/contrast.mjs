// F260 — rendered contrast of every visible text item (the whole Plan page, top to bottom) in all five palettes plus
// System on a dark OS, iPhone 430 px, standalone apps/f260.html signed in as Eli. Uses the Phase 2 VIS page library
// (hide text → screenshot → sample the background under each line box; p10 = 10th-percentile ratio).
// Thresholds: 4.5:1 normal text, 3:1 large (>= 24 px, or >= 18.66 px bold).
//   node "audits/tools/phase3/f260/contrast.mjs"
import { local, sleep, DEMO, save, shot, ready } from './_lib.mjs';
import { install } from '../../phase2/VIS/lib-vis.mjs';

const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const out = {};
async function sweep(page) {
  await install(page);
  const H = await page.evaluate(() => ({ sh: document.documentElement.scrollHeight, ch: innerHeight }));
  const done = new Map();
  for (let y = 0; y < H.sh; y += Math.floor(H.ch * 0.8)) {
    await page.evaluate(y => window.scrollTo(0, y), y); await sleep(150);
    const vis = await page.evaluate(ids => { const cur = __vis.texts().map(({ el, ...x }) => x).filter(x => !ids.includes(x.id)); return __vis.onscreen(cur); }, [...done.keys()]);
    if (!vis.length) continue;
    await page.evaluate(() => __vis.hideText(true));
    const png = await page.screenshot({ scale: 'css', animations: 'disabled', caret: 'hide' });
    await page.evaluate(() => __vis.hideText(false));
    const res = await page.evaluate(([b64, items]) => __vis.sample(b64, items), [png.toString('base64'), vis]);
    for (const r of res) { const it = vis.find(v => v.id === r.id); done.set(r.id, { sel: it.sel, text: it.text.slice(0, 40), fs: it.fs, fw: it.fw, large: it.large, p10: r.p10, med: r.med }); }
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  return [...done.values()];
}
try {
  const cases = [['hearth', 'light'], ['parchment', 'light'], ['frost', 'light'], ['midnight', 'light'], ['forest', 'light'], ['system', 'dark'], ['hearth', 'dark']];
  for (const [theme, mode] of cases) {
    const d = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: DEMO, mode });
    await d.ctx.route(u => u.href.startsWith(L.api + '/api/') && !u.href.startsWith(L.api + '/api/media/'), r => r.request().method() === 'GET' ? r.fallback() : r.abort());   // no writes: the theme choice stays on this device
    await d.page.goto(L.site + '/apps/f260.html', { waitUntil: 'load' });
    await ready(d.page);
    await d.page.evaluate(t => hub.setTheme(t), theme); await sleep(600);
    const scheme = await d.page.evaluate(() => ({ theme: document.documentElement.dataset.theme || null, scheme: document.documentElement.dataset.scheme, bg: getComputedStyle(document.body).backgroundColor }));
    const items = await sweep(d.page);
    const fails = items.filter(i => i.p10 < (i.large ? 3 : 4.5)).sort((a, b) => a.p10 - b.p10);
    const done = items.find(i => /todayDone/.test(i.sel));
    const groups = {}; for (const i of fails) { const k = i.sel.split(' > ').pop().replace(/#week-\d+/, '') + ' ' + i.fs + 'px'; const g = groups[k] || (groups[k] = { n: 0, min: 99, sample: i.text }); g.n++; g.min = Math.min(g.min, i.p10); }
    out[theme + '-' + mode] = { scheme, measured: items.length, failing: fails.length, groups: Object.fromEntries(Object.entries(groups).sort((a, b) => b[1].n - a[1].n)), worst: fails.slice(0, 12), done };
    console.log((theme + '-' + mode).padEnd(16), JSON.stringify(scheme), 'items', items.length, 'failing', fails.length, '| Done', done && done.p10, '| worst', JSON.stringify(fails.slice(0, 5).map(f => f.text + ' ' + f.fs + 'px ' + f.p10)));
    await shot(d.page, `contrast-${theme}-${mode}-iphone.png`);
    await d.close();
  }
} finally { await L.close(); }
console.log('evidence →', save('contrast.json', out));
