// Batch 11, Tally: the look claims, on the local rig (WebKit, typical household, real clock). The app runs in the shell's viewer.
//  (1) UX-TALLY-5 / VIS-TALLY-2: at 375x667, 390x844, 844x390, 820x1180, 1180x820 and 1440x900, default and XXL text, adult (Eli) and
//      kid (Ezra): the name pill never overlaps the dial, + and - are inside the frame (above the fold), no sideways scroll, + and -
//      targets >= 44 px (64 px for a kid), Reset >= 44 (64 kid).
//  (2) VIS-TALLY-10: the dial's tick ring has >= 3:1 against the dial in every palette (Hearth, Parchment, Frost, Midnight, Forest, Graphite).
//  (3) VIS-TALLY-4: - and + are one material: the same background colour and image, border, shadow, ink.
//  (4) P4-GLASS-05 / CONS-GLASS-2: nothing on the page has a backdrop filter (the viewer bar is outside the frame): content layers 0.
//  (5) CONS-ICON-1 / VIS-TALLY-8: every svg is an svg.sym naming a sprite symbol; the pill carries the person's face (an .avatar with the
//      person's own data-accent); no hex in <style> (the pre-paint bootstrap's map is outside it); the page background is a real colour.
//   node "audits/tools/phase6/11/tally-claims-11.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';

const ROOT = process.cwd();
let pass = 0, fail = 0; const ok = (c, n, x) => { if (c) { pass++; console.log('  ✓', n); } else { fail++; console.log('  ✗', n, x === undefined ? '' : JSON.stringify(x).slice(0, 900)); } };
const SPRITE = fs.readFileSync(path.join(ROOT, 'icons', 'sprite.svg'), 'utf8');
const SYMS = new Set([...SPRITE.matchAll(/<symbol id="([^"]+)"/g)].map(m => m[1]));
const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
const SIZES = [[320, 568], [375, 667], [390, 844], [844, 390], [820, 1180], [1180, 820], [1440, 900]];
// Wait until the dial's width/height transition (--dur-slow) and the fit() that starts it have finished: a frame for the change to
// register, then until the dial has no running animation (its transitionend), with a 1.5 s fallback; never Reduce Motion.
const settle = f => f.evaluate(() => new Promise(res => {
  const dial = document.querySelector('.dial'); let t0 = performance.now();
  const step = () => { const busy = dial.getAnimations().length > 0; if (!busy || performance.now() - t0 > 1500) setTimeout(() => (dial.getAnimations().length && performance.now() - t0 < 1500 ? step() : res()), 120); else requestAnimationFrame(step); };
  setTimeout(step, 150);
}));
async function open(profile, size, attrs = {}, ls = null) {
  const d = await L.device({ device: 'iphone-pwa', profile, mode: 'light', fixedTime: false, localStorage: ls });
  await d.page.setViewportSize({ width: size[0], height: size[1] });
  const f = await d.openApp('tally', { wait: '#plus' });
  await sleep(900);
  if (Object.keys(attrs).length) { await f.evaluate(a => { for (const [k, v] of Object.entries(a)) document.documentElement.setAttribute(k, v); }, attrs); }
  await settle(f);
  return { d, f };
}
try {
  console.log('\n## (1) layout');
  for (const profile of ['eli', 'ezra']) for (const xxl of [false, true]) for (const [w, h] of SIZES) {
    const { d, f } = await open(profile, [w, h], xxl ? { 'data-text-size': 'xxl' } : {});
    const m = await f.evaluate(() => {
      const r = s => { const b = document.querySelector(s).getBoundingClientRect(); return { top: b.top, bottom: b.bottom, left: b.left, right: b.right, w: b.width, h: b.height }; };
      const who = r('#who'), dial = r('.dial'), plus = r('#plus'), minus = r('#minus'), reset = r('#reset');
      return { over: !(who.bottom <= dial.top + 0.5 || who.top >= dial.bottom || who.right <= dial.left || who.left >= dial.right), plusIn: plus.top >= 0 && plus.bottom <= innerHeight && plus.right <= innerWidth && plus.left >= 0,
        hs: document.documentElement.scrollWidth > innerWidth + 1, plusW: plus.w, minusW: minus.w, resetH: reset.h, ih: innerHeight, plusBottom: plus.bottom,
        resetIn: reset.top >= 0 && reset.bottom <= innerHeight && reset.right <= innerWidth, dialIn: dial.top >= -0.5 && dial.bottom <= innerHeight + 0.5 && dial.left >= 0 && dial.right <= innerWidth, dialW: dial.w };
    });
    const min = profile === 'ezra' ? 64 : 44, tag = `${profile}${xxl ? ' XXL' : ''} ${w}x${h}`;
    ok(!m.over && !m.hs, tag + ': pill clear of the dial, no sideways scroll', m);
    const tiny = w <= 330 && xxl;   // a 320 px phone at XXL: the chrome alone fills the frame; only no sideways scroll is required there
    ok(m.plusIn && (tiny || m.resetIn), tag + ': + (and Reset, except on a 320 px XXL phone) above the fold', m);
    ok(tiny || m.dialIn, tag + ': the whole dial is on the screen (never cut)', m);
    ok(m.plusW >= min && m.minusW >= min && m.resetH >= min - 0.5, tag + ': targets', m);
    await d.close();
  }
  console.log('\n## (1d) no first-load jump, one icon weight, big screens use their room');
  for (const profile of ['eli', 'ezra']) for (const [w, h] of [[390, 844], [820, 1180], [1180, 820]]) {
    const d = await L.device({ device: 'iphone-pwa', profile, mode: 'light', fixedTime: false });
    await d.page.addInitScript(() => { window.__tops = []; const tick = () => { const t = ['plus', 'minus', 'reset'].map(id => { const e = document.getElementById(id); return e ? Math.round(e.getBoundingClientRect().top * 10) / 10 : null; }); if (t.every(x => x != null)) window.__tops.push([...t, innerWidth, innerHeight]); requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
    await d.page.setViewportSize({ width: w, height: h });
    const f = await d.openApp('tally', { wait: '#plus' }); await sleep(2500);
    const j = await f.evaluate(() => { const all = window.__tops || [], last = all[all.length - 1] || [], s = all.filter(x => x[3] === last[3] && x[4] === last[4]);   // frames at the frame's final size: the viewer sizes the iframe itself
     const mx = i => Math.max(...s.map(x => x[i])), mn = i => Math.min(...s.map(x => x[i])); let prev = ''; const seq = []; all.forEach((x, i) => { const k = x.join('|'); if (k !== prev) seq.push(i + ':' + k); prev = k; }); return { samples: s.length, move: [0, 1, 2].map(i => Math.round((mx(i) - mn(i)) * 10) / 10), seq: seq.slice(0, 8) }; });
    ok(j.samples > 5 && j.move.every(x => x <= 1), `${profile} ${w}x${h}: -, + and Reset never move while the count arrives (${j.samples} frames, moves ${j.move.join('/')} px)`, j);
    const st = await f.evaluate(() => ['plus', 'minus', 'reset', 'add-counter'].map(id => getComputedStyle(document.getElementById(id).querySelector('svg.sym')).strokeWidth));
    ok(new Set(st).size === 1 && parseFloat(st[0]) === 1.75, `${profile} ${w}x${h}: + - Reset and New counter draw one icon weight (${st.join(' / ')})`, st);
    const dw = await f.evaluate(() => ({ dial: document.querySelector('.dial').getBoundingClientRect().width, ih: innerHeight }));
    const want = w >= 1024 ? 480 : w >= 744 ? 400 : 200;
    ok(dw.dial >= want && dw.dial <= dw.ih, `${profile} ${w}x${h}: the dial takes its room (${Math.round(dw.dial)} px, at least ${want}, inside the frame)`, dw);
    await d.close();
  }
  { const d = await L.device({ device: 'iphone-pwa', profile: 'eli', mode: 'light', fixedTime: false }); await d.page.setViewportSize({ width: 1440, height: 900 }); const f = await d.openApp('tally', { wait: '#plus' }); await sleep(1500);
    const w1 = await f.evaluate(() => document.querySelector('.dial').getBoundingClientRect().width); ok(w1 >= 480, `eli 1440x900: the dial takes its room (${Math.round(w1)} px, at least 480)`, w1); await d.close(); }
  console.log('\n## (1b) several counters (2 and 6, long names, 5 recent resets): + still on the screen, nothing overlapping');
  const now = Date.now();
  const names = ['Laps around the garden', 'Glasses of water today', 'Pages read this evening', 'Push-ups before dinner', 'Words of kindness given', 'Birds seen at the feeder'];
  const seed = async (pid, n) => {
    const put = (key, value) => L.apiAs(pid, `/api/data/tally/${encodeURIComponent(key)}?scope=person`, { method: 'PUT', body: { value, updated_at: Date.now() } });
    const cur = await L.apiAs(pid, '/api/data/tally?scope=person');
    for (const it of (cur.body.items || [])) if (/^(counter|c:|resetlog)/.test(it.key)) await L.apiAs(pid, `/api/data/tally/${encodeURIComponent(it.key)}?scope=person`, { method: 'DELETE' });
    for (let i = 0; i < n; i++) await put('counter:k' + i, { name: names[i], at: now - 100000 + i });
    for (let i = 0; i < 5; i++) await put('resetlog:' + (now - 5000 * (i + 1)), { cid: i % 2 && n > i ? 'k' + i : null, from: 123456 - i, at: now - 5000 * (i + 1) });
  };
  for (const profile of ['eli', 'ezra']) for (const n of [2, 6]) {
    await seed(profile, n);
    for (const xxl of [false, true]) for (const [w, h] of SIZES) {
      const { d, f } = await open(profile, [w, h], xxl ? { 'data-text-size': 'xxl' } : {});
      const m = await f.evaluate(() => {
        const vis = e => e && !e.hidden && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().height > 0;
        const got = {}; for (const [k, s] of Object.entries({ who: '#who', switcher: '#switcher', dial: '.dial', ctl: '#ctl' })) { const e = document.querySelector(s); if (vis(e)) { const b = e.getBoundingClientRect(); got[k] = { l: b.left, r: b.right, t: b.top, b: b.bottom }; } }
        const ks = Object.keys(got), over = [];
        for (let i = 0; i < ks.length; i++) for (let j = i + 1; j < ks.length; j++) { const a = got[ks[i]], b = got[ks[j]]; if (a.l < b.r - 1 && b.l < a.r - 1 && a.t < b.b - 1 && b.t < a.b - 1) over.push(ks[i] + '/' + ks[j]); }
        const p = document.getElementById('plus').getBoundingClientRect(), dial = document.querySelector('.dial').getBoundingClientRect();
        const rs = document.getElementById('reset').getBoundingClientRect();
        return { plusIn: p.top >= 0 && p.bottom <= innerHeight, resetIn: rs.top >= 0 && rs.bottom <= innerHeight && rs.right <= innerWidth && rs.left >= 0, resetClear: ['plus', 'minus'].every(id => { const q = document.getElementById(id).getBoundingClientRect(); return rs.right <= q.left + 1 || rs.left >= q.right - 1 || rs.bottom <= q.top + 1 || rs.top >= q.bottom - 1; }), over, hs: document.documentElement.scrollWidth > innerWidth + 1, disc: Math.round(dial.width), ih: innerHeight, plusBottom: Math.round(p.bottom), resets: document.querySelectorAll('#reset-list li').length };
      });
      const tiny = w <= 330 && xxl, minDisc = tiny ? 80 : w <= 330 ? 120 : w <= 400 && h <= 700 ? 160 : 120;
      ok(m.plusIn && (tiny || m.resetIn) && m.resetClear && !m.over.length && !m.hs && m.disc >= minDisc && m.resets === 5, `${profile} ${n} counters${xxl ? ' XXL' : ''} ${w}x${h}: + and Reset on the screen, no overlap, no sideways scroll, disc >= ${minDisc}, 5 resets listed`, m);
      if (n === 6) {
        const pk = await f.evaluate(() => { const c = document.getElementById('cpick'), r = c.getBoundingClientRect(); return { shown: !c.hidden && r.height > 0, text: c.textContent, seg: document.getElementById('seg').hidden, inView: r.left >= 0 && r.right <= innerWidth, h: r.height }; });
        ok(pk.shown && /Counters . 7/.test(pk.text) && pk.seg && pk.inView && pk.h >= (profile === 'ezra' ? 64 : 44) - 0.5, `${profile} 6 counters${xxl ? ' XXL' : ''} ${w}x${h}: one "Counters · 7" button says there are more, in view, big enough`, pk);
        await f.evaluate(() => document.getElementById('cpick').click()); await sleep(250);
        const sh = await f.evaluate(() => { const rows = [...document.querySelectorAll('.csheet li button')].map(b => b.getBoundingClientRect()); return { n: rows.length, minH: Math.min(...rows.map(r => r.height)), cut: rows.some(r => r.left < 0 || r.right > innerWidth) }; });
        ok(sh.n === 7 && sh.minH >= (profile === 'ezra' ? 64 : 44) - 0.5 && !sh.cut, `${profile} 6 counters${xxl ? ' XXL' : ''} ${w}x${h}: the list sheet shows all 7 on their own rows (>= ${profile === 'ezra' ? 64 : 44} px)`, sh);
      }
      await d.close();
    }
    await seed(profile, 0);
  }
  console.log('\n## (1c) across the room, adult and kid (the kid rule must not beat the room rule)');
  for (const profile of ['eli', 'ezra']) await L.apiAs(profile, '/api/data/tally/count?scope=person', { method: 'PUT', body: { value: 987654, updated_at: Date.now() } });
  for (const profile of ['eli', 'ezra']) for (const xxl of [false, true]) for (const [w, h] of [[820, 1180], [1180, 820], [1366, 1024]]) {
    const { d, f } = await open(profile, [w, h], xxl ? { 'data-text-size': 'xxl' } : {});
    const m = () => f.evaluate(() => { const dial = document.querySelector('.dial').getBoundingClientRect(), n = document.getElementById('n'), r = document.createRange(); r.selectNodeContents(n); const t = r.getBoundingClientRect(); return { w: dial.width, font: parseFloat(getComputedStyle(n).fontSize), text: n.textContent, textW: t.width, reset: getComputedStyle(document.getElementById('reset')).display, inside: t.left >= dial.left + dial.width * 0.05 && t.right <= dial.right - dial.width * 0.05 }; });
    const before = await m();
    await f.evaluate(() => window.__tally.far(true)); await settle(f);
    const after = await m();
    const need = w > h ? 1.3 : 1.05;   // landscape (the kitchen iPad): nearly the whole frame height
    ok(after.w > before.w * need && after.reset === 'none', `${profile}${xxl ? ' XXL' : ''} ${w}x${h}: room mode grows the dial (${Math.round(before.w)} -> ${Math.round(after.w)}) and puts Reset away`, { before, after });
    const wh = await f.evaluate(() => { const q = id => document.querySelector(id).getBoundingClientRect(), w = q('#who'), dl = q('.dial'), c = q('#ctl'), hit = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top; return { text: document.getElementById('who').textContent, shown: w.width > 0 && getComputedStyle(document.getElementById('who')).display !== 'none', inView: w.left >= 0 && w.right <= innerWidth && w.top >= 0 && w.bottom <= innerHeight, clear: !hit(w, dl) && !hit(w, c), face: !!document.querySelector('#who .avatar'), font: parseFloat(getComputedStyle(document.querySelector('#who .who-name')).fontSize) }; });
    ok(wh.shown && wh.inView && wh.clear && wh.face && new RegExp(profile === 'eli' ? 'Eli' : 'Ezra').test(wh.text), `${profile}${xxl ? ' XXL' : ''} ${w}x${h}: room mode keeps the face and name in view, clear of the dial and controls ("${wh.text}", ${Math.round(wh.font)} px)`, wh);
    ok(after.font / before.font >= 0.85 * (after.w / before.w) && after.inside, `${profile}${xxl ? ' XXL' : ''} ${w}x${h}: the number grows with the dial (${Math.round(before.font)} -> ${Math.round(after.font)} px) and stays inside it (${after.text})`, { before, after });
    await d.close();
  }
  { await seed('eli', 2); const { d, f } = await open('eli', [1180, 820]); await f.evaluate(() => document.querySelector('#seg button[data-cid="k1"]').click()); await sleep(300);
    await f.evaluate(() => window.__tally.far(true)); await settle(f);
    const wt = await f.evaluate(() => document.getElementById('who').textContent); ok(/Eli/.test(wt) && /Glasses of water today/.test(wt), `eli 1180x820: room mode on a named counter says which one ("${wt}")`, wt); await d.close(); await seed('eli', 0); }
  for (const profile of ['eli', 'ezra']) await L.apiAs(profile, '/api/data/tally/count?scope=person', { method: 'DELETE' });
  console.log('\n## (1e) the name pill never cuts a counter name; no chip runs past its track');
  for (const profile of ['eli', 'ezra']) {
    await seed(profile, 2);
    for (const xxl of [false, true]) for (const [w, h] of SIZES) for (const far of [false, true]) {
      if (far && w < 768) continue;
      const { d, f } = await open(profile, [w, h], xxl ? { 'data-text-size': 'xxl' } : {}, { ['hub.tally.sel.' + profile]: 'k1' });
      if (far) { await f.evaluate(() => window.__tally.far(true)); await settle(f); }
      const m = await f.evaluate(() => { const w = document.getElementById('who'), n = w.querySelector('.who-name'), r = w.getBoundingClientRect(), seg = document.getElementById('seg'), chips = seg.hidden ? [] : [...seg.querySelectorAll('button')];
        return { dims: [n.scrollWidth, n.clientWidth, n.scrollHeight, n.clientHeight, Math.round(r.width)], text: w.textContent.trim(), clipped: n.scrollWidth > n.clientWidth + 1 || n.scrollHeight > n.clientHeight + 6, inView: r.left >= 0 && r.right <= innerWidth, chipOver: chips.filter(b => b.scrollWidth > b.clientWidth + 1).length + (seg.hidden ? 0 : seg.scrollWidth > seg.clientWidth + 1 ? 1 : 0) }; });
      ok(/Glasses of water today/.test(m.text) && !m.clipped && m.inView && m.chipOver === 0, `${profile}${xxl ? ' XXL' : ''} ${w}x${h}${far ? ' room mode' : ''}: the pill shows "${m.text}" whole, no chip overflows its track`, m);
      await d.close();
    }
    await seed(profile, 0);
  }
  console.log('\n## (1f) kid XXL: + stays on the screen with a named counter, and with an unbroken 24-character name');
  for (const [label, name, w, h] of [['a named counter', 'Glasses of water today!!', 320, 568], ['a named counter', 'Glasses of water today!!', 375, 667], ['an unbroken 24-character name', 'Wwwwwwwwwwwwwwwwwwwwwwww', 844, 390], ['an unbroken 24-character name', 'Wwwwwwwwwwwwwwwwwwwwwwww', 320, 568]]) {
    await L.apiAs('ezra', '/api/data/tally/counter%3AkU?scope=person', { method: 'PUT', body: { value: { name, at: Date.now() - 1000 }, updated_at: Date.now() } });
    for (const sel of ['', 'kU']) {
      const { d, f } = await open('ezra', [w, h], { 'data-text-size': 'xxl' }, { 'hub.tally.sel.ezra': sel });
      const m = await f.evaluate(() => { const p = document.getElementById('plus').getBoundingClientRect(), pill = document.getElementById('who').getBoundingClientRect(); return { plusTop: Math.round(p.top), plusBottom: Math.round(p.bottom), ih: innerHeight, plusIn: p.top >= 0 && p.bottom <= innerHeight, hs: document.documentElement.scrollWidth > innerWidth + 1, pill: Math.round(pill.width) }; });
      ok(m.plusIn && !m.hs, `ezra XXL ${w}x${h} with ${label}${sel ? ' chosen' : ' (Count chosen)'}: + is on the screen (${m.plusTop}-${m.plusBottom} of ${m.ih}), no sideways scroll`, m);
      await d.close();
    }
    await L.apiAs('ezra', '/api/data/tally/counter%3AkU?scope=person', { method: 'DELETE' });
  }
  console.log('\n## (2) tick ring contrast, (3) one material, (4) no content glass, (5) icons and face');
  const { f } = await open('eli', [390, 844]);
  const lum = c => { const [r, g, b] = c.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  for (const [theme, scheme] of [['hearth', 'light'], ['parchment', 'light'], ['frost', 'light'], ['midnight', 'dark'], ['forest', 'dark'], ['graphite', 'dark']]) {
    await f.evaluate(([t, s]) => { const r = document.documentElement; r.setAttribute('data-theme', t); r.setAttribute('data-scheme', s); r.style.colorScheme = s; }, [theme, scheme]); await sleep(150);
    const c = await f.evaluate(() => { const dial = document.querySelector('.dial'), b = getComputedStyle(dial, '::before'), bg = getComputedStyle(dial).backgroundColor; return { ring: b.borderTopColor, style: b.borderTopStyle, bg }; });
    const px = s => (s.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
    const a = lum(px(c.ring)), b = lum(px(c.bg)), cr = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    ok(c.style === 'dashed' && cr >= 3, `${theme}: tick ring ${cr.toFixed(2)}:1 on the dial (>= 3)`, c);
  }
  const mat = await f.evaluate(() => { const g = id => { const s = getComputedStyle(document.getElementById(id)); return { bg: s.backgroundColor, img: s.backgroundImage, bd: s.borderTopColor + s.borderTopWidth, sh: s.boxShadow, ink: s.color }; }; return [g('minus'), g('plus')]; });
  ok(JSON.stringify(mat[0]) === JSON.stringify(mat[1]), '- and + share background, border, shadow and ink', mat);
  const glass = await f.evaluate(() => [...document.querySelectorAll('body *')].filter(e => { const s = getComputedStyle(e); return (s.backdropFilter && s.backdropFilter !== 'none') || (s.webkitBackdropFilter && s.webkitBackdropFilter !== 'none'); }).map(e => e.tagName + '#' + e.id + '.' + e.className));
  ok(glass.length === 0, 'content glass layers: 0', glass);
  const icons = await f.evaluate(() => [...document.querySelectorAll('svg')].map(s => ({ sym: s.classList.contains('sym'), href: (s.querySelector('use') || { getAttribute: () => '' }).getAttribute('href') })));
  ok(icons.length >= 3 && icons.every(i => i.sym && SYMS.has('i-' + String(i.href || '').split('#i-')[1])), 'every svg is a sprite svg.sym', icons);
  const face = await f.evaluate(() => { const a = document.querySelector('#who .avatar'); return a && { accent: a.dataset.accent, name: document.querySelector('#who .who-name').textContent, hue: hub.hueOf(hub.profile) }; });
  ok(face && face.accent === face.hue && /Eli/.test(face.name), 'the pill carries the persons own face in their own colour family', face);
  const html = fs.readFileSync(path.join(ROOT, 'apps', 'tally.html'), 'utf8'), style = html.match(/<style>([\s\S]*?)<\/style>/)[1];
  ok(!/#[0-9a-fA-F]{3,8}\b/.test(style), 'no hex colour in <style>');
  const bg = await f.evaluate(() => { const r = document.documentElement; const out = {}; for (const t of ['hearth', 'graphite']) { r.setAttribute('data-theme', t); out[t] = getComputedStyle(document.body).backgroundColor; } return out; });
  ok(bg.hearth !== bg.graphite && bg.hearth !== 'rgba(0, 0, 0, 0)', 'the page has a real background colour that follows the palette', bg);
} finally { await L.close(); console.log(`\nPASS ${pass} · FAIL ${fail}`); process.exit(fail ? 1 : 0); }
