// Completeness critic: the report's "every text pair passes AA" (visual.json) never measured the add bar's error line
// (.err, 12 px, color var(--danger), apps/leftovers.html:62, shown by setErr at 180/298/322) or the sync line (.mode.warn,
// 12 px, var(--warn-ink), apps/leftovers.html:26-27). This reads the computed colours in each palette inside the Larder
// frame and computes WCAG contrast against the glass bar (--glass-strong composited over --bg, and over --surface for a
// card behind the bar) and against the page.
import { local, sleep } from '../../lib/local.mjs';
import fs from 'node:fs';
import path from 'node:path';
const EV = path.resolve('audits/evidence/p3/leftovers'); fs.mkdirSync(EV, { recursive: true });
const parse = s => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
const over = (fg, bg) => ({ r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 });
const lum = c => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; return .2126 * f(c.r) + .7152 * f(c.g) + .0722 * f(c.b); };
const cr = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return +((x + .05) / (y + .05)).toFixed(2); };
const L = await local({ variant: 'typical', clock: 'demo' });
const out = {};
try {
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli' });
  await d.goto('#home');
  const f = await d.openApp('leftovers');
  await f.waitForSelector('.item .done', { timeout: 20000 }); await sleep(800);
  for (const theme of ['hearth', 'parchment', 'frost', 'midnight', 'forest']) {
    const c = await f.evaluate(t => {
      document.documentElement.dataset.theme = t;
      const err = document.getElementById('err'); err.hidden = false; err.textContent = "Couldn't hear that — try again or type it.";
      const mode = document.getElementById('mode'); mode.hidden = false; mode.className = 'mode sans warn'; mode.textContent = 'x';
      const cs = getComputedStyle(document.documentElement), v = n => cs.getPropertyValue(n).trim();
      const probe = n => { const e = document.createElement('i'); e.style.color = `var(${n})`; document.body.append(e); const col = getComputedStyle(e).color; e.remove(); return col; };
      return { err: getComputedStyle(err).color, errPx: getComputedStyle(err).fontSize, mode: getComputedStyle(mode).color, modePx: getComputedStyle(mode).fontSize,
        glass: probe('--glass-strong'), bg: probe('--bg'), surface: probe('--surface') };
    }, theme);
    const bg = parse(c.bg), surface = parse(c.surface), glass = parse(c.glass);
    out[theme] = { raw: c, err_on_glass_over_bg: cr(parse(c.err), over(glass, bg)), err_on_glass_over_card: cr(parse(c.err), over(glass, surface)), mode_on_page: cr(parse(c.mode), bg) };
    console.log(theme, JSON.stringify({ errPx: c.errPx, err_on_glass_over_bg: out[theme].err_on_glass_over_bg, err_on_glass_over_card: out[theme].err_on_glass_over_card, mode_on_page: out[theme].mode_on_page }));
  }
  await f.evaluate(() => { document.documentElement.dataset.theme = 'hearth'; });
  await d.page.screenshot({ path: path.join(EV, 'critic-err-contrast-hearth-iphone.png'), scale: 'css' });
} finally { await L.close(); }
fs.writeFileSync(path.join(EV, 'critic-err-contrast.json'), JSON.stringify(out, null, 1));
console.log('saved audits/evidence/p3/leftovers/critic-err-contrast.json');
