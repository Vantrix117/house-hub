// Batch 8, Worker E: the Larder's look, on the local rig (typical household and the 32-item overflow list, real clock).
//  (1) VIS-LEFTOVERS-6: at the bottom of the list nothing (no card, no "Recently finished", no copy block) ends under the add
//      bar: the last block's bottom <= the bar's top; the page's bottom padding is the bar's measured height plus the safe area
//      + the bar's own bottom offset. 375 / 390 / 430 / 820 / 1180 / 1440, and 390 at XXL text. The bar keeps its glass (a
//      backdrop-filter) and goes solid under Reduce Transparency.
//  (2) P3-LEFTOVERS-11: a long name wraps to at most two lines (the clamp), a short one is one line; no name is a single
//      nowrap/ellipsis line.
//  (3) VIS-LEFTOVERS-11: the name field's width never shrinks from the first frames to after ready (sampled every frame); the
//      mic's slot is laid out from the first paint; where speech is not supported the mic is not laid out at all.
//  (4) UX-LEFTOVERS-3: the Kitchen iPad (html data-kind="kitchen", set in the frame: the rig has no kitchen profile): the oldest
//      item's name and age are at --fs-glance-3 and every card name is too; the cap height of the drawn "H" is measured in mm
//      on an 11-inch iPad (1 CSS px = 0.1924 mm); the check button is >= --tap-lg. 820 x 1180 and 1180 x 820.
//  (5) VIS-LEFTOVERS-4: every adult card shows who logged it with an .avatar in that person's own family (data-accent equal to
//      hub.hueOf), the faces differ between people, the card has the person's name in its title/aria-label.
//  (6) No horizontal scroll from 375 to 1440, and at XXL (375/390/820), adult.
//  (7) The kid view is unchanged: no check button, no add bar, no copy block, one .pic per card, no face, every target >= 64 px,
//      the name is not clamped (a kid reads the whole name).
//  (8) Icons: every <svg> on the page is an svg.sym whose <use> names a symbol in icons/sprite.svg (no inline paths, no text glyph
//      or emoji used as an icon on an adult card), the Copy button uses i-copy, never i-refresh-cw; no hex in <style>.
//  (9) The look of D's pieces, when they are in: the banner is a button, the edit sheet opens in the house sheet, #retry, the copy box.
//  (10) Review round 1: P3 the copy-fallback box (textarea + Select and copy) ends above the add bar at 390/430/820/1440 and XXL, light and
//      dark, and html carries scroll-padding-bottom = the bar; P4 only the name is the edit button (.nm[role=button], not .info) so the meta,
//      age, "Logged by" and "Some left" stay readable; P5 the kid picture view keeps its old geometry (flush stripe, 12-radius card, a name
//      column >= 130 px at 430, a one-name card <= 125 px, never broken mid-word); N6 the Kitchen shows the age once; N3 the sheet's
//      name field grows to show a long name whole.
//  (11) Rescore fixes: 1 "Some left" has the half circle (card and swipe layer); 2 i-check only in the finish action, Fresh no icon, Eat soon the
//      clock, Use it up the triangle, no close X; 3 two columns from 1024 px (not the Kitchen, not kids), nothing under the bar; 4 the chip beside the
//      check button from a 480 px card; 5 the subtitle row and the count keep one place from empty to filled; 6 the banner at title 2 from 768 px;
//      8 the toast keeps the hub's shared position and never covers a card's Undo or Select and copy (review R1).
//   node "audits/tools/phase6/8/larder-look-8.mjs"     ONLY=bottom,names,mic,kitchen,faces,hscroll,kid,icons,pieces,review,rescore
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';

const ROOT = process.cwd();
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null; const want = s => !ONLY || ONLY.includes(s);
const SHOTS = process.env.SHOTS || path.join(ROOT, 'audits', 'evidence', 'p6', '8', 'larder-look');
fs.mkdirSync(SHOTS, { recursive: true });
let pass = 0, fail = 0; const ok = (c, n, x) => { if (c) { pass++; console.log('  ✓', n); } else { fail++; console.log('  ✗', n, x === undefined ? '' : JSON.stringify(x).slice(0, 900)); } };
const SPRITE = fs.readFileSync(path.join(ROOT, 'icons', 'sprite.svg'), 'utf8');
const SYMS = new Set([...SPRITE.matchAll(/<symbol id="([^"]+)"/g)].map(m => m[1]));
const MM = 0.1924;   // an 11-inch iPad: mm per CSS px
const out = {};

const VIEWS = [['375', 375, 667], ['390', 390, 844], ['430', 430, 932], ['820', 820, 1180], ['1180', 1180, 820], ['1440', 1440, 900]];
async function open(L, { size, profile = 'eli', mode = 'light', device = 'iphone-pwa', attrs = {}, init, wait = '.item' } = {}) {
  const d = await L.device({ device, profile, mode, fixedTime: false });
  if (init) await d.ctx.addInitScript(init);
  if (size) await d.page.setViewportSize({ width: size[0], height: size[1] });
  const f = await d.openApp('leftovers', { wait });
  await sleep(900);
  if (Object.keys(attrs).length) { await f.evaluate(a => { for (const [k, v] of Object.entries(a)) document.documentElement.setAttribute(k, v); }, attrs); await sleep(500); }
  return { d, f };
}
const shot = (d, name) => d.page.screenshot({ path: path.join(SHOTS, name + '.png'), animations: 'disabled' });
const toBottom = async f => { await f.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await sleep(350); };

const LT = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
const LO = await local({ variant: 'overflow', clock: 'real', engine: 'webkit' });
try {
  // ── (1) nothing under the add bar ────────────────────────────────────────────────────────────────────────────────
  if (want('bottom')) console.log('\n## VIS-LEFTOVERS-6: the list ends above the add bar');
  out.bottom = {};
  for (const [L, tag] of [[LT, 'typical'], [LO, 'overflow']]) for (const [name, w, h, xxl] of [...VIEWS.map(v => [...v]), ['390xxl', 390, 844, true]]) {
    if (!want('bottom')) break;
    const { d, f } = await open(L, { size: [w, h], attrs: xxl ? { 'data-text-size': 'xxl' } : {} });
    await toBottom(f);
    const m = await f.evaluate(() => {
      const bar = document.getElementById('add').getBoundingClientRect();
      const blocks = [...document.querySelectorAll('.item, #donelist, .hearth, .copybox')].filter(e => e.getClientRects().length);
      const last = blocks.map(e => e.getBoundingClientRect().bottom).reduce((a, b) => Math.max(a, b), 0);
      const cs = getComputedStyle(document.body), bf = getComputedStyle(document.getElementById('add'));
      const safe = 0;
      return { barTop: Math.round(bar.top * 10) / 10, barH: Math.round(bar.height * 10) / 10, lastBottom: Math.round(last * 10) / 10, innerH: innerHeight,
        padBottom: parseFloat(cs.paddingBottom), addbarVar: getComputedStyle(document.documentElement).getPropertyValue('--addbar-h').trim(),
        bottomOffset: innerHeight - bar.bottom, glass: (bf.backdropFilter || bf.webkitBackdropFilter || '') !== 'none', hscroll: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 };
    });
    out.bottom[`${tag}-${name}`] = m;
    ok(m.lastBottom <= m.barTop + 0.5, `${tag}@${name}: the last block ends above the bar (${m.lastBottom} <= ${m.barTop})`, m);
    ok(Math.abs(m.padBottom - (m.barH + m.bottomOffset + 16)) <= 2, `${tag}@${name}: padding-bottom ${m.padBottom} = bar ${m.barH} + its offset ${Math.round(m.bottomOffset)} + one gap`, m);
    ok(m.glass, `${tag}@${name}: the bar is glass (a backdrop filter)`);
    if (name === '390' || name === '390xxl') await shot(d, `bottom-${tag}-${name}`);
    await d.close();
  }
  if (want('bottom')) {   // Reduce Transparency makes the bar opaque
    const { d, f } = await open(LT, { size: [390, 844], attrs: { 'data-transparency': 'reduce' } });
    const bg = await f.evaluate(() => getComputedStyle(document.getElementById('add')).backgroundColor);
    const a = /rgba?\(([^)]*)\)/.exec(bg); const alpha = a ? (a[1].split(',').length > 3 ? parseFloat(a[1].split(',')[3]) : 1) : 0;
    ok(alpha >= 0.95, `Solid glass: the add bar's fill is opaque (${bg})`, bg); await d.close();
  }

  // ── (2) names wrap to two lines ──────────────────────────────────────────────────────────────────────────────────
  if (want('names')) console.log('\n## P3-LEFTOVERS-11: names wrap to two lines');
  for (const [w, h] of want('names') ? [[375, 667], [390, 844], [820, 1180], [1440, 900]] : []) {
    const { d, f } = await open(LO, { size: [w, h] });
    const m = await f.evaluate(() => [...document.querySelectorAll('.item .nm')].map(n => { const cs = getComputedStyle(n), lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.3;
      return { text: n.textContent.length, lines: Math.round(n.getBoundingClientRect().height / lh), clamp: cs.webkitLineClamp || cs.lineClamp, cut: n.scrollHeight > n.clientHeight + 1, nowrap: cs.whiteSpace === 'nowrap' }; }));
    out[`names-${w}`] = m;
    ok(m.length > 20 && m.every(x => x.lines <= 2 && !x.nowrap), `${w}: ${m.length} names, none over two lines, none nowrap`, m.filter(x => x.lines > 2 || x.nowrap).slice(0, 3));
    ok(m.some(x => x.lines === 2) && m.some(x => x.lines === 1), `${w}: long names take two lines, short ones one`, m.map(x => x.lines));
    ok(m.every(x => String(x.clamp) === '2'), `${w}: the clamp is 2`, m.slice(0, 2));
    if (w === 390) await shot(d, 'names-overflow-390');
    await d.close();
  }

  // ── (3) the mic's slot ───────────────────────────────────────────────────────────────────────────────────────────
  if (want('mic')) console.log('\n## VIS-LEFTOVERS-11: the name field never shrinks');
  if (want('mic')) {
    const sampler = () => { window.__nw = []; const tick = () => { const n = document.getElementById('name'), m = document.getElementById('mic'); if (n) { const r = n.getBoundingClientRect(), mr = m && m.getBoundingClientRect(); window.__nw.push([Math.round(r.width * 10) / 10, mr ? Math.round(mr.width) : -1, document.readyState]); } requestAnimationFrame(tick); }; requestAnimationFrame(tick); };
    const { d, f } = await open(LT, { size: [390, 844], init: sampler });
    await sleep(2500);
    const s = await f.evaluate(() => ({ nw: window.__nw, hasHub: !!window.hub, micCls: document.getElementById('mic').className, micVis: getComputedStyle(document.getElementById('mic')).visibility }));
    const widths = [...new Set(s.nw.map(x => x[0]))];
    out.mic = { samples: s.nw.length, widths, micCls: s.micCls, micVis: s.micVis };
    ok(s.nw.length > 20 && widths.length === 1, `the name field keeps one width in all ${s.nw.length} sampled frames (${widths.join(', ')})`, widths);
    ok(s.nw.every(x => x[1] > 0), 'the mic slot is laid out in every frame (width > 0)', s.nw.slice(0, 3));
    ok(s.micVis === 'visible' && !/mic-off/.test(s.micCls), 'after ready the mic is visible', s);
    await shot(d, 'mic-390'); await d.close();
    const x = await open(LT, { size: [390, 844], init: () => { try { delete window.SpeechRecognition; delete window.webkitSpeechRecognition; Object.defineProperty(window, 'SpeechRecognition', { value: undefined }); Object.defineProperty(window, 'webkitSpeechRecognition', { value: undefined }); } catch {} } });
    const g = await x.f.evaluate(() => ({ nomic: document.documentElement.classList.contains('nomic'), disp: getComputedStyle(document.getElementById('mic')).display, w: document.getElementById('name').getBoundingClientRect().width }));
    ok(g.nomic && g.disp === 'none', 'without speech support the mic is not laid out (html.nomic, set before first paint)', g);
    await x.d.close();
  }

  // ── (4) the Kitchen iPad ─────────────────────────────────────────────────────────────────────────────────────────
  if (want('kitchen')) console.log('\n## UX-LEFTOVERS-3: the Kitchen iPad reads from 2 m');
  out.kitchen = {};
  for (const [device, tag] of want('kitchen') ? [['ipad-portrait', 'portrait'], ['ipad-landscape', 'landscape']] : []) {
    const { d, f } = await open(LT, { device, attrs: { 'data-kind': 'kitchen' } });
    const m = await f.evaluate(() => {
      const probe = v => { const p = document.createElement('div'); p.style.cssText = 'position:absolute;visibility:hidden;font-size:var(' + v + ')'; document.body.appendChild(p); const px = parseFloat(getComputedStyle(p).fontSize); p.remove(); return px; };
      const cap = el => { const cs = getComputedStyle(el); const c = document.createElement('canvas').getContext('2d'); c.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`; const t = c.measureText('H'); return t.actualBoundingBoxAscent + t.actualBoundingBoxDescent; };
      const first = document.querySelector('#list > .group > .list > .item'), names = [...document.querySelectorAll('.item .nm')];
      const nm = first.querySelector('.nm'), age = first.querySelector('.age'), done = first.querySelector('.done');
      const glance = probe('--fs-glance-3'), tapLg = probe('--tap-lg');
      const chk = done.getBoundingClientRect();
      return { glance, nameFont: parseFloat(getComputedStyle(nm).fontSize), ageFont: parseFloat(getComputedStyle(age).fontSize), ageShown: getComputedStyle(age).display !== 'none', ageText: age.textContent,
        allNames: names.every(n => parseFloat(getComputedStyle(n).fontSize) >= glance - 0.5), nameCapPx: cap(nm), ageCapPx: cap(age), done: [Math.round(chk.width), Math.round(chk.height)],
        tapLg: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--tap-lg')) || null, hscroll: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, firstName: nm.textContent, wrapW: Math.round(document.querySelector('.wrap').getBoundingClientRect().width) };
    });
    m.nameMm = Math.round(m.nameCapPx * MM * 100) / 100; m.ageMm = Math.round(m.ageCapPx * MM * 100) / 100; m.metresAtH2 = Math.round(m.nameMm * 344) / 1000;
    out.kitchen[tag] = m;
    ok(m.nameFont >= m.glance - 0.5 && m.ageShown && m.ageFont >= m.glance - 0.5, `${tag}: the oldest item (${m.firstName}) name ${m.nameFont}px and age "${m.ageText}" ${m.ageFont}px are at --fs-glance-3 (${m.glance}px)`, m);
    ok(m.allNames, `${tag}: every card name is at the glance role`);
    ok(m.nameMm >= 5.8, `${tag}: the name's cap height is ${m.nameMm} mm (H2 needs 5.8 mm at 2 m; reads to about ${m.metresAtH2} m)`, m);
    ok(m.done[0] >= 60 && m.done[1] >= 60, `${tag}: the check button is ${m.done.join(' x ')} px (>= 60)`, m.done);
    ok(!m.hscroll, `${tag}: no horizontal scroll`);
    await shot(d, `kitchen-${tag}`); await d.close();
  }

  // ── (5) faces ────────────────────────────────────────────────────────────────────────────────────────────────────
  if (want('faces')) console.log('\n## VIS-LEFTOVERS-4: each card shows who logged it');
  for (const mode of want('faces') ? ['light', 'dark'] : []) {
    const { d, f } = await open(LT, { size: [390, 844], mode });
    const m = await f.evaluate(() => [...document.querySelectorAll('.item')].map(c => {
      const lg = c.querySelector('.logger'), av = c.querySelector('.logger .avatar'), cs = av && getComputedStyle(av);
      return { name: c.querySelector('.nm').textContent, face: !!av, accent: av && av.dataset.accent, bg: cs && cs.backgroundColor, ring: cs && cs.boxShadow.slice(0, 80), title: lg && lg.title, size: av && Math.round(av.getBoundingClientRect().width) };
    }));
    out[`faces-${mode}`] = m;
    ok(m.length >= 5 && m.every(x => x.face && /^Logged by /.test(x.title || '')), `${mode}: every card has a face and "Logged by <name>"`, m.filter(x => !x.face));
    ok(new Set(m.map(x => x.accent)).size >= 2 && new Set(m.map(x => x.bg)).size >= 2, `${mode}: the faces wear their own colours (${[...new Set(m.map(x => x.accent))].join(', ')})`, m.map(x => [x.accent, x.bg]));
    const same = await f.evaluate(() => [...document.querySelectorAll('.item')].every(c => { const av = c.querySelector('.logger .avatar'); const id = (hub.list('item:').map(r => r.value).find(v => v.id === c.dataset.id) || {}).by; const p = hub.people().find(x => x.id === id); return !av || !p || av.dataset.accent === hub.hueOf(p); }));
    ok(same, `${mode}: each face's family is hub.hueOf(its person)`);
    if (mode === 'light') await shot(d, 'faces-390-light');
    await d.close();
  }
  if (want('faces')) {   // two people, two Log colours (CONS-ACCENT-4)
    const logs = [];
    for (const profile of ['eli', 'christian']) { const { d, f } = await open(LT, { size: [390, 844], profile }); logs.push(await f.evaluate(() => { const cs = getComputedStyle(document.querySelector('.log')); return [cs.backgroundColor, cs.color, getComputedStyle(document.getElementById('mic')).color, document.documentElement.dataset.accent]; })); await d.close(); }
    out.logColours = logs;
    ok(logs[0][0] !== logs[1][0] && logs[0][1] && logs[0][3] !== logs[1][3], `the Log button is the person's own solid (${logs.map(l => l[3] + ' ' + l[0]).join(' | ')})`, logs);
  }

  // ── (6) no sideways scroll ───────────────────────────────────────────────────────────────────────────────────────
  if (want('hscroll')) console.log('\n## no horizontal scroll');
  for (const [L, tag] of want('hscroll') ? [[LT, 'typical'], [LO, 'overflow']] : []) for (const [name, w, h, xxl] of [...VIEWS, ['375xxl', 375, 667, true], ['390xxl', 390, 844, true], ['820xxl', 820, 1180, true]]) {
    const { d, f } = await open(L, { size: [w, h], attrs: xxl ? { 'data-text-size': 'xxl' } : {} });
    const m = await f.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, over: [...document.querySelectorAll('body *')].filter(e => e.getClientRects().length && e.getBoundingClientRect().right > document.documentElement.clientWidth + 1 && !e.closest('.swipe-act')).slice(0, 3).map(e => e.tagName + '.' + e.className) }));
    ok(m.sw <= m.cw + 1 && !m.over.length, `${tag}@${name}: scrollWidth ${m.sw} <= ${m.cw}, nothing past the right edge`, m);
    await d.close();
  }

  // ── (7) the kid view ─────────────────────────────────────────────────────────────────────────────────────────────
  if (want('kid')) console.log('\n## the kid view is unchanged');
  for (const [w, h] of want('kid') ? [[390, 844], [820, 1180]] : []) {
    const { d, f } = await open(LO, { size: [w, h], profile: 'ezra' });
    const m = await f.evaluate(() => {
      const cards = [...document.querySelectorAll('.item')];
      const small = [...document.querySelectorAll('button, a[href], input:not([type=hidden]), select, summary')].filter(e => e.getClientRects().length).map(e => { const r = e.getBoundingClientRect(); return [e.tagName + '.' + e.className, Math.round(r.width), Math.round(r.height)]; }).filter(x => x[1] < 63 || x[2] < 63);
      return { cards: cards.length, done: document.querySelectorAll('.done, .undo, .swipe-act').length, pics: cards.filter(c => c.querySelector('.pic') && getComputedStyle(c.querySelector('.pic')).display !== 'none').length,
        face: document.querySelectorAll('.logger').length, bar: getComputedStyle(document.getElementById('add')).display, hearth: getComputedStyle(document.querySelector('.hearth')).display, donelist: getComputedStyle(document.getElementById('donelist')).display,
        small, clipped: cards.filter(c => { const n = c.querySelector('.nm'); return n.scrollHeight > n.clientHeight + 1; }).length, role: cards.filter(c => c.querySelector('[role=button]')).length };
    });
    out[`kid-${w}`] = m;
    ok(m.cards > 20 && m.done === 0 && m.role === 0 && m.pics === m.cards && m.face === 0, `${w}: ${m.cards} picture cards, no check, no undo, no swipe, no edit target, no face`, m);
    ok(m.bar === 'none' && m.hearth === 'none' && m.donelist === 'none', `${w}: no add bar, no copy block, no finished list`, m);
    ok(!m.small.length, `${w}: every target is at least 64 px`, m.small.slice(0, 4));
    ok(m.clipped === 0, `${w}: no kid's name is cut`, m.clipped);
    if (w === 390) await shot(d, 'kid-390');
    await d.close();
  }

  // ── (8) icons and no hex ─────────────────────────────────────────────────────────────────────────────────────────
  if (want('icons')) console.log('\n## icons from the sprite, no hex');
  if (want('icons')) {
    const { d, f } = await open(LT, { size: [390, 844] });
    const m = await f.evaluate(() => {
      const bad = [], uses = [];
      for (const s of document.querySelectorAll('svg')) { if (s.closest('#hub-toast')) continue; const u = s.querySelector('use'); if (!s.classList.contains('sym') || !u) { bad.push(s.outerHTML.slice(0, 80)); continue; } uses.push((u.getAttribute('href') || '').split('#')[1]); }
      const glyphs = [...document.querySelectorAll('.item, #donelist, .hearth, form')].map(e => e.textContent).join('').match(/[✓✕✗✔★⚠↻⟳]/g) || [];
      const copyUse = document.querySelector('#copy use') && document.querySelector('#copy use').getAttribute('href');
      return { bad, uses: [...new Set(uses)], glyphs, copyUse, stroke: [...document.querySelectorAll('svg.sym')].map(s => getComputedStyle(s).strokeWidth).filter((v, i, a) => a.indexOf(v) === i) };
    });
    out.icons = m;
    ok(!m.bad.length, 'every <svg> is an svg.sym with a <use>', m.bad);
    ok(m.uses.every(u => SYMS.has(u)), `every symbol exists in icons/sprite.svg (${m.uses.join(', ')})`, m.uses.filter(u => !SYMS.has(u)));
    ok(!m.glyphs.length, 'no text glyph is used as an icon on a card, the finished list, the copy block or the add bar', m.glyphs);
    ok(/#i-copy$/.test(m.copyUse || '') && !m.uses.includes('i-refresh-cw'), 'Copy uses i-copy, never the refresh glyph', m);
    const html = fs.readFileSync(path.join(ROOT, 'apps', 'leftovers.html'), 'utf8'), style = (html.match(/<style>([\s\S]*?)<\/style>/) || [])[1] || '';
    ok(!/#[0-9a-fA-F]{3,8}\b/.test(style) && !/prefers-color-scheme/.test(style), 'no hex and no prefers-color-scheme in <style>');
    await d.close();
  }

  // ── (10) review round 1 ──
  if (want('review')) console.log('\n## review round 1: copy box above the bar, the name is the button, kid geometry, one age, a long name in the sheet');
  if (want('review')) {
    const refuse = () => { try { Object.defineProperty(Navigator.prototype, 'clipboard', { configurable: true, get: () => ({ writeText: () => Promise.reject(new Error('no')) }) }); } catch {} try { Document.prototype.execCommand = () => false; } catch {} };
    out.copybox = {};
    for (const [name, w, h, xxl] of [['390', 390, 844], ['430', 430, 932], ['820', 820, 1180], ['1440', 1440, 900], ['390xxl', 390, 844, true]]) for (const mode of ['light', 'dark']) {
      const { d, f } = await open(LT, { size: [w, h], mode, init: refuse, attrs: xxl ? { 'data-text-size': 'xxl' } : {} });
      await f.evaluate(() => document.getElementById('copy').click()); await sleep(900);
      const m = await f.evaluate(() => { const b = document.getElementById('copybox').getBoundingClientRect(), bar = document.getElementById('add').getBoundingClientRect(), sp = getComputedStyle(document.documentElement).scrollPaddingBottom;
        return { boxBottom: Math.round(b.bottom * 10) / 10, boxTop: Math.round(b.top), barTop: Math.round(bar.top * 10) / 10, shown: !document.getElementById('copybox').hidden, sp }; });
      out.copybox[name + '-' + mode] = m;
      ok(m.shown && m.boxBottom <= m.barTop, `${name}/${mode}: the copy box (bottom ${m.boxBottom}) ends above the add bar (top ${m.barTop})`, m);
      ok(parseFloat(m.sp) > 100, `${name}/${mode}: html has scroll-padding-bottom (${m.sp})`, m);
      if (mode === 'light' && (name === '390' || name === '390xxl')) await shot(d, 'copybox-' + name);
      await d.close();
    }
    { const { d, f } = await open(LT, { size: [390, 844] });   // a focused card stays clear of the bar
      const m = await f.evaluate(() => { const cs = [...document.querySelectorAll('.item .nm[role=button]')], last = cs[cs.length - 1]; last.focus(); return { n: cs.length, cards: document.querySelectorAll('.item').length, infoRole: document.querySelectorAll('.item .info[role]').length }; });
      ok(m.n === m.cards && m.infoRole === 0, 'P4: every card has one edit button, and it is the name (not the whole .info)', m);
      await sleep(300);
      const m2 = await f.evaluate(() => { const l = document.activeElement.getBoundingClientRect(); return [l.bottom, document.getElementById('add').getBoundingClientRect().top]; });
      ok(m2[0] <= m2[1], `P4/P3: a Tab-focused last card stays above the bar (${Math.round(m2[0])} <= ${Math.round(m2[1])})`, m2);
      const meta = await f.evaluate(() => { const c = document.querySelector('.item'); const nm = c.querySelector('.nm[role=button]'); return { nmText: nm.textContent, meta: c.querySelector('.meta').textContent, metaInsideButton: !!c.querySelector('.nm[role=button] .meta') }; });
      ok(!meta.metaInsideButton && /day|today/.test(meta.meta), 'P4: the size, date and age are outside the button, so a screen reader reads them', meta);
      await d.close(); }
    { const { d, f } = await open(LT, { size: [430, 932], device: 'iphone-pwa', profile: 'ezra' });
      const m = await f.evaluate(() => { const cs = [...document.querySelectorAll('.item')], c0 = cs[0], nm = c0.querySelector('.nm'), st = c0.querySelector('.stripe'), s = getComputedStyle(c0);
        return { nmW: Math.round(nm.getBoundingClientRect().width), radius: s.borderRadius, stripeMargin: getComputedStyle(st).marginLeft, stripeH: Math.round(st.getBoundingClientRect().height), cardH: Math.round(c0.getBoundingClientRect().height), wrap: getComputedStyle(nm).overflowWrap,
          cut: cs.filter(c => { const n = c.querySelector('.nm'); return n.scrollWidth > n.clientWidth + 1; }).length, heights: cs.map(c => Math.round(c.getBoundingClientRect().height)) }; });
      out.kidGeom = m;
      ok(m.stripeMargin === '0px' && m.stripeH >= m.cardH - 3 && parseFloat(m.radius) <= 20, `P5: the kid card has the flush stripe and the small radius (${m.radius})`, m);
      ok(m.wrap === 'break-word' && m.cut === 0, 'P5: the kid name breaks at words (overflow-wrap: break-word), never cut', m);
      ok(m.nmW >= 130, `P5: the kid name column is ${m.nmW} px at 430 (about 150 before batch 8, 134 before this fix)`, m);
      ok(m.cardH <= 125, `P5: a one-name card is ${m.cardH} px high (about 98 before batch 8, 157 before this fix); all ${m.heights.join(',')}`, m);
      await shot(d, 'kid-430'); await d.close(); }
    { const { d, f } = await open(LT, { device: 'ipad-portrait', attrs: { 'data-kind': 'kitchen' } });
      const m = await f.evaluate(() => { const c = document.querySelector('.item'), vis = [...c.querySelectorAll('.age, .mage')].filter(e => e.getClientRects().length && getComputedStyle(e).display !== 'none'); return { texts: vis.map(e => e.textContent), meta: c.querySelector('.meta .mt').innerText }; });
      ok(m.texts.length === 1 && !/days/.test(m.meta), `N6: the Kitchen shows the age once ("${m.texts[0]}"; meta "${m.meta}")`, m);
      await d.close(); }
    { const { d, f } = await open(LT, { size: [390, 844] });   // N1 look: a use-by item reads right (bar = the rule's score, chip, group)
      const m = await f.evaluate(async () => { const it = hub.list('item:').map(r => r.value).find(v => /pot roast/i.test(v.name)); const t = new Date(hub.today() + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() + 1);
        hub.set('item:' + it.id, { ...it, useBy: t.toISOString().slice(0, 10) }); window.__larder.render(); await new Promise(r => setTimeout(r, 300));
        const c = document.querySelector('.item[data-id="' + it.id + '"]'); return { level: c.dataset.level, p: parseFloat(getComputedStyle(c.querySelector('.bar')).getPropertyValue('--p')), chip: c.querySelector('.status').textContent.trim(), label: c.querySelector('.bar').getAttribute('aria-label'), group: c.closest('.group').dataset.tone, meta: c.querySelector('.meta').textContent }; });
      ok(m.level === 'soon' && Math.abs(m.p - 0.6) < 0.01 && /Eat soon/.test(m.chip) && m.group === 'warn' && /use by/.test(m.meta), 'N1: a pot roast with use-by tomorrow is "Eat soon", in the Eat soon group, bar 60% (the rule score), meta says use by', m);
      await f.evaluate(() => window.scrollTo(0, 300)); await sleep(300); await shot(d, 'useby-390'); await d.close(); }
    { const { d, f } = await open(LO, { size: [390, 844] });   // N3 a long name in the sheet
      await f.evaluate(() => { document.querySelector('.item .nm[role=button]').click(); }); await sleep(500);
      const m = await f.evaluate(() => { const t = document.getElementById('e-name'); return { tag: t.tagName, val: t.value.length, h: Math.round(t.getBoundingClientRect().height), sh: t.scrollHeight, ch: t.clientHeight }; });
      ok(m.tag === 'TEXTAREA' && m.sh <= m.ch + 1 && m.h > 60, `N3: the sheet shows the whole ${m.val}-character name (${m.h} px high, no scroll)`, m);
      await shot(d, 'sheet-long-name'); await d.close(); }
  }

  // ── (11) rescore fixes: icons per meaning, two columns, chip beside the check, the subtitle row, glance banner, toast above the bar ──
  if (want('rescore')) console.log('\n## rescore: one drawing per meaning, two columns from 1024, chip beside the check, subtitle row, banner, toast');
  if (want('rescore')) {
    { const { d, f } = await open(LT, { size: [390, 844] });
      await f.evaluate(async () => { const it = hub.list('item:').map(r => r.value).find(v => /pot roast/i.test(v.name)); window.__larder.setPortion(it.id, true); await new Promise(r => setTimeout(r, 500)); });
      const m = await f.evaluate(() => {
        const use = e => [...e.querySelectorAll('use')].map(u => (u.getAttribute('href') || '').split('#')[1]);
        const cards = [...document.querySelectorAll('.item')];
        const chips = Object.fromEntries(cards.map(c => [c.dataset.level, use(c.querySelector('.status'))]));
        const checks = [...document.querySelectorAll('use[href$="#i-check"]')].map(u => u.closest('.done, .sw-fin, .status, .putback, .alert') ? u.closest('.done, .sw-fin, .status, .putback, .alert').className.split(' ')[0] : 'other');
        const some = document.querySelector('.item.some');
        return { chips, checks: [...new Set(checks)], portionUse: some && use(some.querySelector('.portion')), swUse: some && use(some.querySelector('.sw-some')), pbar: document.querySelectorAll('.pbar').length, usesX: document.querySelectorAll('use[href$="#i-x"]').length };
      });
      out.iconsPerMeaning = m;
      ok(m.checks.every(c => c === 'done' || c === 'sw-fin'), `1/2: i-check appears only in the finish action (${m.checks.join(', ')})`, m);
      ok(m.chips.fresh && m.chips.fresh.length === 0 && m.chips.soon[0] === 'i-clock' && m.chips.old[0] === 'i-triangle-alert', `2: Fresh has no icon, Eat soon the clock, Use it up the warning triangle (${JSON.stringify(m.chips)})`, m.chips);
      ok(m.usesX === 0, '2: no close X on a card', m);
      ok(m.portionUse && m.portionUse[0] === 'i-circle-half' && m.swUse[0] === 'i-circle-half' && m.pbar === 0, '1: "Some left" has the half circle, on the card and in the swipe layer, and no mini switch bar', m);
      await f.evaluate(() => window.scrollTo(0, 300)); await sleep(300); await shot(d, 'rescore-icons-390'); await d.close(); }
    out.cols = {};
    for (const [name, w, h, attrs] of [['820', 820, 1180, {}], ['1024', 1024, 768, {}], ['1180', 1180, 820, {}], ['1440', 1440, 900, {}], ['1180kitchen', 1180, 820, { 'data-kind': 'kitchen' }]]) {
      const { d, f } = await open(LO, { size: [w, h], attrs });
      const m = await f.evaluate(() => { const lists = [...document.querySelectorAll('#list .group > .list')], tracks = getComputedStyle(lists[0]).gridTemplateColumns.split(' ').length;
        const c = [...lists[0].querySelectorAll('.item')]; const r0 = c[0].getBoundingClientRect(), r1 = c[1].getBoundingClientRect(), bar = document.getElementById('add').getBoundingClientRect(); const wrap = document.querySelector('.wrap').getBoundingClientRect();
        return { tracks, sameRow: Math.abs(r0.top - r1.top) < 2 && r1.left > r0.right - 1, w0: Math.round(r0.width), wrapW: Math.round(wrap.width), hs: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, padBottom: parseFloat(getComputedStyle(document.body).paddingBottom), barH: Math.round(bar.height) }; });
      out.cols[name] = m;
      const two = w >= 1024 && !attrs['data-kind'];
      ok(two ? m.tracks === 2 && m.sameRow && m.wrapW > 700 : m.tracks === 1 && !m.sameRow, `3: ${name}: ${m.tracks} column(s), wrap ${m.wrapW} px, cards ${m.w0} px`, m);
      ok(!m.hs, `3: ${name}: no sideways scroll`);
      if (two) { await f.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await sleep(300);
        const u = await f.evaluate(() => { const last = [...document.querySelectorAll('.item, #donelist, .hearth')].map(e => e.getBoundingClientRect().bottom).reduce((a, b) => Math.max(a, b), 0); return [Math.round(last), Math.round(document.getElementById('add').getBoundingClientRect().top)]; });
        ok(u[0] <= u[1], `3: ${name}: at the bottom nothing is under the add bar (${u[0]} <= ${u[1]})`, u); }
      if (name === '1180' || name === '1440') await shot(d, 'cols-' + name);
      await d.close(); }
    { const { d, f } = await open(LT, { size: [390, 844] }); const { d: d2, f: f2 } = await open(LT, { size: [1180, 820] });
      const stack = await f.evaluate(() => { const c = document.querySelector('.item'), s = c.querySelector('.status').getBoundingClientRect(), k = c.querySelector('.done').getBoundingClientRect(); return { cardW: Math.round(c.getBoundingClientRect().width), stacked: s.bottom <= k.top + 1 }; });
      const side = await f2.evaluate(() => { const c = document.querySelector('.item'), s = c.querySelector('.status').getBoundingClientRect(), k = c.querySelector('.done').getBoundingClientRect(); return { cardW: Math.round(c.getBoundingClientRect().width), beside: s.right <= k.left && Math.abs((s.top + s.bottom) / 2 - (k.top + k.bottom) / 2) < 6, h: Math.round(c.getBoundingClientRect().height) }; });
      out.chipBeside = { stack, side };
      ok(stack.cardW < 480 && stack.stacked, `4: a ${stack.cardW} px card keeps the chip above the check button`, stack);
      ok(side.cardW >= 480 && side.beside, `4: a ${side.cardW} px card puts the chip beside the check button (card ${side.h} px high)`, side);
      await d.close(); await d2.close(); }
    { const sampler = () => { window.__sub = []; const tick = () => { const s = document.querySelector('.sub'), l = document.getElementById('list'), t = document.getElementById('tally'); if (s && l && t) { const a = s.getBoundingClientRect(), b = l.getBoundingClientRect(), c = t.getBoundingClientRect(); window.__sub.push([Math.round(a.top), Math.round(a.height), Math.round(b.top), Math.round(c.top), Math.round(c.height), !!t.textContent]); } requestAnimationFrame(tick); }; requestAnimationFrame(tick); };
      for (const [w, h] of [[390, 844], [820, 1180]]) {
        // the run must see both states (an empty count while loading, then the filled one), or the check proves nothing
        const { d, f } = await open(LT, { size: [w, h], init: sampler });
        // open() lands on a Larder that is already filled: the shell has pulled the house list and the app paints that cache at its first frame, so a
        // sampler started with the page sees no empty state (WebKit; a slower pull in other runs only hid this). Make the cold open real and
        // repeatable: drop this app's cache, hold the list's request for 700 ms, reload the frame, and sample from the empty count to the filled one.
        await d.page.route(u => u.pathname.includes('/api/data/leftovers'), async r => { await sleep(700); r.continue().catch(() => {}); });
        await f.evaluate(() => { for (const k of Object.keys(localStorage)) if (k.startsWith('hub.cache.leftovers.')) localStorage.removeItem(k); location.reload(); });
        await sleep(300); await f.waitForSelector('.item', { timeout: 20000 }); await sleep(2500);
        const s = await f.evaluate(() => window.__sub);
        const uniq = k => [...new Set(s.map(x => x[k]))];
        out['sub' + w] = { n: s.length, sub: uniq(0), subH: uniq(1), list: uniq(2), tally: uniq(3), tallyH: uniq(4), filled: s.some(x => x[5]) && s.some(x => !x[5]) };
        ok(s.length > 10 && out['sub' + w].filled && uniq(0).length === 1 && uniq(1).length === 1 && uniq(3).length === 1 && uniq(4).length === 1, `5: ${w}: the subtitle row and the count keep one place in all ${s.length} frames from empty to filled (row at ${uniq(0)}, count ${uniq(3)})`, out['sub' + w]);
        await d.close(); } }
    for (const [name, w, h] of [['390', 390, 844], ['820', 820, 1180], ['1180', 1180, 820]]) {
      const { d, f } = await open(LT, { size: [w, h] });
      const m = await f.evaluate(() => { const p = document.createElement('div'); p.style.cssText = 'position:absolute;visibility:hidden;font-size:var(--fs-title2)'; document.body.appendChild(p); const t2 = parseFloat(getComputedStyle(p).fontSize); p.remove(); return { font: parseFloat(getComputedStyle(document.querySelector('.alert')).fontSize), t2 }; });
      out['banner' + name] = m;
      ok(w >= 768 ? m.font >= m.t2 - 0.5 : m.font < m.t2, `6: ${name}: the banner is ${m.font}px (title 2 is ${m.t2}px; on from 768 px)`, m);
      await d.close(); }
    for (const [name, w, h] of [['390', 390, 844], ['820', 820, 1180], ['1440', 1440, 900]]) {
      const { d, f } = await open(LT, { size: [w, h] });
      // review R1 (batch 8, confirmation round): the toast keeps the hub's shared position (a Larder offset above the add bar covered a
      // card's own Undo, a just-logged card and Select and copy). It may cover the bar's Size and Date for a few seconds; it never covers a
      // card's Undo, the card just logged, or the copy box's buttons.
      await toBottom(f);
      const last = await f.evaluate(() => { const c = [...document.querySelectorAll('.item:not(.gone):not(.finishing)')].pop(); c.querySelector('.done').click(); return c.dataset.id; });
      await sleep(900);
      const R = await f.evaluate(id => { const r = e => { const x = e.getBoundingClientRect(); return { l: x.left, r: x.right, t: x.top, b: x.bottom }; }; const u = document.querySelector('.item[data-id="' + id + '"] .undo'), t = document.getElementById('hub-toast'), bar = document.getElementById('add'); return { undo: u && r(u), toast: t && !t.hidden && r(t), bar: r(bar), card: r(document.querySelector('.item[data-id="' + id + '"]')) }; }, last);
      const hit = (x, y) => !!x && !!y && x.l < y.r && x.r > y.l && x.t < y.b && x.b > y.t;
      out['toastUndo' + name] = R;
      ok(R.undo && R.toast && !hit(R.undo, R.toast) && !hit(R.card, R.toast), '8/R1: ' + name + ': the toast does not cover the bottom card\'s own Undo (or any of that card)', R);
      await f.evaluate(() => document.querySelector('#hub-toast .toast-act') && document.querySelector('#hub-toast .toast-act').click()); await sleep(500);
      await f.evaluate(() => { navigator.clipboard.writeText = () => Promise.reject(new Error('refused')); document.execCommand = () => false; document.getElementById('copy').click(); }); await sleep(500);
      await f.evaluate(() => hub.toast('Logged Chicken tortilla soup', 20000, { action: 'Undo', onAction: () => {} })); await sleep(900);
      const C = await f.evaluate(() => { const r = e => { const x = e.getBoundingClientRect(); return { l: x.left, r: x.right, t: x.top, b: x.bottom }; }; const s = document.getElementById('copyselect'); s.scrollIntoView({ block: 'nearest' }); return { sel: r(s), toast: r(document.getElementById('hub-toast')), bar: r(document.getElementById('add')) }; });
      out['toastCopy' + name] = C;
      ok(!hit(C.sel, C.toast), '8/R1: ' + name + ': with a toast showing, "Select and copy" is not under it', C);
      if (name === '390') await shot(d, 'toast-390');
      await d.close(); }
  }

  // ── (9) D's pieces, when they are in ─────────────────────────────────────────────────────────────────────────────
  if (want('pieces')) console.log('\n## the look of the sheet, banner, error, copy box (skipped parts say so)');
  if (want('pieces')) {
    const { d, f } = await open(LT, { size: [390, 844] });
    const b = await f.evaluate(() => { const a = document.querySelector('#list .alert'); return a && { tag: a.tagName, text: a.textContent.trim(), h: Math.round(a.getBoundingClientRect().height), hasUse: !!a.querySelector('use') }; });
    out.banner = b;
    if (b && b.tag === 'BUTTON') { ok(b.h >= 44 && b.hasUse, `the banner is a button >= 44 px with its sprite icon ("${b.text}")`, b); await shot(d, 'banner-390'); } else console.log('  - banner is not a button yet (D)', b);
    const hasEdit = await f.evaluate(() => typeof window.__larderEdit === 'function');
    if (hasEdit) {
      await f.evaluate(() => window.scrollTo(0, 0));
      await f.evaluate(() => { const c = document.querySelector('.item .nm[role=button]'); c.click(); }); await sleep(600);
      const s = await f.evaluate(() => { const w = document.getElementById('editwrap'), sh = document.getElementById('editsheet'), r = sh.getBoundingClientRect(), bg = getComputedStyle(sh).backgroundImage;
        return { open: !w.hidden, w: Math.round(r.width), h: Math.round(r.height), bottom: Math.round(innerHeight - r.bottom), name: document.getElementById('e-name').value, fields: ['e-name', 'e-size', 'e-date', 'e-useby', 'e-some', 'e-save', 'e-cancel'].map(i => { const e = document.getElementById(i), q = e.getBoundingClientRect(); return [i, Math.round(q.width), Math.round(q.height)]; }) }; });
      out.sheet = s;
      ok(s.open && s.name && s.fields.every(x => x[2] >= 32 && x[1] >= 32), 'the edit sheet opens with the full name and every control >= 32 px', s);
      ok(s.fields.filter(x => !['e-some'].includes(x[0])).every(x => x[2] >= 44), 'every sheet field and button is >= 44 px high', s.fields);
      await shot(d, 'edit-sheet-390');
      await d.page.keyboard.press('Escape'); await sleep(300);
    } else console.log('  - the edit sheet is not wired yet (D)');
    await d.close();
  }
} finally { await LT.close(); await LO.close(); }
fs.writeFileSync(path.join(SHOTS, 'larder-look-8.json'), JSON.stringify(out, null, 1));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
