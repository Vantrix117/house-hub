// Phase 4 TOK — skeptic #1 for "tok-focus-ring": is --focus (0 0 0 3px accent 38%) under 3:1 against what it sits on?
// Independent of pairs.mjs / lib-tok.mjs: own colour maths, measured on the rig's local instance.
//  1. For each theme x profile: sign in on desktop (theme set as the profile's own pref + mirror), read the live root's
//     --accent, --surface, --bg and compute (own sRGB maths) the 38% ring composited over --surface and --bg vs that colour.
//  2. Real focus: press Tab through the shell's Home and Me, and on the first focused element whose computed box-shadow
//     is the 3px focus ring, screenshot at 1x and read the rendered pixels: ring (2 px outside the border box) vs just
//     outside the ring (8 px out) -> contrast of what is actually painted.
//   node audits/tools/phase4/TOK/verify-tok-focus-ring-1.mjs -> audits/evidence/p4/TOK/verify-tok-focus-ring-1.json (+ 1x PNGs)
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';

const OUT = path.resolve('audits/evidence/p4/TOK');
const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const cr = (a, b) => { const x = lum(a), y = lum(b); return +((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)).toFixed(2); };
const mix = (fg, bg, a) => fg.map((v, i) => Math.round(v * a + bg[i] * (1 - a)));
const hexTo = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));

const THEMES = [['hearth', 'light'], ['parchment', 'light'], ['frost', 'light'], ['midnight', 'dark'], ['forest', 'dark'], ['system', 'dark']];
const PROFILES = ['eli', 'dad', 'mom', 'christian', 'niece'];
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const res = { computed: [], painted: [] };
const setTheme = (p, t) => L.apiAs(p, '/api/data/hub/theme?scope=person', { method: 'PUT', body: { value: t, updated_at: Date.now() } });
try {
  for (const [theme, mode] of THEMES) for (const prof of PROFILES) {
    await setTheme(prof, theme);
    const d = await L.device({ device: 'desktop', profile: prof, mode, localStorage: theme === 'system' ? {} : { 'hub.theme': JSON.stringify(theme) } });
    await d.goto('#home'); await d.page.waitForSelector('#view-home', { timeout: 15000 });
    await d.page.waitForFunction(() => window.hub && hub.sync && hub.sync.lastPull, null, { timeout: 10000 }).catch(() => {});
    await sleep(700);
    const v = await d.page.evaluate(() => {
      const probe = document.createElement('i'); document.body.appendChild(probe);
      const rgb = x => { probe.style.color = ''; probe.style.color = x; const m = getComputedStyle(probe).color.match(/[\d.]+/g).map(Number); return m.length > 3 && /^color\(/.test(getComputedStyle(probe).color) ? m : m; };
      const rs = getComputedStyle(document.documentElement);
      const o = { dataTheme: document.documentElement.dataset.theme, scheme: document.documentElement.dataset.scheme, accent: rs.getPropertyValue('--accent').trim(), focus: rs.getPropertyValue('--focus').trim(), surfaceCss: getComputedStyle(probe).color, surface: rgb('var(--surface)'), bg: rgb('var(--bg)'), acc: rgb('var(--accent)') };
      probe.remove(); return o;
    });
    const fix = a => a.length >= 3 && a.every(n => n <= 1.0001) && a.slice(0, 3).some(n => n % 1) ? a.map(n => n * 255) : a;
    const acc = fix(v.acc).slice(0, 3), surf = fix(v.surface).slice(0, 3), bg = fix(v.bg).slice(0, 3);
    const ringS = mix(acc, surf, 0.38), ringB = mix(acc, bg, 0.38);
    const row = { theme, mode, prof, dataTheme: v.dataTheme, scheme: v.scheme, accent: v.accent, focus: v.focus, surface: surf, bg, ringOverSurface: ringS, ratioOverSurface: cr(ringS, surf), ringOverBg: ringB, ratioOverBg: cr(ringB, bg), solidAccentOverSurface: cr(acc, surf) };
    res.computed.push(row);
    console.log(theme.padEnd(9), prof.padEnd(9), 'data-theme', v.dataTheme, v.scheme, 'accent', v.accent, '| ring/surface', row.ratioOverSurface, 'ring/bg', row.ratioOverBg, '| solid accent/surface', row.solidAccentOverSurface);

    // painted ring on a real focusable (one profile per theme to keep the run short)
    if (prof === 'eli' || prof === 'dad') {
      const found = [];
      for (const tab of ['#home', '#me']) {
        await d.goto(tab); await sleep(1200);
        await d.page.mouse.click(5, 5);
        for (let i = 0; i < 45; i++) {
          await d.page.keyboard.press('Tab');
          const info = await d.page.evaluate(() => { const e = document.activeElement; if (!e || e === document.body) return null; const cs = getComputedStyle(e); const r = e.getBoundingClientRect();
            return { tag: e.tagName, cls: (e.className && e.className.baseVal === undefined ? e.className : '').slice(0, 60), text: (e.innerText || e.value || e.getAttribute('aria-label') || '').trim().slice(0, 30), fv: e.matches(':focus-visible'), boxShadow: cs.boxShadow, outline: cs.outlineStyle + ' ' + cs.outlineWidth, r: { x: r.x, y: r.y, w: r.width, h: r.height } }; });
          if (!info) continue;
          if (/3px/.test(info.boxShadow) && info.r.w > 20 && info.r.y > 20 && info.r.y < 860) { found.push({ tab, ...info }); break; }
        }
        if (found.length) break;
      }
      const f = found[0];
      if (!f) { res.painted.push({ theme, prof, found: null }); console.log('   no focused element with the 3px ring found in 45 tabs on Home/Me'); }
      else {
        await sleep(400);
        const pad = 14, clip = { x: Math.max(0, Math.floor(f.r.x - pad)), y: Math.max(0, Math.floor(f.r.y - pad)), width: Math.ceil(Math.min(f.r.w, 260) + pad * 2), height: Math.ceil(f.r.h + pad * 2) };
        const file = path.join(OUT, `verify-tok-focus-ring-1-${theme}-${prof}.png`);
        const buf = await d.page.screenshot({ path: file, scale: 'css', animations: 'disabled', caret: 'hide', clip });
        const px = await d.page.evaluate(async ({ b64, pts }) => { const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode(); const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0); return pts.map(([x, y]) => Array.from(g.getImageData(x, y, 1, 1).data).slice(0, 3)); },
          { b64: buf.toString('base64'), pts: [
            // top edge, 1/3 across (away from the rounded corner): ring rows 1..3 px above the box, outside 8 px above; also left edge mid
            [Math.round(f.r.x - clip.x + Math.min(f.r.w, 260) / 3), Math.round(f.r.y - clip.y) - 2], [Math.round(f.r.x - clip.x + Math.min(f.r.w, 260) / 3), Math.round(f.r.y - clip.y) - 9],
            [Math.round(f.r.x - clip.x) - 2, Math.round(f.r.y - clip.y + f.r.h / 2)], [Math.round(f.r.x - clip.x) - 9, Math.round(f.r.y - clip.y + f.r.h / 2)],
          ] });
        const p = { theme, prof, el: f, png: path.relative(process.cwd(), file).replace(/\\/g, '/'), ringTop: px[0], outsideTop: px[1], ratioTop: cr(px[0], px[1]), ringLeft: px[2], outsideLeft: px[3], ratioLeft: cr(px[2], px[3]) };
        res.painted.push(p);
        console.log('   painted on', f.tab, f.tag, JSON.stringify(f.cls), JSON.stringify(f.text), 'fv', f.fv, '|', f.boxShadow.slice(0, 70), '| top ring', px[0], 'out', px[1], '=>', p.ratioTop, '| left ring', px[2], 'out', px[3], '=>', p.ratioLeft);
      }
    }
    await d.close();
  }
} catch (e) { console.log('ERROR', e && e.stack || e); }
finally { await L.close(); }
const s = res.computed.map(r => r.ratioOverSurface), b = res.computed.map(r => r.ratioOverBg);
res.summary = { cases: s.length, underThreeOverSurface: s.filter(x => x < 3).length, minS: Math.min(...s), maxS: Math.max(...s), underThreeOverBg: b.filter(x => x < 3).length, minB: Math.min(...b), maxB: Math.max(...b), painted: res.painted.filter(p => p.ratioTop).map(p => [p.theme, p.prof, p.ratioTop, p.ratioLeft]) };
console.log('SUMMARY', JSON.stringify(res.summary));
fs.writeFileSync(path.join(OUT, 'verify-tok-focus-ring-1.json'), JSON.stringify(res, null, 1));
