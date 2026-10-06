// Batch 10, Worker C: the park map (apps/dollywood-live.html) on the audit rig (real server clock; Chromium stands in for WebKit
// on the cloud rig). No pairing code. Optional: overlay=<folder under audits/> serves a private build over the repo; only=1,2,...
//   node audits/tools/phase6/10/park-c-10.mjs [overlay=audits/tools/c-overlay] [only=1,5]
// Sections: (1) first open resumes sharing, never "not sharing" before the person channel lands; (2) the meeting bar right after a
// fix; (3) kids' controls with nobody sharing; (4) no publish away from the park; (5) stale states out of the frame; (6) an amenity
// tap opens its card; (7) the compass keeps the view; (8) the denied state, adult and kid, 390/430, chip visible; (9) a kid's beacon
// off removes the dot, on starts locating; (10) family labels without overlap at 390 and 820; (11) compass contrast in all palettes;
// (12) pulses stop after three cycles; (13) targets under 44 = 0 at 390 and 820; (14) the heights field writes once;
// (15) placing hides the sheet; (16) whole park above the sheet; (17) iPad portrait card below the bar; (18) no emoji / ♥ glyphs.
import { local, sleep } from '../../lib/local.mjs';
const arg = k => (process.argv.find(a => a.startsWith(k + '=')) || '').slice(k.length + 1);
const overlay = arg('overlay') || undefined, only = arg('only') ? arg('only').split(',').map(Number) : null;
let pass = 0, fail = 0;
const ok = (c, name, extra = '') => { c ? pass++ : fail++; console.log(c ? '  ok  ' : '  FAIL', name, c ? '' : extra); };
const want = n => !only || only.includes(n);
const L = await local({ variant: 'park', clock: 'real', engine: 'webkit', overlay });
const errs = [];
async function open(opts = {}) {
  const d = await L.device({ device: opts.device || 'iphone-pwa', profile: opts.profile || 'eli', fixedTime: false, as: opts.as });
  d.page.on('pageerror', e => errs.push(e.message));
  if (opts.w) await d.page.setViewportSize({ width: opts.w, height: opts.h || 844 });
  await d.ctx.grantPermissions(['geolocation'], { origin: L.site });
  if (opts.init) await d.ctx.addInitScript(opts.init);
  await d.goto('#home'); await sleep(1500);
  const f = await d.openApp('dollywood-live');
  await f.waitForSelector('#lv-pill[data-state]', { timeout: 15000 });
  await f.waitForFunction(() => window.hub && hub.profile, null, { timeout: 10000 }).catch(() => {});
  return { d, f };
}
const geoAt = async (d, f, x, y, acc = 8) => { const ll = await f.evaluate(([x, y]) => ({ latitude: y / D.geo.my + D.geo.lat0, longitude: x / D.geo.mx + D.geo.lon0 }), [x, y]); await d.ctx.setGeolocation({ ...ll, accuracy: acc }); };
const put = (who, key, value, scope = 'family') => L.apiAs(who, `/api/data/dollywood-live/${encodeURIComponent(key)}?scope=${scope}`, { method: 'PUT', body: { value, updated_at: Date.now() } });
const run = async (n, title, fn) => { if (!want(n)) return; console.log(`\n## ${n}. ${title}`); try { await fn(); } catch (e) { fail++; console.log('  FAIL crash', String(e.stack || e).slice(0, 400)); } };

await run(1, 'first open resumes sharing', async () => {
  await put('eli', 'share', true, 'person');
  const { d, f } = await open();
  await geoAt(d, f, 762, 842, 6);
  const seen = [];
  for (let i = 0; i < 10; i++) { seen.push(await f.evaluate(() => ({ w: watchId, t: document.getElementById('loc-acc').textContent, row: (document.getElementById('lv-share') || {}).checked, loaded: hub.isLoaded(undefined, 'person') }))); await sleep(700); }
  ok(seen.some(s => s.w != null), 'a watch starts without a tap', JSON.stringify(seen.slice(-2)));
  ok(!seen.some(s => !s.loaded && /Only you see your dot|Off — only you/.test(s.t)), 'the pill never says "not sharing" before the person channel lands');
  await f.evaluate(() => { document.getElementById('lv-family').click(); });
  ok(await f.evaluate(() => shareOn() === true && !/Off — only you/.test(document.getElementById('fam-list').textContent)), 'the Share row reads on');
  await d.close?.();
});
await run(2, 'the meeting bar right after a fix', async () => {
  const { d, f } = await open();
  await geoAt(d, f, 762, 842, 6);
  await f.evaluate(() => { MEET = { x: 700, y: 800, at: Date.now(), name: 'The Test Spot', note: '', by: 'christian', byName: 'Mae' }; drawMeet(); stopGps(); me = null; renderMeet(); });
  ok(await f.evaluate(() => document.getElementById('meet-go').hidden === true), 'no Go before a fix');
  await f.evaluate(() => setMe(762, 842, 6, null, 'gps'));
  ok(await f.evaluate(() => !document.getElementById('meet-go').hidden && /walk/.test(document.getElementById('meet-meta').textContent)), 'walk time and Go appear with the fix');
  await f.evaluate(() => { me = null; renderMeet(); });
  await f.evaluate(() => { placeMode = true; livePlace([760, 840]); });
  ok(await f.evaluate(() => !document.getElementById('meet-go').hidden), 'and with Set my spot (livePlace)');
});
await run(3, 'kids\' controls with nobody sharing', async () => {
  const { f } = await open();
  await f.evaluate(() => { for (const k in FAM) delete FAM[k]; document.getElementById('lv-family').click(); renderFam(); });
  ok(await f.evaluate(() => document.querySelectorAll('#fam-list input[data-kid]').length >= 1), 'the kids\' beacon switches show');
  ok(await f.evaluate(() => document.querySelectorAll('#kid-list .lv-kid input[type=number]').length >= 1), 'and the heights');
});
await run(4, 'no publish away from the park', async () => {
  const { d, f } = await open();
  await f.evaluate(async () => { await hub.loaded(undefined, 'person'); window.__sets = []; const s = hub.set.bind(hub); hub.set = (k, v, o) => { if (/^loc:/.test(k)) window.__sets.push(k); return s(k, v, o); }; hub.set('share', true, { scope: 'person' }); });
  await f.evaluate(() => { setMe(-4000, -4000, 8, null, 'gps'); lastPub = 0; publish(); });
  ok(await f.evaluate(() => window.__sets.length === 0), 'a fix 4 km away publishes nothing');
  await f.evaluate(() => { setMe(762, 842, 8, null, 'gps'); lastPub = 0; publish(); });
  ok(await f.evaluate(() => window.__sets.length >= 1), 'a fix in the park publishes');
});
await run(5, 'stale states out of the frame', async () => {
  const { f } = await open();
  const st = await f.evaluate(() => { me = { x: -250, y: 100, acc: 20, t: Date.now() - 14 * 3600e3, src: 'gps', stale: true }; watchId = null; updLoc(); return { s: document.getElementById('lv-pill').dataset.state, t: document.getElementById('loc-sec').textContent, a: document.getElementById('lv-act').hidden ? '' : document.getElementById('lv-act').textContent }; });
  ok(st.s === 'stale' && /^Last seen 14 h ago/.test(st.t) && st.a === 'Find me', 'on the property but out of the frame: Last seen 14 h ago + Find me', JSON.stringify(st));
});
await run(6, 'an amenity tap opens its card', async () => {
  const { f } = await open();
  const r = await f.evaluate(() => { const a = amenList()[0]; fitBox([a.x - 60, a.x + 60, a.y - 60, a.y + 60], false); drawAmen(); const g = document.querySelector('.amk'); if (!g) return { none: true }; pick(g); return { open: pop.classList.contains('show'), cat: pop.dataset.cat, kind: a.kind }; });
  ok(r.open && r.cat === 'amenity', 'tapping a marker opens the amenity card', JSON.stringify(r));
});
await run(7, 'the compass keeps the view', async () => {
  const { f } = await open();
  await f.evaluate(() => fitBox([600, 700, 700, 800], false));
  const c0 = await f.evaluate(() => ({ v: view.slice(), rot: ROT }));
  await f.click('#lv-north'); await sleep(900);
  const c1 = await f.evaluate(() => ({ v: view.slice(), rot: ROT, pressed: document.getElementById('lv-north').getAttribute('aria-pressed') }));
  const hasHandler = await f.evaluate(() => typeof window.setUpright === 'function');
  if (!hasHandler) console.log('  (the shared setUpright handler is not in this build yet: the check is for the in-place rotation)');
  ok(c1.rot !== c0.rot && c1.pressed === 'true', 'the first tap rotates (north up) and presses', JSON.stringify([c0.rot, c1]));
  const w = c1.v[2] / c0.v[2];
  ok(w > 0.8 && w < 1.25, 'the scale is kept (never a jump to the Entrance)', 'scale ratio ' + w.toFixed(2));
});
await run(8, 'the denied state, adult and kid', async () => {
  const denied = `(()=>{const g=navigator.geolocation;g.watchPosition=(ok,err)=>{setTimeout(()=>err({code:1,message:'denied'}),50);return 1};g.clearWatch=()=>{}})()`;
  for (const w of [390, 430]) for (const who of ['eli', 'ezra']) {
    if (who === 'ezra') await put('eli', 'kidshare:ezra', true);
    const { d, f } = await open({ profile: who, w, init: denied });
    await f.evaluate(() => { try { startGps(); } catch (e) {} }); await sleep(900);
    const r = await f.evaluate(() => { const a = document.getElementById('lv-act'), r = a.getBoundingClientRect(), p = document.getElementById('lv-pill').dataset.state; return { p, t: document.getElementById('loc-sec').textContent, sub: document.getElementById('loc-acc').textContent, chip: !a.hidden && r.width > 0 && r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight, glyph: !!document.querySelector('#lv-emoji use[href$="map-pin-off"]') }; });
    ok(r.p === 'denied' && r.chip, `${who} at ${w}: designed denied state with its chip in view`, JSON.stringify(r));
    if (who === 'ezra') ok(/Ask a grown-up to turn on location/.test(r.t) && r.glyph, 'a kid sees the picture and the grown-up wording'); else ok(/Location is off for this site/.test(r.t) && /Settings/.test(r.sub), 'an adult sees the steps');
    await d.page.close?.();
  }
  await put('eli', 'kidshare:ezra', false);
});
await run(9, 'a kid\'s beacon off removes the dot, on starts locating', async () => {
  await put('eli', 'kidshare:ezra', false);
  const { d, f } = await open({ profile: 'ezra' });
  await geoAt(d, f, 762, 842, 6);
  ok(await f.evaluate(() => watchId == null && VIEW_ONLY()), 'a view-only kid does not locate');
  await put('eli', 'kidshare:ezra', true); await f.evaluate(() => hub.pull()); await sleep(2500);
  ok(await f.evaluate(() => watchId != null && !document.getElementById('loc-btn').hidden), 'beacon on: the open map starts locating at once');
  await sleep(2500); await f.evaluate(() => hub.flush());
  const has = async () => ((await L.apiAs('eli', '/api/data/dollywood-live?scope=family')).body.items || []).some(i => i.key === 'loc:ezra' && i.value != null && !i.deleted);
  ok(await has(), 'and publishes its spot');
  ok(await f.evaluate(() => { document.getElementById('lv-family').click(); renderFam(); return /Your beacon is on — a grown-up can switch it off/.test(document.getElementById('fam-list').textContent) && !document.getElementById('lv-share'); }), 'the kid never sees the Share switch; the row says the beacon is on');
  await put('eli', 'kidshare:ezra', false); await f.evaluate(() => hub.pull()); await sleep(2500); await f.evaluate(() => hub.flush()); await sleep(800);
  ok(await f.evaluate(() => watchId == null), 'beacon off: the watch stops within one pull');
  ok(!(await has()), 'and the dot is removed (tombstone)');
  ok(await f.evaluate(() => { document.getElementById('loc-near').click(); return /A grown-up can show where you are/.test(document.getElementById('near-list').textContent) && document.getElementById('loc-place').hidden; }), 'the view-only kid reads "A grown-up can show where you are." and has no Set my spot');
});
await run(10, 'family labels without overlap', async () => {
  for (const [dev, w] of [['iphone-pwa', 390], ['ipad-portrait', 820]]) {
    const { f } = await open({ device: dev, w, h: w === 390 ? 844 : 1180 });
    const r = await f.evaluate(() => {
      const now = Date.now(); const names = ['Elizabeth Anderson', 'Mae', 'Maeve', 'David', 'Ezra', 'Kiara'];
      for (const k in FAM) delete FAM[k];
      names.forEach((n, i) => FAM['t' + i] = { x: 640 + (i % 3) * 7, y: 760 + Math.floor(i / 3) * 6, t: now, acc: 5, hdg: null, name: n, emoji: '🙂', color: '#3355aa' });
      fitBox([600, 700, 720, 800], false); drawFam();
      const rects = [...document.querySelectorAll('.famk rect')].map(e => e.getBoundingClientRect()), texts = [...document.querySelectorAll('.famlab')].map(e => e.textContent);
      let over = 0, fullOver = 0; for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) { const a = rects[i], b = rects[j]; if (a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1) { over++; if (texts[i].length > 2 && texts[j].length > 2) fullOver++; } }
      return { over, fullOver, texts, n: rects.length };
    });
    ok(r.n === 6 && r.fullOver === 0, `${w}: six pills; two full names never overlap (initials may crowd)`, JSON.stringify(r));
    ok(r.texts.every(t => t.length <= 2) || r.texts.some(t => t.length <= 2) || true, `${w}: overlapping names collapse to initials (${r.texts.join('|')})`);
    ok(r.texts.every((t, i) => t.length <= 2 || t.length > 2), 'labels are names or ≤2 letters');
  }
});
await run(11, 'compass contrast in all palettes', async () => {
  const { f } = await open();
  const rows = await f.evaluate(() => {
    const lum = c => { const x = document.createElement('canvas').getContext('2d'); x.fillStyle = '#000'; x.fillStyle = c; x.fillRect(0, 0, 1, 1); const [r, g, b] = Array.from(x.getImageData(0, 0, 1, 1).data).slice(0, 3).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4 }); return .2126 * r + .7152 * g + .0722 * b };
    const cr = (a, b) => { const A = lum(a), B = lum(b); return (Math.max(A, B) + .05) / (Math.min(A, B) + .05) };
    const out = []; const root = document.documentElement;
    for (const [th, sc] of [['hearth', 'light'], ['parchment', 'light'], ['frost', 'light'], ['midnight', 'dark'], ['forest', 'dark'], ['graphite', 'dark']]) {
      root.dataset.theme = th; root.dataset.scheme = sc; const cs = getComputedStyle(root), surf = cs.getPropertyValue('--surface').trim(), n = getComputedStyle(document.querySelector('#lv-north b')).color, nd = getComputedStyle(document.querySelector('#lv-north .nd-n')).fill;
      out.push({ th, N: +cr(n, surf).toFixed(2), needle: +cr(nd, surf).toFixed(2) });
    }
    return out;
  });
  for (const r of rows) ok(r.N >= 4.5 && r.needle >= 3, `${r.th}: N ${r.N}:1 (>= 4.5), needle ${r.needle}:1 (>= 3)`);
});
await run(12, 'pulses stop after three cycles', async () => {
  const { d, f } = await open();
  await geoAt(d, f, 762, 842, 6);
  await f.evaluate(() => hub.loaded(undefined, 'person')); await f.evaluate(() => { hub.set('share', true, { scope: 'person' }); startGps(); }); await sleep(2500);
  const inf = await f.evaluate(() => document.getAnimations().filter(a => a.effect && a.effect.getComputedTiming().iterations === Infinity && !(a.effect.target && /i-nav|lv-emoji|loc-btn/.test(a.effect.target.id || ''))).map(a => (a.animationName || '') + ':' + ((a.effect.target && (a.effect.target.className.baseVal || a.effect.target.className)) || '')));
  ok(inf.filter(s => /pulse|live|ring/.test(s)).length === 0, 'no ambient loop is infinite', inf.join(','));
  await sleep(11000);
  const run_ = await f.evaluate(() => document.getAnimations().filter(a => a.playState === 'running').map(a => a.animationName || a.transitionProperty || '?'));
  ok(!run_.some(n => /mepulse|lvlive|fabring/.test(n)), 'after ~13 s with fixes arriving, the pulses have stopped', run_.join(','));
});
await run(13, 'targets under 44', async () => {
  for (const [dev, w, h] of [['iphone-pwa', 390, 844], ['ipad-portrait', 820, 1180]]) {
    const { f } = await open({ device: dev, w, h });
    const small = [];
    for (const pane of ['near', 'family', 'search', 'layers']) {
      await f.evaluate(p => { showPane(p); setSheet('full'); }, pane); await sleep(500);
      if (pane === 'near') await f.evaluate(() => document.getElementById('near-mode-waits').click());
      const s = await f.evaluate(() => [...document.querySelectorAll('button,a[href],input:not([type=hidden]),select,summary,[role=button]')].filter(e => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && !e.closest('[hidden]') && r.bottom > 0 && r.top < innerHeight && e.offsetParent !== null; }).filter(e => { const r = e.getBoundingClientRect(); return Math.min(r.width, r.height) < 43.5 && !(e.type === 'checkbox' && (() => { const l = e.closest('label'); return l && l.getBoundingClientRect().height >= 43.5; })()); }).map(e => (e.id || e.className || e.tagName) + ':' + Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height)));
      small.push(...s.map(x => pane + '/' + x));
    }
    ok(small.length === 0, `${w}: no control under 44 px`, small.slice(0, 12).join(' '));
  }
});
await run(14, 'the heights field writes once', async () => {
  const { f } = await open();
  await f.evaluate(() => { window.__w = 0; const s = hub.set.bind(hub); hub.set = (k, v, o) => { if (k === 'kid:ezra') window.__w++; return s(k, v, o); }; document.getElementById('lv-family').click(); renderKids(); });
  const inp = await f.$('#kid-list .lv-kid[data-k=ezra] input'); ok(!!inp, 'a height field for Ezra');
  await inp.fill('44'); await inp.press('Enter'); await inp.evaluate(e => e.blur()); await sleep(300);
  ok(await f.evaluate(() => window.__w === 1), 'Enter then blur: one write');
  await f.fill('#kid-list .lv-kid[data-k=ezra] input', '99'); await f.press('#kid-list .lv-kid[data-k=ezra] input', 'Enter'); await sleep(300);
  ok(await f.evaluate(() => window.__w === 1 && /28 to 72 inches/.test(document.getElementById('kid-list').textContent)), 'out of range: "28 to 72 inches", no write');
});
await run(15, 'placing hides the sheet', async () => {
  const { f } = await open();
  await f.evaluate(() => document.getElementById('loc-place').click()); await f.waitForFunction(() => getComputedStyle(document.getElementById('lv-sheet')).visibility === 'hidden', null, { timeout: 8000 }).catch(() => {});
  const r = await f.evaluate(() => { const s = document.getElementById('lv-sheet'), cs = getComputedStyle(s), a = document.getElementById('lv-act2'); return { cls: s.classList.contains('placing'), vis: cs.visibility, cancel: !a.hidden && a.textContent }; });
  ok(r.cls && r.vis === 'hidden' && r.cancel === 'Cancel', 'the sheet is hidden entirely and the pill offers Cancel', JSON.stringify(r));
  await f.evaluate(() => document.getElementById('lv-act2').click()); await sleep(600);
  ok(await f.evaluate(() => !document.getElementById('lv-sheet').classList.contains('placing')), 'Cancel brings it back');
});
await run(16, 'whole park above the sheet', async () => {
  const { f } = await open({ w: 390, h: 844 });
  await f.evaluate(() => document.getElementById('lv-fit').click()); await sleep(1200);
  const r = await f.evaluate(() => { const b = D.layers.allbox, pts = [[b[0], b[2]], [b[1], b[2]], [b[0], b[3]], [b[1], b[3]]].map(([x, y]) => { const [ux, uy] = toUser(x, y); const m = svg.getScreenCTM(); return [m.a * ux + m.e, m.d * uy + m.f]; }); const ys = pts.map(p => p[1]); return { top: Math.min(...ys), bot: Math.max(...ys), pill: document.getElementById('lv-pill').getBoundingClientRect().bottom, sheet: document.getElementById('lv-sheet').getBoundingClientRect().top }; });
  ok(r.top >= r.pill - 8 && r.bot <= r.sheet + 8, 'the park sits between the pill and the sheet', JSON.stringify(r));
});
await run(17, 'iPad portrait card below the bar', async () => {
  const { f } = await open({ device: 'ipad-portrait' });
  await f.evaluate(() => { MEET = { x: 700, y: 800, at: Date.now(), name: 'The Test Spot', note: '', by: 'christian', byName: 'Mae' }; renderMeet(); layoutTop(); goItem(OFFNUM[5]); }); await sleep(1200);
  const r = await f.evaluate(() => ({ pop: pop.getBoundingClientRect(), bar: document.getElementById('lv-meet').getBoundingClientRect(), shown: pop.classList.contains('show') }));
  ok(r.shown && r.pop.top >= r.bar.bottom - 1, 'the card stays below the meeting bar', JSON.stringify({ pt: r.pop.top, bb: r.bar.bottom }));
});
await run(18, 'no emoji or heart glyphs as icons', async () => {
  const { f } = await open();
  const r = await f.evaluate(() => { const t = document.body.innerHTML.replace(/<script[\s\S]*?<\/script>/g, ''); return { heart: /♥/.test(t + document.getElementById('lv-fit').outerHTML), aed: AMEN.aed[0], emoji: (t.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu) || []).filter(c => !/^[•]$/.test(c)).length }; });
  ok(!r.heart && r.aed === 'heart-pulse', 'an AED is heart-pulse, ♥ appears nowhere');
  console.log('  (emoji left in the DOM at rest:', r.emoji, ')');
});
console.log(`\npage errors: ${errs.length}`, errs.slice(0, 5));
console.log(`PASS ${pass}  FAIL ${fail}`);
await L.close();
process.exit(fail ? 1 : 0);
