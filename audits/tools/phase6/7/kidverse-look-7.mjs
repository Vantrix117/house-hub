// Batch 7, Worker B: Kid Verse's look, on the local rig (typical / overflow / empty household, real clock). WebKit.
//  (1) UX-KIDVERSE-2: for Ezra (a kid) inside the hub's viewer at 390x844, 430x932, 820x1180, 1180x820 and 1440x900, light and dark,
//      the art, the reference, the verse speaker and Done are ALL on the first screen (their bottoms are inside the frame's own
//      height); the story card and "I heard it" follow, and (round 1 review) "I heard it" ends within 1.5 screens at the default
//      size: the kid's stars card sits BELOW the story card. XXL text: reported; the speaker and Done are required on the first screen from 820 up.
//  (2) UX-KIDVERSE-10: for Eli (an adult) the grown-ups panel is the FIRST card, above the kid's art, which is labelled "What the
//      kids see"; the panel's top is on the first screen at every size; the voice panel slot (#voice-panel) is a stable sibling
//      right after it.
//  (3) VIS-KIDVERSE-5: the grown-ups panel at 375 / 390 / 430 with the overflow household (a long kid name): each kid's face, name
//      and star count share the first line, the seven dots are on the line below, no two of them overlap, nothing is clipped.
//  (4) No horizontal scroll from 375 to 1440 (kid, adult, the shelf sheet open), and nothing in the page wider than the screen.
//  (5) Kid targets: every visible button on the kid's screen is at least 64 x 64 px (shelf cards and Show all included).
//  (6) IMP-KIDVERSE-F3: the word under a fake `boundary` event is the one highlighted (<mark class="hl">), the text is unchanged,
//      the highlight has no animation or transition (so Reduce Motion changes nothing), it is cleared on end, on cancel and on
//      error, nothing happens (and nothing breaks) when the voice sends no boundary at all, a boundary with no charLength (Safari)
//      takes the word up to the next space; the story speaker does the same; a spoken toast never talks over a reading.
//  (7) IMP-KIDVERSE-I1: the shelf: the last 6 earlier weeks, newest first, then "Show all"; a tap opens a read-only sheet "Just
//      for listening" (an ear): the verse and the story each with a speaker and the highlight, NO Done, NO "I heard it", no star;
//      the person and family rows the kid owns are byte-identical before and after (nothing written); closing returns focus; the
//      TV does not get the shelf.
//  (8) P3-KIDVERSE-04: each day dot carries one mark per kind of star (data-marks), the group's label counts what the count counts,
//      each dot reads its day and marks aloud; the stars card, the grown-ups' panel and the story card agree.
//  (9) UX-KIDVERSE-1 / VIS-KIDVERSE-9 / CONS-ICON-1: the two speakers have distinct pictures (a scroll, a book), "I heard it" is an
//      ear with the star mark, no ★ / ✓ / − / + glyph in any label, every <svg> is an svg.sym naming a symbol that exists in
//      icons/sprite.svg, and the stepper is the sprite's minus and plus.
// (10) UX-KIDVERSE-5: with no family week (the empty household) a kid sees a picture and one sentence (read aloud on tap), no
//      Done, no Week 1 art; an adult sees "Pick this week's verse" with the stepper as the first thing.
// (11) VIS-KIDVERSE-11: the rewards summary wraps as whole items (no "·" anywhere in it).
// (12) CONS-GLASS-2 / CONS-TOK-3 / CONS-TYPE-2 / GAP-TOK-4 / VIS-SHAPE-1: no .btn-glass / .pill / backdrop-filter in the page, no
//      color-mix, no avatar font-size or --size literal, the story picture's corner is the concentric --r-inset.
//   node "audits/tools/phase6/7/kidverse-look-7.mjs"      ONLY=first,adult,panel,scroll,targets,hl,shelf,dots,icons,noweek,rewards,tokens,move,marks,stale,take
//   SHOTS=<dir> to keep the pictures (default audits/evidence/p6/7/kidverse-look)
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, DEMO } from '../../lib/local.mjs';

const ROOT = process.cwd();
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null; const want = s => !ONLY || ONLY.includes(s);
const EV = path.join(ROOT, 'audits', 'evidence', 'p6', '7'); fs.mkdirSync(EV, { recursive: true });
const SHOTS = process.env.SHOTS || path.join(EV, 'kidverse-look'); fs.mkdirSync(SHOTS, { recursive: true });
let pass = 0, fail = 0;
const ok = (c, n, x) => { if (c) { pass++; console.log('  ✓', n); } else { fail++; console.log('  ✗', n, x === undefined ? '' : JSON.stringify(x).slice(0, 900)); } };
const info = (n, x) => console.log('  ·', n, x === undefined ? '' : JSON.stringify(x).slice(0, 600));
const SPRITE = fs.readFileSync(path.join(ROOT, 'icons', 'sprite.svg'), 'utf8');
const SYMS = new Set([...SPRITE.matchAll(/<symbol id="([^"]+)"/g)].map(m => m[1]));
const SRC = fs.readFileSync(path.join(ROOT, 'apps', 'kidverse.html'), 'utf8');
const SIZES = [{ n: '390x844', dev: 'iphone-pwa', w: 390, h: 844 }, { n: '430x932', dev: 'iphone-pwa', w: 430, h: 932 }, { n: '820x1180', dev: 'ipad-portrait', w: 820, h: 1180 }, { n: '1180x820', dev: 'ipad-landscape', w: 1180, h: 820 }, { n: '1440x900', dev: 'desktop', w: 1440, h: 900 }];

// a stand-in speechSynthesis that keeps every utterance so the check can fire `boundary`, `end` and `error` itself
const fakeSpeech = ctx => ctx.addInitScript(() => {
  window.__utts = []; window.__cancels = 0;
  const synth = { speaking: false, pending: false, paused: false, speak(u) { window.__utts.push(u); this.speaking = true; }, cancel() { window.__cancels++; this.speaking = false; }, pause() {}, resume() {}, getVoices() { return []; }, addEventListener() {}, removeEventListener() {} };
  try { Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true, writable: true }); } catch {}
  try { window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; this.rate = 1; this.pitch = 1; this.lang = ''; this.voice = null; } }; } catch {}
});
const frameBox = async d => (await d.page.$('#frame')).boundingBox();

let L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
try {
  // ── (1) the kid's first screen ──────────────────────────────────────────────────────────────────
  if (want('first')) {
    console.log('\n## (1) Ezra: art, reference, verse speaker and Done on the first screen, in the hub\'s viewer');
    for (const mode of (process.env.MODE ? [process.env.MODE] : ['light', 'dark'])) for (const xxl of (process.env.NOXXL ? [false] : [false, true])) for (const S of SIZES.filter(z => !process.env.SIZE || z.n === process.env.SIZE)) {
      await L.reset('typical');
      const d = await L.device({ device: S.dev, profile: 'ezra', mode, fixedTime: false, });
      await d.page.setViewportSize({ width: S.w, height: S.h });
      const f = await d.openApp('kidverse');
      await f.waitForFunction(() => document.querySelector('#rewards:not([hidden])') && document.querySelector('#done:not([disabled])'), null, { timeout: 15000 }).catch(() => {});
      if (xxl) await f.evaluate(() => document.documentElement.setAttribute('data-text-size', 'xxl'));   // Me > Appearance's largest size
      await sleep(600);
      const fb = await frameBox(d);
      const m = await f.evaluate(() => {
        const r = id => { const e = document.getElementById(id); if (!e) return null; const b = e.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), h: Math.round(b.height), w: Math.round(b.width) }; };
        return { H: window.innerHeight, scene: r('scene'), ref: r('ref'), say: r('say'), done: r('done'), words: r('wordscard'), mine: r('mine'), story: r('story'), heard: r('story-heard'), say2: r('story-say'), size: document.documentElement.getAttribute('data-text-size') };
      });
      const tag = `${S.n} ${mode}${xxl ? ' XXL' : ''}`;
      const first = m.scene.bottom <= m.H && m.ref.bottom <= m.H && m.say.bottom <= m.H && m.done.bottom <= m.H;
      const need = !xxl || S.w >= 820;
      if (need) ok(first, `${tag}: art, reference, speaker and Done are on the first screen (frame ${Math.round(fb.height)} px tall)`, { H: m.H, scene: m.scene.bottom, ref: m.ref.bottom, say: m.say.bottom, done: m.done.bottom }); else info(`${tag}: first screen (XXL, reported)`, { H: m.H, ok: first, scene: m.scene.bottom, ref: m.ref.bottom, say: m.say.bottom, done: m.done.bottom });
      const reach = m.heard ? m.heard.bottom / m.H : null;
      if (!xxl) ok(reach !== null && reach <= 1.5, `${tag}: "I heard it" ends within ~1.5 screens (the kid's stars card is below the story) (${reach && reach.toFixed(2)} screens; story card top ${m.story.top}, art ${m.scene.h} px tall)`, { reach });
      else info(`${tag}: "I heard it" ends at ${reach && reach.toFixed(2)} screens`);
      if (!xxl && mode === 'light') await d.shot(path.join(SHOTS, `kid-${S.n}-${mode}.png`));
      if (!xxl && mode === 'dark' && S.n !== '1180x820') await d.shot(path.join(SHOTS, `kid-${S.n}-${mode}.png`));
      if (xxl && mode === 'light' && (S.w === 390 || S.w === 1180)) await d.shot(path.join(SHOTS, `kid-${S.n}-xxl.png`));
      await d.close();
    }
  }

  // ── (2) adults first ──────────────────────────────────────────────────────────────────────────────
  if (want('adult')) {
    console.log('\n## (2) Eli: the grown-ups\' panel comes first, the kid\'s screen is labelled a preview');
    for (const S of SIZES) {
      await L.reset('typical');
      const d = await L.device({ device: S.dev, profile: 'eli', fixedTime: false });
      await d.page.setViewportSize({ width: S.w, height: S.h });
      const f = await d.openApp('kidverse'); await f.waitForSelector('#grown:not([hidden])'); await sleep(500);
      const m = await f.evaluate(() => {
        const t = id => { const e = document.getElementById(id); return e ? Math.round(e.getBoundingClientRect().top) : null; };
        const order = [...document.querySelector('.wrap').children].filter(e => !e.hidden && e.getClientRects().length).map(e => e.id || e.className.split(' ')[0]);
        const next = document.getElementById('grown').nextElementSibling;
        return { H: window.innerHeight, grown: t('grown'), scene: t('scene'), label: t('kv-label'), voiceNext: next && next.id, order, labelText: (document.getElementById('kv-label') || {}).textContent, voiceHidden: document.getElementById('voice-panel').hidden };
      });
      ok(m.order.indexOf('grown') < m.order.indexOf('scene') && m.grown < m.scene, `${S.n}: the panel is above the kid's art`, m.order);
      ok(m.grown < m.H * 0.5 && /What the kids see/.test(m.labelText || '') && m.label < m.scene, `${S.n}: the panel starts on the first screen and "What the kids see" labels the preview`, { grown: m.grown, H: m.H, label: m.label });
      ok(m.voiceNext === 'voice-panel', `${S.n}: #voice-panel is the stable sibling right after the panel`, m.voiceNext);
      if (S.n === '390x844' || S.n === '1440x900') await d.shot(path.join(SHOTS, `adult-${S.n}.png`));
      await d.close();
    }
  }

  // ── (3) the iPhone kids panel with a long name; (4) no horizontal scroll ─────────────────────────────
  if (want('panel') || want('scroll')) {
    await L.close(); L = await local({ variant: 'overflow', clock: 'real', engine: 'webkit' });
    if (want('panel')) {
      console.log('\n## (3) the grown-ups\' kids panel on a phone, with the long-named kids of the overflow household');
      for (const w of [375, 390, 430]) for (const mode of ['light', 'dark']) {
        await L.reset('overflow');
        const d = await L.device({ device: 'iphone-pwa', profile: 'eli', mode, fixedTime: false });
        await d.page.setViewportSize({ width: w, height: 844 });
        const f = await d.openApp('kidverse'); await f.waitForSelector('.kids li[data-kid]'); await sleep(700);
        const rows = await f.evaluate(() => [...document.querySelectorAll('.kids li[data-kid]')].map(li => {
          const b = s => { const e = li.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom }; };
          const nm = li.querySelector('.nm'); return { id: li.dataset.kid, text: li.querySelector('.kn').textContent.trim(), av: b('.avatar'), nm: b('.nm'), cnt: b('.kn b'), days: b('.days'), li: li.getBoundingClientRect().width, nmClipped: nm.scrollWidth > nm.clientWidth + 1, spans: [...li.querySelectorAll('.days .day')].map(s => { const r = s.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom }; }) };
        }));
        const hit = (a, c) => a && c && a.l < c.r - 0.5 && c.l < a.r - 0.5 && a.t < c.b - 0.5 && c.t < a.b - 0.5;
        const bad = []; for (const r of rows) { if (hit(r.nm, r.cnt) || hit(r.nm, r.days) || hit(r.cnt, r.days) || hit(r.av, r.nm) || hit(r.av, r.cnt)) bad.push(r.id + ' overlap'); if (r.days.t < Math.max(r.nm.b, r.cnt.b) - 1) bad.push(r.id + ' dots not below'); if (r.cnt.t > r.nm.t + 30 && r.cnt.t > r.nm.b) bad.push(r.id + ' count on its own line'); for (let i = 1; i < r.spans.length; i++) if (hit(r.spans[i - 1], r.spans[i])) bad.push(r.id + ' dots overlap'); if (r.nmClipped || r.days.r > r.li + r.av.l + 2) bad.push(r.id + ' clipped'); }
        ok(rows.length >= 2 && !bad.length, `${w} ${mode}: each kid's name and count share a line, the dots are below, nothing overlaps (${rows.map(r => r.text.replace(/\s+/g, ' ')).join(' | ')})`, { bad, rows: rows.map(r => ({ id: r.id, nm: r.nm, cnt: r.cnt, days: r.days })) });
        if (w === 390 || w === 375) await d.shot(path.join(SHOTS, `panel-${w}-${mode}.png`));
        await d.close();
      }
    }
    if (want('scroll')) {
      console.log('\n## (4) no horizontal scroll from 375 to 1440 (kid and adult, the household with the long names)');
      for (const prof of ['ezra', 'eli']) for (const w of [375, 390, 430, 560, 768, 820, 1024, 1180, 1440]) {
        await L.reset('overflow');
        const d = await L.device({ device: w >= 1024 ? 'desktop' : 'iphone-pwa', profile: prof, fixedTime: false });
        await d.page.setViewportSize({ width: w, height: 900 });
        const f = await d.openApp('kidverse'); await f.waitForSelector(prof === 'ezra' ? '#rewards:not([hidden])' : '.kids li[data-kid]', { timeout: 15000 }).catch(() => {}); await sleep(500);
        const m = await f.evaluate(() => { const W = document.documentElement.clientWidth; const wide = [...document.querySelectorAll('body *')].filter(e => e.getClientRects().length && e.getBoundingClientRect().right > W + 1 && !e.closest('.confetti')).map(e => (e.id || e.className || e.tagName).toString().slice(0, 30)); return { W, sw: document.documentElement.scrollWidth, wide: wide.slice(0, 5) }; });
        ok(m.sw <= m.W + 1 && !m.wide.length, `${prof} at ${w}: no horizontal scroll`, m);
        await d.close();
      }
    }
    await L.close(); L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
  }

  // ── (5) kid targets, (9) icons, (8) dots, (11) rewards, (12) tokens ─────────────────────────────────
  if (want('targets') || want('icons') || want('dots') || want('rewards') || want('tokens')) {
    await L.reset('typical');
    const d = await L.device({ device: 'iphone-pwa', profile: 'ezra', fixedTime: false });
    const f = await d.openApp('kidverse'); await f.waitForFunction(() => document.querySelector('#rewards:not([hidden])') && document.querySelector('#shelf:not([hidden])'), null, { timeout: 15000 }).catch(() => {}); await sleep(600);
    if (want('targets')) {
      console.log('\n## (5) a kid\'s targets');
      const bs = await f.evaluate(() => [...document.querySelectorAll('button')].filter(b => !b.hidden && b.getClientRects().length).map(b => { const r = b.getBoundingClientRect(); return { id: b.id || b.className, w: Math.round(r.width), h: Math.round(r.height) }; }));
      ok(bs.length >= 4 && bs.every(b => b.w >= 64 && b.h >= 64), `every visible button on Ezra's screen is at least 64 x 64 (${bs.length} buttons: ${bs.map(b => b.id.split(' ')[0] + ' ' + b.w + 'x' + b.h).join(', ')})`, bs.filter(b => b.w < 64 || b.h < 64));
    }
    if (want('icons')) {
      console.log('\n## (9) pictures, not reading; one sprite');
      const m = await f.evaluate(() => {
        const use = id => [...(document.getElementById(id) || document.body).querySelectorAll('use')].map(u => u.getAttribute('href').split('#')[1]);
        const svgs = [...document.querySelectorAll('svg')].map(s => ({ sym: s.classList.contains('sym'), uses: [...s.querySelectorAll('use')].map(u => u.getAttribute('href')) }));
        const labels = [...document.querySelectorAll('button, .btn, h1, h2, .kn, .sub, .kind, .bank, .badges small, .paid')].map(e => e.textContent).join(' | ');
        return { say: use('say'), say2: use('story-say'), done: use('done'), heard: use('story-heard'), svgs, labels, doneText: document.querySelector('#done span').textContent, heardText: document.querySelector('#story-heard span').textContent };
      });
      ok(m.say.includes('i-scroll-text') && m.say2.includes('i-book-open') && m.say[0] !== m.say2[0], 'the two speakers have distinct pictures: a scroll for the verse, a book for the story', { say: m.say, say2: m.say2 });
      ok(m.heard.includes('i-ear') && m.heard.includes('i-star') && m.done.includes('i-star'), '"I heard it" is an ear with the star mark; Done is the star', { heard: m.heard, done: m.done });
      ok(!/[★✓✔−×→]/.test(m.labels) && m.doneText === 'Done' && m.heardText === 'I heard it', 'no ★ / ✓ / − glyph in any label', { doneText: m.doneText, heardText: m.heardText, g: (m.labels.match(/[★✓✔−×→]/g) || []) });
      ok(m.svgs.length > 8 && m.svgs.every(s => s.sym && s.uses.length === 1 && SYMS.has(s.uses[0].split('#i-').pop() ? 'i-' + s.uses[0].split('#i-').pop() : '')), `every <svg> is an svg.sym naming a symbol in icons/sprite.svg (${m.svgs.length} of them)`, m.svgs.filter(s => !s.sym));
      ok(!/class="icon\b|class="icon /.test(SRC.replace(/<style[\s\S]*?<\/style>/g, '')), 'no hand-drawn <svg class="icon"> is left in the page');
    }
    if (want('dots')) {
      console.log('\n## (8) the day dots carry every kind of star');
      const m = await f.evaluate(() => {
        const grp = document.querySelector('#mine .days'); const dots = [...grp.querySelectorAll('.day')];
        const marks = dots.map(x => ({ day: x.dataset.day, marks: x.dataset.marks ? x.dataset.marks.split(',') : [], label: x.getAttribute('aria-label'), icons: [...x.querySelectorAll('use')].map(u => u.getAttribute('href').split('#')[1]) }));
        const mirror = hub.get('stars:ezra', { scope: 'family' });
        return { label: grp.getAttribute('aria-label'), role: grp.getAttribute('role'), count: document.getElementById('star-count').textContent, marks, total: marks.reduce((n, x) => n + x.marks.length, 0), kidsLabel: document.querySelector('.kids, #kids') ? 0 : -1, mirrorCount: mirror && mirror.count };
      });
      ok(m.total === Number(m.count) && new RegExp('^' + m.count + ' stars? this week$').test(m.label) && m.role === 'group', `the 7 dots hold ${m.total} marks = ★${m.count} and the group says "${m.label}"`, m);
      ok(m.marks.length === 7 && m.marks.every(x => x.label && x.marks.every((k, i) => x.icons[i] === ({ verse: 'i-star', story: 'i-book-open', prayed: 'i-hands' })[k])) && true, 'each dot names its day and marks aloud, with the star, book and hands drawings', m.marks);
      const syn = await f.evaluate(() => { const t = hub.today(); const s = { count: 6, days: { [t]: true }, credited: { story: { [t]: true }, prayed: { [t]: true } } }; const box = document.createElement('div'); box.id = 'synth'; box.style.cssText = 'position:fixed;top:0;left:0;width:320px;background:var(--surface)'; box.innerHTML = window.kidverse.look.daysHtml(s) + window.kidverse.look.daysHtml({ count: 2, days: { [t]: true }, credited: { story: { [t]: true }, prayed: {} } }).replace('<div class="days"', '<div class="days" id="two"'); document.body.appendChild(box); const dots = [...box.querySelectorAll('.day.on')]; const out = dots.map(d => { const m = d.querySelector('.marks'), dr = d.getBoundingClientRect(), mr = m.getBoundingClientRect(); return { cls: m.className, marks: d.dataset.marks, label: d.getAttribute('aria-label'), fits: mr.left >= dr.left - 0.5 && mr.right <= dr.right + 0.5 && mr.top >= dr.top - 0.5 && mr.bottom <= dr.bottom + 0.5, dot: Math.round(dr.width), mark: Math.round(m.querySelector('svg').getBoundingClientRect().width) }; }); box.remove(); return out; });
      ok(syn.length === 2 && syn[0].marks === 'verse,story,prayed' && syn[0].cls.includes('m3') && syn[1].cls.includes('m2') && syn.every(x => x.fits && x.mark >= 11), 'a day with all three kinds draws three marks (star, book, hands) and a day with two draws two, each inside its dot', syn);
      ok(m.marks.some(x => /story star/.test(x.label)) && m.marks.some(x => /verse star/.test(x.label)) || m.marks.some(x => /prayer star/.test(x.label)), 'a story or prayer star shows on its day, not only the verse stars (P3-KIDVERSE-04)', m.marks.map(x => x.label));
      await d.shot(path.join(SHOTS, 'dots-typical.png'));
    }
    if (want('rewards')) {
      console.log('\n## (11) the rewards summary wraps as whole items');
      const m = await f.evaluate(() => { const b = document.getElementById('rw-bank'); return { text: b.textContent, items: [...b.children].map(c => c.className), dots: (b.textContent.match(/·/g) || []).length, flex: getComputedStyle(b).display, wrap: getComputedStyle(b).flexWrap, gap: getComputedStyle(b).columnGap }; });
      ok(m.dots === 0 && m.flex === 'flex' && m.wrap === 'wrap' && m.items.length >= 2, 'the summary is separate items in a wrapping flex row, no "·" between them', m);
      ok(/to cash in/.test(m.text) && !/all time/.test(m.text + (await f.evaluate(() => document.getElementById('mine').textContent))), 'the balance reads "to cash in", never "all time"');
    }
    if (want('tokens')) {
      console.log('\n## (12) tokens only');
      const css = (SRC.match(/<style>([\s\S]*?)<\/style>/) || [])[1] || '';
      const m = await f.evaluate(() => ({ glass: document.querySelectorAll('.btn-glass, .pill, .glass').length, who: document.getElementById('who').className,
        story: (() => { const im = document.getElementById('story-art'), card = document.getElementById('story'); const ci = getComputedStyle(card), ii = getComputedStyle(im), r = im.getBoundingClientRect(), c = card.getBoundingClientRect(); const R = parseFloat(ci.borderTopLeftRadius), pad = parseFloat(ci.paddingLeft), inset = r.left - c.left - parseFloat(ci.borderLeftWidth), insetT = r.top - c.top; return { R, r: parseFloat(ii.borderTopLeftRadius), insetL: Math.round(inset), insetT: Math.round(insetT), pad }; })() }));
      const live = await f.evaluate(() => [...document.querySelectorAll('body *')].filter(e => { const c = getComputedStyle(e); return (c.backdropFilter || c.webkitBackdropFilter || 'none') !== 'none'; }).length);
      ok(live === 0, 'no element in the page has a live backdrop blur (GLASS/layers: 0 live-blur layers in the app document)', live);
      ok(m.glass === 0 && !/backdrop-filter:(?!\s*none)|btn-glass|\.pill\b/.test(css), 'no glass button, pill or backdrop-filter in the page (CONS-GLASS-2)', m);
      ok(!/color-mix\(/.test(css) && !/#[0-9a-fA-F]{3,8}\b/.test(css), 'no color-mix and no hex in the <style> (CONS-TOK-3)');
      ok(!/font-size:\s*\d+px|--size:\s*\d+px/.test(css), 'no px font size and no avatar --size literal (CONS-TYPE-2, GAP-TOK-4)');
      ok(Math.abs(m.story.insetL - m.story.insetT) <= 1 && Math.abs(m.story.r - Math.max(0, m.story.R - m.story.insetL)) <= Math.max(3, 0.25 * m.story.R), `the story picture sits at the card's padding corner and its radius is concentric (R ${m.story.R}, inset ${m.story.insetL}, r ${m.story.r})`, m.story);
    }
    await d.close();
  }

  // ── (6) the word highlight ────────────────────────────────────────────────────────────────────────────
  if (want('hl')) {
    console.log('\n## (6) the word being spoken is highlighted (IMP-KIDVERSE-F3)');
    await L.reset('typical');
    const d = await L.device({ device: 'iphone-pwa', profile: 'ezra', fixedTime: false });
    await fakeSpeech(d.ctx);
    const f = await d.openApp('kidverse'); await f.waitForFunction(() => document.querySelector('#say:not([disabled])') && document.querySelector('#words').textContent.length > 10, null, { timeout: 15000 }); await sleep(500);
    const words = await f.evaluate(() => document.getElementById('words').textContent);
    const st = () => f.evaluate(() => { const m = document.querySelector('#words mark.hl'); return { mark: m ? m.textContent : null, text: document.getElementById('words').textContent, n: document.querySelectorAll('#words mark').length, on: document.getElementById('say').classList.contains('on'), label: document.querySelector('#say span').textContent }; });
    const fire = (i, ev, extra) => f.evaluate(([i, ev, extra]) => { const u = window.__utts[i]; if (ev === 'boundary') u.onboundary && u.onboundary({ name: 'word', ...extra }); else u[ev === 'end' ? 'onend' : 'onerror'] && u[ev === 'end' ? 'onend' : 'onerror']({}); }, [i, ev, extra]);
    await f.click('#say'); await sleep(100);
    const lead = await f.evaluate(() => window.__utts[0].text);
    const off = lead.length - words.length;
    ok(lead.endsWith(words) && (await st()).on && (await st()).label === 'Reading…', 'Read it to me speaks the lead-in and the paraphrase; the button says Reading…');
    const w2 = words.split(' ')[2], i2 = words.indexOf(w2, words.indexOf(' ') + 1 + words.split(' ')[1].length);
    await fire(0, 'boundary', { charIndex: off + i2, charLength: w2.length }); let s = await st();
    ok(s.mark === w2.replace(/[.,;:!?]+$/, '') && s.text === words && s.n === 1, `a boundary at the third word lights exactly that word ("${s.mark}"), the text is unchanged`, s);
    await fire(0, 'boundary', { charIndex: off + words.lastIndexOf(' ') + 1 }); s = await st();   // no charLength: Safari
    const lastW = words.slice(words.lastIndexOf(' ') + 1).replace(/[.,;:!?]+$/, '');
    ok(s.mark === lastW && s.n === 1, `a boundary with no charLength (Safari) takes the word up to the next space ("${s.mark}")`, s);
    await fire(0, 'boundary', { charIndex: 3, charLength: 4 }); s = await st();
    ok(s.mark === null || s.n === 0 || s.text === words, 'a boundary inside the spoken lead-in lights nothing in the paraphrase', s);
    const css = await f.evaluate(() => { const m = document.querySelector('#words mark.hl') || (() => { const e = document.createElement('mark'); e.className = 'hl'; document.getElementById('words').appendChild(e); return e; })(); const c = getComputedStyle(m); return { anim: c.animationName, trans: c.transitionDuration, bg: c.backgroundColor }; });
    ok((css.anim === 'none') && /^0s(, 0s)*$/.test(css.trans) && css.bg !== 'rgba(0, 0, 0, 0)', 'the highlight is a background with no animation or transition (the same under Reduce Motion)', css);
    await fire(0, 'boundary', { charIndex: off + 4, charLength: 5 }); await fire(0, 'end'); await sleep(50); s = await st();
    ok(s.mark === null && s.n === 0 && !s.on && s.label === 'Read it to me' && s.text === words, 'the highlight and "Reading…" are cleared on end');
    await f.click('#say'); await sleep(100); await fire(1, 'boundary', { charIndex: off + 4, charLength: 5 });
    await f.click('#say'); await sleep(100); s = await st();   // a second tap cancels
    ok(s.n === 0 && !s.on && (await f.evaluate(() => window.__cancels)) >= 2, 'a second tap cancels: the highlight is cleared');
    await f.click('#say'); await sleep(100); const k = await f.evaluate(() => window.__utts.length - 1); await fire(k, 'boundary', { charIndex: off + 4, charLength: 5 }); await fire(k, 'error'); await sleep(50); s = await st();
    ok(s.n === 0 && !s.on && s.text === words, 'the highlight is cleared on error');
    await f.click('#say'); await sleep(100); s = await st();
    ok(s.n === 0 && s.on, 'a voice that sends no boundary at all: Reading… shows, nothing is highlighted, nothing breaks');
    // a toast is spoken, but never over a reading
    const nBefore = await f.evaluate(() => window.__utts.length);
    await f.evaluate(() => hub.toast('Hello little one'));
    ok((await f.evaluate(() => window.__utts.length)) === nBefore, 'a kid\'s toast does not talk over a reading in progress');
    await f.evaluate(() => { const u = window.__utts[window.__utts.length - 1]; u.onend && u.onend({}); }); await sleep(50);
    await f.evaluate(() => hub.toast('Great listening!'));
    const spoken = await f.evaluate(() => window.__utts.map(u => u.text));
    ok(spoken[spoken.length - 1] === 'Great listening!', 'a kid\'s toast is spoken when nothing else is', spoken.slice(-2));
    await f.evaluate(() => { const u = window.__utts[window.__utts.length - 1]; u.onend && u.onend({}); });
    // the story speaker
    const sw = await f.evaluate(() => document.getElementById('story-text').textContent);
    await f.click('#story-say'); await sleep(100);
    const su = await f.evaluate(() => window.__utts[window.__utts.length - 1].text); const soff = su.length - sw.length; const sIdx = sw.indexOf(' ') + 1;
    await f.evaluate(([i, c]) => { const u = window.__utts[window.__utts.length - 1]; u.onboundary({ name: 'word', charIndex: i, charLength: c }); }, [soff + sIdx, sw.slice(sIdx).indexOf(' ')]);
    const sm = await f.evaluate(() => { const m = document.querySelector('#story-text mark.hl'); return { m: m && m.textContent, label: document.querySelector('#story-say span').textContent }; });
    ok(sm.m === sw.slice(sIdx).split(' ')[0].replace(/[.,;:!?]+$/, '') && sm.label === 'Reading…', `the story speaker highlights its word too ("${sm.m}")`, sm);
    await f.evaluate(() => { const u = window.__utts[window.__utts.length - 1]; u.onend && u.onend({}); }); await sleep(50);
    ok(await f.evaluate(() => !document.querySelector('#story-text mark') && document.querySelector('#story-say span').textContent === 'Read it to me'), 'the story highlight is cleared on end');
    await d.close();
  }

  // ── (7) the shelf ──────────────────────────────────────────────────────────────────────────────────────
  if (want('shelf')) {
    console.log('\n## (7) the earlier weeks shelf: read-only, "Just for listening", never the TV');
    await L.reset('typical');
    for (const prof of ['ezra', 'eli']) {
      const d = await L.device({ device: 'iphone-pwa', profile: prof, fixedTime: false });
      await fakeSpeech(d.ctx);
      const f = await d.openApp('kidverse'); await f.waitForFunction(() => document.querySelector('#shelf:not([hidden]) .shelf-card'), null, { timeout: 15000 }); await sleep(500);
      const fam = (await L.apiAs('eli', '/api/data/kidverse?scope=family')).body.items.find(r => r.key === 'week').value.week;
      const cards = () => f.evaluate(() => [...document.querySelectorAll('#shelf .shelf-card')].map(c => Number(c.dataset.week)));
      const c0 = await cards();
      ok(c0.length === 6 && c0[0] === fam - 1 && c0.every((n, i) => i === 0 || n === c0[i - 1] - 1), `${prof}: the last 6 earlier weeks, newest first (${c0.join(', ')}), family week ${fam}`, c0);
      const more = await f.$('#shelf-show-all');
      ok(!!more && /Show all \d+ weeks/.test(await more.textContent()), `${prof}: "Show all" follows`);
      const snap = async () => { const own = []; for (const sc of ['person', 'family']) { const r = await L.apiAs(prof === 'ezra' ? 'ezra' : 'eli', '/api/data/kidverse?scope=' + sc); own.push(JSON.stringify((r.body.items || []).map(x => [x.key, x.updated_at, JSON.stringify(x.value)]).sort())); } return own.join('#'); };
      const before = await snap();
      await f.evaluate(() => { window.__sets = 0; const s = hub.set; hub.set = function () { window.__sets++; return s.apply(this, arguments); }; });
      await f.evaluate(() => document.querySelector('#shelf .shelf-card').scrollIntoView({ block: 'center' })); await sleep(200);
      await f.click('#shelf .shelf-card'); await f.waitForSelector('#shelf-view', { timeout: 3000 });
      const m = await f.evaluate(() => { const v = document.getElementById('shelf-view'); const bs = [...v.querySelectorAll('button')].map(b => b.id); return { listen: v.querySelector('#vs-listen').textContent.trim(), ear: !!v.querySelector('#vs-listen use[href$="#i-ear"]'), bs, hasDone: !!v.querySelector('#done, .done, #story-heard, .story-heard'), stars: v.querySelectorAll('.star, svg use[href$="#i-star"]').length, role: v.querySelector('[role=dialog]').getAttribute('aria-modal'), focus: document.activeElement && document.activeElement.id, W: document.documentElement.scrollWidth <= innerWidth + 1, title: v.querySelector('#vs-title').textContent, wrapInert: document.querySelector('.wrap').inert, minH: Math.min(...[...v.querySelectorAll('button')].map(b => b.getBoundingClientRect().height)) }; });
      ok(m.listen === 'Just for listening' && m.ear && !m.hasDone && m.stars === 0 && m.bs.every(i => ['vs-say', 'vs-story-say', 'vs-close'].includes(i)), `${prof}: the sheet says "Just for listening" with an ear; its only buttons are two speakers and Close; no Done, no "I heard it", no star`, m);
      ok(m.role === 'true' && m.focus === 'vs-close' && m.wrapInert && m.W, `${prof}: it is a modal dialog, focus is on Close, the page behind is inert, no sideways scroll`, m);
      if (prof === 'ezra') ok(m.minH >= 64, 'a kid\'s sheet buttons are at least 64 px tall', m.minH);
      await f.click('#vs-say'); await sleep(100);
      const u = await f.evaluate(() => window.__utts[window.__utts.length - 1].text); const vw = await f.evaluate(() => document.getElementById('vs-words').textContent);
      await f.evaluate(([i, c]) => { const x = window.__utts[window.__utts.length - 1]; x.onboundary({ name: 'word', charIndex: i, charLength: c }); }, [u.length - vw.length + 4, 3]);
      ok(await f.evaluate(() => !!document.querySelector('#vs-words mark.hl')), `${prof}: the sheet's verse speaker highlights the word too`);
      await f.click('#vs-story-say'); await sleep(100);
      ok(await f.evaluate(() => !document.querySelector('#vs-words mark') && document.querySelector('#vs-verse #vs-say span').textContent === 'Read it to me'), `${prof}: starting the story stops the verse (one voice at a time) and clears its highlight`);
      if (prof === 'ezra') await d.shot(path.join(SHOTS, 'shelf-sheet-ezra.png'));
      await d.page.keyboard.press('Escape'); await sleep(200);
      ok(await f.evaluate(() => !document.getElementById('shelf-view') && !document.querySelector('.wrap').inert && document.activeElement && document.activeElement.classList.contains('shelf-card')), `${prof}: Escape closes it, the page is live again and focus returns to the card`);
      ok((await f.evaluate(() => window.__sets)) === 0, `${prof}: opening, listening and closing wrote nothing (no hub.set)`, await f.evaluate(() => window.__sets));
      await sleep(400);
      ok((await snap()) === before, `${prof}: the person and family kidverse rows are byte-identical before and after`);
      await f.click('#shelf-show-all'); await sleep(200);
      const all = await cards(); ok(all.length === fam - 1 && all[all.length - 1] === 1 && !(await f.$('#shelf-show-all')), `${prof}: Show all lists every earlier week down to week 1 (${all.length})`, all.length);
      if (prof === 'ezra') await d.shot(path.join(SHOTS, 'shelf-ezra.png'));
      await d.close();
    }
    // the TV: not offered (kiosk, standalone page)
    const tv = await L.device({ device: 'tv', profile: 'tv', fixedTime: false });
    await tv.page.goto(L.site + '/apps/kidverse.html'); await tv.page.waitForFunction(() => window.kidverse && window.hub && hub.sync && hub.sync.lastPull > 0, null, { timeout: 15000 }).catch(() => {}); await sleep(600);
    ok(await tv.page.evaluate(() => document.getElementById('shelf').hidden && !document.querySelector('#shelf .shelf-card')), 'the TV (kiosk) gets no shelf');
    await tv.close();
  }

  // ── (10) no week ─────────────────────────────────────────────────────────────────────────────────────────
  if (want('noweek')) {
    console.log('\n## (10) no family week: a picture for the kid, a prompt for the grown-up');
    await L.close(); L = await local({ variant: 'empty', clock: 'real', engine: 'webkit' });
    await L.reset('empty');
    const d = await L.device({ device: 'iphone-pwa', profile: 'ezra', fixedTime: false }); await fakeSpeech(d.ctx);
    const f = await d.openApp('kidverse'); await f.waitForFunction(() => document.querySelector('#no-week-kid:not([hidden])'), null, { timeout: 15000 }); await sleep(400);
    const m = await f.evaluate(() => { const vis = id => { const e = document.getElementById(id); return !!e && !e.hidden && e.getClientRects().length > 0; }; return { kid: vis('no-week-kid'), scene: vis('scene'), ref: vis('refblock'), done: vis('done'), actions: vis('actions'), story: vis('story'), shelf: vis('shelf'), words: vis('wordscard'), text: document.getElementById('no-week-text').textContent, pic: !!document.querySelector('#no-week-kid .bigpic use'), who: document.getElementById('who').textContent, mine: vis('mine') }; });
    ok(m.kid && !m.scene && !m.ref && !m.done && !m.actions && !m.story && !m.shelf && !m.words && /A grown-up will pick this week/.test(m.text) && m.pic, 'Ezra sees a picture and "A grown-up will pick this week\'s verse": no Week 1 art, no Done, no story, no shelf', m);
    ok(!/Week 1/.test(m.who) && /No week yet/.test(m.who), 'the who-chip says "No week yet", not Week 1', m.who);
    await f.click('#no-week-say'); await sleep(100);
    ok((await f.evaluate(() => window.__utts.map(u => u.text))).some(t => /grown-up will pick this week/.test(t)), 'the placeholder is read aloud on tap');
    await d.shot(path.join(SHOTS, 'noweek-kid.png')); await d.close();
    const a = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
    const g = await a.openApp('kidverse'); await g.waitForSelector('#no-week-adult', { timeout: 15000 }); await sleep(400);
    const n = await g.evaluate(() => { const b = id => { const e = document.getElementById(id); return e ? { top: Math.round(e.getBoundingClientRect().top), dis: e.disabled } : null; }; const head = document.querySelector('#grown').firstElementChild; return { first: head && head.id, prompt: document.querySelector('#no-week-adult h3').textContent, up: b('week-up'), pick: b('week-pick'), scene: document.getElementById('scene').hidden, label: document.getElementById('kv-label').hidden, wk: document.getElementById('week-now').textContent }; });
    ok(n.first === 'no-week-adult' && /Pick this week/.test(n.prompt) && n.up && n.pick && n.scene && n.label, 'Eli sees "Pick this week\'s verse" with the stepper first, and no made-up Week 1 preview', n);
    const before = (await L.apiAs('eli', '/api/data/kidverse?scope=family')).body.items.some(r => r.key === 'week' && r.value);
    await g.click('#week-up'); await sleep(300);
    ok(!before && !(await L.apiAs('eli', '/api/data/kidverse?scope=family')).body.items.some(r => r.key === 'week' && r.value), 'the stepper only moves the candidate: nothing is written until "Use week N"');
    await g.click('#week-pick'); await sleep(900);
    const after = (await L.apiAs('eli', '/api/data/kidverse?scope=family')).body.items.find(r => r.key === 'week');
    ok(after && after.value && after.value.week >= 1, 'Use week N writes the family week (A\'s setWeek)', after && after.value);
    await a.shot(path.join(SHOTS, 'noweek-adult.png')); await a.close();
  }
  // ── (14) the star mark is a small badge on the ear, never bigger than the picture it marks (review round 1, item 2) ──
  if (want('marks')) {
    console.log('\n## (14) "I heard it": the ear is the picture, the star a small badge on it (kid and adult); Done\'s star is the picture');
    await L.reset('typical');
    for (const [prof, dev, w] of [['ezra', 'iphone-pwa', 390], ['ezra', 'ipad-portrait', 820], ['kiara', 'iphone-pwa', 430], ['eli', 'iphone-pwa', 390]]) for (const mode of ['light', 'dark']) {
      const d = await L.device({ device: dev, profile: prof, mode, fixedTime: false }); await d.page.setViewportSize({ width: w, height: dev === 'ipad-portrait' ? 1180 : 844 });
      const f = await d.openApp('kidverse'); await f.waitForSelector('#story-heard', { state: 'attached', timeout: 15000 }); await f.waitForFunction(() => !document.getElementById('story-say').disabled, null, { timeout: 15000 }).catch(() => {}); await sleep(500);
      const m = await f.evaluate(() => {
        const heard = document.getElementById('story-heard'); if (heard.hidden) { heard.hidden = false; heard.parentElement.classList.remove('solo'); }   // an adult never sees it: measure the same CSS on the unhidden button
        const box = e => { const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height }; };
        const ear = heard.querySelector('.pic svg.big'), star = heard.querySelector('.pic svg.star'), done = document.querySelector('#done svg.star'), say = document.querySelector('#say > svg.sym');
        const doneBtn = document.getElementById('done');
        return { ear: box(ear), star: box(star), done: doneBtn.hidden ? null : box(done), say: box(say), kid: document.documentElement.dataset.kind, xl: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--icon-xl')) || 32 };
      });
      const tag = prof + ' ' + w + ' ' + mode;
      ok(m.star.w <= m.ear.w * 0.7 && m.star.w >= 10 && m.star.r >= m.ear.r - 2 && m.star.t <= m.ear.t + m.ear.h * 0.3 && m.ear.w >= m.xl, tag + ': the star badge (' + Math.round(m.star.w) + ' px) is a small mark at the ear\'s top corner (ear ' + Math.round(m.ear.w) + ' px), not covering it', m);
      if (m.kid === 'kid') ok(m.ear.w >= m.xl * 1.3 && m.say.w >= m.xl * 1.3 && m.done && m.done.w >= m.xl * 1.3 && Math.abs(m.say.w - m.ear.w) <= 2, tag + ': the kid\'s ear, scroll and Done star are all the big picture size (' + [m.ear.w, m.say.w, m.done && m.done.w].map(Math.round).join('/') + ')', m);
      if (prof === 'ezra' && w === 390) { await f.evaluate(() => document.getElementById('story-heard').scrollIntoView({ block: 'center' })); await sleep(300); await d.shot(path.join(SHOTS, 'heard-it-' + mode + '.png')); }
      await d.close();
    }
  }

  // ── (15) a week change from another device while a verse or story is being read (review round 1, item 6) ──
  if (want('stale')) {
    console.log('\n## (15) another device steps the week mid-reading: the reading stops and the new words show under the new reference');
    await L.reset('typical');
    const d = await L.device({ device: 'iphone-pwa', profile: 'ezra', fixedTime: false }); await fakeSpeech(d.ctx);
    const f = await d.openApp('kidverse'); await f.waitForFunction(() => document.querySelector('#say:not([disabled])') && document.querySelector('#words').textContent.length > 10, null, { timeout: 15000 }); await sleep(800);
    for (const which of ['verse', 'story']) {
      const w0 = await f.evaluate(() => hub.get('week', { scope: 'family' }).week);
      await f.click(which === 'verse' ? '#say' : '#story-say'); await sleep(200);
      const u = await f.evaluate(() => window.__utts.length - 1);
      await f.evaluate(([u, which]) => { const x = window.__utts[u]; const el = document.getElementById(which === 'verse' ? 'words' : 'story-text'); const t = el.textContent; x.onboundary({ name: 'word', charIndex: x.text.length - t.length + 2, charLength: 3 }); }, [u, which]);
      ok(await f.evaluate(w => !!document.querySelector((w === 'verse' ? '#words' : '#story-text') + ' mark.hl'), which), which + ': reading week ' + w0 + ' with a word lit');
      const next = w0 % 52 + 1;
      await L.apiAs('eli', '/api/data/kidverse/week?scope=family', { method: 'PUT', body: { value: { week: next, by: 'eli', at: Date.now() }, updated_at: Date.now() } });
      await f.evaluate(() => hub.pull()); await sleep(1500);
      const m = await f.evaluate(n => ({ ref: document.getElementById('ref').textContent, refExp: (v => v.refs[v.p])(window.kidverse.VERSES[n - 1]), words: document.getElementById('words').textContent, wordsExp: window.kidverse.VERSES[n - 1].words, story: document.getElementById('story-text').textContent, storyExp: window.kidverse.STORIES[n - 1].s, say: document.querySelector('#say span').textContent, ssay: document.querySelector('#story-say span').textContent, marks: document.querySelectorAll('mark.hl').length }), next);
      ok(m.ref === m.refExp && m.words === m.wordsExp && m.story === m.storyExp && m.marks === 0 && m.say === 'Read it to me' && m.ssay === 'Read it to me', which + ': week ' + next + ' shows its own verse and story at once, no highlight, both buttons idle', m);
      await f.evaluate(() => { const u = window.__utts[window.__utts.length - 1]; u && u.onend && u.onend({}); }); await sleep(300);
      const a = await f.evaluate(n => ({ words: document.getElementById('words').textContent === window.kidverse.VERSES[n - 1].words, story: document.getElementById('story-text').textContent === window.kidverse.STORIES[n - 1].s }), next);
      ok(a.words && a.story, which + ': and still the new words after the old utterance ends', a);
    }
    await d.close();
  }

  // ── (16) the recorder's take state has no glass on a content card (review round 1, item 8; Chromium with a fake microphone) ──
  if (want('take')) {
    console.log('\n## (16) the recorder card with a take on it: solid buttons only');
    await L.close(); L = await local({ variant: 'typical', clock: 'real', engine: 'chromium', args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
    await L.reset('typical');
    const d = await L.device({ device: 'desktop', profile: 'eli', fixedTime: false });
    const f = await d.openApp('kidverse'); await f.waitForSelector('#voice-panel:not([hidden]) #voice-record', { timeout: 20000 }); await sleep(300);
    await f.click('#voice-record'); await f.waitForSelector('#voice-stop', { timeout: 8000 }); await sleep(1200); await f.click('#voice-stop'); await f.waitForSelector('#voice-save', { timeout: 8000 }); await sleep(300);
    const m = await f.evaluate(() => { const panel = document.getElementById('voice-panel'); const live = [...panel.querySelectorAll('*')].filter(e => { const c = getComputedStyle(e); return (c.backdropFilter || c.webkitBackdropFilter || 'none') !== 'none'; }).length; return { glass: panel.querySelectorAll('.btn-glass, .glass, .pill').length, live, redo: document.getElementById('voice-redo').className, btns: [...panel.querySelectorAll('button')].filter(b => b.getClientRects().length).map(b => b.id) }; });
    ok(m.glass === 0 && m.live === 0 && /btn-soft/.test(m.redo) && m.btns.includes('voice-redo') && m.btns.includes('voice-save'), 'with a take on the card (Play my take, Save, Record again) no button is glass and none has a live blur', m);
    await d.shot(path.join(SHOTS, 'voice-take-desktop.png')); await d.close();
  }

  // ── (13) the Move offer's markup (A owns the rule; the demo household's clock is set to a Sunday 5:05 pm New York) ──
  if (want('move')) {
    console.log('\n## (13) "Move to week N+1?" at the top of the grown-ups\' panel, with Move and Not now');
    await L.close(); L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
    for (const choice of ['move', 'no']) {
      await L.reset('typical');
      const t = new Date(DEMO); t.setUTCDate(t.getUTCDate() + ((7 - t.getUTCDay()) % 7)); t.setUTCHours(21, 5, 0, 0); const T = t.getTime();   // Sunday 5:05 pm EDT
      await L.clock(new Date(T).toISOString());
      const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: T });
      const f = await d.openApp('kidverse'); await f.waitForSelector('#move-offer', { timeout: 15000 }).catch(() => {}); await sleep(400);
      const m = await f.evaluate(() => { const o = document.getElementById('move-offer'); if (!o) return null; const bs = ['move-yes', 'move-no'].map(i => { const b = document.getElementById(i).getBoundingClientRect(); return { w: Math.round(b.width), h: Math.round(b.height) }; }); const g = document.getElementById('grown'); return { first: g.firstElementChild === o, text: o.textContent.replace(/\s+/g, ' ').trim(), bs, top: Math.round(o.getBoundingClientRect().top), sw: document.documentElement.scrollWidth <= innerWidth + 1 }; });
      ok(m && m.first && /Move to week 39\?/.test(m.text) && m.bs.every(b => b.h >= 44 && b.w >= 44) && m.sw, `the offer is the first thing in the panel: "${m && m.text}", two buttons >= 44 px`, m);
      if (choice === 'move') { await d.shot(path.join(SHOTS, 'move-offer-390.png')); await f.click('#move-yes'); await sleep(900); const w = (await L.apiAs('eli', '/api/data/kidverse?scope=family')).body.items.find(r => r.key === 'week'); ok(w && w.value.week === 39 && !(await f.$('#move-offer')), 'Move writes week 39 and the offer goes', w && w.value); }
      else { await f.click('#move-no'); await sleep(900); const r = (await L.apiAs('eli', '/api/data/kidverse?scope=person')).body.items.find(r => /^moveoffer:/.test(r.key)); const w = (await L.apiAs('eli', '/api/data/kidverse?scope=family')).body.items.find(r => r.key === 'week'); ok(r && w.value.week === 38 && !(await f.$('#move-offer')), 'Not now is remembered (a person row) and the week stays 38', r && r.key); }
      await d.close();
    }
  }
} finally { await L.close(); }
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
