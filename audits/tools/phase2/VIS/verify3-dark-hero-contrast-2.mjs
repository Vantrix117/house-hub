// Skeptic #2 for "dark-hero-contrast": is the adult Home hero's text (kicker / greeting / sub-line) below WCAG AA in a
// dark palette? Measures the RENDERED background under each line of text (hero screenshot with the text made transparent,
// sampled pixel-by-pixel in the page's canvas), composites the computed text colour at its effective opacity over each
// pixel and reports the ratio distribution. Controls: light OS (Hearth), a kid's hero-soft, other family colours, all
// three times of day, Forest, iPhone width, Chromium, and a counterfactual with the dark `color: var(--text)` rule removed.
//   node "audits/tools/phase2/VIS/verify3-dark-hero-contrast-2.mjs"
// Writes only to the throwaway local rig and audits/evidence/p2/VIS/verify3-dark-hero-2*.{json,png}.
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT, DEMO } from '../../lib/local.mjs';

const EV = path.join(ROOT, 'audits/evidence/p2/VIS');
fs.mkdirSync(EV, { recursive: true });
const TAG = 'verify3-dark-hero-2';
const out = { method: 'rendered-pixel sampling under each text line; fg = computed colour x alpha x ancestor opacity composited over each bg pixel', rows: [] };

const HIDE = `.home-hero .hero-kicker, .home-hero .hero-kicker *, .home-hero .hero-title, .home-hero .hero-title *, .home-hero .hero-sub, .home-hero .hero-sub * { color: transparent !important; -webkit-text-fill-color: transparent !important; text-shadow: none !important; }`;
// the counterfactual: what the hero would look like if the dark-scheme override (design.css:429) did not apply to .hero
const NO_OVERRIDE = `:root[data-scheme="dark"] .ds .home-hero:not(.hero-soft) { color: var(--on-accent) !important; }`;

async function home(d) {
  await d.goto('#home');
  await d.page.waitForSelector('#view-home .home-hero .hero-title', { timeout: 20000 });
  await sleep(1500);
}

async function measure(d, label, { shot = false, extraCss = null } = {}) {
  const page = d.page;
  let extraHandle = null;
  if (extraCss) { extraHandle = await page.addStyleTag({ content: extraCss }); await sleep(200); }
  const info = await page.evaluate(() => {
    const hero = document.querySelector('#view-home .home-hero');
    const hr = hero.getBoundingClientRect();
    const r = document.documentElement;
    const items = [];
    for (const sel of ['.hero-kicker', '.hero-title', '.hero-sub']) {
      const el = hero.querySelector(sel); if (!el) continue;
      const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let n; const rects = []; let color = null, opacity = 1, text = '';
      while ((n = w.nextNode())) {
        const t = n.nodeValue.trim(); if (!t) continue; text += (text ? ' ' : '') + t;
        const rg = document.createRange(); rg.selectNodeContents(n);
        for (const q of rg.getClientRects()) if (q.width > 1 && q.height > 2) rects.push({ x: q.x - hr.x, y: q.y - hr.y, w: q.width, h: q.height });
        if (!color) { const p = n.parentElement; color = getComputedStyle(p).color; for (let e = p; e && e.nodeType === 1; e = e.parentElement) opacity *= parseFloat(getComputedStyle(e).opacity); }
      }
      const cs = getComputedStyle(el);
      items.push({ sel, text: text.slice(0, 80), color, opacity: +opacity.toFixed(3), fontSize: parseFloat(cs.fontSize), fontWeight: parseInt(cs.fontWeight, 10), rects });
    }
    const hcs = getComputedStyle(hero);
    return {
      heroRect: { x: hr.x, y: hr.y, w: hr.width, h: hr.height }, heroClass: hero.className, heroColor: hcs.color, heroBgImage: hcs.backgroundImage.slice(0, 400),
      dataTheme: r.getAttribute('data-theme'), dataScheme: r.dataset.scheme, dataKind: r.dataset.kind, accent: r.style.getPropertyValue('--accent'),
      tokText: getComputedStyle(r).getPropertyValue('--text').trim(), tokOnAccent: getComputedStyle(r).getPropertyValue('--on-accent').trim(),
      hour: new Date().getHours(), vw: innerWidth, items,
    };
  });
  const clip = { x: Math.max(0, info.heroRect.x), y: Math.max(0, info.heroRect.y), width: info.heroRect.w, height: info.heroRect.h };
  if (shot) await page.screenshot({ path: path.join(EV, `${TAG}-${label}.png`), clip, scale: 'css', animations: 'disabled', caret: 'hide' });
  const hide = await page.addStyleTag({ content: HIDE }); await sleep(250);
  const bgBuf = await page.screenshot({ clip, scale: 'css', animations: 'disabled', caret: 'hide' });
  if (shot) fs.writeFileSync(path.join(EV, `${TAG}-${label}-bg-only.png`), bgBuf);
  await hide.evaluate(n => n.remove());
  if (extraHandle) await extraHandle.evaluate(n => n.remove());
  const stats = await page.evaluate(async ({ b64, items }) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const cv = document.createElement('canvas'); cv.width = img.naturalWidth; cv.height = img.naturalHeight;
    const cx = cv.getContext('2d', { willReadFrequently: true }); cx.drawImage(img, 0, 0);
    const px = cx.getImageData(0, 0, cv.width, cv.height).data;
    const c1 = document.createElement('canvas').getContext('2d');
    const parse = s => { c1.clearRect(0, 0, 1, 1); c1.fillStyle = '#000'; c1.fillStyle = s; c1.fillRect(0, 0, 1, 1); const d = c1.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255]; };
    // canvas fillStyle cannot parse every CSS colour form: fall back to a probe element's resolved rgb
    const cssRgb = s => { const m = s.match(/^rgba?\(([^)]+)\)/); if (m) { const v = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [v[0], v[1], v[2], v[3] == null ? 1 : v[3]]; } const m2 = s.match(/^color\(srgb ([^)]+)\)/); if (m2) { const v = m2[1].split(/[ /]+/).filter(Boolean).map(Number); return [v[0] * 255, v[1] * 255, v[2] * 255, v[3] == null ? 1 : v[3]]; } return parse(s); };
    const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
    const hex = c => '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
    return items.map(it => {
      const fg = cssRgb(it.color); const a = fg[3] * it.opacity;
      const rs = [], bgs = [];
      for (const q of it.rects) {
        for (let y = Math.max(0, Math.floor(q.y)); y < Math.min(cv.height, Math.ceil(q.y + q.h)); y++)
          for (let x = Math.max(0, Math.floor(q.x)); x < Math.min(cv.width, Math.ceil(q.x + q.w)); x++) {
            const i = (y * cv.width + x) * 4; const bg = [px[i], px[i + 1], px[i + 2]];
            const f = [0, 1, 2].map(k => fg[k] * a + bg[k] * (1 - a));
            rs.push(ratio(f, bg)); bgs.push(bg);
          }
      }
      if (!rs.length) return { sel: it.sel, text: it.text, n: 0 };
      const idx = rs.map((r, i) => i).sort((i, j) => rs[i] - rs[j]);
      const at = p => idx[Math.min(idx.length - 1, Math.floor(p * idx.length))];
      const large = it.fontSize >= 24 || (it.fontSize >= 18.66 && it.fontWeight >= 700);
      const need = large ? 3 : 4.5;
      return {
        sel: it.sel, text: it.text, fontSize: it.fontSize, fontWeight: it.fontWeight, large, need,
        textColor: it.color, alphaXopacity: +a.toFixed(3), fgHex: hex(fg.slice(0, 3)), n: rs.length,
        min: +rs[at(0)].toFixed(2), p10: +rs[at(0.1)].toFixed(2), median: +rs[at(0.5)].toFixed(2), p90: +rs[at(0.9)].toFixed(2), max: +rs[at(0.9999)].toFixed(2),
        bgAtMin: hex(bgs[at(0)]), bgAtMedian: hex(bgs[at(0.5)]), bgAtMax: hex(bgs[at(0.9999)]),
        shareBelowNeed: +(rs.filter(r => r < need).length / rs.length).toFixed(3),
        shareBelow3: +(rs.filter(r => r < 3).length / rs.length).toFixed(3),
        pass: rs[at(0.5)] >= need,
      };
    });
  }, { b64: bgBuf.toString('base64'), items: info.items });
  const row = { label, engine: d.engine, device: d.device, profile: d.profile, mode: d.mode, ...info, items: undefined, text: stats };
  delete row.items;
  out.rows.push(row);
  console.log(`\n== ${label}  [${d.engine} ${d.device} ${d.profile} os=${d.mode}] theme=${info.dataTheme} scheme=${info.dataScheme} accent=${info.accent} hour=${info.hour} class="${info.heroClass}" heroColor=${info.heroColor}`);
  for (const s of stats) console.log(`   ${s.sel.padEnd(12)} fg=${s.fgHex} a=${s.alphaXopacity} ${s.fontSize}px/${s.fontWeight} need ${s.need}  ratio min ${s.min} p10 ${s.p10} MEDIAN ${s.median} p90 ${s.p90} max ${s.max}  bg@median ${s.bgAtMedian} (min ${s.bgAtMin}, max ${s.bgAtMax})  <need ${(s.shareBelowNeed * 100).toFixed(0)}%  ${s.pass ? 'PASS' : 'FAIL'}  "${s.text}"`);
  return row;
}

const H = 3600e3;
async function run(engine, full) {
  const L = await local({ variant: 'typical', engine });
  try {
    const dev = async (o) => { const d = await L.device(o); d.engine = engine; d.mode = o.mode; return d; };
    // 1. the claim: dark OS (System → Midnight tokens), Eli, iPad portrait, the demo morning
    const d1 = await dev({ device: 'ipad-portrait', mode: 'dark', profile: 'eli' });
    await home(d1);
    await measure(d1, `${engine}-dark-system-eli-ipad-morning`, { shot: true });
    if (!full) return;
    // counterfactual on the same page: the dark override not applied to the full-colour hero
    await measure(d1, `${engine}-dark-system-eli-ipad-morning-COUNTERFACTUAL-on-accent`, { shot: true, extraCss: NO_OVERRIDE });
    // 2. iPhone width
    const d2 = await dev({ device: 'iphone-pwa', mode: 'dark', profile: 'eli' }); await home(d2);
    await measure(d2, `${engine}-dark-system-eli-iphone-morning`, { shot: true });
    // 3. other family colours (dark)
    for (const pid of ['christian', 'mom', 'dad']) { const d = await dev({ device: 'ipad-portrait', mode: 'dark', profile: pid }); await home(d); await measure(d, `${engine}-dark-system-${pid}-ipad-morning`, { shot: pid === 'christian' }); }
    // 4. afternoon and evening (dark)
    for (const [tod, off] of [['afternoon', 5.5 * H], ['evening', 12 * H]]) { const d = await dev({ device: 'ipad-portrait', mode: 'dark', profile: 'eli', fixedTime: DEMO + off }); await home(d); await measure(d, `${engine}-dark-system-eli-ipad-${tod}`, { shot: tod === 'evening' }); }
    // 5. controls: light OS (Hearth) for Eli and Mae; a kid's hero-soft in dark
    for (const pid of ['eli', 'christian']) { const d = await dev({ device: 'ipad-portrait', mode: 'light', profile: pid }); await home(d); await measure(d, `${engine}-light-hearth-${pid}-ipad-morning`, { shot: pid === 'eli' }); }
    { const d = await dev({ device: 'ipad-portrait', mode: 'dark', profile: 'ezra' }); await home(d); await measure(d, `${engine}-dark-system-ezra-kid-ipad-morning`, { shot: true }); }
    // 6. explicit Midnight and Forest picked by the person (dad; writes his theme on the throwaway rig only)
    { const d = await dev({ device: 'ipad-portrait', mode: 'light', profile: 'dad' });
      await home(d);
      for (const t of ['midnight', 'forest']) { await d.page.evaluate(t => hub.setTheme(t), t); await sleep(500); await home(d); await measure(d, `${engine}-lightos-${t}-dad-ipad-morning`, { shot: t === 'forest' }); } }
  } finally { await L.close(); }
}

await run('webkit', true);
await run('chromium', false);
fs.writeFileSync(path.join(EV, `${TAG}.json`), JSON.stringify(out, null, 1));
console.log('\nwrote', path.join(EV, `${TAG}.json`));
