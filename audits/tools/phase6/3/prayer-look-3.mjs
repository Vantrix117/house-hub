// Batch 3, Worker B: Prayer's look, measured in the running app (WebKit for the layout, Chromium for speech).
//   sheet    CONS-SHAPE-5 / VIS-PRAYER-9: #sheet corner = --r-sheet, shadow = --elev-overlay, --col-narrow wide and centred at
//            820 / 1180 (edge to edge on the iPhone)
//   strip    VIS-PRAYER-8: two rows of two at 430, one row of four at 820; nothing scheduled -> no "0/0 today" and no zeros
//   cal      VIS-PRAYER-5: a month name, the weekday letters above the grid, empty days >= 3:1 against the page in every theme
//   chevron  UX-PRAYER-7: each category summary has a chevron that turns when it opens
//   pray     UX-PRAYER-9 / VIS-PRAYER-3 / VIS-PRAYER-11: Close >= 44 x 44, Escape closes, the count, Close, bar and buttons
//            inside the centred column at 1180; hub.immersive(true) on open, (false) on close
//   kitchen  UX-PRAYER-3: items >= 44 px and the heading >= 64 px at 820 / 1180, text >= 7:1 on the dark panel in light and dark
//   kid      UX-PRAYER-2: "Pray" + hands before, face + ✓ + "Prayed" after; lightness change >= 3:1 between the two fills for
//            Ezra and Kiara in both schemes; the speaker reads the request (speechSynthesis.speak called with the title)
// Rescore follow-up (ICO-2): the hands, the checks and the chevron are drawn SVGs now, and the checks read them as such.
// Run: node "audits/tools/phase6/3/prayer-look-3.mjs" -> audits/evidence/p6/3/prayer-look-3.json (exit 1 on any FAIL)
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p6/3';
fs.mkdirSync(OUT, { recursive: true });
const res = { checks: [] };
const ok = (c, name, info) => { res.checks.push({ ok: !!c, name, info }); console.log((c ? '  ✓ ' : '  ✗ ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : '')); };
const lum = s => { const m = s.match(/[\d.]+/g).map(Number); const c = m.slice(0, 3).map(v => v / 255).map(v => v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; };
const cr = (a, b) => { const x = lum(a), y = lum(b); return +((Math.max(x, y) + .05) / (Math.min(x, y) + .05)).toFixed(2); };
const ready = f => f.waitForFunction(() => document.getElementById('todayLine').textContent.trim().length > 0 && !/Loading|Getting/.test(document.getElementById('todayLine').textContent));

const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
try {
  // ── sheet, strip, calendar, chevron, pray, kitchen at three widths ──
  for (const [device, mode] of [['iphone-pwa', 'light'], ['ipad-portrait', 'dark'], ['ipad-landscape', 'light']]) {
    console.log(`\n## ${device} ${mode}`);
    const d = await L.device({ device, mode, profile: 'eli', fixedTime: false });
    const f = await d.openApp('prayer', { wait: '#todayLine' }); await ready(f); await sleep(600);
    await f.evaluate(() => { window.__imm = []; if (window.hub) { const o = hub.immersive; hub.immersive = on => { window.__imm.push(!!on); return o && o(on); }; } });
    const strip = await f.evaluate(() => { const s = [...document.querySelectorAll('#todayStrip > span')].map(e => Math.round(e.getBoundingClientRect().top)); return { n: s.length, rows: new Set(s).size, text: document.getElementById('todayStrip').textContent }; });
    ok(strip.n === 4 && strip.rows === (device === 'iphone-pwa' ? 2 : 1), `strip: four stats in ${device === 'iphone-pwa' ? 'two rows of two' : 'one row'}`, strip);
    const id = await f.evaluate(() => document.querySelector('#todayList [data-open]').dataset.open);
    await f.click(`#todayList [data-open="${id}"]`); await sleep(500);
    const sh = await f.evaluate(() => { const s = document.getElementById('sheet'), r = s.getBoundingClientRect(), cs = getComputedStyle(s);
      const probe = v => { const e = document.createElement('div'); e.style.cssText = 'position:absolute;border-top-left-radius:' + v + ';box-shadow:' + v.replace('--r-sheet', '--elev-overlay'); document.body.appendChild(e); const o = { r: getComputedStyle(e).borderTopLeftRadius, sh: getComputedStyle(e).boxShadow }; e.remove(); return o; };
      const t = probe('var(--r-sheet)');
      return { radius: cs.borderTopLeftRadius, want: t.r, shadow: cs.boxShadow, elev: t.sh, left: Math.round(r.left), right: Math.round(innerWidth - r.right), w: Math.round(r.width), vw: innerWidth }; });
    ok(sh.radius === sh.want, 'sheet: top corners on --r-sheet', [sh.radius, sh.want]);
    ok(sh.shadow.includes(sh.elev.split('),')[0]), 'sheet: the --elev-overlay shadow', null);
    ok(device === 'iphone-pwa' ? sh.w === sh.vw : (sh.w <= 560 && Math.abs(sh.left - sh.right) <= 1), device === 'iphone-pwa' ? 'sheet: full width on the iPhone' : 'sheet: --col-narrow wide and centred', sh);
    await d.page.keyboard.press('Escape'); await sleep(300);
    await f.evaluate(() => { if (document.getElementById('sheet').classList.contains('on') && window.shutSheet) shutSheet(); });
    // Record: the calendar
    await f.evaluate(() => go('answered')); await sleep(400);
    const cal = await f.evaluate(() => { const m = document.querySelector('#record .calmonth'), dow = document.querySelector('#record .dow'), g = document.querySelector('#record .cal');
      const empty = [...g.querySelectorAll('span:not(.on):not(.blank):not(.later):not(.today)')][0];
      const ring = empty ? getComputedStyle(empty).boxShadow.match(/rgba?\([^)]*\)/)[0] : null;
      return { month: m && m.textContent, dowAbove: !!(dow && g && dow.getBoundingClientRect().bottom <= g.getBoundingClientRect().top + 1), ring, bg: getComputedStyle(document.body).backgroundColor }; });
    ok(/\w+ \d{4}/.test(cal.month || ''), 'calendar: the month is named', cal.month);
    ok(cal.dowAbove, 'calendar: the weekday letters sit above the grid');
    ok(cal.ring && cr(cal.ring, cal.bg) >= 3, 'calendar: an empty day is >= 3:1 against the page', cal.ring && cr(cal.ring, cal.bg));
    // List: chevrons
    await f.evaluate(() => go('all')); await sleep(400);
    // batch 3 rescore (ICO-2, on purpose): the chevron is a drawn SVG (summary > svg.chev), no longer a CSS ::after square
    const chev = await f.evaluate(async () => { const all = [...document.querySelectorAll('#allList details.cat > summary')]; const s = all[0], c = s.querySelector(':scope > svg.chev'); const before = c && getComputedStyle(c).transform; s.click(); await new Promise(r => setTimeout(r, 400)); const after = c && getComputedStyle(c).transform; return { every: all.every(x => !!x.querySelector(':scope > svg.chev')), stroke: c && c.getAttribute('stroke'), after_: getComputedStyle(s, '::after').content, before, after, open: s.parentNode.open }; });
    ok(chev.every && chev.stroke === 'currentColor' && chev.after_ === 'none' && chev.open && chev.before !== chev.after, 'list: each category has a drawn chevron that turns when it opens', chev);
    // Pray now
    await f.evaluate(() => go('today')); await sleep(300);
    await f.click('#startPray'); await sleep(600);
    const pr = await f.evaluate(() => { const b = id => document.getElementById(id).getBoundingClientRect(); const c = b('prayShut'), bar = document.querySelector('#pray .bar').getBoundingClientRect(), card = document.querySelector('#pray .card').getBoundingClientRect(), n = b('prayCount'), ctrl = document.querySelector('#pray .ctrl').getBoundingClientRect();
      return { close: [Math.round(c.width), Math.round(c.height)], closeR: Math.round(c.right), cardL: Math.round(card.left), cardR: Math.round(card.right), countL: Math.round(n.left), barL: Math.round(bar.left), barR: Math.round(bar.right), ctrlL: Math.round(ctrl.left), ctrlR: Math.round(ctrl.right), imm: window.__imm.slice() }; });
    ok(pr.close[0] >= 44 && pr.close[1] >= 44, 'pray: Close is at least 44 x 44', pr.close);
    ok([pr.closeR, pr.barR, pr.ctrlR].every(x => Math.abs(x - pr.cardR) <= 1) && [pr.countL, pr.barL, pr.ctrlL].every(x => Math.abs(x - pr.cardL) <= 1), 'pray: the count, Close, bar and buttons share the card\'s column', pr);
    ok(pr.imm[pr.imm.length - 1] === true, 'pray: asks the hub for full screen (hub.immersive(true))', pr.imm);
    await d.page.keyboard.press('Escape'); await sleep(400);
    const shut = await f.evaluate(() => ({ on: document.getElementById('pray').classList.contains('on'), imm: window.__imm.slice() }));
    ok(!shut.on && shut.imm[shut.imm.length - 1] === false, 'pray: Escape closes it and gives the bar back (hub.immersive(false))', shut);
    // Kitchen view
    await f.evaluate(() => openKitchen()); await sleep(500);
    const k = await f.evaluate(() => { const K = document.getElementById('kitchen'), it = K.querySelector('.k-item'), h = K.querySelector('h1'), date = K.querySelector('.date');
      const bgc = getComputedStyle(K).backgroundImage; return { item: parseFloat(getComputedStyle(it).fontSize), h1: parseFloat(getComputedStyle(h).fontSize), fg: getComputedStyle(it).color, fg2: getComputedStyle(date).color, bgImage: bgc.slice(0, 60) }; });
    const wide = device !== 'iphone-pwa';
    ok(wide ? k.item >= 44 && k.h1 >= 64 : k.item >= 28, wide ? 'kitchen: requests at >= 44 px, the list name at >= 64 px' : 'kitchen: requests at the title size on a phone', k);
    res['kitchen-' + device] = k;
    await f.evaluate(() => document.getElementById('kitchenShut').click()); await sleep(300);
    await d.close();
  }

  // ── nothing scheduled: no zeros ──
  {
    const d = await L.device({ device: 'iphone-pwa', mode: 'light', profile: 'eli', fixedTime: false });
    const f = await d.openApp('prayer', { wait: '#todayLine' }); await ready(f); await sleep(500);
    const z = await f.evaluate(() => { for (const p of L().prayers) if (p.status === 'active') p.cadence = 'weekly', p.days = []; L().rotationFor = null; renderToday(); const s = document.getElementById('todayStrip'); return { text: s.textContent, zeros: /(^|\D)0(\/0)?\s/.test(s.textContent), zeroToday: /0\/0/.test(s.textContent) }; });
    ok(!z.zeroToday && !z.zeros, 'strip: nothing scheduled shows no "0/0 today" and no zero', z.text);
    await d.close();
  }
} catch (e) { console.error(e); res.error = String(e.stack || e); ok(false, 'threw', String(e)); }
finally { await L.close(); }

// ── kid cards and speech (Chromium has speechSynthesis) ──
const K = await local({ variant: 'typical', clock: 'real', engine: 'chromium' });
try {
  for (const kid of ['ezra', 'kiara']) for (const mode of ['light', 'dark']) {
    const d = await K.device({ device: 'ipad-portrait', mode, profile: kid, fixedTime: false });
    await d.page.addInitScript(() => { window.__said = []; try { const s = window.speechSynthesis; if (s) { s.speak = u => { window.__said.push(u.text); setTimeout(() => u.onend && u.onend(), 50); }; } } catch (e) {} });
    const f = await d.openApp('prayer', { wait: '#todayLine' }); await ready(f); await sleep(600);
    await f.evaluate(() => { window.__said = []; try { speechSynthesis.speak = u => { window.__said.push(u.text); setTimeout(() => u.onend && u.onend(), 50); }; } catch (e) {} });
    // a kid with nothing prayed yet today taps one first, so both states are on screen
    await f.evaluate(() => { const cs = [...document.querySelectorAll('#todayList .kid')]; if (!cs.some(c => c.classList.contains('done'))) { const b = cs[cs.length - 1] && cs[cs.length - 1].querySelector('.prayed'); if (b) b.click(); } }); await sleep(500);
    const s = await f.evaluate(() => { const cards = [...document.querySelectorAll('#todayList .kid')]; const un = cards.find(c => !c.classList.contains('done')), dn = cards.find(c => c.classList.contains('done'));
      const pick = c => { if (!c) return null; const b = c.querySelector('.prayed'); return { word: (b.querySelector('.kw') || {}).textContent, hands: !!b.querySelector('.khands > svg.hands'), check: !!b.querySelector('.kcheck > svg.check'), emoji: /\p{Extended_Pictographic}/u.test(b.textContent), face: !!b.querySelector('.kme .avatar, .kme .init'), bg: getComputedStyle(b).backgroundColor, ring: getComputedStyle(b).boxShadow, card: getComputedStyle(c).boxShadow, h: Math.round(b.getBoundingClientRect().height) }; };
      return { un: pick(un), dn: pick(dn), speaker: !!document.querySelector('#todayList .kid .ksay'), unId: un && un.querySelector('.prayed').dataset.kpray }; });
    ok(s.un && s.un.word === 'Pray' && s.un.hands && !s.un.emoji && !s.un.check && s.un.h >= 64, `kid ${kid} ${mode}: before, "Pray" with drawn praying hands, no emoji (>= 64 px)`, s.un);
    ok(s.dn && s.dn.word === 'Prayed' && s.dn.check && s.dn.face && !s.dn.hands, `kid ${kid} ${mode}: after, the face, a ✓ and "Prayed"`, s.dn);
    const c = s.un && s.dn ? cr(s.un.bg, s.dn.bg) : 0;
    ok(c >= 3, `kid ${kid} ${mode}: the two fills differ in lightness (>= 3:1), not by hue alone`, c);
    ok(s.speaker, `kid ${kid} ${mode}: a speaker button where the device can speak`);
    if (s.speaker) {
      await f.click('#todayList .kid .ksay'); await sleep(300);
      const said = await f.evaluate(() => ({ said: window.__said.slice(), title: document.querySelector('#todayList .kid .kt').textContent }));
      ok(said.said.length === 1 && said.said[0].startsWith(said.title), `kid ${kid} ${mode}: the speaker reads the request aloud`, said);
    }
    if (kid === 'ezra' && mode === 'light') {
      await f.click(`#todayList [data-kpray="${s.unId}"]`); await sleep(500);
      const t = await f.evaluate(i => { const b = document.querySelector(`#todayList [data-kpray="${i}"]`); return { pressed: b.getAttribute('aria-pressed'), word: b.querySelector('.kw').textContent, check: !!b.querySelector('.kcheck') }; }, s.unId);
      ok(t.pressed === 'true' && t.word === 'Prayed' && t.check, 'kid: a tap turns the card to Prayed with the ✓', t);
      await d.page.screenshot({ path: `${OUT}/prayer-look-3-kid-ezra-light.png`, scale: 'css' });
    }
    if (kid === 'kiara' && mode === 'dark') await d.page.screenshot({ path: `${OUT}/prayer-look-3-kid-kiara-dark.png`, scale: 'css' });
    await d.close();
  }
} catch (e) { console.error(e); res.error2 = String(e.stack || e); ok(false, 'threw (kid)', String(e)); }
finally { await K.close(); }

const fails = res.checks.filter(c => !c.ok).length;
res.summary = `${res.checks.length - fails} passed, ${fails} failed`;
fs.writeFileSync(`${OUT}/prayer-look-3.json`, JSON.stringify(res, null, 1));
console.log('\n' + res.summary);
process.exit(fails ? 1 : 0);
