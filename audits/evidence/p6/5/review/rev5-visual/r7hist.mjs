// rev5-visual probe 4: heading wrap, practice modes at 375 XXL, histogram per palette, guest, editor dark, kid fold shot
import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
const REPO = 'C:/Users/ex_bo/OneDrive/Claude Related/App Hub';
const { local, sleep, DEMO } = await import(pathToFileURL(REPO + '/audits/tools/lib/local.mjs').href);
const OUT = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'));
const SHOTS = path.join(OUT, 'shots'); fs.mkdirSync(SHOTS, { recursive: true });
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const PH = 'Alpha bravo charlie, delta echo foxtrot golf; hotel india juliet kilo lima mike november oscar papa quebec romeo sierra tango.';
const res = {};
const log = (k, v) => { res[k] = v; console.log(k, JSON.stringify(v)); };
async function open(d, id = 'verses') { const f = await d.openApp(id); await sleep(2000); return f; }
const lum = rgb => { const m = String(rgb).match(/[\d.]+/g); const [r, g, b] = m.slice(0, 3).map(Number).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return +(((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)).toFixed(2)); };
try {
  // histogram per palette (independent): fills order, edge vs card, number/label contrast
  for (const theme of ['hearth', 'parchment', 'frost', 'midnight', 'forest', 'graphite']) {
    const d = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: DEMO, localStorage: { 'hub.theme': JSON.stringify(theme) } });
    const f = await open(d);
    await f.evaluate(t => { document.documentElement.setAttribute('data-theme', t); document.documentElement.setAttribute('data-scheme', ['midnight', 'forest', 'graphite'].includes(t) ? 'dark' : 'light'); }, theme); await sleep(300);
    const m = await f.evaluate(() => { const card = getComputedStyle(document.getElementById('stats')).backgroundColor; return { card, bars: [...document.querySelectorAll('#boxes .bx')].map(b => { const i = b.querySelector('.col i'), cs = getComputedStyle(i); return { bg: cs.backgroundColor, edge: cs.borderTopColor, zero: b.classList.contains('zero'), lbl: getComputedStyle(b.querySelector('.lbl')).color }; }) }; });
    const out = { card: m.card, fillVsCard: m.bars.map(b => ratio(b.bg, m.card)), edgeVsCard: m.bars.map(b => ratio(b.edge, m.card)), lblVsCard: ratio(m.bars[0].lbl, m.card), fillLum: m.bars.map(b => +lum(b.bg).toFixed(3)) };
    log(`hist-${theme}`, out);
    await d.close();
  }
} catch (e) { console.error('ERR', e); }
finally { fs.writeFileSync(path.join(OUT, 'r7hist.json'), JSON.stringify(res, null, 1)); await L.close(); }
