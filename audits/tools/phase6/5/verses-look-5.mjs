// Batch 5, Worker B: Verses' look, on the local rig (typical household, demo clock, WebKit).
//  (1) VIS-VERSES-1: the trainer card is sized to its content. For adult (Eli, on a card without and with text) and kid (Ezra) at 390, 820, 1180 and 1440 px
//      (and 390 / 1180 at XXL text) it measures the card's empty band (card bottom - last visible child - padding) and its
//      height before and after Show. Pass: the card does not move on Show (height after = before, within 1 px) and the band
//      before Show is no more than what Show adds (the rating row + its gap); after Show there is no band.
//  (1b) UX-VERSES-6: after a rating at 430×932, 390×844 and 375×667 the rating toast (with Undo) covers no box label of the
//      histogram, nor the reference or any button (the toast sits at the top on this page).
//  (1c) review round 1: a kid's picture ratings are fully on screen after "I said it" (375×667, 390×844, 430×932, XL,
//      XXL); after a Coming up row tapped from the bottom of the page and a rating, the top toast covers nothing of the
//      next card; "Your verses" stays one line and "reviewed today" fits at phone widths. (3) also checks that Word order
//      keeps the card's height on reveal and that the Tab order follows the drawn order; (6) lists the card's rows with
//      the recorder shown.
//  (2) VIS-VERSES-6: the histogram is tinted by box, not by count: in each of the six palettes the five bars' luminance runs
//      one way (lighter → deeper in a light palette, darker → brighter in a dark one), and every bar's edge is >= 3:1 on
//      the card.
//  (3) IMP-VERSES-I3: on a verse with text (an obvious placeholder text added through the app's own editor), each practice
//      mode at 390 px and at XXL text: no horizontal scroll, every word/piece >= 44 px, First letters and Fill the gaps
//      reveal a tapped word without moving the card, Word order refuses a wrong piece and reveals the card after the last.
//      The mode is remembered (person row 'mode').
//  (4) UX-VERSES-1 kid buttons >= 64 px with a picture; IMP-VERSES-I1 the recorder for adults only, never for kids.
//  (5) Icons: no private inline <svg> drawing is left in the page; every glyph is a sprite <use>.
//   node "audits/tools/phase6/5/verses-look-5.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, DEMO } from '../../lib/local.mjs';

const ROOT = process.cwd();
// ONLY=band,toast,hist,modes,rec runs some sections (default: all)
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null; const want = s => !ONLY || ONLY.includes(s);
const EV = path.join(ROOT, 'audits', 'evidence', 'p6', '5'); fs.mkdirSync(EV, { recursive: true });
let pass = 0, fail = 0; const ok = (c, n, x) => { if (c) { pass++; console.log('  ✓', n); } else { fail++; console.log('  ✗', n, x === undefined ? '' : JSON.stringify(x).slice(0, 900)); } };
const out = { band: [], histogram: {}, modes: {}, kid: {}, icons: {} };
const PLACEHOLDER = 'Alpha bravo charlie, delta echo foxtrot golf; hotel india juliet kilo lima mike november oscar papa quebec romeo sierra tango.';
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const VIEW = '#trainer:not([hidden]), #done:not([hidden]), #empty:not([hidden])';
async function open(d) { const f = await d.openApp('verses'); await f.waitForSelector(VIEW, { timeout: 15000 }).catch(() => {}); await f.waitForFunction(() => document.getElementById('trainer').getAttribute('aria-busy') === 'false', null, { timeout: 15000 }).catch(() => {}); await sleep(500); return f; }
const measure = f => f.evaluate(() => {
  const tr = document.getElementById('trainer'), c = tr.getBoundingClientRect(), cs = getComputedStyle(tr);
  // the rating result line's row counts as content: it is kept from the first paint on purpose (review round 7), at the
  // top of an adult's card and at the foot of a kid's
  const kids = [...tr.children].filter(e => ((!e.hidden && getComputedStyle(e).visibility !== 'hidden') || e.id === 'rated') && e.getBoundingClientRect().height > 0);
  const last = Math.max(...kids.map(e => e.getBoundingClientRect().bottom));
  const rate = document.getElementById('act-rate').getBoundingClientRect();
  return { cardH: Math.round(c.height * 10) / 10, top: Math.round(c.top), refTop: Math.round(document.getElementById('ref').getBoundingClientRect().top), band: Math.round((c.bottom - last - parseFloat(cs.paddingBottom)) * 10) / 10,
    // rows laid out but invisible before Show (the rating row, and "Edit the text" on a text card): the room Show fills
    reserved: Math.round([...tr.children].filter(e => e.hidden && e.getClientRects().length && getComputedStyle(e).visibility === 'hidden').reduce((a, e) => a + e.getBoundingClientRect().height + (parseFloat(cs.rowGap) || 0), 0)),
    minH: cs.minHeight, rateH: Math.round(rate.height), gap: parseFloat(cs.rowGap) || 0, revealed: tr.classList.contains('revealed'), hscroll: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 };
});
const lum = rgb => { const m = String(rgb).match(/[\d.]+/g); if (!m) return null; const [r, g, b] = m.slice(0, 3).map(Number).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return Math.round(((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)) * 100) / 100; };
try {
  // ── (1) the card's band before and after Show ─────────────────────────────────────────────────────────────────
  console.log('\n## VIS-VERSES-1: sized to content, no jump on Show');
  for (const [device, width, xxl] of want('band') ? [['iphone-pwa', 390], ['ipad-portrait', 820], ['ipad-landscape', 1180], ['desktop', 1440], ['iphone-pwa', 390, 'xxl'], ['ipad-landscape', 1180, 'xxl']] : []) {
    for (const who of ['eli', 'eli+text', 'ezra']) {
      const profile = who.split('+')[0], withText = who.endsWith('+text');
      const tag = who + (xxl ? '/xxl' : '');
      const d = await L.device({ device, profile, installClock: DEMO });
      if (width === 390) await d.page.setViewportSize({ width: 390, height: 844 });
      await d.ctx.route(u => /\/api\/data\/[^/]+\/batch$/.test(u.pathname), r => r.abort('internetdisconnected'));   // nothing is rated on the server
      const f = await open(d);
      if (xxl) { await f.evaluate(() => document.documentElement.setAttribute('data-text-size', 'xxl')); await sleep(300); }
      // a card with text (its own placeholder through the app's editor): after Show it also offers Edit the text
      if (withText && await f.evaluate(() => !verses.textOf(verses.currentId()))) { await f.click('#addtext'); await f.fill('#text-input', PLACEHOLDER); await f.click('#text-save'); await sleep(700); }
      const has = await f.evaluate(() => !document.getElementById('trainer').hidden && !document.getElementById('show').hidden);
      if (!has) { out.band.push({ width, profile: tag, skipped: 'no card to show' }); ok(false, `${tag} @${width}: a card with Show`); await d.close(); continue; }
      const before = await measure(f);
      await d.page.screenshot({ path: path.join(EV, `verses-look-band-${tag.replace("/", "-")}-${width}-before.png`), scale: 'css' });
      await f.click('#show'); await sleep(450);
      const after = await measure(f);
      const row = { width, profile: tag, before, after, jump: Math.round((after.cardH - before.cardH) * 10) / 10 };
      out.band.push(row);
      await d.page.screenshot({ path: path.join(EV, `verses-look-band-${tag.replace("/", "-")}-${width}.png`), scale: 'css' });
      // the page may scroll Show into view for the tap, so the reference is compared inside the card
      ok(Math.abs(row.jump) <= 1 && after.refTop - after.top === before.refTop - before.top, `${tag} @${width}: the card does not move on Show (height ${before.cardH} → ${after.cardH})`, row);
      ok(before.minH === '0px' || before.minH === 'auto', `${tag} @${width}: no fixed min-height`, before.minH);
      ok(after.band <= 1, `${tag} @${width}: no empty band after Show (${after.band} px)`, after);
      // the empty room before Show is only the rows Show fills (the rating row, and "Edit the text" on a text card), which
      // sit under Read aloud and Show since the rescore follow-up
      ok(before.band <= before.reserved + 2, `${tag} @${width}: the empty room before Show (${before.band} px) is only the rows Show fills (${before.reserved} px)`, row);
      ok(!before.hscroll && !after.hscroll, `${tag} @${width}: no horizontal scroll`);
      if (width === 390 && !xxl && !withText) {
        // (rescore follow-up item 6) the rating tiles (and a kid's two buttons) take the concentric inset radius, not --r-lg
        const rad = await f.evaluate(() => { const pr = document.createElement('div'); pr.style.cssText = 'position:absolute;visibility:hidden;width:10px;height:10px;border-radius:var(--r-inset)'; document.querySelector('#trainer').appendChild(pr); const want = getComputedStyle(pr).borderTopLeftRadius; pr.remove();
          const kid = document.documentElement.dataset.kind === 'kid'; const els = [...document.querySelectorAll('#act-rate [data-rate]'), ...(kid ? document.querySelectorAll('#act-show > .btn') : [])].filter(e => e.getClientRects().length);
          return { want, got: els.map(e => getComputedStyle(e).borderTopLeftRadius) }; });
        ok(rad.got.length && rad.got.every(r => r === rad.want), `${tag} @390: the rating tiles${profile === 'ezra' ? ' and the two kid buttons' : ''} use the concentric inset radius (${rad.want})`, rad);
      }
      if (profile === 'ezra' && width === 390 && !xxl) {
        const kid = await f.evaluate(() => [...document.querySelectorAll('#act-rate [data-rate]')].map(b => { const r = b.getBoundingClientRect(), pic = b.querySelector('.pic'); return { rate: b.dataset.rate, w: Math.round(r.width), h: Math.round(r.height), pic: !!pic && getComputedStyle(pic).display !== 'none', ico: !!b.querySelector('.ico') && getComputedStyle(b.querySelector('.ico')).display !== 'none', word: b.querySelector('span').textContent }; }));
        out.kid.buttons = kid;
        ok(kid.length === 3 && kid.every(b => b.h >= 64 && b.w >= 64 && b.pic && !b.ico), 'kid: three picture buttons, each ≥ 64 px, picture shown, adult glyph hidden', kid);
        out.kid.rec = await f.evaluate(() => ({ rec: !document.getElementById('rec').hidden, pm: !document.getElementById('pm').hidden }));
        ok(!out.kid.rec.rec && !out.kid.rec.pm, 'kid: no recorder, no practice modes', out.kid.rec);
      }
      await d.close();
    }
  }

  // ── (1b) the rating result is a line in the card (UX-VERSES-6, no toast over anything) and, rescore follow-up item 1,
  // Show is on the first screen of a small phone on a verse WITH text: after one rating (the result line armed) the next
  // card (John 17:3, text in the seed) at 375×667 and 390×844, in WebKit (no recorder) and in Chromium (the recorder
  // row shown); the card does not move on Show; the two bands of the veiled text card (item 5) are reported in px ───
  console.log('\n## The rating result in the card; Show on the first screen with text (± the recorder); the bands');
  out.toast = [];
  for (const engine of want('toast') ? ['webkit', 'chromium'] : []) {
    const R = engine === 'webkit' ? L : await local({ variant: 'typical', clock: 'demo', engine: 'chromium' });
    try {
      for (const [w, h] of [[375, 667], [390, 844]]) {
        await R.reset('typical');   // each size starts from the seed (the previous size's rating reached the rig's server)
        const d = await R.device({ device: 'iphone-pwa', profile: 'eli', installClock: DEMO });
        await d.page.setViewportSize({ width: w, height: h });
        await d.ctx.route(u => /\/api\/data\/[^/]+\/batch$/.test(u.pathname), r => r.abort('internetdisconnected'));
        const f = await open(d);
        await f.click('#show'); await sleep(300); await f.click('#act-rate [data-rate="almost"]'); await sleep(1300);
        await f.evaluate(() => window.scrollTo(0, 0)); await sleep(250);
        const read = () => f.evaluate(() => {
          const box = e => { if (!e || !e.getClientRects().length || getComputedStyle(e).visibility === 'hidden') return null; const b = e.getBoundingClientRect(); return [Math.round(b.top), Math.round(b.bottom)]; };
          const tr = document.getElementById('trainer'), as = document.getElementById('act-show'), ar = document.getElementById('act-rate'), gap = parseFloat(getComputedStyle(tr).rowGap) || 0;
          const kids = [...tr.children].filter(e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden');
          const above = kids.filter(e => e.getBoundingClientRect().bottom <= as.getBoundingClientRect().top + 0.5 && e !== as);
          const prevBottom = above.length ? Math.max(...above.map(e => e.getBoundingClientRect().bottom)) : as.getBoundingClientRect().top;
          const t = document.getElementById('hub-toast'), rt = document.getElementById('rated-text');
          return { vh: innerHeight, ref: document.getElementById('ref').textContent, text: !document.getElementById('text').hidden, rec: box(document.getElementById('rec')), rated: box(document.getElementById('rated')), ratedText: rt ? rt.textContent : '',
            show: box(document.getElementById('show')), toast: !!(t && !t.hidden), cardH: Math.round(tr.getBoundingClientRect().height * 10) / 10, refInCard: Math.round(document.getElementById('ref').getBoundingClientRect().top - tr.getBoundingClientRect().top),
            bandAbove: Math.round(as.getBoundingClientRect().top - prevBottom - gap), bandBelow: getComputedStyle(ar).visibility === 'hidden' ? Math.round(ar.getBoundingClientRect().height + gap) : 0 };
        });
        const m = await read();
        out.toast.push({ engine, w, h, ...m });
        await d.page.screenshot({ path: path.join(EV, `verses-look-firstscreen-${engine}-${w}x${h}.png`), scale: 'css' });
        ok(!m.toast && !!m.rated && m.ratedText.length > 0, `${engine} @${w}×${h}: the rating result is a line in the card ("${m.ratedText}"), no toast`, m);
        ok(m.text && !!m.show && m.show[0] >= 0 && m.show[1] <= m.vh && (engine === 'chromium' ? !!m.rec : true), `${engine} @${w}×${h}: on ${m.ref} with its text${engine === 'chromium' ? ' and the recorder shown' : ''}, Show is on the first screen (${m.show && m.show.join('-')} of ${m.vh})`, m);
        ok(m.bandAbove <= 1, `${engine} @${w}×${h}: no empty band above Read aloud and Show (${m.bandAbove} px); the one kept band is the rating row's, under them (${m.bandBelow} px)`, m);
        await f.click('#show'); await sleep(500);
        const n = await read();
        ok(Math.abs(n.cardH - m.cardH) <= 1 && n.refInCard === m.refInCard, `${engine} @${w}×${h}: the card does not move on Show (${m.cardH} → ${n.cardH})`, { before: m.cardH, after: n.cardH });
        await d.close();
      }
    } finally { if (R !== L) await R.close(); }
  }

  // ── (1c) review round 1: a kid sees the picture ratings after "I said it"; the toast after a row tap from a scrolled
  // page; the stats heading and labels at phone widths; the Tab order of the practice switch ─────────────────────
  console.log('\n## Review round 1: the kid ratings in view, the toast after a row tap, the stats heading, Tab order');
  if (want('r1')) {
    await L.reset('typical');
    out.r1 = { kid: [], row: [], stats: [] };
    for (const [w, h, size, dev = 'iphone-pwa'] of [[375, 667, ''], [430, 740, '', 'iphone-safari'], [390, 844, ''], [430, 932, ''], [390, 844, 'xl'], [390, 844, 'xxl'], [375, 667, 'xxl']]) {
      const d = await L.device({ device: dev, profile: 'ezra', installClock: DEMO });
      await d.page.setViewportSize({ width: w, height: h });
      await d.ctx.route(u => /\/api\/data\/[^/]+\/batch$/.test(u.pathname), r => r.abort('internetdisconnected'));
      const f = await open(d);
      if (size) { await f.evaluate(s => document.documentElement.setAttribute('data-text-size', s), size); await sleep(300); }
      await f.evaluate(() => window.scrollTo(0, 0)); await sleep(150);
      // round 2: at the default size "Read aloud" and "I said it" each stay on one line inside their buttons, no scroll
      const lbl = await f.evaluate(() => [...document.querySelectorAll('#act-show > .btn')].map(b => { const s = b.querySelector('span'), r = document.createRange(); r.selectNodeContents(s); const br = b.getBoundingClientRect(), sr = s.getBoundingClientRect();
        return { t: s.textContent, lines: new Set([...r.getClientRects()].map(x => Math.round(x.top))).size, inside: sr.left >= br.left - 0.5 && sr.right <= br.right + 0.5, hscroll: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 }; }));
      // round 3: at the default size Read aloud and I said it are fully on screen before any tap, with no scroll
      const fold = await f.evaluate(() => { const r = document.getElementById('act-show').getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), vh: innerHeight, scrollY: Math.round(scrollY) }; });
      if (!size) ok(fold.scrollY === 0 && fold.top >= 0 && fold.bottom <= fold.vh, `kid @${w}×${h} (${dev}): Read aloud and I said it on screen before any scroll (${fold.top}-${fold.bottom} of ${fold.vh})`, fold);
      if (!size) await d.page.screenshot({ path: path.join(EV, `verses-look-kid-before-${w}x${h}.png`), scale: 'css' });
      // (confirmation pass) "I said it" wears Show's eye, the one drawing of that meaning (never Record's microphone)
      if (!size) { const g = await f.evaluate(() => [...document.querySelectorAll('#show svg')].filter(s => getComputedStyle(s).display !== 'none').map(s => s.querySelector('use').getAttribute('href').split('#')[1])); ok(g.length === 1 && g[0] === 'i-eye', `kid @${w}: "I said it" shows Show's eye`, g); }
      if (!size) ok(lbl.length === 2 && lbl.every(x => x.lines === 1 && x.inside && !x.hscroll), `kid @${w}: "Read aloud" and "I said it" each on one line inside their buttons, no horizontal scroll`, lbl);
      // tap "I said it" where it is (a finger scrolls the page to it first, as Playwright does)
      await f.click('#show'); await sleep(1100);
      const m = await f.evaluate(() => { const e = document.getElementById('act-rate'), r = e.getBoundingClientRect(); const probe = document.createElement('div'); probe.style.cssText = 'position:absolute;visibility:hidden;height:var(--sp-4)'; document.body.appendChild(probe); const sp4 = probe.getBoundingClientRect().height; probe.remove();
        return { top: Math.round(r.top), bottom: Math.round(r.bottom), vh: innerHeight, gap: Math.round(innerHeight - r.bottom), sp4: Math.round(sp4), margin: getComputedStyle(e).scrollMarginBottom, shown: !e.hidden }; });
      out.r1.kid.push({ w, h, size, labels: lbl, ...m });
      await d.page.screenshot({ path: path.join(EV, `verses-look-kidfold-${w}x${h}${size ? '-' + size : ''}.png`), scale: 'css' });
      ok(m.shown && m.top >= 0 && m.bottom <= m.vh, `kid @${w}×${h}${size ? ' ' + size : ''}: after "I said it" the three picture ratings are fully on screen (${m.top}-${m.bottom} of ${m.vh})`, m);
      ok(m.gap >= m.sp4 - 1, `kid @${w}×${h}${size ? ' ' + size : ''}: and stop ${m.gap} px above the bottom edge (≥ --sp-4, ${m.sp4} px)`, m);
      await d.close();
    }
    // Elizabeth has nothing due: the heading carries its longest note
    for (const w of [375, 430]) {
      const d = await L.device({ device: 'iphone-pwa', profile: 'mom', installClock: DEMO });
      await d.page.setViewportSize({ width: w, height: 800 });
      const f = await open(d);
      const st = await f.evaluate(() => { const h2 = document.querySelector('#stats h2'); const title = [...h2.childNodes].find(n => n.nodeType === 3 && n.textContent.trim()); const r = document.createRange(); r.selectNodeContents(title);
        return { titleLines: new Set([...r.getClientRects()].map(x => Math.round(x.top))).size, sub: document.getElementById('stats-sub').textContent }; });
      out.r1.stats.push({ w, profile: 'mom', ...st });
      await f.evaluate(() => document.getElementById('stats').scrollIntoView({ block: 'start' })); await sleep(200);
      await d.page.screenshot({ path: path.join(EV, `verses-look-stats-nothing-due-${w}.png`), scale: 'css' });
      ok(st.titleLines === 1, `stats @${w}, nothing due: "Your verses" stays on one line (note: "${st.sub}")`, st);
      await d.close();
    }
    for (const [w, h] of [[375, 667], [390, 844], [430, 932]]) {
      const d = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: DEMO });
      await d.page.setViewportSize({ width: w, height: h });
      await d.ctx.route(u => /\/api\/data\/[^/]+\/batch$/.test(u.pathname), r => r.abort('internetdisconnected'));
      const f = await open(d);
      // the stats heading: the title on one line; "reviewed today" on one line
      const st = await f.evaluate(() => { const h2 = document.querySelector('#stats h2'); const lines = el => { const r = document.createRange(); r.selectNodeContents(el); return new Set([...r.getClientRects()].map(x => Math.round(x.top))).size; };
        const title = [...h2.childNodes].find(n => n.nodeType === 3 && n.textContent.trim()); const r = document.createRange(); r.selectNodeContents(title); const tl = new Set([...r.getClientRects()].map(x => Math.round(x.top))).size;
        return { titleLines: tl, sub: document.getElementById('stats-sub').textContent, today: lines(document.querySelector('#st-today + span')) }; });
      out.r1.stats.push({ w, h, ...st });
      // rounds 3-4: in Due today / Coming up each reference stays on one line (default size), "chapter:verse" and "Week N"
      // never break inside (any size), the chevron sits beside the row's words in its own column (never on a line of its
      // own), and nothing scrolls sideways
      const refs = async () => f.evaluate(() => { const tops = rects => new Set(rects.map(x => Math.round(x.top))).size; const rows = [...document.querySelectorAll('.queue .qrow')];
        const out = rows.map(b => { const rf = b.querySelector('.rf'), body = b.querySelector('.qbody'), chev = b.querySelector(':scope > svg'); const rr = [];
          for (const n of rf.childNodes) { if (n.nodeType === 3 && n.textContent.trim()) { const r = document.createRange(); r.selectNodeContents(n); rr.push(...r.getClientRects()); } else if (n.classList && n.classList.contains('cv')) rr.push(...n.getClientRects()); }
          const br = b.getBoundingClientRect(), qb = body.getBoundingClientRect(), cr = chev.getBoundingClientRect(), pad = parseFloat(getComputedStyle(b).paddingTop) + parseFloat(getComputedStyle(b).paddingBottom);
          return { ref: rf.firstChild.textContent + (rf.querySelector('.cv') ? rf.querySelector('.cv').textContent : ''), refLines: tops(rr), cvBroken: [...b.querySelectorAll('.cv')].some(c => tops([...c.getClientRects()]) > 1),
            overlap: [...b.querySelectorAll('.qbody > .chip, .qbody > .when')].some(e => { const a = e.getBoundingClientRect(); return rr.some(x => x.left < a.right && a.left < x.right && x.top < a.bottom && a.top < x.bottom); }),
            chevBeside: cr.left >= qb.right - 0.5 && cr.top >= br.top - 0.5 && cr.bottom <= br.bottom + 0.5, chevOwnLine: br.height > Math.max(qb.height, cr.height) + pad + 1.5, rowH: Math.round(br.height) }; });
        return { n: out.length, multiLine: out.filter(x => x.refLines > 1).map(x => x.ref), cvBroken: out.filter(x => x.cvBroken).map(x => x.ref), chevBad: out.filter(x => !x.chevBeside || x.chevOwnLine).map(x => x.ref + ' ' + x.rowH), overlapped: out.filter(x => x.overlap).map(x => x.ref), hscroll: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, rowH: [...new Set(out.map(x => x.rowH))] }; });
      const rf0 = await refs();
      out.r1.refs = (out.r1.refs || []).concat([{ w, ...rf0 }]);
      ok(rf0.n > 0 && !rf0.multiLine.length && !rf0.cvBroken.length && !rf0.overlapped.length && !rf0.hscroll, `refs @${w}: all ${rf0.n} references in the lists on one line, none broken inside, no horizontal scroll`, rf0);
      ok(rf0.n > 0 && !rf0.chevBad.length, `refs @${w}: every chevron beside its row's words, none on a line of its own (row heights ${rf0.rowH.join('/')} px)`, rf0);
      // the longest references of the plan, put in a row for the measure (the seed's lists may not hold them)
      const longest = await f.evaluate(() => { const rf = document.querySelector('.queue .rf'); const t = rf.firstChild, cv = rf.querySelector('.cv'); const keep = [t.textContent, cv.textContent]; const out = [];
        for (const [book, c] of [['1 Thessalonians', '5:23-24'], ['2 Corinthians', '4:7-10'], ['Deuteronomy', '31:7-8']]) { t.textContent = book + ' '; cv.textContent = c; const row = rf.closest('.qbody').getBoundingClientRect(), r = rf.getBoundingClientRect(); out.push({ ref: book + ' ' + c, fits: r.right <= row.right + 0.5, hscroll: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 }); }
        t.textContent = keep[0]; cv.textContent = keep[1]; return out; });
      ok(longest.every(x => x.fits && !x.hscroll), `refs @${w}: the longest references fit their row whole`, longest);
      await f.evaluate(() => document.getElementById('queue').scrollIntoView({ block: 'start' })); await sleep(200);
      await d.page.screenshot({ path: path.join(EV, `verses-look-queue-${w}.png`), scale: 'css' });
      // round 4: a long name in the pill keeps "N to go" together
      const pill = await f.evaluate(() => { const b = document.querySelector('#who b'); if (!b) return null; const s = b.parentElement; const keep = s.firstChild.textContent; s.firstChild.textContent = 'Grandma Josephine Annabelle · '; const r = document.createRange(); r.selectNodeContents(b); const lines = new Set([...r.getClientRects()].map(x => Math.round(x.top))).size; const txt = b.textContent; s.firstChild.textContent = keep; return { lines, txt }; });
      ok(pill && pill.lines === 1, `pill @${w}: with a long name "${pill && pill.txt}" stays on one line`, pill);
      if (w === 375) { await f.evaluate(() => { document.documentElement.setAttribute('data-text-size', 'xxl'); document.getElementById('queue').scrollIntoView({ block: 'start' }); }); await sleep(300); const rf1 = await refs(); ok(!rf1.hscroll && !rf1.cvBroken.length && !rf1.chevBad.length && !rf1.overlapped.length, 'refs @375 XXL: no horizontal scroll, "chapter:verse" and "Week N" never broken inside (a break after the book is fine), nothing overlaps a reference, the chevron beside the words', rf1); await d.page.screenshot({ path: path.join(EV, 'verses-look-queue-375-xxl.png'), scale: 'css' }); await f.evaluate(() => document.documentElement.removeAttribute('data-text-size')); await sleep(300); }
      ok(st.titleLines === 1, `stats @${w}: "Your verses" stays on one line (note: "${st.sub}")`, st);
      if (w <= 390) ok(st.today === 1, `stats @${w}: "reviewed today" on one line`, st);
      // a row tapped at the bottom of the page, then a rating: the toast does not cover the next card's kicker or reference
      await f.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await sleep(300);
      const scrolledTo = await f.evaluate(() => Math.round(scrollY));
      const rows = await f.$$('#later-list .qrow');
      if (!rows.length) { ok(false, `row @${w}: a Coming up row to tap`); await d.close(); continue; }
      await rows[rows.length - 1].click(); await sleep(1000);
      await f.click('#show'); await sleep(300); await f.click('#act-rate [data-rate="got"]'); await sleep(1100);
      const t = await f.evaluate(() => { const o = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom && b.height > 0; const t = document.getElementById('hub-toast'); const tr = t && !t.hidden ? t.getBoundingClientRect() : null;
        const cov = tr ? ['kick', 'boxchip', 'ref', 'hint', 'show', 'say'].filter(id => { const e = document.getElementById(id); return e && !e.hidden && getComputedStyle(e).visibility !== 'hidden' && o(tr, e.getBoundingClientRect()); }) : null;
        return { scrollY: Math.round(scrollY), toast: tr && [Math.round(tr.top), Math.round(tr.bottom)], card: Math.round(document.getElementById('trainer').getBoundingClientRect().top), covered: cov }; });
      out.r1.row.push({ w, h, scrolledTo, ...t });
      await d.page.screenshot({ path: path.join(EV, `verses-look-toast-after-row-${w}x${h}.png`), scale: 'css' });
      // (rescore follow-up) the rating result is a line in the card now: no toast at all, and the next card's head is on screen
      const head = await f.evaluate(() => { const k = document.getElementById('kick').getBoundingClientRect(), r = document.getElementById('rated'); return { kickTop: Math.round(k.top), rated: !!r && r.getClientRects().length > 0 }; });
      ok(!t.toast && scrolledTo > 0 && head.kickTop >= 0 && head.rated, `row @${w}×${h}: tapped from ${scrolledTo} px down, no toast, the result line in the card and the next card's kicker on screen (card top ${t.card})`, { ...t, ...head });
      await d.close();
    }
    // (rescore follow-up item 3) the current row's secondary text is >= 4.5:1 on the selection fill in every palette: one
    // device per palette (the palette set before the page loads, as a person's own setting would be)
    { const res = {};
      for (const [t, mode] of [['hearth', 'light'], ['parchment', 'light'], ['frost', 'light'], ['midnight', 'dark'], ['forest', 'dark'], ['graphite', 'dark']]) {
        const d = await L.device({ device: 'iphone-pwa', profile: 'eli', mode, installClock: DEMO, localStorage: { 'hub.theme': t } });
        await d.page.setViewportSize({ width: 390, height: 844 });
        await d.ctx.route(u => /\/api\/data\/[^/]+\/batch$/.test(u.pathname), r => r.abort('internetdisconnected'));   // the palette stays on this device
        const f = await open(d);
        // the person's palette, as Me > Appearance sets it (hub.js would otherwise put the person's saved palette back)
        await f.evaluate(t => hub.setTheme(t), t); await sleep(400);
        res[t] = await f.evaluate(() => {
          const lum = c => { const m = String(c).match(/[\d.]+/g).slice(0, 3).map(Number).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]; };
          const ratio = (a, b) => Math.round(((Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05)) * 100) / 100;
          const li = document.querySelector('.queue li.cur'); if (!li) return { theme: document.documentElement.dataset.theme, none: true };
          const bg = getComputedStyle(li.querySelector('.qrow')).backgroundColor;
          return { theme: document.documentElement.dataset.theme, ratios: [...li.querySelectorAll('.rf, .rf small, .when')].map(e => ratio(getComputedStyle(e).color, bg)) }; });
        await d.close();
      }
      out.r1.curRow = res;
      const all = Object.entries(res);
      ok(all.every(([t, r]) => r.theme === t && r.ratios && r.ratios.every(x => x >= 4.5)), 'the current row: reference, week and day >= 4.5:1 on the selection fill in all six palettes (min ' + Math.min(...all.flatMap(([, r]) => r.ratios || [0])) + ')', res);
    }
  }

  // ── (1d) review round 7: (a) the first rating's result line never moves the next card (its row is kept from the first
  // paint): the reference's and the buttons' place in the card is the same before the first rating and on the next card,
  // at 375 / 390 / 1180, adult and kid; (b) Record is one compact row right under Read aloud / Show (Chromium, where the
  // browser records): close under them, Show on the first screen at 375×667 and 390×844, the focus order follows the
  // screen; after Show the ratings are fully on screen (390×844 without a scroll; 375×667 scrolled into view) ─────────
  console.log('\n## Review round 7: no move on the first rating; the compact recorder');
  if (want('r7')) {
    out.r7 = { first: [], rec: [] };
    for (const engine of ['webkit', 'chromium']) {
      const R = engine === 'webkit' ? L : await local({ variant: 'typical', clock: 'demo', engine: 'chromium' });
      try {
        for (const [w, h, profile, dev] of engine === 'webkit' ? [[375, 667, 'eli'], [390, 844, 'eli'], [1180, 820, 'eli', 'ipad-landscape'], [375, 667, 'ezra'], [390, 844, 'ezra'], [1180, 820, 'ezra', 'ipad-landscape']] : [[375, 667, 'eli'], [390, 844, 'eli']]) {
          await R.reset('typical');
          const d = await R.device({ device: dev || 'iphone-pwa', profile, installClock: DEMO });
          await d.page.setViewportSize({ width: w, height: h });
          await d.ctx.route(u => /\/api\/data\/[^/]+\/batch$/.test(u.pathname), r => r.abort('internetdisconnected'));
          const f = await open(d);
          const place = () => f.evaluate(() => { const tr = document.getElementById('trainer').getBoundingClientRect(), y = id => Math.round(document.getElementById(id).getBoundingClientRect().top - tr.top);
            const rec = document.getElementById('rec'), as = document.getElementById('act-show').getBoundingClientRect();
            const foc = [...document.querySelectorAll('#trainer button')].filter(e => !e.disabled && e.tabIndex >= 0 && e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden').map(e => ({ id: e.id || e.dataset.rate || e.dataset.mode || e.className, y: Math.round(e.getBoundingClientRect().top) }));
            const sh = document.getElementById('show').getBoundingClientRect();
            const at = document.getElementById('addtext'), atr = at.getBoundingClientRect(), gapRow = parseFloat(getComputedStyle(document.getElementById('trainer')).rowGap) || 0;
            const above = [...document.getElementById('trainer').children].filter(e => e !== at && e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden' && e.getBoundingClientRect().bottom <= atr.top + 0.5);
            const addGap = at.hidden ? null : Math.round(atr.top - Math.max(...above.map(e => e.getBoundingClientRect().bottom)) - gapRow);
            return { addGap, ref: y('ref'), kick: y('kick'), kickPad: Math.round(document.getElementById('kick').getBoundingClientRect().top - tr.top - parseFloat(getComputedStyle(document.getElementById('trainer')).paddingTop)), actShow: y('act-show'), ref0: document.getElementById('ref').textContent, rec: rec.hidden ? null : Math.round(rec.getBoundingClientRect().top - as.bottom), show: [Math.round(sh.top), Math.round(sh.bottom)], vh: innerHeight, focus: foc }; });
          await f.evaluate(() => window.scrollTo(0, 0)); await sleep(200);
          const a = await place();
          await f.click('#show'); await sleep(900);
          const rateBox = await f.evaluate(() => { const r = document.getElementById('act-rate').getBoundingClientRect(); return [Math.round(r.top), Math.round(r.bottom), innerHeight, Math.round(scrollY)]; });
          await f.click('#act-rate [data-rate="almost"]'); await sleep(1300);
          // a kid with one verse left this week lands on the done card: "Practise again" brings the card back, line armed
          if (await f.evaluate(() => document.getElementById('trainer').hidden && !document.getElementById('again').hidden)) { await f.click('#again'); await sleep(800); }
          await f.evaluate(() => window.scrollTo(0, 0)); await sleep(200);
          const b = await place();
          out.r7.first.push({ engine, w, h, profile, before: a, after: b, rateBox });
          await d.page.screenshot({ path: path.join(EV, `verses-look-r7-${engine}-${profile}-${w}.png`), scale: 'css' });
          ok(!!b.ref0 && b.ref === a.ref, `${engine} ${profile} @${w}: the first rating's result line moves nothing: the next card's reference is where the first one was (${a.ref} → ${b.ref} px in the card; the buttons follow that card's own content)`, { a, b });
          // (final rescore A) one slot: the kicker keeps its place across the first rating, and there is no empty band above
          // it before any rating (it sits at the card's top, at most centred in the slot)
          ok(b.kick === a.kick && a.kickPad <= 12, `${engine} ${profile} @${w}: the kicker stays where it was (${a.kick} → ${b.kick} px in the card) and starts ${a.kickPad} px under the card's padding, no empty band above it`, { a, b });
          if (profile === 'eli' && w <= 390) {
            ok(a.show[0] >= 0 && a.show[1] <= a.vh && b.show[1] <= b.vh, `${engine} eli @${w}×${h}: Show on the first screen before and after the first rating (${a.show.join('-')}, ${b.show.join('-')} of ${a.vh})`, { a, b });
            ok(rateBox[0] >= 0 && rateBox[1] <= rateBox[2], `${engine} eli @${w}×${h}: after Show the ratings are fully on screen (${rateBox[0]}-${rateBox[1]} of ${rateBox[2]}${rateBox[3] ? ', scrolled ' + rateBox[3] + ' px' : ', no scroll'})`, rateBox);
            if (a.addGap !== null) ok(a.addGap <= 1, `${engine} eli @${w}: before Show "Add the verse text" sits right under the buttons (${a.addGap} px of extra gap; the rating row's room is at the card's foot)`, a);
            if (w === 390) ok(rateBox[3] === 0, `${engine} eli @390×844: the ratings fit without a scroll`, rateBox);
            ok(a.focus.every((x, i) => i === 0 || x.y >= a.focus[i - 1].y - 2), `${engine} eli @${w}: the focus order follows the screen (${a.focus.map(x => x.id).join(', ')})`, a.focus);
            if (engine === 'chromium') { out.r7.rec.push({ w, gap: a.rec }); ok(a.rec !== null && a.rec >= 0 && a.rec <= 12, `chromium eli @${w}: Record sits right under Read aloud / Show (${a.rec} px below)`, a); }
          }
          await d.close();
        }
      } finally { if (R !== L) await R.close(); }
    }
  }

  // ── (1e) review round 7, part 2: at XL / XXL on a phone the mode switch is 2 × 2, every word whole, 44 px targets ──
  console.log('\n## Review round 7b: the mode switch at XL / XXL on a phone');
  if (want('r7')) {
    await L.reset('typical');
    for (const [w, size] of [[375, 'xl'], [375, 'xxl'], [390, 'xl'], [390, 'xxl']]) {
      const d = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: DEMO });
      await d.page.setViewportSize({ width: w, height: 844 });
      await d.ctx.route(u => /\/api\/data\/[^/]+\/batch$/.test(u.pathname), r => r.abort('internetdisconnected'));
      const f = await open(d);
      if (await f.evaluate(() => !verses.textOf(verses.currentId()))) { await f.click('#addtext'); await f.fill('#text-input', PLACEHOLDER); await f.click('#text-save'); await sleep(800); }
      await f.evaluate(s => document.documentElement.setAttribute('data-text-size', s), size); await sleep(400);
      const m = await f.evaluate(() => {
        const bs = [...document.querySelectorAll('#pm-modes button')];
        const words = b => { const out = []; const walk = n => { for (const c of n.childNodes) { if (c.nodeType === 3) { const re = /\S+/g; let x; while ((x = re.exec(c.textContent))) { const r = document.createRange(); r.setStart(c, x.index); r.setEnd(c, x.index + x[0].length); out.push({ w: x[0], lines: new Set([...r.getClientRects()].map(q => Math.round(q.top))).size }); } } else walk(c); } }; walk(b); return out; };
        return { shown: !document.getElementById('pm').hidden, cols: new Set(bs.map(b => Math.round(b.getBoundingClientRect().left))).size, rows: new Set(bs.map(b => Math.round(b.getBoundingClientRect().top))).size,
          small: bs.filter(b => { const r = b.getBoundingClientRect(); return r.width < 44 || r.height < 44; }).map(b => b.textContent), broken: bs.flatMap(words).filter(x => x.lines > 1).map(x => x.w),
          overflow: bs.filter(b => b.scrollWidth > b.clientWidth + 1).map(b => b.textContent), hscroll: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 }; });
      await f.evaluate(() => document.getElementById('pm').scrollIntoView({ block: 'center' })); await sleep(200);
      await d.page.screenshot({ path: path.join(EV, `verses-look-modes-${w}-${size}.png`), scale: 'css' });
      ok(m.shown && m.cols === 2 && m.rows === 2 && !m.small.length && !m.broken.length && !m.overflow.length && !m.hscroll, `modes @${w} ${size}: the switch is 2 × 2, no word broken, every target ≥ 44 px, no horizontal scroll`, m);
      await d.close();
    }
  }

  // ── (1f) final rescore: B) after Show on an iPad in landscape the result line (with Undo) stays on screen and the hub's
  // page never scrolls the frame under its viewer bar (XL text makes the revealed card taller than the screen);
  // D) the four mode labels are one line each, in one row, at 375 / 390 / 430 (default size) ──────────────────────
  console.log('\n## Final rescore: the result line after Show on an iPad landscape; one-line mode labels');
  if (want('final')) {
    out.final = { ipad: [], labels: [] };
    for (const [w, h] of [[1180, 820], [1024, 768]]) {
      await L.reset('typical');
      const d = await L.device({ device: 'ipad-landscape', profile: 'eli', installClock: DEMO });
      await d.page.setViewportSize({ width: w, height: h });
      await d.ctx.route(u => /\/api\/data\/[^/]+\/batch$/.test(u.pathname), r => r.abort('internetdisconnected'));
      const f = await open(d);
      await f.click('#show'); await sleep(300); await f.click('#act-rate [data-rate="almost"]'); await sleep(1300);   // the line is armed now
      // XL text makes the next card taller than the screen once revealed, as a long verse does
      await f.evaluate(() => document.documentElement.setAttribute('data-text-size', 'xl')); await sleep(400);
      await f.evaluate(() => window.scrollTo(0, 0)); await sleep(200);
      // tap Show where it is on the first screen (a JS click: Playwright's own click would scroll first, which a finger need not)
      const showOn = await f.evaluate(() => { const r = document.getElementById('show').getBoundingClientRect(); return !document.getElementById('show').hidden && r.top >= 0 && r.bottom <= innerHeight; });
      if (showOn) { await f.evaluate(() => document.getElementById('show').click()); await sleep(1200); }
      const m = await f.evaluate(() => { const l = document.getElementById('rated'), u = document.getElementById('rated-undo'), lr = l.getBoundingClientRect(), ur = u.getBoundingClientRect();
        return { armed: l.classList.contains('armed') && !l.classList.contains('faded'), line: [Math.round(lr.top), Math.round(lr.bottom)], undo: u.hidden ? null : [Math.round(ur.top), Math.round(ur.bottom)], vh: innerHeight, scrollY: Math.round(scrollY), cardH: Math.round(document.getElementById('trainer').getBoundingClientRect().height) }; });
      const shell = await d.page.evaluate(() => { const fr = document.querySelector('iframe').getBoundingClientRect(); return { scrollY: Math.round(scrollY), frameTop: Math.round(fr.top) }; });
      out.final.ipad.push({ w, h, ...m, shell });
      await d.page.screenshot({ path: path.join(EV, `verses-look-ipad-after-show-${w}x${h}.png`), scale: 'css' });
      ok(showOn && m.armed && m.line[0] >= 0 && (!m.undo || m.undo[0] >= 0) && shell.scrollY === 0, `iPad ${w}×${h}: after Show the result line and its Undo stay on screen (line ${m.line.join('-')}, frame scrolled ${m.scrollY} px of a ${m.cardH} px card; the hub's page not scrolled: ${shell.scrollY})`, { m, shell });
      await d.close();
    }
    for (const w of [375, 390, 430]) {
      await L.reset('typical');
      const d = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: DEMO });
      await d.page.setViewportSize({ width: w, height: 844 });
      await d.ctx.route(u => /\/api\/data\/[^/]+\/batch$/.test(u.pathname), r => r.abort('internetdisconnected'));
      const f = await open(d);
      if (await f.evaluate(() => !verses.textOf(verses.currentId()))) { await f.click('#addtext'); await f.fill('#text-input', PLACEHOLDER); await f.click('#text-save'); await sleep(800); }
      const m = await f.evaluate(() => { const bs = [...document.querySelectorAll('#pm-modes button')]; return { labels: bs.map(b => { const r = document.createRange(); r.selectNodeContents(b); return { t: b.textContent, name: b.getAttribute('aria-label') || b.textContent, lines: new Set([...r.getClientRects()].map(x => Math.round(x.top))).size, h: Math.round(b.getBoundingClientRect().height) }; }), rows: new Set(bs.map(b => Math.round(b.getBoundingClientRect().top))).size }; });
      out.final.labels.push({ w, ...m });
      ok(m.labels.length === 4 && m.rows === 1 && m.labels.every(x => x.lines === 1 && x.h >= 44 && x.name.toLowerCase().includes(x.t.toLowerCase())), `modes @${w}: four one-line labels in one row (${m.labels.map(x => x.t).join(' · ')}), each ≥ 44 px, the visible word part of its name`, m);
      await d.close();
    }
  }

  // ── (2) histogram tint by box, six palettes ─────────────────────────────────────────────────────────────────
  console.log('\n## VIS-VERSES-6: the histogram is tinted by box');
  if (want('hist')) {
    const d = await L.device({ device: 'ipad-portrait', profile: 'eli', installClock: DEMO });
    await d.ctx.route(u => /\/api\/data\/[^/]+\/batch$/.test(u.pathname), r => r.abort('internetdisconnected'));
    const f = await open(d);
    for (const [theme, scheme] of [['hearth', 'light'], ['parchment', 'light'], ['frost', 'light'], ['midnight', 'dark'], ['forest', 'dark'], ['graphite', 'dark']]) {
      const h = await f.evaluate(([t, s]) => {
        const r = document.documentElement; r.setAttribute('data-theme', t); r.setAttribute('data-scheme', s);
        // every box, whether or not it has verses: read the bar rule for box n (a zero box would show the empty stub)
        const card = getComputedStyle(document.getElementById('stats')).backgroundColor;
        const bars = [...document.querySelectorAll('#boxes .bx')].map(bx => { const z = bx.classList.contains('zero'); bx.classList.remove('zero'); const i = bx.querySelector('.col i'), cs = getComputedStyle(i); const o = { bg: cs.backgroundColor, edge: cs.borderTopColor, edgeW: cs.borderTopWidth }; if (z) bx.classList.add('zero'); return o; });
        return { card, bars };
      }, [theme, scheme]);
      const L5 = h.bars.map(b => lum(b.bg));
      const mono = h.bars.length === 5 && L5.every((v, i) => i === 0 || (scheme === 'light' ? v < L5[i - 1] : v > L5[i - 1]));
      const edges = h.bars.map(b => ratio(b.edge, h.card));
      out.histogram[theme] = { scheme, card: h.card, bars: h.bars.map((b, i) => ({ ...b, lum: +L5[i].toFixed(4), edgeContrast: edges[i] })) };
      ok(mono, `${theme}: the five bars run ${scheme === 'light' ? 'lighter → deeper' : 'darker → brighter'} by box`, L5);
      ok(edges.every(e => e >= 3), `${theme}: every bar's edge ≥ 3:1 on the card (min ${Math.min(...edges)})`, edges);
    }
    await f.evaluate(() => { const r = document.documentElement; r.setAttribute('data-theme', 'hearth'); r.setAttribute('data-scheme', 'light'); });
    await f.evaluate(() => document.getElementById('stats').scrollIntoView({ block: 'center' })); await sleep(200);
    await d.page.screenshot({ path: path.join(EV, 'verses-look-histogram-hearth.png'), scale: 'css' });
    // (5) icons: nothing hand-drawn left
    out.icons = await f.evaluate(() => { const svgs = [...document.querySelectorAll('svg')]; return { total: svgs.length, private: svgs.filter(s => !s.querySelector('use')).map(s => s.outerHTML.slice(0, 80)), uses: [...new Set([...document.querySelectorAll('svg use')].map(u => u.getAttribute('href')))] }; });
    ok(out.icons.private.length === 0 && out.icons.uses.every(h => /^\.\.\/icons\/sprite\.svg#i-[a-z0-9-]+$/.test(h)), 'every icon is a sprite <use> (no private drawing)', out.icons);
    // the sprite parses as XML (one stray double hyphen in its comment breaks every symbol) and every glyph Verses names exists
    out.icons.sprite = await f.evaluate(async uses => { const t = await (await fetch('../icons/sprite.svg', { cache: 'no-store' })).text(); const doc = new DOMParser().parseFromString(t, 'image/svg+xml'); const bad = !!doc.querySelector('parsererror'); const ids = new Set([...doc.querySelectorAll('symbol')].map(s => s.id)); return { wellFormed: !bad, missing: uses.map(u => u.split('#')[1]).filter(id => !ids.has(id)), drawn: [...document.querySelectorAll('#trainer svg.sym use, #stats svg use')].filter(u => u.closest('svg').getBoundingClientRect().width > 0).map(u => { const g = u.getBoundingClientRect(); return Math.round(g.width); }) }; }, out.icons.uses);
    ok(out.icons.sprite.wellFormed && !out.icons.sprite.missing.length, 'the sprite parses and has every glyph Verses uses', out.icons.sprite);
    ok(out.icons.sprite.drawn.length > 0 && out.icons.sprite.drawn.every(w => w > 0), 'the glyphs actually draw (each <use> has a box)', out.icons.sprite.drawn);
    await d.close();
  }

  // ── (3) practice modes at 390 px and at XXL text ────────────────────────────────────────────────────────────
  console.log('\n## IMP-VERSES-I3: practice modes');
  if (want('modes')) await L.reset('typical');   // the toast section's ratings reach the rig's server: start from the seed
  for (const size of want('modes') ? ['m', 'xxl'] : []) {
    const d = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: DEMO });
    await d.page.setViewportSize({ width: 390, height: 844 });
    const f = await open(d);
    if (size === 'xxl') await f.evaluate(() => document.documentElement.setAttribute('data-text-size', 'xxl'));
    // give the card a text through the app's own editor (an obvious placeholder, never Scripture), unless it has one
    let hasText = await f.evaluate(() => !!(window.verses && verses.currentId() && verses.textOf(verses.currentId())));
    if (!hasText) {
      await f.click('#addtext'); await f.fill('#text-input', PLACEHOLDER); await f.click('#text-save'); await sleep(700);
      hasText = await f.evaluate(() => !!verses.textOf(verses.currentId()));
    }
    ok(hasText, `${size}: the card has a text to practise with`);
    const res = {};
    for (const mode of ['letters', 'gaps', 'order', 'recall']) {
      await f.click(`#pm-modes [data-mode="${mode}"]`); await sleep(300);
      const m = await f.evaluate(mode => {
        const area = document.getElementById('pm-area'), tr = document.getElementById('trainer');
        const t = [...area.querySelectorAll('button')].map(b => { const r = b.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; });
        return { mode, areaShown: !area.hidden, textShown: getComputedStyle(document.getElementById('text')).display !== 'none', dataPm: tr.getAttribute('data-pm'), pressed: document.querySelector('#pm-modes [aria-pressed="true"]').dataset.mode,
          small: t.filter(x => x.h < 44 || x.w < 44).length, targets: t.length, hscroll: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, cardH: Math.round(tr.getBoundingClientRect().height), stored: hub.get('mode') };
      }, mode);
      res[mode] = m;
      ok(m.pressed === mode && m.stored === mode, `${size}/${mode}: chosen and remembered (row 'mode')`, m);
      ok(!m.hscroll, `${size}/${mode}: no horizontal scroll at 390 px`, m);
      if (mode !== 'recall') { ok(m.areaShown && !m.textShown && m.dataPm === mode, `${size}/${mode}: the mode's surface takes the text's place`, m); ok(m.targets > 0 && m.small === 0, `${size}/${mode}: ${m.targets} targets, none under 44 px`, m); }
      else ok(!m.areaShown && m.textShown && !m.dataPm, `${size}/recall: the card as it always was`, m);
      if (mode === 'letters' || mode === 'gaps') {
        const r = await f.evaluate(() => { const tr = document.getElementById('trainer'), h0 = tr.getBoundingClientRect().height; const b = document.querySelector('#pm-area .pm-w[data-i]'); const w0 = b.getBoundingClientRect().width; const c0 = getComputedStyle(b.querySelector('.rest, .whole')).color; b.click(); const c1 = getComputedStyle(b.querySelector('.rest, .whole')).color; return { h0: Math.round(h0), h1: Math.round(tr.getBoundingClientRect().height), w0: Math.round(w0), w1: Math.round(b.getBoundingClientRect().width), clear0: c0 === 'rgba(0, 0, 0, 0)', shown1: c1 !== 'rgba(0, 0, 0, 0)' }; });
        ok(r.clear0 && r.shown1 && r.h0 === r.h1 && r.w0 === r.w1, `${size}/${mode}: a tapped word shows in place (card and word keep their size)`, r);
        await d.page.screenshot({ path: path.join(EV, `verses-look-mode-${mode}-${size}.png`), scale: 'css' });
      }
      if (mode === 'order') {
        await d.page.screenshot({ path: path.join(EV, `verses-look-mode-order-${size}.png`), scale: 'css' });
        const p = await f.evaluate(() => versesB.practice());
        // a wrong piece first: the first pool piece whose words are not the next piece's
        const wrongK = p.pool.find(k => p.chunks[k] !== p.chunks[0]);
        if (wrongK != null) { await f.click(`#pm-pool [data-k="${wrongK}"]`); await sleep(80); const w = await f.evaluate(() => ({ next: versesB.practice().next, wrong: !!document.querySelector('#pm-pool .pm-chunk.wrong') })); ok(w.next === 0 && w.wrong, `${size}/order: a wrong piece is refused and marked`, w); }
        const hOrder0 = await f.evaluate(() => Math.round(document.getElementById('trainer').getBoundingClientRect().height));
        for (let i = 0; i < p.chunks.length; i++) {
          const k = await f.evaluate(i => { const q = versesB.practice(); const used = [...document.querySelectorAll('#pm-pool .pm-chunk.used')].map(b => +b.dataset.k); return q.pool.find(k => !used.includes(k) && q.chunks[k] === q.chunks[i]); }, i);
          if (k == null) break;
          await f.click(`#pm-pool [data-k="${k}"]`); await sleep(60);
        }
        await sleep(500);
        const end = await f.evaluate(() => ({ revealed: verses.revealedNow(), rate: !document.getElementById('act-rate').hidden, line: document.getElementById('pm-line') && document.getElementById('pm-line').textContent.replace(/\s+/g, ' ').trim() }));
        ok(end.revealed && end.rate, `${size}/order: the last piece reveals the card and the three ratings`, end);
        const hOrder1 = await f.evaluate(() => Math.round(document.getElementById('trainer').getBoundingClientRect().height));
        ok(Math.abs(hOrder1 - hOrder0) <= 1, `${size}/order: the card keeps its height on reveal (${hOrder0} to ${hOrder1})`, { hOrder0, hOrder1 });
        // Tab order is the drawn order: each focusable control on the card is at or below the one before it
        const tab = await f.evaluate(() => [...document.querySelectorAll('#trainer button, #trainer textarea')].filter(e => !e.disabled && e.tabIndex >= 0 && e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden').map(e => ({ id: e.id || e.dataset.mode || e.className, y: Math.round(e.getBoundingClientRect().top) })));
        ok(tab.every((t, i) => i === 0 || t.y >= tab[i - 1].y - 2), `${size}/order: Tab order follows the drawn order`, tab);
        await d.page.screenshot({ path: path.join(EV, `verses-look-mode-order-done-${size}.png`), scale: 'css' });
      }
    }
    out.modes[size] = res;
    // record yourself: offered to an adult where the browser has the recorder
    const rec = await f.evaluate(() => ({ can: versesB.canRecord, shown: !document.getElementById('rec').hidden, note: document.getElementById('rec-note').textContent }));
    out.modes[size].rec = rec;
    ok(rec.shown === rec.can && /Stays on this device/.test(rec.note), `${size}: record yourself ${rec.can ? 'offered' : 'not offered (no recorder here)'}, with its "stays on this device" note`, rec);
    await d.close();
  }
  // ── (6) record yourself, in Chromium (WebKit on Windows has no MediaRecorder): a stand-in microphone (an oscillator
  // stream; the rig has no audio device), record → stop → Play it back; nothing stored; the card changing drops it; a
  // refused microphone is a calm toast ──────────────────────────────────────────────────────────────────────────
  console.log('\n## IMP-VERSES-I1: record yourself (Chromium, stand-in microphone)');
  if (want('rec')) {
    const C = await local({ variant: 'typical', clock: 'demo', engine: 'chromium' });
    try {
      const d = await C.device({ device: 'iphone-pwa', profile: 'eli', installClock: DEMO });
      await d.page.setViewportSize({ width: 390, height: 844 });
      await d.ctx.route(u => /\/api\/data\/[^/]+\/batch$/.test(u.pathname), r => r.abort('internetdisconnected'));
      const f = await open(d);
      const fake = mode => f.evaluate(mode => { navigator.mediaDevices.getUserMedia = mode === 'refuse' ? async () => { throw new DOMException('denied', 'NotAllowedError'); } : async () => { const ac = new AudioContext(); const o = ac.createOscillator(); const dst = ac.createMediaStreamDestination(); o.connect(dst); o.start(); window.__fakeTracks = dst.stream.getTracks(); return dst.stream; }; }, mode);
      const st = () => f.evaluate(() => ({ shown: !document.getElementById('rec').hidden, btn: document.querySelector('#rec-btn span').textContent, play: !document.getElementById('rec-play').hidden, rec: versesB.recording(), ls: Object.keys(localStorage).filter(k => /rec|audio|blob/i.test(k)), live: (window.__fakeTracks || []).filter(t => t.readyState === 'live').length }));
      const s0 = await st();
      ok(s0.shown, 'Chromium: record yourself is offered to an adult', s0);
      // the card with the recorder row shown, top to bottom (390 px)
      out.recLayout = await f.evaluate(() => [...document.getElementById('trainer').children].filter(e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden').map(e => ({ el: e.id || e.className, top: Math.round(e.getBoundingClientRect().top), h: Math.round(e.getBoundingClientRect().height) })));
      console.log('  card rows (Chromium, 390):', out.recLayout.map(r => r.el + ' ' + r.top + '+' + r.h).join(' · '));
      await d.page.screenshot({ path: path.join(EV, 'verses-look-record-layout-390.png'), scale: 'css' });
      await fake('ok');
      await f.click('#rec-btn'); await sleep(900);
      const s1 = await st();
      ok(s1.rec.state === 'recording' && /Stop/.test(s1.btn), 'recording: the button says Stop', s1);
      await f.click('#rec-btn'); await sleep(500);
      const s2 = await st();
      ok(s2.rec.state === 'inactive' && s2.rec.hasUrl && s2.play && s2.live === 0, 'stopped: Play it back appears, the microphone is released', s2);
      ok(!s2.ls.length, 'nothing about the recording is written to storage', s2.ls);
      const sent = []; d.page.on('request', r => { if (/blob|audio|media/i.test(r.url()) && r.method() !== 'GET') sent.push(r.url()); });
      await f.click('#rec-play'); await sleep(400);
      const s3 = await f.evaluate(() => document.querySelector('#rec-play span').textContent);
      ok(/Stop/.test(s3), 'Play it back plays (its button says Stop while playing)', s3);
      await d.page.screenshot({ path: path.join(EV, 'verses-look-record-chromium.png'), scale: 'css' });
      // the card changes (Show, then a rating): the recording is gone
      await f.click('#show'); await sleep(300); await f.click('#act-rate [data-rate="almost"]'); await sleep(1200);
      const s4 = await st();
      ok(!s4.rec.hasUrl && !s4.play && s4.rec.state === 'none', 'the next card: the recording is dropped', s4);
      ok(!sent.length, 'no upload of any recording', sent);
      await fake('refuse');
      await f.click('#rec-btn'); await sleep(500);
      const toast = await f.evaluate(() => { const t = document.getElementById('hub-toast'); return t && !t.hidden ? t.textContent : null; });
      ok(/microphone/i.test(toast || ''), 'a refused microphone gives a calm toast', toast);
      out.record = { s0, s1, s2, s4, toast };
      const k = await C.device({ device: 'iphone-pwa', profile: 'ezra', installClock: DEMO });
      const fk = await open(k);
      const kr = await fk.evaluate(() => ({ rec: !document.getElementById('rec').hidden, can: versesB.canRecord }));
      ok(kr.can && !kr.rec, 'a kid never gets the recorder (even where the browser has one)', kr);
    } finally { await C.close(); }
  }
} finally {
  fs.writeFileSync(path.join(EV, 'verses-look-5.json'), JSON.stringify(out, null, 1));
  await L.close();
  console.log(`\nverses-look-5: ${pass} passed, ${fail} failed`);
  process.exitCode = fail ? 1 : 0;
}
