// UX-HOME-2, skeptic s1: independent re-measure of the TV board's text sizes (kiosk profile, 1920x1080) and height.
// Cap height = computed font-size x 0.705 (SF Pro cap ratio) x mm per CSS px of a 1080p panel (43" 0.4958, 55" 0.6342,
// 65" 0.7495). Local rig only.
//   node "audits/tools/phase5/ux-verify/UX-HOME-2/s1-tv-text.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p5/ux-verify/UX-HOME-2/s1');
fs.mkdirSync(OUT, { recursive: true });
const CAP = 0.705, PANELS = { tv43: 0.4958, tv55: 0.6342, tv65: 0.7495 };
const SPECS = [
  ['date kicker', '#tv-date'], ['clock', '#clock'], ['greeting', '#tv-greet'], ['pane titles', '#tv .tv-pane h2'],
  ['verse refs', '#tv-refs span'], ['face labels', '#tv .tv-face > span:last-child'], ['stars count', '#tv-stars .tv-face b'],
  ['feed name', '#tv-feed .who'], ['feed text', '#tv-feed .txt'], ['feed time', '#tv-feed .when'],
  ['reminder text', '#tv-rem-card .rem-text'], ['reminder byline', '#tv-rem-card .rem-by'],
];
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const out = { method: 'computed font-size x 0.705 x mm/px; H2 @3m = 8.7 mm (10 arcmin), 20/20 limit @3m = 4.4 mm (5 arcmin)', panels: PANELS };
try {
  const d = await L.device({ device: 'tv', profile: 'tv' });
  await d.goto('#home');
  await d.page.waitForFunction(() => window.hub && hub.sync.lastPull > 0 && document.querySelector('#tv-refs span') && document.querySelector('#tv-feed li .txt'), null, { timeout: 15000 }).catch(() => {});
  await sleep(1000);
  const rows = await d.page.evaluate(specs => specs.map(([name, sel]) => {
    const els = [...document.querySelectorAll(sel)].filter(e => e.getBoundingClientRect().height > 0);
    if (!els.length) return { name, missing: true };
    const px = els.map(e => parseFloat(getComputedStyle(e).fontSize));
    const e0 = els[px.indexOf(Math.min(...px))];
    return { name, n: els.length, px: Math.min(...px), sample: (e0.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 30), bottom: Math.round(e0.getBoundingClientRect().bottom) };
  }), SPECS);
  for (const r of rows) if (!r.missing) for (const [k, mm] of Object.entries(PANELS)) { r[k + 'Mm'] = +(r.px * CAP * mm).toFixed(1); r[k + '@3m'] = r[k + 'Mm'] >= 8.7 ? 'H2 ok' : 'below H2'; }
  const geo = await d.page.evaluate(() => {
    const v = document.querySelector('#views');
    const panes = [...document.querySelectorAll('#tv .tv-pane')].filter(p => !p.hidden).map(p => ({ cls: p.className.replace('tv-pane glass-strong ', ''), bottom: Math.round(p.getBoundingClientRect().bottom) }));
    return { vw: innerWidth, vh: innerHeight, scrollH: v.scrollHeight, clientH: v.clientHeight, lastPaneBottom: Math.max(...panes.map(p => p.bottom)), panes, reminders: document.querySelectorAll('#tv-rem-card .rem-text').length, fsXs: getComputedStyle(document.documentElement).getPropertyValue('--fs-xs').trim(), fsSm: getComputedStyle(document.documentElement).getPropertyValue('--fs-sm').trim() };
  });
  out.rows = rows; out.geometry = geo;
  console.table(rows); console.log(JSON.stringify(geo));
  await d.page.screenshot({ path: path.join(OUT, 's1-tv-board.png'), animations: 'disabled', caret: 'hide' });
  await d.close();
} finally {
  fs.writeFileSync(path.join(OUT, 's1-tv-text.json'), JSON.stringify(out, null, 1));
  await L.close();
}
