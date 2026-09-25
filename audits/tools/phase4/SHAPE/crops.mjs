// Phase 4 SHAPE — side-by-side evidence: one content card and one primary button per area (iPad portrait, light OS,
// System theme, typical household), cropped at 1x and laid out on one contact sheet with the measured radius / padding /
// border / elevation under each. Plus the concentric-corner examples.
//   node audits/tools/phase4/SHAPE/crops.mjs → audits/evidence/p4/SHAPE/sheet-cards.png, sheet-buttons.png, sheet-concentric.png
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { local, sleep } from '../../lib/local.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const EV = path.join(ROOT, 'audits/evidence/p4/SHAPE');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'shape-crops-'));

const CARDS = [
  { area: 'shell', hash: '#home', sel: '.glance > .card.gcard', label: 'Shell Home .card' },
  { area: 'shell', hash: '#me', sel: '.me-grid > .card.glass:has(#syncnow)', label: 'Shell Me .card.glass' },
  { area: 'f260', sel: 'section#today', label: 'F260 Today' },
  { area: 'f260', sel: '#hero', label: 'F260 Next up' },
  { area: 'leftovers', sel: '.list .item', label: 'Larder item' },
  { area: 'prayer', sel: '.ledger', label: 'Prayer ledger' },
  { area: 'dollywood', sel: '.profwrap', label: 'Build guide profile' },
  { area: 'kidverse', sel: 'section#story', label: 'Kid Verse story' },
  { area: 'verses', sel: '#stats', label: 'Verses stats' },
  { area: 'tv', device: 'tv', profile: 'tv', hash: '#home', sel: '.tv-pane.tv-verse', label: 'TV verse pane' },
];
const BUTTONS = [
  { area: 'shell', hash: '#me', sel: '#syncnow', label: 'Shell .btn' },
  { area: 'f260', sel: '#todayDone', label: 'F260 Done' },
  { area: 'leftovers', sel: 'button.log', label: 'Larder Log' },
  { area: 'prayer', sel: 'button.act.hero', label: 'Prayer Pray now' },
  { area: 'tally', sel: '#plus', label: 'Tally +' },
  { area: 'timer', sel: '#go', label: 'Timer Start' },
  { area: 'verses', sel: '#show', label: 'Verses Show' },
  { area: 'kidverse', profile: 'ezra', sel: '#done', label: 'Kid Verse Done (kid)' },
  { area: 'dollywood', sel: '.tabs button', label: 'Build guide tabs' },
  { area: 'dollywood-live', sel: '#lv-family', label: 'Park map tab' },
];
const CONC = [
  { area: 'shell', hash: '#me', sel: '.me-grid > .card.glass:has(#syncnow)', label: 'Shell Me card R22, 21 px inset, buttons r16 (want ~1)' },
  { area: 'verses', sel: '#trainer', label: 'Verses trainer R36, 25 px inset, buttons r28 (want ~11)' },
  { area: 'kidverse', sel: 'section#story', label: 'Kid Verse story R28, 21 px inset, button r28 (want ~7)' },
  { area: 'leftovers', sel: 'form#add', label: 'Larder add bar R16, 13 px inset, fields r12 (want ~3)' },
];

function measure(el) {
  const s = getComputedStyle(el);
  const px = v => Math.round(parseFloat(v) * 10) / 10;
  return { w: Math.round(el.getBoundingClientRect().width), h: Math.round(el.getBoundingClientRect().height), r: px(s.borderTopLeftRadius), pad: [s.paddingTop, s.paddingRight, s.paddingBottom, s.paddingLeft].map(px).join('/'), border: px(s.borderTopWidth), shadow: s.boxShadow === 'none' ? 'none' : s.boxShadow.split(/,(?![^(]*\))/).length + ' layers', bg: s.backgroundColor };
}

const L = await local({ variant: 'typical', engine: 'webkit' });
const results = { cards: [], buttons: [], conc: [] };
try {
  for (const [list, key] of [[CARDS, 'cards'], [BUTTONS, 'buttons'], [CONC, 'conc']]) {
    for (const c of list) {
      const d = await L.device({ device: c.device || 'ipad-portrait', mode: 'light', profile: c.profile || 'eli' });
      try {
        let fr;
        if (c.area === 'shell' || c.area === 'tv') { await d.goto(c.hash); await sleep(2500); fr = d.page.mainFrame(); }
        else { fr = await d.openApp(c.area); await sleep(c.area.startsWith('dollywood') ? 6000 : 2500); }
        const loc = fr.locator(c.sel).first();
        await loc.scrollIntoViewIfNeeded({ timeout: 4000 }).catch(() => {});
        await sleep(400);
        const m = await loc.evaluate(measure);
        const file = path.join(TMP, `${key}-${c.area}-${results[key].length}.png`);
        await loc.screenshot({ path: file, animations: 'disabled', timeout: 8000, scale: 'css' });
        results[key].push({ ...c, ...m, file });
        console.log(key, c.label, JSON.stringify(m));
      } catch (e) { console.log('ERR', key, c.label, e.message.split('\n')[0]); results[key].push({ ...c, error: e.message.split('\n')[0] }); }
      await d.close();
    }
  }
  // contact sheets
  const sheet = async (key, title, out, colW) => {
    const items = results[key].filter(x => !x.error);
    const html = `<!doctype html><meta charset=utf-8><style>body{margin:0;padding:16px;background:#E9E6E1;font:13px system-ui,Segoe UI,sans-serif;color:#222}h1{font-size:16px;margin:0 0 12px}.g{display:flex;flex-wrap:wrap;gap:16px;align-items:flex-start}.c{width:${colW}px;background:#fff;padding:10px;border-radius:6px}.c img{max-width:100%;display:block;margin:0 auto 6px}.c b{display:block}.c span{color:#555;font-size:12px}</style><h1>${title} (crops at 1x CSS; wider ones scaled to the column)</h1><div class=g>${items.map(x => `<div class=c><img src="${pathToFileURL(x.file).href}"><b>${x.label}</b><span>${x.w}×${x.h} · r ${x.r} · pad ${x.pad} · border ${x.border} · shadow ${x.shadow}</span></div>`).join('')}</div>`;
    const hf = path.join(TMP, key + '.html'); fs.writeFileSync(hf, html);
    const d = await L.device({ device: 'desktop', mode: 'light', profile: null });
    await d.page.setViewportSize({ width: 1440, height: 900 });
    await d.page.goto(pathToFileURL(hf).href); await sleep(500);
    await d.page.screenshot({ path: out, fullPage: true, scale: 'css' });
    await d.close();
  };
  await sheet('cards', 'Content cards per area (iPad portrait 820, light, System theme, Eli)', path.join(EV, 'sheet-cards.png'), 440);
  await sheet('buttons', 'Primary / main action buttons per area (iPad portrait 820, light, System theme)', path.join(EV, 'sheet-buttons.png'), 330);
  await sheet('conc', 'Concentric corners: container radius vs inner control radius', path.join(EV, 'sheet-concentric.png'), 680);
} finally { await L.close(); }
fs.writeFileSync(path.join(EV, 'crops.json'), JSON.stringify(Object.fromEntries(Object.entries(results).map(([k, v]) => [k, v.map(({ file, ...x }) => x)])), null, 1));
fs.rmSync(TMP, { recursive: true, force: true });
console.log('done');
