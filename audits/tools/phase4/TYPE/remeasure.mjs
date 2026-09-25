// Phase 4 TYPE — independent re-measurement of the TYPE investigation's key numbers (written by the re-measurer; it does
// not import or call any of the investigator's TYPE scripts, and it reads none of their JSON outputs).
//
// Usage:
//   node audits/tools/phase4/TYPE/remeasure.mjs code            # declared font sizes per file (own regex scan)
//   node audits/tools/phase4/TYPE/remeasure.mjs raw             # own pass over the rig-v2 raw files (all runs)
//   node audits/tools/phase4/TYPE/remeasure.mjs live [job,job]  # live runs on the local instance (lib/local.mjs, WebKit)
//   node audits/tools/phase4/TYPE/remeasure.mjs tvmath          # the TV viewing-angle arithmetic, from panel geometry
// Output: audits/evidence/p4/TYPE/remeasure-<part>.json (live: remeasure-live-<job>.json), plus a stdout summary.
// Local only: lib/local.mjs blocks production; the rig never knows a PIN or the pairing code.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../../..');
const OUT = path.join(ROOT, 'audits/evidence/p4/TYPE');
const part = process.argv[2];
const write = (name, obj) => { fs.writeFileSync(path.join(OUT, name), JSON.stringify(obj, null, 1)); console.log('wrote', path.relative(ROOT, path.join(OUT, name))); };

// ─────────────────────────────────────────────────────────────── code: declared font sizes
if (part === 'code') {
  const FILES = ['apps/design.css', 'index.html', 'apps/f260.html', 'apps/prayer.html', 'apps/leftovers.html', 'apps/kidverse.html', 'apps/verses.html', 'apps/tally.html', 'apps/timer.html', 'apps/dollywood.html', 'apps/dollywood-live.html', '../dollywood-build-project/scripts/template.html'];
  const res = {};
  for (const f of FILES) {
    const p = path.resolve(ROOT, f); if (!fs.existsSync(p)) { res[f] = 'missing'; continue; }
    let src = fs.readFileSync(p, 'utf8');
    // the Dollywood exports embed megabytes of data on single lines: keep only the lines that are not huge data blobs
    const lines = src.split('\n');
    const R = { sizeDecl: { token: 0, px: 0, other: 0 }, fontShorthand: { token: 0, px: 0, other: 0 }, jsFontSize: 0, otherSamples: [], under11: [] };
    lines.forEach((ln, i) => {
      if (ln.length > 20000) { // a data line: scan only for CSS-looking font declarations, cap the work
        ln = ln.slice(0, 20000);
      }
      for (const m of ln.matchAll(/(?<![-\w])font-size\s*:\s*([^;"'}`<]+)/g)) {
        const v = m[1].trim();
        const k = /var\(--fs/.test(v) ? 'token' : /^-?[\d.]+px$/.test(v) ? 'px' : 'other';
        R.sizeDecl[k]++; if (k === 'other' && R.otherSamples.length < 30) R.otherSamples.push(`${i + 1}: font-size:${v.slice(0, 50)}`);
        if (k === 'px' && parseFloat(v) < 11) R.under11.push(`${i + 1}:${v}`);
      }
      for (const m of ln.matchAll(/(?<![-\w])font\s*:\s*([^;"'}`<]+)/g)) {
        const v = m[1].trim();
        if (/^(inherit|initial|unset)$/.test(v)) { R.fontShorthand.other++; continue; }
        const k = /var\(--fs/.test(v) ? 'token' : /(^|\s|\/)[\d.]+px/.test(v) ? 'px' : 'other';
        R.fontShorthand[k]++; if (k === 'other' && R.otherSamples.length < 30) R.otherSamples.push(`${i + 1}: font:${v.slice(0, 50)}`);
        const pm = v.match(/(?:^|\s)([\d.]+)px/); if (k === 'px' && pm && parseFloat(pm[1]) < 11) R.under11.push(`${i + 1}:font ${pm[1]}px`);
      }
      R.jsFontSize += (ln.match(/\.fontSize\s*=/g) || []).length;
    });
    R.total = { token: R.sizeDecl.token + R.fontShorthand.token, px: R.sizeDecl.px + R.fontShorthand.px, other: R.sizeDecl.other + R.fontShorthand.other };
    res[f] = R;
    console.log(f.padEnd(52), 'font-size', JSON.stringify(R.sizeDecl), 'font:', JSON.stringify(R.fontShorthand), 'TOTAL', JSON.stringify(R.total), 'js .fontSize=', R.jsFontSize);
  }
  write('remeasure-code.json', res);
}

// ─────────────────────────────────────────────────────────────── tvmath
if (part === 'tvmath') {
  const pitch = inch => (inch * 25.4 * 16 / Math.hypot(16, 9)) / 1920;          // mm per px, 16:9 1080p
  const ipad = 25.4 / 264 * 2;                                                     // mm per CSS px, 264 ppi @2x
  const eq = (fs, inch, dTv = 3000, dPad = 400) => fs * pitch(inch) / dTv * dPad / ipad;
  const r = { pitch55: pitch(55), pitch65: pitch(65), ipadMmPerCssPx: ipad, px18_55: eq(18, 55), px18_65: eq(18, 65), px12_55: eq(12, 55), px26_55: eq(26, 55) };
  console.log(r); write('remeasure-tvmath.json', r);
}

// ─────────────────────────────────────────────────────────────── raw: own pass over rig-v2 raw files
if (part === 'raw') {
  const RAW = path.join(ROOT, 'audits/evidence/p4/measure/raw');
  // selector key: the last two segments, with transient state classes removed (the definition the draft states)
  const STATE = /\.(on|open|morning|afternoon|evening|night|done|active|sel|cur|today)\b/g;
  const key2 = s => s.split(' > ').slice(-2).join(' > ').replace(STATE, '');
  const A = {};
  let files = 0, skipped = 0;
  for (const run of ['themes', 'devices', 'states']) {
    const rd = path.join(RAW, run); if (!fs.existsSync(rd)) continue;
    for (const area of fs.readdirSync(rd)) {
      const ad = path.join(rd, area); if (!fs.statSync(ad).isDirectory()) continue;
      for (const f of fs.readdirSync(ad)) {
        if (!f.endsWith('.json')) continue;
        let j; try { j = JSON.parse(fs.readFileSync(path.join(ad, f), 'utf8')); } catch { skipped++; continue; }
        if (j.v !== 2) { skipped++; continue; }
        files++;
        const X = A[area] ??= { sizes: {}, sel: {}, kidBoxes: 0, kidLe12: 0, fraunces: 0, frauncesCombos: {}, tvSizes: {} };
        const kindOf = Object.fromEntries((j.docs || []).map(d => [d.name, d.meta?.kind || '?']));
        for (const t of j.text || []) {
          const isPage = t.doc === 'page';
          if ((area === 'shell' || area === 'tv') ? !isPage : isPage) continue;   // the area's own document only
          const kind = kindOf[t.doc] || '?';
          const k = key2(t.sel);
          const S = X.sel[kind + '|' + k] ??= {};
          (S[j.device] ??= []).push(t.fs);
          (X.sizes[kind] ??= {})[t.fs] = ((X.sizes[kind] ??= {})[t.fs] || 0) + 1;
          if (kind === 'kid') { X.kidBoxes++; if (t.fs <= 12) X.kidLe12++; }
          if (/Fraunces/.test(t.ff)) { X.fraunces++; const c = `${t.ff} -> ${t.ffr} ${t.fs}/${t.fw} ${k}`; X.frauncesCombos[c] = (X.frauncesCombos[c] || 0) + 1; }
          if (area === 'tv' && j.device === 'tv') { const c = `${t.fs}/${t.fw}${t.tt && t.tt !== 'none' ? ' ' + t.tt : ''} ${k}`; X.tvSizes[c] = (X.tvSizes[c] || 0) + 1; }
        }
      }
    }
  }
  const out = { files, skipped, areas: {} };
  for (const [area, X] of Object.entries(A)) {
    const mx = a => Math.max(...a);
    // iPad portrait vs iPhone PWA: selectors (per profile kind) seen on both devices; compare the max size
    let same = 0, larger = 0, smaller = 0; const smallerList = [];
    for (const [k, v] of Object.entries(X.sel)) {
      const i = v['iphone-pwa'], p = v['ipad-portrait']; if (!i || !p) continue;
      if (mx(p) > mx(i)) larger++; else if (mx(p) < mx(i)) { smaller++; smallerList.push(`${k} ${mx(i)}->${mx(p)}`); } else same++;
    }
    // kid vs adult: selectors present in both kinds (any device), kid max > adult max
    const byKind = kind => { const m = {}; for (const [k, v] of Object.entries(X.sel)) { const [kd, s] = [k.slice(0, k.indexOf('|')), k.slice(k.indexOf('|') + 1)]; if (kd !== kind) continue; m[s] = Math.max(m[s] || 0, ...Object.values(v).flat()); } return m; };
    const ad = byKind('adult'), kd = byKind('kid'); const common = Object.keys(kd).filter(s => s in ad);
    const grow = common.filter(s => kd[s] > ad[s]).length;
    const adultKind = area === 'tv' ? 'kiosk' : 'adult';
    const sizes = Object.keys(X.sizes[adultKind] || {}).map(Number).sort((a, b) => a - b);
    out.areas[area] = {
      ipad: { same, larger, smaller, of: same + larger + smaller, smallerList },
      distinctAdultSizes: sizes.length, fractional: sizes.filter(s => s % 1).length, sizes,
      kid: X.kidBoxes ? { le12Pct: +(100 * X.kidLe12 / X.kidBoxes).toFixed(1), boxes: X.kidBoxes, grow, common: common.length } : null,
      fraunces: X.fraunces, frauncesCombos: X.frauncesCombos,
      ...(area === 'tv' ? { tvSizes: X.tvSizes } : {}),
    };
    console.log(area.padEnd(15), `ipad same ${same}/${same + larger + smaller} (larger ${larger}, smaller ${smaller})`, `| adult sizes ${sizes.length} (frac ${sizes.filter(s => s % 1).length})`,
      X.kidBoxes ? `| kid <=12 ${(100 * X.kidLe12 / X.kidBoxes).toFixed(1)}% of ${X.kidBoxes}, grow ${grow}/${common.length}` : '| no kid', X.fraunces ? `| Fraunces boxes ${X.fraunces}` : '');
  }
  console.log('files', files, 'skipped', skipped);
  write('remeasure-raw.json', out);
}

// ─────────────────────────────────────────────────────────────── live
if (part === 'live') {
  const { local, sleep } = await import(pathToFileURL(path.join(ROOT, 'audits/tools/lib/local.mjs')).href);
  const { DEVICES } = await import(pathToFileURL(path.join(ROOT, 'audits/tools/lib/devices.mjs')).href);

  // In-page probe (runs in every document). HTML text boxes with their computed type, cumulative zoom and rendered box;
  // SVG <text> with computed size, CTM scale and rendered box, and a reference HTML span set at the claimed effective size
  // (same family/weight/text) whose height the SVG box should match if size × scale is right.
  function probe() {
    const vw = innerWidth, vh = innerHeight;
    const shown = el => { for (let e = el; e && e.nodeType === 1; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false; } return true; };
    const sel = el => { const p = []; for (let e = el, i = 0; e && e.nodeType === 1 && i < 3; e = e.parentElement, i++) { let s = e.tagName.toLowerCase(); if (e.id) s += '#' + e.id; const c = (e.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean); if (c.length) s += '.' + c.join('.'); p.unshift(s); } return p.join(' > '); };
    const zoomOf = el => { let z = 1; for (let e = el; e; e = e.parentElement) z *= parseFloat(getComputedStyle(e).zoom || '1') || 1; return z; };
    const html = [];
    for (const el of document.querySelectorAll('body *')) {
      if (el.closest('svg') || /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE)$/.test(el.tagName)) continue;
      const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim();
      if (!own) continue;
      const r = el.getBoundingClientRect(); if (!(r.width > 0 && r.height > 0) || !shown(el)) continue;
      const cs = getComputedStyle(el);
      let tw = null; try { const rg = document.createRange(); rg.selectNodeContents(el); const rr = rg.getBoundingClientRect(); tw = +rr.width.toFixed(2); } catch {}
      html.push({ sel: sel(el), text: own.slice(0, 40), fs: parseFloat(cs.fontSize), fw: cs.fontWeight, ff: cs.fontFamily, ls: cs.letterSpacing, tt: cs.textTransform, fvn: cs.fontVariantNumeric, color: cs.color, zoom: +zoomOf(el).toFixed(3), w: +r.width.toFixed(2), h: +r.height.toFixed(2), tw, x: +r.x.toFixed(1), y: +r.y.toFixed(1), onscreen: r.bottom > 0 && r.right > 0 && r.top < vh && r.left < vw });
    }
    const svg = [];
    for (const t of document.querySelectorAll('svg text')) {
      const txt = (t.textContent || '').trim(); if (!txt) continue;
      const r = t.getBoundingClientRect(); if (!(r.width > 0 && r.height > 0) || !shown(t)) continue;
      const m = t.getScreenCTM(); if (!m) continue;
      const scale = Math.sqrt(Math.abs(m.a * m.d - m.b * m.c));
      const cs = getComputedStyle(t); const fs = parseFloat(cs.fontSize); const eff = fs * scale;
      const ref = document.createElement('span');
      ref.textContent = txt; ref.style.cssText = `position:absolute;left:-9999px;top:0;white-space:nowrap;line-height:normal;font-family:${cs.fontFamily};font-weight:${cs.fontWeight};font-style:${cs.fontStyle};font-size:${eff}px;letter-spacing:${cs.letterSpacing};text-transform:${cs.textTransform}`;
      document.body.appendChild(ref); const rr = ref.getBoundingClientRect(); ref.remove();
      const g = t.closest('g[id]');
      svg.push({ sel: sel(t), group: g ? g.id : null, cls: t.getAttribute('class'), text: txt.slice(0, 30), fs, scale: +scale.toFixed(4), eff: +eff.toFixed(2), fw: cs.fontWeight, ff: cs.fontFamily, h: +r.height.toFixed(2), w: +r.width.toFixed(2), refH: +rr.height.toFixed(2), refW: +rr.width.toFixed(2), onscreen: r.bottom > 0 && r.right > 0 && r.top < vh && r.left < vw });
    }
    const de = document.documentElement;
    return { url: location.pathname, vw, vh, theme: de.dataset.theme, scheme: de.dataset.scheme, kind: de.dataset.kind, bodyZoom: getComputedStyle(document.body).zoom, html, svg };
  }

  // canvas width comparison: does the declared first family render, or does it fall back (Fraunces → serif?)
  function faceCheck(specs) {
    const c = document.createElement('canvas').getContext('2d');
    const s = 'Official listings Layers Hamburger 0123456789';
    return Object.fromEntries(specs.map(f => { c.font = f; return [f, +c.measureText(s).width.toFixed(2)]; }));
  }

  const lum = rgb => { const [r, g, b] = rgb.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const parseRGB = s => (s.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
  const cr = (a, b) => { const [x, y] = [lum(parseRGB(a)), lum(parseRGB(b))].sort((p, q) => q - p); return +((x + 0.05) / (y + 0.05)).toFixed(2); };

  const STATE = /\.(on|open|morning|afternoon|evening|night|done|active|sel|cur|today)\b/g;
  const key2 = s => s.split(' > ').slice(-2).join(' > ').replace(STATE, '');

  // job: area, screen, device, profile override, theme, then extract(docs) → summary
  const JOBS = {
    'tv-board': [{ area: 'tv', screen: 'board', device: 'tv' }, { area: 'tv', screen: 'board', device: 'tv', theme: 'midnight' }],
    'f260-zoom': [{ area: 'f260', screen: 'today', device: 'ipad-portrait' }, { area: 'f260', screen: 'large-text', device: 'ipad-portrait' }, { area: 'f260', screen: 'today', device: 'iphone-pwa' }, { area: 'f260', screen: 'large-text', device: 'iphone-pwa' }],
    'park-labels': [{ area: 'dollywood-live', screen: 'map', device: 'iphone-pwa' }, { area: 'dollywood-live', screen: 'map', device: 'ipad-portrait' }, { area: 'dollywood-live', screen: 'map', device: 'desktop' }, { area: 'dollywood-live', screen: 'whole-park', device: 'ipad-portrait' }],
    'park-phone-fit': [{ area: 'dollywood-live', screen: 'whole-park', device: 'iphone-pwa' }],
    'guide-svg': [{ area: 'dollywood', screen: 'map', device: 'iphone-pwa' }, { area: 'dollywood', screen: 'map', device: 'ipad-portrait' }, { area: 'dollywood', screen: 'cross-section', device: 'iphone-pwa' }, { area: 'dollywood', screen: 'cross-section', device: 'ipad-portrait' }],
    'titles': [{ area: 'shell', screen: 'apps', device: 'ipad-portrait' }, { area: 'f260', screen: 'today', device: 'ipad-portrait' }, { area: 'leftovers', screen: 'main', device: 'ipad-portrait' }, { area: 'prayer', screen: 'today', device: 'ipad-portrait' }, { area: 'timer', screen: 'idle', device: 'ipad-portrait', theme: 'forest' }, { area: 'dollywood', screen: 'map', device: 'ipad-portrait' }],
    'fraunces': [{ area: 'dollywood-live', screen: 'search', device: 'iphone-pwa' }, { area: 'dollywood', screen: 'listings', device: 'ipad-portrait' }],
    'kv': [{ area: 'dollywood', screen: 'coaster', device: 'ipad-portrait' }, { area: 'dollywood', screen: 'coaster', device: 'ipad-portrait', theme: 'midnight' }],
    'scale': [{ area: 'leftovers', screen: 'main', device: 'iphone-pwa' }, { area: 'leftovers', screen: 'main', device: 'ipad-portrait' }, { area: 'tally', screen: 'main', device: 'iphone-pwa' }, { area: 'tally', screen: 'main', device: 'ipad-portrait' }, { area: 'leftovers', screen: 'kid', device: 'ipad-portrait' }, { area: 'tally', screen: 'kid', device: 'ipad-portrait' }, { area: 'shell', screen: 'home', device: 'ipad-portrait', theme: 'parchment' }, { area: 'shell', screen: 'home', device: 'iphone-pwa', theme: 'parchment' }],
  };
  const want = (process.argv[3] || Object.keys(JOBS).join(',')).split(',');

  for (const job of want) {
    const specs = JOBS[job]; if (!specs) { console.log('no job', job); continue; }
    const results = [];
    for (const spec of specs) {
      const mod = await import(pathToFileURL(path.join(ROOT, 'audits/tools/areas', spec.area + '.mjs')).href);
      const s = mod.screens.find(x => x.screen === spec.screen);
      const variant = (s.variant && s.variant.typical) || 'typical';
      const who = spec.profile !== undefined ? spec.profile : (s.profile === undefined ? 'eli' : s.profile);
      const L = await local({ variant, engine: 'webkit' });
      const rec = { ...spec, variant, profile: who };
      try {
        if (spec.theme) {
          for (const [id, sess] of Object.entries(L.S.sessions)) { if (sess.profile.kind === 'kiosk') continue; const r = await L.apiAs(id, '/api/data/hub/theme?scope=person', { method: 'PUT', body: { value: spec.theme } }); if (r.status >= 300) rec.themeErr = (rec.themeErr || '') + id + ':' + r.status + ' '; }
        }
        const ls = { ...(s.localStorage || {}), ...(spec.theme ? { 'hub.theme': JSON.stringify(spec.theme) } : {}) };
        const d = await L.device({ device: spec.device, mode: 'light', profile: who, localStorage: ls });
        const page = d.page, dev = DEVICES[spec.device];
        const cors = { 'Access-Control-Allow-Origin': L.site, 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' };
        const matcher = m => typeof m === 'function' ? m : m instanceof RegExp ? (u => m.test(u.href)) : (u => u.href.startsWith(L.api + m));
        const t = {
          page, ctx: d.ctx, state: 'typical', device: spec.device, mode: 'light', variant, profile: who, site: L.site, api: L.api, dev,
          loading: false, offline: false, error: false, reopened: false, touch: dev.hasTouch, sleep,
          settle: async (ms = 900) => { await sleep(ms); },
          frame: () => page.frameLocator('#frame'),
          goto: h => d.goto(h),
          async openApp(id, { wait } = {}) { await d.goto('#' + id); await page.waitForSelector('#viewer.on', { timeout: 10000 }).catch(() => {}); const f = await d.openApp(id, { wait }); await sleep(600); return f; },
          appFrame: id => page.frames().find(f => f.url().includes(`/apps/${id}.html`)),
          async tap(target, opts = {}) { const loc = typeof target === 'string' ? page.locator(target).first() : target; if (dev.hasTouch) await loc.tap(opts); else await loc.click(opts); },
          async tapIn(fl, sl, opts = {}) { const loc = sl ? fl.locator(sl).first() : fl; if (dev.hasTouch) await loc.tap(opts); else await loc.click(opts); },
          async hold(m) { await d.ctx.route(matcher(m), () => {}); },
          async answer(m, { status = 200, body = {}, contentType = 'application/json' } = {}) { await d.ctx.route(matcher(m), r => r.request().method() === 'OPTIONS' ? r.fulfill({ status: 204, headers: cors }) : r.fulfill({ status, contentType, headers: cors, body: typeof body === 'string' ? body : JSON.stringify(body) })); },
          async failApi(m, { status = 500, error = 'internal', message = 'x' } = {}) { await t.answer(m, { status, body: { error, message } }); },
          async clockTo(when) { await d.ctx.clock.setFixedTime(new Date(when)); },
          async scroll(selector = '#views', y = 'bottom', where = page) { await where.evaluate(([sl, y]) => { const el = document.querySelector(sl) || document.scrollingElement; el.scrollTop = y === 'bottom' ? el.scrollHeight : y; }, [selector, y]); await sleep(250); },
        };
        try { await s.go(t); await sleep(1500); if (s.after) await s.after(t); } catch (e) { rec.goError = String(e.message || e).split('\n')[0].slice(0, 200); }
        rec.docs = [];
        for (const f of page.frames()) {
          if (f.url() === 'about:blank') continue;
          try { const r = await f.evaluate(probe); rec.docs.push({ doc: f === page.mainFrame() ? 'page' : 'frame', ...r }); } catch (e) { rec.docs.push({ doc: f.url(), error: String(e.message).slice(0, 160) }); }
        }
        // extras per job
        const app = page.frames().find(f => f.url().includes(`/apps/${spec.area}.html`));
        if (job === 'fraunces' && app) rec.faces = await app.evaluate(faceCheck, ['600 15px Fraunces, serif', '600 15px serif', '600 15px Georgia', '600 15px "Times New Roman"', '400 16px ui-serif, serif', '400 16px serif']);
        if (job === 'f260-zoom' && app) {
          // Playwright's own boxes for the WEEK label(s) (protocol-level quads, independent of in-page getBoundingClientRect)
          const loc = app.locator('text=/^\\s*week\\s*$/i');
          const n = await loc.count(); rec.weekBoxes = [];
          for (let i = 0; i < Math.min(n, 4); i++) rec.weekBoxes.push(await loc.nth(i).boundingBox().catch(() => null));
        }
        await d.close();
      } catch (e) { rec.error = String(e.stack || e).slice(0, 400); }
      finally { await L.close(); }
      results.push(rec);
      console.log(job, spec.area, spec.screen, spec.device, spec.theme || 'system', rec.goError ? 'goError ' + rec.goError : '', rec.error ? 'ERROR ' + rec.error : '', 'docs', (rec.docs || []).map(x => `${x.doc}:${x.theme}/${x.kind} html ${x.html?.length} svg ${x.svg?.length}`).join(' '));
    }

    // ── per-job summaries
    const own = (r) => (r.docs || []).find(x => x.doc === ((r.area === 'shell' || r.area === 'tv') ? 'page' : 'frame') && x.html);
    const summary = {};
    if (job === 'tv-board') {
      const pick = { names: /span\.tv-face/, star: /> b$/, times: /span\.when/, bylines: /rem-by/, date: /#tv-date/, lines: /span\.txt/, reminders: /rem-text/, clock: /div#clock/, refs: /#tv-refs/, greeting: /#tv-greet/, paneH2: /tv-pane.* > h2$/ };
      for (const r of results) {
        const D = own(r); const o = {};
        for (const [nm, re] of Object.entries(pick)) { const hits = D.html.filter(h => re.test(h.sel) && (nm !== 'star' || /★/.test(h.text))); o[nm] = [...new Set(hits.map(h => `${h.fs}/${h.fw}${h.tt !== 'none' ? ' ' + h.tt : ''}`))].join(', ') + ` (n=${hits.length})`; }
        summary[(r.theme || 'system')] = { theme: D.theme, kind: D.kind, vw: D.vw, ...o };
      }
    }
    if (job === 'f260-zoom') {
      for (const r of results) {
        const D = own(r);
        const wk = D.html.filter(h => /^week$/i.test(h.text));
        const smallest = D.html.filter(h => h.onscreen).sort((a, b) => a.fs * a.zoom - b.fs * b.zoom)[0];
        summary[`${r.screen}/${r.device}`] = { bodyZoom: D.bodyZoom, week: wk.map(h => ({ sel: h.sel, fs: h.fs, zoom: h.zoom, eff: +(h.fs * h.zoom).toFixed(2), w: h.w, h: h.h, tw: h.tw })), pwBox: r.weekBoxes, smallest: smallest && { sel: smallest.sel, text: smallest.text, fs: smallest.fs, zoom: smallest.zoom } };
      }
    }
    if (job === 'park-labels' || job === 'park-phone-fit' || job === 'guide-svg') {
      for (const r of results) {
        const D = own(r); if (!D) { summary[`${r.screen}/${r.device}`] = { error: r.error || r.goError }; continue; }
        const groups = {};
        for (const s of D.svg) {
          const g = job !== 'guide-svg' ? (s.sel.includes('famk') ? 'family' : s.sel.includes('lv-meetpin') ? 'meet' : null)
            : (s.cls === 'seclab' ? 'seclab' : s.cls === 'onum' ? 'onum' : s.cls === 'clab' ? 'clab' : s.sel.includes('svg#prof') ? 'profile' : null);
          if (!g) continue;
          const G = groups[g] ??= { n: 0, effs: new Set(), fs: new Set(), scale: new Set(), hOverRefH: [], sample: null };
          G.n++; G.effs.add(s.eff); G.fs.add(s.fs); G.scale.add(s.scale); if (s.refH) G.hOverRefH.push(+(s.h / s.refH).toFixed(3)); G.sample ??= s;
        }
        for (const G of Object.values(groups)) { G.effs = [...G.effs].sort((a, b) => a - b); G.fs = [...G.fs]; G.scale = [...G.scale]; const hr = G.hOverRefH.sort((a, b) => a - b); G.hOverRefH = hr.length ? [hr[0], hr[hr.length >> 1], hr[hr.length - 1]] : null; }
        summary[`${r.screen}/${r.device}`] = groups;
      }
    }
    if (job === 'titles') {
      for (const r of results) {
        const D = own(r); const P = r.docs.find(x => x.doc === 'page');
        const h1 = (D?.html || []).filter(h => /(^|> )h1/.test(h.sel.split(' > ').pop()) || /\bh1\b/.test(h.sel.split(' > ').pop()));
        const pill = (P?.html || []).filter(h => /#pill-label/.test(h.sel));
        const big = (D?.html || []).filter(h => h.fs >= 24 && h.onscreen).map(h => `${h.sel.split(' > ').pop()} ${h.fs}/${h.fw} ls ${h.ls} ${h.ff.split(',')[0]} "${h.text.slice(0, 20)}"`);
        summary[`${r.area}/${r.screen}`] = { theme: D?.theme, h1: h1.map(h => `${h.sel.split(' > ').pop()} ${h.fs}/${h.fw} ls ${h.ls} ${h.ff.split(',')[0]} "${h.text.slice(0, 24)}"`), pill: pill.map(h => `${h.fs}/${h.fw} "${h.text}"`), big: [...new Set(big)].slice(0, 12) };
      }
    }
    if (job === 'fraunces') {
      for (const r of results) {
        const D = own(r);
        const h2 = D.html.filter(h => /tabbody/.test(h.sel) && / > h2$/.test(h.sel) || /tabbody > h2/.test(h.sel));
        summary[`${r.area}/${r.screen}/${r.device}`] = { h2: [...new Set(h2.map(h => `${h.fs}/${h.fw} ff ${h.ff} "${h.text}"`))], n: h2.length, faces: r.faces };
      }
    }
    if (job === 'kv') {
      for (const r of results) {
        const D = own(r); if (!D) { summary[r.theme || 'system'] = { error: r.error || r.goError }; continue; }
        const dt = D.html.filter(h => /dl\.kv > dt$/.test(h.sel) || /\.kv > dt$/.test(h.sel)), dd = D.html.filter(h => /\.kv > dd/.test(h.sel.split(' > ').slice(-2).join(' > ')));
        const pairs = [...new Set(dt.map(a => a.color))].flatMap(a => [...new Set(dd.map(b => b.color))].map(b => `${a} vs ${b}: ${cr(a, b)}:1`));
        summary[r.theme || 'system'] = { theme: D.theme, dt: [...new Set(dt.map(h => `${h.fs}/${h.fw} ${h.ff.split(',')[0]} ${h.color}`))], dd: [...new Set(dd.map(h => `${h.fs}/${h.fw} ${h.ff.split(',')[0]} ${h.color}`))], inkRatio: pairs, n: [dt.length, dd.length] };
      }
    }
    if (job === 'scale') {
      const map = r => { const D = own(r); const m = {}; for (const h of D?.html || []) { const k = key2(h.sel); m[k] = Math.max(m[k] || 0, h.fs); } return { m, kind: D?.kind, theme: D?.theme }; };
      const get = (a, sc, dv) => results.find(r => r.area === a && r.screen === sc && r.device === dv);
      const cmp = (A, B) => { let same = 0, larger = 0, smaller = 0; const diff = []; for (const k of Object.keys(A.m)) { if (!(k in B.m)) continue; if (B.m[k] > A.m[k]) { larger++; diff.push(`${k} ${A.m[k]}->${B.m[k]}`); } else if (B.m[k] < A.m[k]) { smaller++; diff.push(`${k} ${A.m[k]}->${B.m[k]} (smaller)`); } else same++; } return { same, larger, smaller, of: same + larger + smaller, diff }; };
      for (const a of ['leftovers', 'tally']) {
        const ph = map(get(a, 'main', 'iphone-pwa')), pd = map(get(a, 'main', 'ipad-portrait')), kid = map(get(a, 'kid', 'ipad-portrait'));
        summary[a] = { ipadVsIphone: cmp(ph, pd), kidVsAdult_ipad: { kind: kid.kind, ...cmp(pd, kid) } };
      }
      const sh = map(get('shell', 'home', 'iphone-pwa')), sd = map(get('shell', 'home', 'ipad-portrait'));
      summary.shellHomeParchment = { themes: [sh.theme, sd.theme], ...cmp(sh, sd) };
    }
    console.log(JSON.stringify(summary, null, 1));
    // keep the evidence small: summaries + the svg/type records only where needed
    const slim = results.map(r => ({ ...r, docs: (r.docs || []).map(x => ({ doc: x.doc, url: x.url, theme: x.theme, scheme: x.scheme, kind: x.kind, vw: x.vw, bodyZoom: x.bodyZoom, htmlCount: x.html?.length, svgCount: x.svg?.length, error: x.error,
      ...(job !== 'titles' && /park|guide/.test(job) ? { svg: (x.svg || []).filter((s, i) => i < 120) } : {}) })) }));
    write(`remeasure-live-${job}.json`, { job, summary, runs: slim });
  }
}
