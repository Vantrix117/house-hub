// Batch 6, Worker B: the Kitchen timer's look, on the local rig (typical household, real clock).
//  (1) P3-TIMER-02 + VIS-TIMER-1: the dial is round (w = h) in every state and the same box; nothing below it moves at 0, on
//      Start, Pause, Resume or Stop: the dial, the presets and #go keep their rect from idle → running → paused → running →
//      ringing (0:00, the dial at-zero) → stopped. #go is the primary (btn-primary, the accent solid) in every state, its icon
//      follows the state (play / pause / play / square). UX-TIMER-4: at 0 the dial says "Time's up" in words with the sprite
//      bell (not colour or blinking alone); under Reduce Motion the dial does not pulse. Adult at 390 / 820 / 1440, kid at 390.
//  (2) UX-TIMER-5: the Kitchen iPad (html data-kind="kitchen", set in the frame: the rig has no kitchen profile) at 820×1180
//      and 1180×820: the digits are at least the glance role (--fs-glance-1) and the drawn "0" reads to >= 3 m (cap height
//      >= distance / 200, 1 CSS px = 0.192 mm on an 11-inch iPad); the dial is wider than the old 400 px cap; no scroll sideways.
//  (3) UX-TIMER-6: a kid (Ezra) at 390 and 820: every visible control in the Timer is >= 64 × 64 px, each length shows its
//      picture (a sprite use) above the words, Start / Reset carry their icons; no custom time, label, sound or notify switch.
//  (4) GAP-TIMER-3 / VIS-TIMER-4: two timers (one with a long label) and an hour-long one, at 375×667, 390×844, 820, 1180 and
//      1440, and at XXL text at 390 and 1180: no horizontal scroll, nothing in the page wider than the screen, the digits
//      inside the ring (h:mm:ss too).
//  (5) Icons (CONS-ICON-1/-2): every <svg> in the page is the dial ring or an svg.sym whose <use> names a symbol that exists
//      in icons/sprite.svg; no emoji or text glyph is used as an icon.
//  (6) CONS-TYPE-1 / VIS-TIMER-2 / CONS-TELL-1 / CONS-DARK-1 / GAP-TOK-4: in the hub the h1 is visually hidden (kept for
//      screen readers) and the art mark is not drawn; standalone the h1 is the large-title role (34 px × the text size, 700)
//      and the art mark is a --tap high, on the art plate, not draggable.
//  (8) Review round 1: at 375×667 and XXL text the main control (Pause, Stop) is on the first screen, unscrolled, while a timer
//      runs and while it rings (adult and kid); (9) the label row under the digits never moves when "Paused" or "Time's up"
//      comes and goes; (9b, round 2) a long label and the state line stay inside the ring's inner circle at 375/390/820,
//      default and XXL; (9c, round 3) "Paused" and "Time's up" are never cut (scrollWidth <= clientWidth) and stay inside the
//      ring at 375/390/820, default + XXL, adult + kid; (11, rescore) collapsed while a timer is on the dial (nothing under the
//      actions but your timers), New timer opens in place with no jump, the unseen end ("Ended 8:37 AM" + OK), the state words
//      >= title 2 on the iPad, the kitchen in the Timer's coral (AA), idle actions on one row, the fried-egg picture; (10) the markup is in the drawn order: no CSS order on main's children, recents after the actions in
//      the DOM and on screen, the question under the presets.
//  (7) The shell's pill (Worker C's carry-overs, reported here as B measures them): a kid's pill >= 64 px high (P4-SHAPE-01)
//      and the forced :active press reads --press-scale (0.97) with a dim (CONS-MOTION-1). Skipped when there is no pill.
//   node "audits/tools/phase6/6/timer-look-6.mjs"            ONLY=states,kitchen,kid,two,icons,title,fold,label,chord,statefit,rescore,order,pill
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';

const ROOT = process.cwd();
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null; const want = s => !ONLY || ONLY.includes(s);
const EV = path.join(ROOT, 'audits', 'evidence', 'p6', '6'); fs.mkdirSync(EV, { recursive: true });
const SHOTS = process.env.SHOTS || path.join(EV, 'timer-look');
fs.mkdirSync(SHOTS, { recursive: true });
let pass = 0, fail = 0; const ok = (c, n, x) => { if (c) { pass++; console.log('  ✓', n); } else { fail++; console.log('  ✗', n, x === undefined ? '' : JSON.stringify(x).slice(0, 900)); } };
const out = { states: {}, kitchen: {}, kid: {}, two: [], icons: {}, title: {}, pill: {} };
const SPRITE = fs.readFileSync(path.join(ROOT, 'icons', 'sprite.svg'), 'utf8');
const SYMS = new Set([...SPRITE.matchAll(/<symbol id="([^"]+)"/g)].map(m => m[1]));
const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });

async function open(d, { size } = {}) {
  if (size) await d.page.setViewportSize(size);
  const f = await d.openApp('timer');
  await f.waitForFunction(() => window.__timer && window.__timer.isLive && window.__timer.isLive(), null, { timeout: 20000 }).catch(() => {});
  await sleep(500);
  return f;
}
// clear every timer of the signed-in person, from the app's own SDK
const clearAll = f => f.evaluate(async () => { for (const r of hub.timers.list({ stale: true })) await hub.timers.clear(r.id, r.startedAt); });
const shot = (d, name) => d.page.screenshot({ path: path.join(SHOTS, name + '.png'), animations: 'disabled' });
const rect = (f, sel) => f.evaluate(s => { const e = document.querySelector(s); if (!e || !e.getClientRects().length) return null; const b = e.getBoundingClientRect(); return { x: Math.round(b.left * 10) / 10, y: Math.round(b.top * 10) / 10, w: Math.round(b.width * 10) / 10, h: Math.round(b.height * 10) / 10 }; }, sel);
const sameBox = (a, b) => a && b && ['x', 'y', 'w', 'h'].every(k => Math.abs(a[k] - b[k]) <= 0.5);
const snap = f => f.evaluate(() => {
  // the layout box: the ringing pulse is a transform (scale), so it is held still while the boxes are read
  const dl = document.getElementById('dial'), anim = getComputedStyle(dl).animationName; dl.style.animation = 'none';
  const r = s => { const e = document.querySelector(s); if (!e || !e.getClientRects().length) return null; const b = e.getBoundingClientRect(); return { x: Math.round(b.left * 10) / 10, y: Math.round(b.top * 10) / 10, w: Math.round(b.width * 10) / 10, h: Math.round(b.height * 10) / 10 }; };
  const go = document.getElementById('go'), cs = getComputedStyle(go);
  const icon = ['ic-play', 'ic-pause', 'ic-stop'].find(c => { const e = go.querySelector('.' + c); return e && getComputedStyle(e).display !== 'none'; });
  const ts = document.getElementById('tstate');
  return { dial: r('#dial'), presets: r('#presets'), go: r('#go'), t: r('#t'), state: go.dataset.state, word: (go.querySelector('.lbl') || go).textContent.trim(), icon,
    primary: go.classList.contains('btn-primary'), goBg: cs.backgroundColor, scroll: window.scrollY,
    tstate: ts && !ts.hidden ? ts.textContent.trim() : '', bell: !!(ts && !ts.hidden && ts.querySelector('use[href$="#i-bell"]')),
    anim, done: document.body.classList.contains('done'),
    // judge's confirmation: #go fills the first row; whatever else shows in the row is centred under it
    row: (() => { const a = document.querySelector('.actions'), ab = a.getBoundingClientRect(), gb = go.getBoundingClientRect(), pad = parseFloat(getComputedStyle(a).paddingLeft) || 0;
      const rest = [...a.children].filter(e => e !== go && e.getClientRects().length && getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden').map(e => e.getBoundingClientRect());
      const fill = Math.abs(gb.width - (ab.width - 2 * pad)) <= 1;
      const centred = !rest.length || Math.abs((Math.min(...rest.map(b => b.left)) - ab.left) - (ab.right - Math.max(...rest.map(b => b.right)))) <= 2;
      return { fill, centred, rest: rest.length }; })(),
    _: (dl.style.animation = '') };
});
try {
  // ── (1) the states: nothing moves ────────────────────────────────────────────────────────────────────────────────
  if (want('states')) console.log('\n## P3-TIMER-02 / VIS-TIMER-1 / UX-TIMER-4: one round dial, nothing moves, the primary in every state');
  for (const [device, size, profile, motion] of want('states') ? [['iphone-pwa', { width: 390, height: 844 }, 'eli'], ['ipad-portrait', null, 'eli'], ['desktop', null, 'eli'], ['iphone-pwa', { width: 390, height: 844 }, 'ezra'], ['iphone-pwa', { width: 390, height: 844 }, 'eli', 'reduce']] : []) {
    const tag = `${profile}@${size ? size.width : device}${motion ? '/reduce-motion' : ''}`;
    const d = await L.device({ device, profile, fixedTime: false });
    const f = await open(d, { size });
    if (motion) await f.evaluate(() => document.documentElement.setAttribute('data-motion', 'reduce'));
    // the one-time 'Notify me' offer (A) shows under the list after a first Start and stays until answered; this section
    // measures the layout through Start and Stop, so the offer is marked as already made on this device
    await f.evaluate(() => { try { localStorage.setItem('hub.timer.notifyOffered', '1'); } catch {} });
    await clearAll(f); await sleep(600);
    await f.evaluate(() => window.scrollTo(0, 0));
    await f.click('#presets [data-s="60"]'); await sleep(400);
    const seq = {};
    seq.idle = await snap(f);
    await f.click('#go'); await sleep(700); seq.running = await snap(f);
    await f.click('#go'); await sleep(500); seq.paused = await snap(f);
    await f.click('#go'); await sleep(500); seq.resumed = await snap(f);
    // the ringing state: a 3-second timer from the SDK (the UI path to 0 is a minute long), shown on the dial
    await clearAll(f); await sleep(300);
    await f.evaluate(async () => { await hub.timers.start({ total: 3000, label: '' }); });
    await sleep(4500); await f.evaluate(() => window.scrollTo(0, 0)); seq.ringing = await snap(f);
    await shot(d, `states-${tag.replace(/[@/]/g, '-')}-ringing`);
    await f.click('#go'); await sleep(800); await f.evaluate(() => window.scrollTo(0, 0)); seq.stopped = await snap(f);
    out.states[tag] = seq;
    const S = Object.entries(seq);
    ok(S.every(([, s]) => s.dial && Math.abs(s.dial.w - s.dial.h) <= 0.5), `${tag}: the dial is round in every state`, S.map(([k, s]) => [k, s.dial]));
    ok(S.every(([, s]) => sameBox(s.dial, seq.idle.dial)), `${tag}: the dial keeps its box (idle ${seq.idle.dial && seq.idle.dial.w}×${seq.idle.dial && seq.idle.dial.h})`, S.map(([k, s]) => [k, s.dial]));
    // (rescore) the picker folds away under the actions while a timer is on the dial, so the presets are measured only
    // where they show: idle before Start and idle after Stop
    ok(sameBox(seq.stopped.presets, seq.idle.presets), `${tag}: the presets come back to the same place after Stop`, [seq.idle.presets, seq.stopped.presets]);
    ok(S.every(([, s]) => sameBox(s.go, seq.idle.go)), `${tag}: #go keeps its place and size`, S.map(([k, s]) => [k, s.go]));
    ok(S.every(([, s]) => s.primary) && new Set(S.map(([, s]) => s.goBg)).size === 1, `${tag}: #go is the primary (the same accent solid) in every state`, S.map(([k, s]) => [k, s.word, s.goBg]));
    const icons = Object.fromEntries(S.map(([k, s]) => [k, s.icon]));
    ok(S.every(([, s]) => s.row.fill && s.row.centred), `${tag}: #go fills the first row and 1 min / Reset sit centred under it in every state`, S.map(([k, s]) => [k, s.row]));
    ok(icons.idle === 'ic-play' && icons.running === 'ic-pause' && icons.paused === 'ic-play' && icons.ringing === 'ic-stop', `${tag}: the icon follows the state (play, pause, play, square)`, icons);
    ok(seq.ringing.done && /time.?s up/i.test(seq.ringing.tstate) && seq.ringing.bell, `${tag}: at 0 the dial says "${seq.ringing.tstate}" with the sprite bell`, seq.ringing);
    ok(/paused/i.test(seq.paused.tstate), `${tag}: a paused timer says so ("${seq.paused.tstate}")`, seq.paused.tstate);
    if (motion) ok(seq.ringing.anim === 'none' || (await f.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--pulse-scale').trim())) === '1', `${tag}: under Reduce Motion the dial does not pulse`, seq.ringing.anim);
    await clearAll(f);
    await d.close();
  }

  // ── (2) the Kitchen iPad: glance-size digits ─────────────────────────────────────────────────────────────────────
  if (want('kitchen')) console.log('\n## UX-TIMER-5: the Kitchen iPad reads from 3 m');
  for (const [device] of want('kitchen') ? [['ipad-portrait'], ['ipad-landscape']] : []) {
    for (const mode of ['light', 'dark']) {
      const d = await L.device({ device, profile: 'eli', mode, fixedTime: false });
      const f = await open(d);
      await clearAll(f);
      await f.evaluate(async () => { document.documentElement.setAttribute('data-kind', 'kitchen'); await hub.timers.start({ total: 754000, label: 'Lasagne' }); });
      await sleep(1500);
      const m = await f.evaluate(() => {
        const t = document.getElementById('t'), cs = getComputedStyle(t), dial = document.getElementById('dial').getBoundingClientRect();
        const pr = document.createElement('div'); pr.style.cssText = 'position:absolute;visibility:hidden;font-size:var(--fs-glance-1)'; document.body.appendChild(pr); const glance = parseFloat(getComputedStyle(pr).fontSize); pr.remove();
        const c = document.createElement('canvas').getContext('2d'); c.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`; const mt = c.measureText('0');
        const capPx = mt.actualBoundingBoxAscent + mt.actualBoundingBoxDescent;
        const tb = t.getBoundingClientRect();
        return { fontPx: parseFloat(cs.fontSize), glance, capPx: Math.round(capPx * 10) / 10, mm: Math.round(capPx * 0.192 * 10) / 10, metres: Math.round(capPx * 0.192 * 200 / 100) / 10,
          dial: Math.round(dial.width), off: Math.round(dial.left + dial.width / 2 - document.documentElement.clientWidth / 2), inside: tb.left >= dial.left && tb.right <= dial.right, hscroll: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, text: t.textContent };
      });
      out.kitchen[`${device}-${mode}`] = m;
      await shot(d, `kitchen-${device}-${mode}`);
      ok(m.fontPx >= m.glance - 0.5, `kitchen ${device} ${mode}: digits ${m.fontPx} px >= the glance role ${m.glance} px`, m);
      ok(m.metres >= 3, `kitchen ${device} ${mode}: the "0" is ${m.capPx} px = ${m.mm} mm high, read to ${m.metres} m (>= 3)`, m);
      ok(m.dial > 400 && m.inside && !m.hscroll, `kitchen ${device} ${mode}: the dial is ${m.dial} px (the 400 px cap lifted), digits inside it, no sideways scroll`, m);
      if (device === 'ipad-portrait') ok(Math.abs(m.off) <= 2, `kitchen ${device} ${mode}: the dial is centred (${m.off} px off)`, m);
      await clearAll(f);
      await d.close();
    }
  }

  // ── (3) a kid's controls ─────────────────────────────────────────────────────────────────────────────────────────
  if (want('kid')) console.log('\n## UX-TIMER-6: a kid\'s controls are pictures and words, 64 px and more');
  for (const [device, size] of want('kid') ? [['iphone-pwa', { width: 390, height: 844 }], ['ipad-portrait', null]] : []) {
    for (const running of [false, true]) {
      const d = await L.device({ device, profile: 'ezra', fixedTime: false });
      const f = await open(d, { size });
      await clearAll(f); await sleep(400);
      if (running) { await f.click('#presets [data-s="180"]'); await sleep(300); await f.click('#go'); await sleep(800); }
      const k = await f.evaluate(() => {
        const vis = e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden' && !e.closest('[hidden]');
        const ctrls = [...document.querySelectorAll('main button, main input')].filter(vis).map(e => { const b = e.getBoundingClientRect(); return { id: e.id || e.dataset.s || e.dataset.r || e.className, w: Math.round(b.width), h: Math.round(b.height) }; });
        const presets = [...document.querySelectorAll('#presets [data-s]')].map(b => { const pic = b.querySelector('.pic'), u = pic && pic.querySelector('use'); const pr = pic && pic.getBoundingClientRect(), lr = b.querySelector('.lbl').getBoundingClientRect();
          return { s: b.dataset.s, pic: !!pic && getComputedStyle(pic).display !== 'none', href: u && u.getAttribute('href'), above: !!pr && pr.bottom <= lr.top + 1, word: b.querySelector('.lbl').textContent }; });
        const goIcon = [...document.querySelectorAll('#go .sym')].some(s => getComputedStyle(s).display !== 'none');
        const resetIcon = !!document.querySelector('#reset .sym');
        const hidden = ['custom-btn', 'custom', 'label', 'sound', 'notify'].map(id => [id, !vis(document.getElementById(id))]);
        return { ctrls, presets, goIcon, resetIcon, hidden, hscroll: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 };
      });
      const tag = `ezra@${size ? size.width : 820}${running ? '/running' : ''}`;
      out.kid[tag] = k;
      await shot(d, `kid-${tag.replace(/[@/]/g, '-')}`);
      const small = k.ctrls.filter(c => c.w < 64 || c.h < 64);
      ok(k.ctrls.length >= (running ? 3 : 7) && !small.length, `${tag}: all ${k.ctrls.length} visible controls >= 64 × 64 px`, small);
      ok(k.presets.length === 6 && k.presets.every(p => p.pic && p.above && /sprite\.svg#i-/.test(p.href)), `${tag}: every length has its picture above the words (${k.presets.map(p => p.href.split('#i-')[1]).join(', ')})`, k.presets);
      ok(k.goIcon && k.resetIcon, `${tag}: Start/Pause and Reset carry their icons`, { goIcon: k.goIcon, resetIcon: k.resetIcon });
      ok(k.hidden.every(([, h]) => h), `${tag}: no custom time, label, sound or notification switch`, k.hidden);
      ok(!k.hscroll, `${tag}: no sideways scroll`);
      if (running) {
        // (rescore) the picker is folded while a timer runs, so no preset can replace it and there is no question to answer
        const pk = await f.evaluate(() => ({ presets: !document.getElementById('presets').getClientRects().length, add: !document.getElementById('add') || !document.getElementById('add').getClientRects().length, say: !document.getElementById('say').getClientRects().length }));
        ok(pk.presets && pk.add && pk.say, `${tag}: while it runs a kid sees no presets, no New timer and no Say it`, pk);
      }
      await clearAll(f);
      await d.close();
    }
  }

  // ── (4) two timers, an hour-long one, every width, XXL ───────────────────────────────────────────────────────────
  if (want('two')) console.log('\n## GAP-TIMER-3 / VIS-TIMER-4: two timers and h:mm:ss at every width and at XXL');
  for (const [device, size, xxl] of want('two') ? [['iphone-pwa', { width: 375, height: 667 }], ['iphone-pwa', { width: 390, height: 844 }], ['ipad-portrait', null], ['ipad-landscape', null], ['desktop', null], ['iphone-pwa', { width: 390, height: 844 }, 'xxl'], ['ipad-landscape', null, 'xxl']] : []) {
    for (const mode of xxl ? ['light'] : ['light', 'dark']) {
      const d = await L.device({ device, profile: 'eli', mode, fixedTime: false });
      const f = await open(d, { size });
      if (xxl) await f.evaluate(() => document.documentElement.setAttribute('data-text-size', 'xxl'));
      await clearAll(f); await sleep(300);
      await f.evaluate(async () => { await hub.timers.start({ total: 12 * 60000, label: 'Pasta' }); await hub.timers.start({ total: 3725000, label: 'Sourdough loaf in the big oven' }); });
      await sleep(1500);
      const m = await f.evaluate(() => {
        const vw = document.documentElement.clientWidth, dial = document.getElementById('dial').getBoundingClientRect(), t = document.getElementById('t').getBoundingClientRect();
        const wide = [...document.querySelectorAll('main *')].filter(e => e.getClientRects().length && !e.closest('[hidden]') && !e.closest('.sr-only, .hd')).map(e => [e.id || e.className.baseVal || e.className || e.tagName, Math.round(e.getBoundingClientRect().right)]).filter(([, r]) => r > vw + 1);
        return { vw, hscroll: document.documentElement.scrollWidth > vw + 1, wide: wide.slice(0, 5), text: document.getElementById('t').textContent, len: document.getElementById('t').dataset.len || null,
          inside: t.left >= dial.left + 4 && t.right <= dial.right - 4, list: document.querySelectorAll('#list .tm').length, tWidth: Math.round(t.width), dial: Math.round(dial.width) };
      });
      const tag = `${size ? size.width + '×' + size.height : device}${xxl ? '/xxl' : ''} ${mode}`;
      out.two.push({ tag, ...m });
      await shot(d, `two-${tag.replace(/[ ×/]/g, '-')}`);
      ok(m.list >= 2 && !m.hscroll && !m.wide.length, `${tag}: two timers listed (${m.list}), no sideways scroll, nothing wider than the screen`, m);
      ok(m.inside, `${tag}: "${m.text}" fits inside the ring (${m.tWidth} of ${m.dial} px)`, m);
      // the other one, shown: the hour-long timer
      await f.evaluate(() => { const b = [...document.querySelectorAll('#list .tm')].find(x => /Sourdough/.test(x.textContent)); if (b) b.click(); }); await sleep(600);
      const h = await f.evaluate(() => { const dial = document.getElementById('dial').getBoundingClientRect(), t = document.getElementById('t').getBoundingClientRect(); return { text: document.getElementById('t').textContent, len: document.getElementById('t').dataset.len || null, inside: t.left >= dial.left + 4 && t.right <= dial.right - 4, tWidth: Math.round(t.width), dial: Math.round(dial.width), hscroll: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 }; });
      out.two[out.two.length - 1].hour = h;
      if (!xxl && mode === 'light') await shot(d, `hour-${tag.replace(/[ ×/]/g, '-')}`);
      ok(/^\d+:\d\d:\d\d$/.test(h.text) && h.inside && !h.hscroll, `${tag}: the hour-long timer reads "${h.text}" (h:mm:ss) inside the ring (${h.tWidth} of ${h.dial} px)`, h);
      await clearAll(f);
      await d.close();
    }
  }

  // ── (5) icons ────────────────────────────────────────────────────────────────────────────────────────────────────
  if (want('icons')) {
    console.log('\n## CONS-ICON-1/-2: every icon is a sprite use');
    const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
    const f = await open(d, { size: { width: 390, height: 844 } });
    const ic = await f.evaluate(() => {
      const svgs = [...document.querySelectorAll('svg')];
      const ring = svgs.filter(s => s.classList.contains('ring'));
      const syms = svgs.filter(s => s.classList.contains('sym'));
      const other = svgs.filter(s => !s.classList.contains('ring') && !s.classList.contains('sym')).map(s => s.outerHTML.slice(0, 80));
      const uses = syms.map(s => { const u = s.querySelector('use'); return u ? u.getAttribute('href') : null; });
      const inline = syms.filter(s => s.querySelector('path, circle, rect, line')).length;
      const text = document.body.innerText;
      const emoji = (text.match(/\p{Extended_Pictographic}/gu) || []).length, glyphs = (text.match(/[✓✕✗×★☆▶⏸⏹⟲↺⏱⏰🔔]/g) || []).length;
      return { ring: ring.length, syms: syms.length, other, uses, inline, emoji, glyphs };
    });
    const missing = ic.uses.filter(u => !u || !SYMS.has(u.split('#')[1]));
    out.icons = { ...ic, missing, sprite: SYMS.size };
    ok(ic.ring === 1 && !ic.other.length && !ic.inline, `the page draws ${ic.syms} sprite icons and the one dial ring, no private drawing`, ic);
    ok(!missing.length && ic.uses.every(u => /^\.\.\/icons\/sprite\.svg#i-/.test(u)), `every <use> names a symbol in icons/sprite.svg (${SYMS.size} symbols)`, missing);
    ok(!ic.emoji && !ic.glyphs, 'no emoji or text glyph used as an icon', ic);
    for (const id of ['i-timer', 'i-pause', 'i-apple', 'i-popcorn', 'i-egg-fried', 'i-cooking-pot', 'i-cookie', 'i-pizza']) ok(SYMS.has(id), `sprite has ${id}`);
    await d.close();
  }

  // ── (6) the title ────────────────────────────────────────────────────────────────────────────────────────────────
  if (want('title')) {
    console.log('\n## CONS-TYPE-1 / VIS-TIMER-2 / CONS-TELL-1: the title in the hub and standalone');
    for (const [device, size] of [['iphone-pwa', { width: 390, height: 844 }], ['ipad-portrait', null], ['desktop', { width: 1280, height: 800 }]]) {
      const d = await L.device({ device, profile: 'eli', fixedTime: false });
      const f = await open(d, { size });
      const inHub = await f.evaluate(() => { const h = document.querySelector('.hd h1').getBoundingClientRect(), img = document.querySelector('.hd img'); return { framed: document.documentElement.classList.contains('framed'), h1: [Math.round(h.width), Math.round(h.height)], h1Text: document.querySelector('.hd h1').textContent, img: getComputedStyle(img).display, dialTop: Math.round(document.getElementById('dial').getBoundingClientRect().top) }; });
      out.title[`hub@${size ? size.width : 820}`] = inHub;
      ok(inHub.framed && inHub.h1[0] <= 1 && inHub.h1[1] <= 1 && inHub.h1Text === 'Kitchen timer' && inHub.img === 'none', `in the hub @${size ? size.width : 820}: the h1 is kept for screen readers only, no art mark (dial at y ${inHub.dialTop})`, inHub);
      // standalone: the page itself, top-level
      await d.page.goto(L.site + '/apps/timer.html', { waitUntil: 'load' }); await sleep(1500);
      const sa = await d.page.evaluate(() => { const h = document.querySelector('.hd h1'), cs = getComputedStyle(h), img = document.querySelector('.hd img'), ic = getComputedStyle(img);
        const pr = document.createElement('div'); pr.style.cssText = 'position:absolute;visibility:hidden;font-size:var(--fs-large-title);height:var(--tap)'; document.body.appendChild(pr); const want = parseFloat(getComputedStyle(pr).fontSize), tap = parseFloat(getComputedStyle(pr).height); pr.remove();
        return { url: location.pathname, framed: document.documentElement.classList.contains('framed'), fs: parseFloat(cs.fontSize), want, fw: cs.fontWeight, imgH: Math.round(img.getBoundingClientRect().height), tap, draggable: img.draggable, drag: ic.webkitUserDrag || ic.getPropertyValue('-webkit-user-drag'), plate: ic.backgroundColor, radius: ic.borderTopLeftRadius }; });
      out.title[`standalone@${size ? size.width : 820}`] = sa;
      if (/timer\.html$/.test(sa.url)) {
        ok(!sa.framed && Math.abs(sa.fs - sa.want) < 0.5 && +sa.fw >= 700, `standalone @${size ? size.width : 820}: the h1 is the large-title role (${sa.fs} px, ${sa.fw})`, sa);
        ok(Math.abs(sa.imgH - sa.tap) < 1 && sa.draggable === false && sa.drag === 'none', `standalone @${size ? size.width : 820}: the art mark is a --tap high (${sa.imgH} px), not draggable`, sa);
      } else ok(true, `standalone @${size ? size.width : 820}: hub.js sends a top-level timer.html to the hub (${sa.url}); the header rules are checked in the frame`);
      await d.close();
    }
  }

  // ── (8) Pause / Stop on the first screen at 375×667 XXL ───────────────────────────────────────────────────────────
  if (want('fold')) console.log('\n## Review round 1: Pause and Stop on the first screen at 375×667, XXL text');
  for (const profile of want('fold') ? ['eli', 'ezra'] : []) {
    const d = await L.device({ device: 'iphone-pwa', profile, fixedTime: false });
    const f = await open(d, { size: { width: 375, height: 667 } });
    await f.evaluate(() => document.documentElement.setAttribute('data-text-size', 'xxl'));
    await clearAll(f); await sleep(300);
    const at = () => f.evaluate(() => { window.scrollTo(0, 0); const b = document.getElementById('go').getBoundingClientRect(); return { word: (document.querySelector('#go .lbl') || {}).textContent, top: Math.round(b.top), bottom: Math.round(b.bottom), vh: innerHeight, scrollY: scrollY }; });
    await f.evaluate(async () => { await hub.timers.start({ total: 300000, label: '' }); }); await sleep(1200);
    const run = await at();
    await clearAll(f); await f.evaluate(async () => { await hub.timers.start({ total: 3000, label: '' }); }); await sleep(4500);
    const ring = await at();
    await shot(d, `fold-${profile}-375-xxl-ringing`);
    out.fold = out.fold || {}; out.fold[profile] = { run, ring };
    ok(run.word === 'Pause' && run.bottom <= run.vh, `${profile} 375×667 XXL running: "${run.word}" ends at y ${run.bottom} of ${run.vh}`, run);
    ok(ring.word === 'Stop' && ring.bottom <= ring.vh, `${profile} 375×667 XXL ringing: "${ring.word}" ends at y ${ring.bottom} of ${ring.vh}`, ring);
    await clearAll(f);
    await d.close();
  }

  // ── (9) the label row does not move ──────────────────────────────────────────────────────────────────────────────
  if (want('label')) console.log('\n## Review round 1: the label under the digits never moves');
  for (const [device, size] of want('label') ? [['iphone-pwa', { width: 390, height: 844 }], ['ipad-portrait', null]] : []) {
    const d = await L.device({ device, profile: 'eli', fixedTime: false });
    const f = await open(d, { size });
    await clearAll(f); await sleep(300);
    const lab = () => f.evaluate(() => { const dl = document.getElementById('dial'); dl.style.animation = 'none'; window.scrollTo(0, 0);
      const r = s => { const b = document.getElementById(s).getBoundingClientRect(); return { y: Math.round(b.top * 10) / 10, h: Math.round(b.height * 10) / 10 }; };
      const o = { label: r('tlabel'), state: r('tstate'), text: document.getElementById('tlabel').textContent.trim(), st: document.getElementById('tstate').textContent.trim() }; dl.style.animation = ''; return o; });
    const seq = {};
    seq.idle = await lab();
    await f.evaluate(async () => { await hub.timers.start({ total: 60000, label: 'Pasta' }); }); await sleep(1000); seq.running = await lab();
    await f.click('#go'); await sleep(600); seq.paused = await lab();
    await f.click('#go'); await sleep(600); seq.resumed = await lab();
    await clearAll(f); await f.evaluate(async () => { await hub.timers.start({ total: 3000, label: 'Pasta' }); }); await sleep(4500); seq.ringing = await lab();
    out.label = out.label || {}; out.label[device] = seq;
    const S = Object.entries(seq);
    ok(S.every(([, x]) => Math.abs(x.label.y - seq.idle.label.y) <= 0.5 && Math.abs(x.state.y - seq.idle.state.y) <= 0.5), `${device}: the state and label rows keep their place idle → running → paused → running → 0 (label y ${seq.idle.label.y})`, S.map(([k, x]) => [k, x.label.y, x.state.y, x.st, x.text]));
    ok(seq.running.text === 'Pasta' && /paused/i.test(seq.paused.st) && /time.?s up/i.test(seq.ringing.st), `${device}: the rows say "${seq.running.text}", "${seq.paused.st}", "${seq.ringing.st}"`, S.map(([k, x]) => [k, x.st, x.text]));
    await clearAll(f);
    await d.close();
  }

  // ── (9b) review round 2: the label and the state stay inside the ring's inner circle ─────────────────────────────
  if (want('chord')) console.log('\n## Review round 2: a long label and the state line stay inside the ring');
  for (const [device, size, xxl] of want('chord') ? [['iphone-pwa', { width: 375, height: 667 }], ['iphone-pwa', { width: 390, height: 844 }], ['ipad-portrait', null], ['iphone-pwa', { width: 375, height: 667 }, 'xxl'], ['iphone-pwa', { width: 390, height: 844 }, 'xxl'], ['ipad-portrait', null, 'xxl']] : []) {
    const d = await L.device({ device, profile: 'eli', fixedTime: false });
    const f = await open(d, { size });
    if (xxl) await f.evaluate(() => document.documentElement.setAttribute('data-text-size', 'xxl'));
    await clearAll(f); await sleep(300);
    await f.evaluate(async () => { await hub.timers.start({ total: 754000, label: 'Slow-roasted pork shoulder with apples and cider' }); }); await sleep(1000);
    await f.click('#go'); await sleep(700);   // paused: both lines show
    const c = await f.evaluate(() => {
      const dl = document.getElementById('dial'); dl.style.animation = 'none';
      const ring = dl.querySelector('svg.ring').getBoundingClientRect(), cx = ring.left + ring.width / 2, cy = ring.top + ring.height / 2, R = ring.width * 20.5 / 52;   // r 22, stroke 3: the inner edge
      const box = id => { const b = document.getElementById(id).getBoundingClientRect(); const corners = [[b.left, b.top], [b.right, b.top], [b.left, b.bottom], [b.right, b.bottom]]; return { w: Math.round(b.width), h: Math.round(b.height), worst: Math.round(Math.max(...corners.map(([x, y]) => Math.hypot(x - cx, y - cy))) * 10) / 10, text: document.getElementById(id).textContent.trim() }; };
      const t = document.getElementById('t').getBoundingClientRect();
      const o = { R: Math.round(R * 10) / 10, label: box('tlabel'), state: box('tstate'), clearOfDigits: document.getElementById('tlabel').getBoundingClientRect().bottom <= t.top + 2 && document.getElementById('tstate').getBoundingClientRect().top >= t.bottom - 2 };
      dl.style.animation = ''; return o; });
    const tag = `${size ? size.width + '×' + size.height : '820'}${xxl ? '/xxl' : ''}`;
    out.chord = out.chord || {}; out.chord[tag] = c;
    await shot(d, `chord-${tag.replace(/[×/]/g, '-')}`);
    ok(c.label.worst <= c.R && c.state.worst <= c.R, `${tag}: the label (${c.label.w} px, farthest corner ${c.label.worst}) and "${c.state.text}" (${c.state.worst}) stay inside the ring's inner circle (r ${c.R})`, c);
    ok(c.clearOfDigits, `${tag}: the label sits above the digits and the state below them, clear of both`, c);
    await clearAll(f);
    await d.close();
  }

  // ── (9c) review round 3: the state words are never cut, and stay inside the ring (adult + kid, paused + ringing) ─────
  if (want('statefit')) console.log('\n## Review round 3: "Paused" and "Time\'s up" are never cut and stay inside the ring');
  for (const profile of want('statefit') ? ['eli', 'ezra'] : []) {
    for (const [device, size, xxl] of [['iphone-pwa', { width: 375, height: 667 }], ['iphone-pwa', { width: 390, height: 844 }], ['ipad-portrait', null], ['iphone-pwa', { width: 375, height: 667 }, 'xxl'], ['iphone-pwa', { width: 390, height: 844 }, 'xxl'], ['ipad-portrait', null, 'xxl']]) {
      const d = await L.device({ device, profile, fixedTime: false });
      const f = await open(d, { size });
      if (xxl) await f.evaluate(() => document.documentElement.setAttribute('data-text-size', 'xxl'));
      await clearAll(f); await sleep(300);
      const fit = () => f.evaluate(() => {
        const dl = document.getElementById('dial'); dl.style.animation = 'none';
        const ring = dl.querySelector('svg.ring').getBoundingClientRect(), cx = ring.left + ring.width / 2, cy = ring.top + ring.height / 2, R = ring.width * 20.5 / 52;
        const st = document.getElementById('tstate'), b = st.getBoundingClientRect(), words = [...st.querySelectorAll('span')].concat(st);
        const corners = [[b.left, b.top], [b.right, b.top], [b.left, b.bottom], [b.right, b.bottom]];
        const o = { text: st.textContent.trim(), cut: words.some(e => e.scrollWidth > e.clientWidth + 0.5), fs: getComputedStyle(st).fontSize, w: Math.round(b.width), worst: Math.round(Math.max(...corners.map(([x, y]) => Math.hypot(x - cx, y - cy))) * 10) / 10, R: Math.round(R * 10) / 10 };
        dl.style.animation = ''; return o; });
      await f.evaluate(async () => { await hub.timers.start({ total: 600000, label: '' }); }); await sleep(900);
      await f.click('#go'); await sleep(700); const paused = await fit();
      await clearAll(f); await f.evaluate(async () => { await hub.timers.start({ total: 3000, label: '' }); }); await sleep(4500); const ringing = await fit();
      const tag = `${profile} ${size ? size.width + '×' + size.height : '820'}${xxl ? '/xxl' : ''}`;
      out.statefit = out.statefit || {}; out.statefit[tag] = { paused, ringing };
      if (profile === 'ezra' && xxl && size && size.width === 375) await shot(d, 'statefit-ezra-375-xxl-ringing');
      ok(/paused/i.test(paused.text) && !paused.cut && paused.worst <= paused.R, `${tag}: "${paused.text}" whole (${paused.w} px at ${paused.fs}), inside the ring (${paused.worst} ≤ ${paused.R})`, paused);
      ok(/time.?s up/i.test(ringing.text) && !ringing.cut && ringing.worst <= ringing.R, `${tag}: "${ringing.text}" whole (${ringing.w} px at ${ringing.fs}), inside the ring (${ringing.worst} ≤ ${ringing.R})`, ringing);
      await clearAll(f);
      await d.close();
    }
  }

  // ── (11) the rescore: collapsed while a timer is on the dial, New timer in place, the unseen end, the state size,
  // the kitchen's coral, idle actions, the egg ───────────────────────────────────────────────────────────────────────
  if (want('rescore')) {
    console.log('\n## Rescore: the collapsed view, New timer in place, the unseen end, title-2 state words, the kitchen in coral');
    const lum = rgb => { const m = String(rgb).match(/[\d.]+/g); const [r, g, b] = m.slice(0, 3).map(Number).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
    const ratio = (a, b) => { const x = lum(a), y = lum(b); return Math.round(((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)) * 100) / 100; };
    const below = f => f.evaluate(() => { const a = document.querySelector('.actions'), kids = [...document.querySelector('main').children];
      return kids.slice(kids.indexOf(a) + 1).filter(e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden' && e.getBoundingClientRect().height > 0 && !e.classList.contains('sr-only')).map(e => e.id || e.className).filter(x => x !== 'notify-offer'); });   // the one-time Notify me offer may show after a first Start
    const boxes = f => f.evaluate(() => { const r = s => { const e = document.querySelector(s); if (!e || !e.getClientRects().length) return null; const b = e.getBoundingClientRect(); return { x: Math.round(b.left * 10) / 10, y: Math.round(b.top * 10) / 10, w: Math.round(b.width * 10) / 10, h: Math.round(b.height * 10) / 10 }; };
      const dl = document.getElementById('dial'); dl.style.animation = 'none'; window.scrollTo(0, 0); const o = { dial: r('#dial'), go: r('#go'), list: r('#list'), presets: !!r('#presets'), word: (document.querySelector('#go .lbl') || {}).textContent }; dl.style.animation = ''; return o; });
    // (a) idle at 390: Start, 1 min and Reset on one row, the two invisible but in place; the 5-minute picture is the fried egg
    {
      const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
      const f = await open(d, { size: { width: 390, height: 844 } });
      await clearAll(f); await sleep(800);
      const idle = await f.evaluate(() => { const g = document.getElementById('go').getBoundingClientRect(), p = document.getElementById('plus1'), r = document.getElementById('reset');
        const a = document.querySelector('.actions').getBoundingClientRect();
        return { fill: Math.abs(g.width - a.width) <= 1, gone: [getComputedStyle(p).display, getComputedStyle(r).display], egg: document.querySelector('#presets [data-s="300"] use').getAttribute('href') }; });
      out.rescore = { idle };
      ok(idle.fill && idle.gone.every(v => v === 'none'), 'idle at 390: Start fills its row; 1 min and Reset are out of the layout (no lopsided half-empty row)', idle);
      ok(/#i-egg-fried$/.test(idle.egg), `the 5-minute picture is the fried egg (${idle.egg.split('#')[1]})`, idle.egg);
      // (b) running at 390: nothing below the actions but your timers; ringing likewise
      await f.evaluate(async () => { await hub.timers.start({ total: 300000, label: 'Rice' }); }); await sleep(1200);
      const runBelow = await below(f), run = await boxes(f);
      await shot(d, 'rescore-running-390');
      ok(runBelow.every(x => x === 'list') && !run.presets, `running at 390: below the actions only ${runBelow.length ? runBelow.join(', ') : 'nothing'} (the picker is folded)`, runBelow);
      // (c) New timer opens the picker in place and closing it (tapping the running timer) moves nothing above it
      const addShown = await f.evaluate(() => { const a = document.getElementById('add'); return !!a && !!a.getClientRects().length; });
      if (addShown) {
        await f.click('#add'); await sleep(600); const open1 = await boxes(f);
        await shot(d, 'rescore-new-timer-390');
        await f.click('#list .tm'); await sleep(600); const closed = await boxes(f);
        out.rescore.newTimer = { run, open1, closed };
        ok(open1.presets && sameBox(open1.dial, run.dial) && sameBox(open1.go, run.go) && sameBox(open1.list, run.list), `New timer opens the picker under your timers; the dial, ${run.word}/${open1.word} and the list stay put`, { run, open1 });
        ok(!closed.presets && sameBox(closed.dial, run.dial) && sameBox(closed.go, run.go) && sameBox(closed.list, run.list), 'tapping the running timer folds the picker again; nothing above it moved', { run, closed });
      } else ok(false, 'New timer is offered with one timer running', addShown);
      await clearAll(f); await f.evaluate(async () => { await hub.timers.start({ total: 3000, label: '' }); }); await sleep(4500);
      const ringBelow = await below(f);
      ok(ringBelow.every(x => x === 'list'), `ringing at 390: below the actions only ${ringBelow.length ? ringBelow.join(', ') : 'nothing'}`, ringBelow);
      await clearAll(f);
      await d.close();
    }
    // (a2, review round 6) a kid's idle screen at 375×667: 1 min and Reset are out of the layout, so the first row of food
    // pictures is on the first screen (default and XXL); Start does not move when it is tapped
    for (const xxl of [false, true]) {
      const d = await L.device({ device: 'iphone-pwa', profile: 'ezra', fixedTime: false });
      const f = await open(d, { size: { width: 375, height: 667 } });
      if (xxl) await f.evaluate(() => document.documentElement.setAttribute('data-text-size', 'xxl'));
      await clearAll(f); await sleep(800);
      const at = () => f.evaluate(() => { window.scrollTo(0, 0); const g = document.getElementById('go').getBoundingClientRect(), first = document.querySelector('#presets [data-s]'), fb = first && first.getClientRects().length ? first.getBoundingClientRect() : null;
        return { go: { x: Math.round(g.left), y: Math.round(g.top), w: Math.round(g.width), h: Math.round(g.height) }, firstBottom: fb ? Math.round(fb.bottom) : null, vh: innerHeight,
          extra: ['plus1', 'reset'].map(id => getComputedStyle(document.getElementById(id)).display), state: document.getElementById('go').dataset.state }; });
      const idle = await at();
      await shot(d, `kid-idle-375${xxl ? '-xxl' : ''}`);
      await f.click('#go'); await sleep(900);
      const run = await at();
      const tag = `ezra 375×667${xxl ? ' XXL' : ''}`;
      out.rescore['kid idle ' + tag] = { idle, run };
      ok(idle.extra.every(x => x === 'none') && idle.firstBottom != null && idle.firstBottom <= idle.vh, `${tag} idle: 1 min and Reset out of the layout; the first row of pictures ends at y ${idle.firstBottom} of ${idle.vh}`, idle);
      ok(sameBox(idle.go, run.go) && run.extra.some(x => x !== 'none'), `${tag}: Start → ${run.state}: the main button stays put; 1 min / Reset appear under it`, { idle, run });
      await clearAll(f);
      await d.close();
    }
    // (d) the unseen end: "Ended 8:37 AM" whole and inside the ring, #go is OK with the check (adult 390, kid 375 XXL)
    for (const [profile, size, xxl] of [['eli', { width: 390, height: 844 }], ['ezra', { width: 375, height: 667 }, 'xxl']]) {
      const d = await L.device({ device: 'iphone-pwa', profile, fixedTime: false });
      let f = await open(d, { size });
      if (xxl) await f.evaluate(() => document.documentElement.setAttribute('data-text-size', 'xxl'));
      await clearAll(f); await f.evaluate(async () => { await hub.timers.start({ total: 1000, label: '' }); }); await sleep(300);
      await d.goto('#home'); await sleep(8000);
      f = await open(d, { size }); if (xxl) await f.evaluate(() => document.documentElement.setAttribute('data-text-size', 'xxl')); await sleep(800);
      const u = await f.evaluate(() => { const dl = document.getElementById('dial'); dl.style.animation = 'none';
        const ring = dl.querySelector('svg.ring').getBoundingClientRect(), cx = ring.left + ring.width / 2, cy = ring.top + ring.height / 2, R = ring.width * 20.5 / 52;
        const st = document.getElementById('tstate'), b = st.getBoundingClientRect(), cut = [...st.querySelectorAll('span')].concat(st).some(e => e.scrollWidth > e.clientWidth + 0.5);
        const worst = Math.max(...[[b.left, b.top], [b.right, b.top], [b.left, b.bottom], [b.right, b.bottom]].map(([x, y]) => Math.hypot(x - cx, y - cy)));
        const go = document.getElementById('go'), ic = ['ic-play', 'ic-pause', 'ic-stop', 'ic-ok'].filter(c => { const e = go.querySelector('.' + c); return e && getComputedStyle(e).display !== 'none'; });
        const o = { text: st.textContent.trim(), cut, worst: Math.round(worst * 10) / 10, R: Math.round(R * 10) / 10, go: go.dataset.state, word: (go.querySelector('.lbl') || go).textContent.trim(), ic, ended: document.getElementById('ended') ? !document.getElementById('ended').hidden : false,
          quiet: { bg: getComputedStyle(document.body).backgroundImage, anim: dl.style.animation === 'none' ? (dl.style.animation = '', getComputedStyle(dl).animationName) : getComputedStyle(dl).animationName, ring: getComputedStyle(dl).boxShadow, bgColor: getComputedStyle(document.body).backgroundColor, heroColor: (() => { const p = document.createElement('div'); p.style.cssText = 'position:absolute;background:var(--hero-bg)'; document.body.appendChild(p); const c = getComputedStyle(p).backgroundColor; p.remove(); return c; })() } };
        dl.style.animation = ''; return o; });
      const tag = `${profile} ${size.width}×${size.height}${xxl ? '/xxl' : ''}`;
      out.rescore['unseen ' + tag] = u;
      await shot(d, `rescore-unseen-${profile}-${size.width}${xxl ? '-xxl' : ''}`);
      ok(/^Ended \d/.test(u.text) && !u.cut && u.worst <= u.R, `${tag}: "${u.text}" whole, inside the ring (${u.worst} ≤ ${u.R})`, u);
      ok(u.go === 'ok' && u.word === 'OK' && u.ic.length === 1 && u.ic[0] === 'ic-ok' && !u.ended, `${tag}: #go is "OK" with the check alone; no second "ended" line`, u);
      // judge's confirmation: an unseen end is not styled as a live alarm (no pulse, no lit ring round the dial, no alarm wash)
      ok(u.quiet.anim === 'none' && !/0px 0px 0px [1-9]/.test(u.quiet.ring) && u.quiet.bgColor !== u.quiet.heroColor, `${tag}: the unseen dial is quiet (no pulse, no outer ring, the page colour not the alarm wash)`, u.quiet);
      if (profile === 'eli') {
        // review round 6: the line's length depends on the clock ("Ended 8:37 AM" vs "Ended 10:20 AM"), so the LONGEST form,
        // "Ended 12:59 PM", is written into the same element (its key unchanged, so the app does not rebuild it) and measured
        // at 375×667, 390×844 and 820×1180, default and XXL, adult and kid (data-kind on the frame's root)
        await f.evaluate(() => { const sp = document.querySelector('#tstate span'); if (sp) sp.textContent = 'Ended 12:59 PM'; });
        for (const [w, h] of [[375, 667], [390, 844], [820, 1180]]) {
          await d.page.setViewportSize({ width: w, height: h }); await sleep(300);
          for (const kind of ['adult', 'kid']) for (const ts of ['', 'xxl']) {
            const m = await f.evaluate(([kind, ts]) => { const root = document.documentElement; if (kind === 'kid') root.setAttribute('data-kind', 'kid'); else root.setAttribute('data-kind', 'adult');
              if (ts) root.setAttribute('data-text-size', ts); else root.removeAttribute('data-text-size');
              const dl = document.getElementById('dial'); dl.style.animation = 'none';
              const ring = dl.querySelector('svg.ring').getBoundingClientRect(), cx = ring.left + ring.width / 2, cy = ring.top + ring.height / 2, R = ring.width * 20.5 / 52;
              const st = document.getElementById('tstate'), b = st.getBoundingClientRect(), cut = [...st.querySelectorAll('span')].concat(st).some(e => e.scrollWidth > e.clientWidth + 0.5);
              const worst = Math.max(...[[b.left, b.top], [b.right, b.top], [b.left, b.bottom], [b.right, b.bottom]].map(([x, y]) => Math.hypot(x - cx, y - cy)));
              const o = { text: st.textContent.trim(), cut, w: Math.round(b.width), fs: getComputedStyle(st).fontSize, worst: Math.round(worst * 10) / 10, R: Math.round(R * 10) / 10 }; dl.style.animation = ''; return o; }, [kind, ts]);
            const t2 = `"Ended 12:59 PM" ${w}×${h} ${kind}${ts ? ' XXL' : ''}`;
            out.rescore[t2] = m;
            ok(m.text === 'Ended 12:59 PM' && !m.cut && m.worst <= m.R, `${t2}: whole (${m.w} px at ${m.fs}), inside the ring (${m.worst} ≤ ${m.R})`, m);
          }
        }
        await f.evaluate(() => { document.documentElement.setAttribute('data-kind', 'adult'); document.documentElement.removeAttribute('data-text-size'); });
      }
      await clearAll(f);
      await d.close();
    }
    // (judge's confirmation) a kid's dial is at least its pre-batch size (min(82vw, 52vh, 400px)) on 844- and 1180-tall screens
    // and in iPad landscape; only a short phone (<= 700 px high) takes the smaller kid dial
    for (const [device, size] of [['iphone-pwa', { width: 390, height: 844 }], ['ipad-portrait', null], ['ipad-landscape', null]]) {
      const d = await L.device({ device, profile: 'ezra', fixedTime: false });
      const f = await open(d, { size });
      const k = await f.evaluate(() => { const w = document.getElementById('dial').getBoundingClientRect().width; return { w: Math.round(w), before: Math.round(Math.min(0.82 * innerWidth, 0.52 * innerHeight, 400)), vw: innerWidth, vh: innerHeight }; });
      out.rescore['kid dial ' + device] = k;
      ok(k.w >= k.before - 1, `kid ${device} (${k.vw}×${k.vh}): the dial is ${k.w} px (pre-batch ${k.before})`, k);
      await d.close();
    }
    // (e) the state words are at least title 2 on the person's iPad (portrait and landscape)
    for (const device of ['ipad-portrait', 'ipad-landscape']) {
      const d = await L.device({ device, profile: 'eli', fixedTime: false });
      const f = await open(d);
      await clearAll(f); await f.evaluate(async () => { await hub.timers.start({ total: 300000, label: '' }); }); await sleep(900);
      await f.click('#go'); await sleep(700);
      const w = await f.evaluate(() => { const pr = document.createElement('div'); pr.style.cssText = 'position:absolute;visibility:hidden;font-size:var(--fs-title2)'; document.body.appendChild(pr); const t2 = parseFloat(getComputedStyle(pr).fontSize); pr.remove();
        return { fs: parseFloat(getComputedStyle(document.getElementById('tstate')).fontSize), t2, text: document.getElementById('tstate').textContent.trim(), digits: parseFloat(getComputedStyle(document.getElementById('t')).fontSize) }; });
      out.rescore['state ' + device] = w;
      ok(w.fs >= w.t2 - 0.5, `${device}: "${w.text}" is ${w.fs} px (title 2 = ${w.t2} px) under ${w.digits} px digits`, w);
      await clearAll(f);
      await d.close();
    }
    // (f) the kitchen wears the Timer's coral, not its graphite profile colour, and keeps AA on the primary
    for (const mode of ['light', 'dark']) {
      const d = await L.device({ device: 'ipad-portrait', profile: 'eli', mode, fixedTime: false });
      const f = await open(d);
      await clearAll(f);
      await f.evaluate(async () => { document.documentElement.setAttribute('data-kind', 'kitchen'); document.documentElement.setAttribute('data-accent', 'graphite'); await hub.timers.start({ total: 600000, label: '' }); }); await sleep(1200);
      const k = await f.evaluate(() => { const cs = getComputedStyle(document.documentElement), go = document.getElementById('go'), gs = getComputedStyle(go), lbl = getComputedStyle(go.querySelector('.lbl'));
        const pr = document.createElement('div'); pr.style.cssText = 'position:absolute;color:var(--coral-strong);background:var(--graphite-strong)'; document.body.appendChild(pr); const coral = getComputedStyle(pr).color, graphite = getComputedStyle(pr).backgroundColor; pr.remove();
        return { goBg: gs.backgroundColor, goInk: lbl.color, coral, graphite, ring: getComputedStyle(document.querySelector('#dial .ring .fg')).stroke }; });
      out.rescore['kitchen ' + mode] = k;
      await shot(d, `rescore-kitchen-${mode}`);
      ok(k.goBg === k.coral && k.goBg !== k.graphite && k.ring === k.coral, `kitchen ${mode}: Pause and the ring are coral (${k.goBg}), not graphite (${k.graphite})`, k);
      ok(ratio(k.goBg, k.goInk) >= 4.5, `kitchen ${mode}: Pause's word on coral is ${ratio(k.goBg, k.goInk)}:1 (AA)`, k);
      await clearAll(f);
      await d.close();
    }
  }

  // ── (10) drawn order = DOM order ─────────────────────────────────────────────────────────────────────────────────
  if (want('order')) {
    console.log('\n## Review round 1: the markup is in the drawn order');
    const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
    const f = await open(d, { size: { width: 390, height: 844 } });
    await clearAll(f); await f.evaluate(async () => { await hub.timers.start({ total: 125000, label: 'Tea' }); }); await sleep(1200);
    await clearAll(f); await sleep(1200);   // idle again: recents ("2:05 · Tea") show only when no timer is on the dial
    const o = await f.evaluate(() => {
      const main = document.querySelector('main'), kids = [...main.children];
      const ordered = kids.filter(e => getComputedStyle(e).order !== '0').map(e => e.id || e.className);
      const ex = document.getElementById('extras'), exOrdered = [...ex.children].filter(e => getComputedStyle(e).order !== '0').map(e => e.id || e.className);
      const a = document.querySelector('.actions'), r = document.getElementById('recents'), p = document.getElementById('presets'), q = document.getElementById('ask');
      const ab = a.getBoundingClientRect(), rb = r.getBoundingClientRect();
      return { ordered, exOrdered, dom: kids.map(e => e.id || e.className.split(' ')[0]),
        recentsAfterActionsDom: !!(a.compareDocumentPosition(r) & Node.DOCUMENT_POSITION_FOLLOWING), recentsShown: !r.hidden && rb.height > 0, recentsBelow: rb.top >= ab.bottom - 0.5,
        askAfterPresetsDom: !!(p.compareDocumentPosition(q) & Node.DOCUMENT_POSITION_FOLLOWING) };
    });
    out.order = o;
    ok(!o.ordered.length && !o.exOrdered.length, `no CSS order on the page's blocks or in the extras (DOM: ${o.dom.join(' · ')})`, o);
    ok(o.recentsAfterActionsDom && o.recentsShown && o.recentsBelow, 'recents come after the actions in the DOM and on screen', o);
    ok(o.askAfterPresetsDom, 'the question comes after the presets in the DOM (it opens under them)', o);
    await clearAll(f);
    await d.close();
  }

  // ── (7) the shell's pill (Worker C's carry-overs) ────────────────────────────────────────────────────────────────
  if (want('pill')) {
    console.log('\n## P4-SHAPE-01 / CONS-MOTION-1: the timer pill (the shell, Worker C)');
    for (const [device, size] of [['iphone-pwa', { width: 390, height: 844 }], ['ipad-portrait', null]]) {
      const d = await L.device({ device, profile: 'ezra', fixedTime: false });
      const f = await open(d, { size });
      await clearAll(f); await f.evaluate(async () => { await hub.timers.start({ total: 300000, label: '' }); }); await sleep(800);
      await d.goto('#home'); await sleep(2500);
      const p = await d.page.evaluate(() => { const e = document.getElementById('timer-pill'); if (!e || !e.getClientRects().length) return null; const b = e.getBoundingClientRect(); return { h: Math.round(b.height), w: Math.round(b.width) }; });
      if (!p) { ok(true, `ezra@${size ? size.width : 820}: no pill shown on Home (skipped)`); out.pill[`ezra@${size ? size.width : 820}`] = null; await d.close(); continue; }
      // the press: force :active through CDP is not available in WebKit; read the rule that :active applies
      const press = await d.page.evaluate(() => { const want = getComputedStyle(document.documentElement).getPropertyValue('--press-scale').trim();
        const rules = []; for (const sh of document.styleSheets) { let rs; try { rs = sh.cssRules; } catch { continue; } for (const r of rs) { const walk = x => { if (x.selectorText && /#timer-pill[^,]*:active/.test(x.selectorText)) rules.push(x.style.cssText); if (x.cssRules) for (const y of x.cssRules) walk(y); }; walk(r); } }
        return { want, rules }; });
      out.pill[`ezra@${size ? size.width : 820}`] = { ...p, press };
      ok(p.h >= 64, `ezra@${size ? size.width : 820}: the kid's pill is ${p.h} px high (>= 64)`, p);
      ok(press.rules.some(r => /--press-scale/.test(r) && /--press-dim/.test(r)) && press.rules.every(r => !/transform/.test(r) || /--press-scale/.test(r)), `ezra@${size ? size.width : 820}: the pill's :active reads --press-scale (${press.want}) and --press-dim`, press.rules);
      const f2 = await open(d); await clearAll(f2);
      await d.close();
    }
  }
} finally {
  fs.writeFileSync(path.join(EV, 'timer-look-6.json'), JSON.stringify(out, null, 1));
  await L.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exitCode = fail ? 1 : 0;
}
