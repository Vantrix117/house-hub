// Phase 4 COLOR, skeptic #1 for "raw-accent-ink-no-dark-lift": re-measure from scratch on the local instance.
// Parts (pass one or more as args; default all): tokens | prayer | park
//  tokens: raw profile hex (worker/seed.sql:4-11) vs the resolved --bg/--surface/--surface-2 of every palette, and vs --accent-deep
//  prayer: #kitchen .k-cat (apps/prayer.html:359) and #f-mic (:387) computed colour vs computed background, plus pixel median of
//          the kitchen background with text hidden; records whether body.shared (family list: --accent = teal, :39) is on
//  park:   dollywood-live Nearby tab icon (template:429), walk-time <small> (:440), .lv-from b (:524), route glyph svg (:458/:464)
// Usage: node audits/tools/phase4/COLOR/verify-raw-accent-ink-no-dark-lift-1.mjs [tokens] [prayer] [park]
import { local, sleep } from '../../lib/local.mjs';
import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib';
const EV = path.resolve('audits/evidence/p4/COLOR'); fs.mkdirSync(EV, { recursive: true });
const parts = process.argv.slice(2).length ? process.argv.slice(2) : ['tokens', 'prayer', 'park'];
const lin = v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; };
const lum = ([r, g, b]) => .2126 * lin(r) + .7152 * lin(g) + .0722 * lin(b);
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return +((x + .05) / (y + .05)).toFixed(2); };
const parse = s => { if (!s) return null; const srgb = /^color\(srgb/.test(s); const m = s.replace(/^color\(srgb/, '').match(/[\d.]+/g); if (!m) return null; const n = m.map(Number);
  return { rgb: n.slice(0, 3).map(v => srgb ? v * 255 : v), a: n.length > 3 ? n[3] : 1 }; };
const over = (fg, bg) => fg.rgb.map((v, i) => v * fg.a + bg[i] * (1 - fg.a));
const hex = c => '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
function png(buf) { let o = 8, w, h, ct, idat = []; while (o < buf.length) { const len = buf.readUInt32BE(o), t = buf.toString('ascii', o + 4, o + 8), d = buf.subarray(o + 8, o + 8 + len); if (t === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); ct = d[9]; } if (t === 'IDAT') idat.push(d); o += 12 + len; }
  const bpp = ct === 6 ? 4 : 3, raw = zlib.inflateSync(Buffer.concat(idat)), px = Buffer.alloc(w * h * bpp), st = w * bpp;
  for (let y = 0; y < h; y++) { const f = raw[y * (st + 1)], line = raw.subarray(y * (st + 1) + 1, (y + 1) * (st + 1)); for (let x = 0; x < st; x++) { const a = x >= bpp ? px[y * st + x - bpp] : 0, b = y ? px[(y - 1) * st + x] : 0, c = x >= bpp && y ? px[(y - 1) * st + x - bpp] : 0; let v = line[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1; else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; } px[y * st + x] = v & 255; } }
  return { w, h, at: (x, y) => { const i = (Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))) * bpp; return [px[i], px[i + 1], px[i + 2]]; } }; }
const SEED = { eli: '#4F5D8C', christian: '#BC5A38', ezra: '#137F77', kiara: '#B4861B', mom: '#8A6A4B', dad: '#3D5A3D', niece: '#5B8143', tv: '#4C4C58' };
const h2 = s => [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16));
const out = { note: 'skeptic #1 re-measure; ratios are WCAG 2 contrast; text needs 4.5 (3 for large), icons 3', tokens: null, prayer: [], park: [] };

async function themed(L, variant, profile, theme, mode, device) {
  await L.reset(variant);
  if (theme !== 'system') { const r = await L.apiAs(profile, '/api/data/hub/theme?scope=person', { method: 'PUT', body: { value: theme } }); if (r.status >= 300) throw new Error('theme PUT ' + r.status); }
  return L.device({ device, mode, profile, fixedTime: variant === 'park' ? false : undefined, localStorage: theme !== 'system' ? { 'hub.theme': JSON.stringify(theme) } : {} });
}
// resolve a CSS colour expression inside a document
const RESOLVE = (exprs) => { const p = document.createElement('i'); document.body.append(p); const r = {}; for (const [k, e] of Object.entries(exprs)) { p.style.color = ''; p.style.color = e; r[k] = getComputedStyle(p).color; } p.remove(); return r; };
// median background pixel inside an element's box, with the element's ink hidden
async function bgMedian(d, doc, sel) {
  const off = doc === d.page ? [0, 0] : await d.page.evaluate(() => { const b = document.querySelector('iframe#frame, iframe').getBoundingClientRect(); return [b.x, b.y]; });
  const box = await doc.evaluate(sel => { const e = [...document.querySelectorAll(sel)].find(x => x.getClientRects().length); if (!e) return null; const b = e.getBoundingClientRect(); return [b.x, b.y, b.width, b.height]; }, sel);
  if (!box) return null;
  await doc.evaluate(sel => { const s = document.createElement('style'); s.id = '__v1'; s.textContent = `${sel}, ${sel} *{color:transparent!important;-webkit-text-fill-color:transparent!important;stroke:transparent!important}`; document.head.append(s); }, sel);
  await sleep(150);
  const img = png(await d.page.screenshot({ scale: 'css', animations: 'disabled' }));
  await doc.evaluate(() => document.getElementById('__v1')?.remove());
  const px = []; for (let y = box[1] + 1; y < box[1] + box[3] - 1; y++) for (let x = box[0] + 1; x < box[0] + box[2] - 1; x++) px.push(img.at(Math.round(x + off[0]), Math.round(y + off[1])));
  px.sort((p, q) => lum(p) - lum(q)); return { median: px[px.length >> 1], min: px[0], max: px[px.length - 1], n: px.length, box: box.map(Math.round) };
}
async function ink(doc, sel, prop = 'color') { return doc.evaluate(([sel, prop]) => { const e = [...document.querySelectorAll(sel)].find(x => x.getClientRects().length) || document.querySelector(sel); if (!e) return null; const cs = getComputedStyle(e);
  let op = 1; for (let n = e; n && n.nodeType === 1; n = n.parentElement) op *= +getComputedStyle(n).opacity;
  return { v: prop === 'stroke' ? cs.stroke : cs.color, bg: cs.backgroundColor, fs: cs.fontSize, fw: cs.fontWeight, op, visible: !!e.getClientRects().length, text: (e.textContent || '').trim().slice(0, 30), theme: document.documentElement.dataset.theme || 'system', scheme: document.documentElement.dataset.scheme, accent: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() }; }, [sel, prop]); }

const PARK = parts.length === 1 && parts[0] === 'park';   // the park seed runs on the real clock, alone
const L = await local(PARK ? { variant: 'park', clock: 'real', engine: 'webkit' } : { variant: 'typical', clock: 'demo', engine: 'webkit' });
if (parts.includes('park') && !PARK) throw new Error('run park on its own');
try {
  if (parts.includes('tokens')) {
    const T = {};
    for (const [label, theme, mode] of [['hearth', 'hearth', 'light'], ['parchment', 'parchment', 'light'], ['frost', 'frost', 'light'], ['midnight', 'midnight', 'light'], ['forest', 'forest', 'light'], ['system-dark', 'system', 'dark']]) {
      const d = await themed(L, 'typical', 'eli', theme, mode, 'ipad-portrait'); await d.goto('#home'); await sleep(2500);
      const row = { resolved: await d.page.evaluate(() => ({ theme: document.documentElement.dataset.theme || 'system', scheme: document.documentElement.dataset.scheme })) };
      const tok = await d.page.evaluate(RESOLVE, { bg: 'var(--bg)', surface: 'var(--surface)', surface2: 'var(--surface-2)' });
      row.tokens = Object.fromEntries(Object.entries(tok).map(([k, v]) => [k, hex(parse(v).rgb)]));
      row.profiles = {};
      for (const [id, c] of Object.entries(SEED)) {
        const deep = await d.page.evaluate(([c]) => { const r = document.documentElement; const old = r.style.getPropertyValue('--accent'); r.style.setProperty('--accent', c); const p = document.createElement('i'); document.body.append(p); p.style.color = 'var(--accent-deep)'; const v = getComputedStyle(p).color; p.remove(); r.style.setProperty('--accent', old); return v; }, [c]);
        const dp = parse(deep).rgb;
        row.profiles[id] = { raw: c, rawOnBg: ratio(h2(c), h2(row.tokens.bg)), rawOnSurface: ratio(h2(c), h2(row.tokens.surface)), rawOnSurface2: ratio(h2(c), h2(row.tokens.surface2)), accentDeep: hex(dp), deepOnBg: ratio(dp, h2(row.tokens.bg)), deepOnSurface: ratio(dp, h2(row.tokens.surface)) };
      }
      T[label] = row; console.log('tokens', label, JSON.stringify(row.tokens), Object.entries(row.profiles).map(([k, v]) => `${k} raw/bg ${v.rawOnBg} raw/surf ${v.rawOnSurface} deep/bg ${v.deepOnBg}`).join(' | '));
      await d.close();
    }
    out.tokens = T;
  }
  if (parts.includes('prayer')) {
    const cases = process.env.PRAYER_CASES ? JSON.parse(process.env.PRAYER_CASES) : [['eli', 'midnight', 'light'], ['eli', 'forest', 'light'], ['eli', 'system', 'dark'], ['eli', 'system', 'light'], ['eli', 'midnight', 'light', 'family'], ['christian', 'midnight', 'light']];
    for (const [profile, theme, mode, list] of cases) { let d; try {
      d = await themed(L, 'typical', profile, theme, mode, 'ipad-portrait'); await d.goto('#home'); const f = await d.openApp('prayer');
      await f.waitForSelector('#todayLine:not(:empty)', { timeout: 20000 }); await sleep(800);
      if (list === 'family') { await f.click('#listSwitch [data-list="shared"]'); await sleep(800); }
      const shared = await f.evaluate(() => document.body.classList.contains('shared'));
      const mic = await ink(f, '#f-mic');
      await f.click('#moreBtn'); await f.waitForSelector('#sheet.on', { timeout: 5000 }); await f.click('[data-more="kitchen"]'); await f.waitForSelector('#kitchen.on', { timeout: 5000 }); await sleep(700);
      const kc = await ink(f, '#kitchen .k-cat'); const kbg = await f.evaluate(() => getComputedStyle(document.getElementById('kitchen')).backgroundColor);
      const pix = await bgMedian(d, f, '#kitchen .k-cat');
      const kfg = parse(kc.v), kb = parse(kbg).rgb, mfg = parse(mic.v), mb = parse(mic.bg).rgb;
      const r = { profile, theme, mode, sharedList: shared, resolved: kc.theme + '/' + kc.scheme, accent: kc.accent,
        kcat: { fg: hex(kfg.rgb), bgComputed: hex(kb), ratioComputed: ratio(over(kfg, kb), kb), bgPixelMedian: pix && hex(pix.median), ratioPixel: pix && ratio(over(kfg, pix.median), pix.median), fs: kc.fs, fw: kc.fw, text: kc.text, opacity: kc.op },
        mic: { fg: hex(mfg.rgb), bg: hex(mb), ratio: ratio(over(mfg, mb), mb), visibleInRig: mic.visible, note: 'icon: 3:1 threshold' } };
      r.list = list || 'personal'; out.prayer.push(r); console.log('prayer', JSON.stringify(r));
      if (profile === 'eli' && theme === 'midnight' && !list) await d.page.screenshot({ path: path.join(EV, 'verify-raw-accent-ink-no-dark-lift-1-prayer-kitchen-midnight.png'), scale: 'css' });
      } catch (e) { out.prayer.push({ profile, theme, mode, list, error: String(e.message).split(String.fromCharCode(10))[0] }); console.log('prayer case failed', profile, theme, String(e.message).split(String.fromCharCode(10))[0]); }
      if (d) await d.close();
    }
  }
  if (parts.includes('park')) {
    for (const [profile, theme, mode] of [['eli', 'midnight', 'light'], ['dad', 'midnight', 'light'], ['eli', 'system', 'dark'], ['eli', 'hearth', 'light'], ['kiara', 'hearth', 'light'], ['kiara', 'parchment', 'light']]) {
      const d = await themed(L, 'park', profile, theme, mode, 'iphone-pwa');
      await d.ctx.grantPermissions(['geolocation'], { origin: L.site });
      await d.goto('#home'); await sleep(1500);
      const f = await d.openApp('dollywood-live'); await f.waitForSelector('#lv-pill[data-state]', { timeout: 20000 }); await sleep(2000);
      const ll = await f.evaluate(([x, y]) => ({ latitude: y / D.geo.my + D.geo.lat0, longitude: x / D.geo.mx + D.geo.lon0 }), [842, 858]);
      await d.ctx.setGeolocation({ ...ll, accuracy: 8 });
      await f.evaluate(() => document.getElementById('loc-btn') && document.getElementById('loc-btn').click()); await sleep(4000);
      await f.evaluate(() => { try { showPane('near'); setSheet('half'); } catch (e) {} }); await sleep(1200);
      const r = { profile, theme, mode };
      const tab = await ink(f, '#loc-near svg', 'stroke'); r.resolved = tab && (tab.theme + '/' + tab.scheme); r.accent = tab && tab.accent;
      r.viewOnly = await f.evaluate(() => { try { return VIEW_ONLY(); } catch { return null; } });
      const tabbg = await bgMedian(d, f, '#loc-near svg');
      if (tab && tabbg) { const fg = parse(tab.v); r.tabIcon = { stroke: hex(fg.rgb), bgMedian: hex(tabbg.median), ratio: ratio(over(fg, tabbg.median), tabbg.median), ratioVsLightestBg: ratio(over(fg, tabbg.max), tabbg.max), ratioVsDarkestBg: ratio(over(fg, tabbg.min), tabbg.min) }; }
      const sm = await ink(f, '#near-list .lv-item .d small');
      if (sm && sm.visible) { const bg = await bgMedian(d, f, '#near-list .lv-item .d small'); const fg = parse(sm.v); r.walkSmall = { text: sm.text, fg: hex(fg.rgb), fs: sm.fs, bgMedian: hex(bg.median), ratio: ratio(over(fg, bg.median), bg.median) }; }
      else r.walkSmall = { absent: true, nearText: await f.evaluate(() => (document.getElementById('near-list') || {}).innerText?.slice(0, 120)) };
      if (profile === 'eli' && theme === 'midnight') await d.page.screenshot({ path: path.join(EV, 'verify-raw-accent-ink-no-dark-lift-1-park-nearby-midnight.png'), scale: 'css' });
      if (sm && sm.visible) {
        await f.evaluate(() => document.querySelector('#near-list .lv-item').click()); await sleep(1800);
        const fb = await ink(f, '.lv-from b');
        if (fb && fb.visible) { const bg = await bgMedian(d, f, '.lv-from b'); const fg = parse(fb.v); r.fromB = { text: fb.text, fg: hex(fg.rgb), fs: fb.fs, bgMedian: hex(bg.median), ratio: ratio(over(fg, bg.median), bg.median) }; } else r.fromB = { absent: true };
        // route glyph: start directions to that ride through the page's own function
        await f.evaluate(() => { try { const n = +document.querySelector('#near-list .lv-item').dataset.n; routeTo(OFFNUM[n]); } catch (e) { window.__rerr = String(e); } }); await sleep(2500);
        const g = await ink(f, '#route-glyph svg', 'stroke');
        if (g && g.visible) { const tile = await f.evaluate(() => getComputedStyle(document.getElementById('route-glyph')).backgroundColor); const fg = parse(g.v), tb = parse(tile).rgb; r.routeGlyph = { stroke: hex(fg.rgb), tile: hex(tb), ratio: ratio(over(fg, tb), tb), note: '.lv-route-head svg (:464, later) beats .lv-turn svg stroke:currentColor (:458) at equal specificity' }; }
        else r.routeGlyph = { absent: true, err: await f.evaluate(() => window.__rerr || null) };
      }
      out.park.push(r); console.log('park', JSON.stringify(r));
      await d.close();
    }
  }
} catch (e) { out.error = String(e && e.stack || e); console.error(e); }
finally { await L.close(); }
const file = path.join(EV, 'verify-raw-accent-ink-no-dark-lift-1-' + parts.join('-') + '.json');
fs.writeFileSync(file, JSON.stringify(out, null, 1)); console.log('saved', file);
