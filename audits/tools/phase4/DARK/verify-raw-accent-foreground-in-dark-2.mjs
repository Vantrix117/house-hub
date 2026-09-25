// Phase 4 DARK, skeptic 2 for "raw-accent-foreground-in-dark". Independent re-measure (does not import accent-fg.mjs).
// For each theme/profile: computed foreground vs the composited background it sits on (walk up ancestors, alpha-blend
// every background-color), plus a rendered check (element screenshot decoded in-page: most common pixel = background,
// pixel nearest the computed colour (else farthest in luminance) = ink). Checks:
//   timer arc   .dial .ring .fg (apps/timer.html:22,29) while a 5-min timer runs
//   kitchen     #kitchen .k-cat (apps/prayer.html:359) on My list AND on the Family list (body.shared -> --teal, prayer.html:39)
//   park walk   real .lv-item .d small rows in the Nearby list (template.html:440/1420); synthetic probe only if none render
//   home ring   .ring .fg in the shell (already reported in audits/02-shell.md:5845-5850)
//   node audits/tools/phase4/DARK/verify-raw-accent-foreground-in-dark-2.mjs -> audits/evidence/p4/DARK/verify-raw-accent-foreground-in-dark-2.json
import fs from 'node:fs'; import path from 'node:path';
import { local, ROOT, sleep } from '../../lib/local.mjs';
const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const Lm = c => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
const CR = (a, b) => { if (!a || !b) return null; const x = Lm(a), y = Lm(b); return +((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)).toFixed(2); };
const EV = path.join(ROOT, 'audits/evidence/p4/DARK');
const RUN = process.argv[2] ? process.argv[2].split(',') : null;

// in-page: parse colours, composite background, and analyse a PNG (base64) of the element
const PAGE = `window.__v2 = {
  P(s){ const m = String(s).match(/[\\d.]+/g); if(!m) return null; return [+m[0], +m[1], +m[2], m[3] === undefined ? 1 : +m[3]]; },
  bgOf(el){ const layers = []; let n = el; while(n && n.nodeType === 1){ const c = this.P(getComputedStyle(n).backgroundColor); if(c && c[3] > 0) layers.push(c); if(c && c[3] >= 1) break; n = n.parentElement; }
    let out = [255,255,255]; if(!layers.length || layers[layers.length-1][3] < 1){ const r = this.P(getComputedStyle(document.documentElement).backgroundColor); if(r && r[3] > 0) out = r.slice(0,3); }
    for(let i = layers.length - 1; i >= 0; i--){ const [r,g,b,a] = layers[i]; out = [r*a + out[0]*(1-a), g*a + out[1]*(1-a), b*a + out[2]*(1-a)]; }
    return out.map(Math.round); },
  async px(b64, fg){ const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode(); const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0); const d = x.getImageData(0,0,c.width,c.height).data;
    const cnt = new Map(); for(let i=0;i<d.length;i+=4){ const k = d[i]+','+d[i+1]+','+d[i+2]; cnt.set(k,(cnt.get(k)||0)+1); }
    const bg = [...cnt.entries()].sort((a,b)=>b[1]-a[1])[0][0].split(',').map(Number);
    const lin = v => { v/=255; return v <= .04045 ? v/12.92 : ((v+.055)/1.055)**2.4; }; const L = c => .2126*lin(c[0]) + .7152*lin(c[1]) + .0722*lin(c[2]);
    const lb = L(bg); let best = null, bd = -1, near = null, nd = 1e9; for(let i=0;i<d.length;i+=4){ const c=[d[i],d[i+1],d[i+2]]; const dd = Math.abs(L(c)-lb); if(dd > bd){ bd = dd; best = c; } if(fg){ const q = Math.hypot(c[0]-fg[0], c[1]-fg[1], c[2]-fg[2]); if(q < nd){ nd = q; near = c; } } }
    return { bg, ink: near && nd < 40 ? near : best, inkIs: near && nd < 40 ? 'nearest-to-computed (dist ' + nd.toFixed(1) + ')' : 'farthest-luminance', farthest: best }; }
};`;

async function probe(frame, sel, prop, { all = false } = {}) {
  await frame.evaluate(PAGE);
  const els = await frame.$$(sel);
  const res = [];
  for (const h of els.slice(0, all ? 4 : 1)) {
    const info = await h.evaluate((e, prop) => { const cs = getComputedStyle(e); const r = e.getBoundingClientRect(); return { fg: window.__v2.P(cs[prop]), bg: window.__v2.bgOf(e), fs: cs.fontSize, fw: cs.fontWeight, text: (e.textContent || '').trim().slice(0, 40), w: r.width, h: r.height, vis: r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none', op: cs.opacity }; }, prop);
    let rendered = null;
    if (info.vis) { try { const b = await h.screenshot({ scale: 'css', animations: 'disabled' }); rendered = await frame.evaluate(a => window.__v2.px(a[0], a[1]), [b.toString('base64'), info.fg]); } catch (e) { rendered = { err: String(e.message).slice(0, 80) }; } }
    res.push({ ...info, computed: CR(info.fg, info.bg), rendered: rendered && rendered.ink ? { ...rendered, ratio: CR(rendered.ink, rendered.bg) } : rendered });
  }
  return res;
}

const CASES = [['midnight','eli'],['midnight','dad'],['midnight','christian'],['forest','eli'],['forest','dad'],['hearth','eli']].filter(([t,p]) => !RUN || RUN.includes(t + ':' + p));
const out = [];
const L = await local({ variant: 'park', engine: 'webkit' });
try {
  for (const [theme, profile] of CASES) {
    await L.reset('park');
    if (theme !== 'hearth') await L.apiAs(profile, '/api/data/hub/theme?scope=person', { method: 'PUT', body: { value: theme } });
    const d = await L.device({ device: 'ipad-portrait', mode: 'light', profile, localStorage: theme === 'hearth' ? null : { 'hub.theme': JSON.stringify(theme) } });
    const rec = { theme, profile };
    try {
      await d.goto('#home'); await sleep(2500);
      rec.accent = await d.page.evaluate(() => ({ accent: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(), theme: document.documentElement.dataset.theme, scheme: document.documentElement.dataset.scheme }));
      rec.homeRing = await probe(d.page, '.ring .fg', 'stroke');
      let f = await d.openApp('timer', { wait: '.dial' }); await sleep(1000);
      await f.click('#go').catch(() => {}); await sleep(2500);
      rec.timerArc = await probe(f, '.dial .ring .fg', 'stroke');
      await f.click('#reset').catch(() => {}); await sleep(300);
      f = await d.openApp('prayer', { wait: '#moreBtn' }); await sleep(1500);
      for (const list of ['personal', 'shared']) {
        await f.evaluate(() => { const k = document.getElementById('kitchen'); if (k && k.classList.contains('on')) { const c = k.querySelector('.close'); c && c.click(); } }); await sleep(300);
        await f.click(`[data-list="${list}"]`).catch(() => {}); await sleep(600);
        await f.click('#moreBtn').catch(() => {}); await sleep(500); await f.click('[data-more="kitchen"]').catch(() => {}); await sleep(1500);
        rec['kitchen_' + list] = { bodyShared: await f.evaluate(() => document.body.classList.contains('shared')), rows: await probe(f, '#kitchen .k-cat', 'color') };
      }
      f = await d.openApp('dollywood-live', { wait: 'body' }); await sleep(3000);
      // place a spot by hand at the map centre, as Phase 3 did (audits/tools/phase3/dollywood-live/functional.mjs:15-18)
      await f.click('#loc-near').catch(() => {}); await sleep(300);
      await f.click('#loc-place').catch(() => {}); await sleep(400);
      await f.click('#lv-act').catch(() => {}); await sleep(1800);
      rec.parkPill = await f.evaluate(() => document.getElementById('loc-sec').textContent);
      const rows = await probe(f, '#near-list .lv-item .d small', 'color', { all: true });
      rec.parkWalk = rows;
      rec.parkSheetState = await f.evaluate(() => { const s = document.querySelector('.lv-sheet'); return s && s.dataset.state; });
      // (a full-page shot here was 1.5 MB, over the evidence limit, and is not cited)
    } catch (e) { rec.error = String(e.message).slice(0, 200); }
    finally { await d.close(); }
    out.push(rec);
    const s = r => r && r.length ? r.map(x => `${x.computed}/${x.rendered && x.rendered.ratio}`).join(' ') : 'none';
    console.log(theme.padEnd(9), profile.padEnd(10), rec.accent && rec.accent.accent, '| ring', s(rec.homeRing), '| arc', s(rec.timerArc), '| k-mine', s(rec.kitchen_personal && rec.kitchen_personal.rows), '| k-family', s(rec.kitchen_shared && rec.kitchen_shared.rows), '| walk', s(rec.parkWalk), rec.error || '');
  }
} finally { await L.close(); }
const file = path.join(EV, 'verify-raw-accent-foreground-in-dark-2' + (RUN ? '-' + RUN.join('_').replace(/:/g, '-') : '') + '.json');
fs.writeFileSync(file, JSON.stringify({ note: 'computed = computed fg vs alpha-composited ancestor background; rendered = element screenshot, modal pixel vs farthest-luminance pixel (antialiasing lowers it slightly for thin text). Targets 4.5 text, 3 graphics.', out }, null, 1));
console.log('wrote', path.relative(ROOT, file));
