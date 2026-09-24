// F260 — layout and visual measurements from the DOM (WebKit, light): type scale vs iOS Dynamic Type, tap targets,
// the heatmap "today" cell, where the weeks pane opens on wide screens, Undo placement at 1440, Large text on a 430 px
// phone, "Practice again" chips (overflow), iPad text sizes for glanceability, the per-profile accent, the loading screen.
//   node "audits/tools/phase3/f260/layout.mjs"
import { local, sleep, DEMO, save, shot, texts, ready } from './_lib.mjs';
import { install, DT, nearestDT } from '../../phase2/VIS/lib-vis.mjs';

const out = { devices: {} };
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const noWrites = async d => d.ctx.route(u => u.href.startsWith(L.api + '/api/') && !u.href.startsWith(L.api + '/api/media/'), r => r.request().method() === 'GET' ? r.fallback() : r.abort());
try {
  for (const dev of ['iphone-pwa', 'ipad-portrait', 'ipad-landscape', 'desktop']) {
    const d = await L.device({ device: dev, profile: 'eli', installClock: DEMO });
    await noWrites(d);
    const f = await d.openApp('f260'); await ready(f);
    await install(f);
    const m = await f.evaluate(() => {
      const r = e => { if (!e) return null; const b = e.getBoundingClientRect(); return { x: Math.round(b.left), y: Math.round(b.top + scrollY), w: Math.round(b.width), h: Math.round(b.height) }; };
      const cells = [...document.querySelectorAll('#heat span')];
      const t = document.querySelector('#heat span.today'), other = cells.find(c => !c.classList.contains('today'));
      const tc = getComputedStyle(t);
      const wk = document.querySelector('.week.current');
      const texts = __vis.texts().map(({ el, ...x }) => x);
      const size = {}; for (const x of texts) { const k = x.fs + (x.fw >= 600 ? 'b' : ''); size[k] = (size[k] || 0) + 1; }
      const small = __vis.targets().filter(t => t.w < 44 || t.h < 44);
      const cls = s => { const e = document.querySelector(s); if (!e) return null; const c = getComputedStyle(e); return { fs: parseFloat(c.fontSize), fw: c.fontWeight, ff: c.fontFamily.split(',')[0], ls: c.letterSpacing, color: c.color }; };
      return {
        viewport: [innerWidth, innerHeight], docH: document.documentElement.scrollHeight,
        heat: { today: Object.assign(r(t), { display: tc.display, gridColumn: tc.gridColumnStart + '/' + tc.gridColumnEnd, border: tc.borderTopWidth + ' ' + tc.borderTopStyle, padding: tc.paddingTop + ' ' + tc.paddingLeft, bg: tc.backgroundImage.slice(0, 60) }), otherCell: r(other), heatBox: r(document.getElementById('heat')) },
        weeks: { scrollY: Math.round(scrollY), currentWeekY: r(wk).y, currentWeekInView: r(wk).y < scrollY + innerHeight, firstWeekY: r(document.getElementById('week-1')).y, sideScrollTop: Math.round(document.querySelector('.side').scrollTop) },
        type: { h1: cls('h1'), sub: cls('.sub'), todayKick: cls('#todayKind'), todayTitle: cls('#todayTitle'), todayMeta: cls('#todayMeta'), done: cls('#todayDone'), streak: cls('#todayStreak b'), streakSub: cls('#todayStreak span'), ringN: cls('#todayRingN'), ringSmall: cls('#todayRing small'), stripNum: cls('.strip b'), strip: cls('.strip'), ylbl: cls('.ylbl'), hlbl: cls('.hlbl'), heroTitle: cls('#heroTitle'), weekNum: cls('.wk-head .num'), weekSpan: cls('.wk-head .span'), dayRefs: cls('.week.current .refs'), dayLbl: cls('.week.current .day .lbl'), ringWeekNum: cls('.ring .rn'), mileName: cls('.mile .mn'), mileDate: cls('.mile .md'), btn: cls('.btn'), foot: cls('.foot'), body: cls('body') },
        sizesHistogram: size, textItems: texts.length,
        smallTargets: small.length, smallTargetKinds: Object.entries(small.reduce((a, t) => { const k = t.sel.split(' > ').pop().replace(/#[\w-]+/, '').replace(/\[.*$/, '') + ' ' + t.w + 'x' + t.h; a[k] = (a[k] || 0) + 1; return a; }, {})).sort((a, b) => b[1] - a[1]).slice(0, 14),
        accent: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(), doneBg: getComputedStyle(document.getElementById('todayDone')).backgroundColor,
      };
    });
    out.devices[dev] = m;
    await f.evaluate(() => { const t = document.querySelector('#heat span.today'); t.scrollIntoView({ block: 'center' }); }); await sleep(250);
    await shot(d.page, `layout-heat-today-${dev}.png`);
    if (dev === 'desktop' || dev === 'ipad-landscape') {
      // after Done: Undo next to Done?
      await f.evaluate(() => window.scrollTo(0, 0)); await sleep(150);
      await f.locator('#todayDone').click(); await sleep(800);
      out.devices[dev].undo = await f.evaluate(() => { const a = document.getElementById('todayDone').getBoundingClientRect(), b = document.getElementById('todayUndo').getBoundingClientRect(); return { doneY: Math.round(a.top), doneX: Math.round(a.left), undoY: Math.round(b.top), undoX: Math.round(b.left), sameRow: Math.abs(a.top - b.top) < 10 }; });
      await shot(d.page, `layout-undo-${dev}.png`);
    }
    if (dev === 'iphone-pwa') {
      // Large text (zoom 1.15): the Today meta line
      const meta0 = await f.evaluate(() => { const e = document.getElementById('todayMeta'); return { h: Math.round(e.getBoundingClientRect().height), lh: parseFloat(getComputedStyle(e).lineHeight) }; });
      await f.evaluate(() => document.body.classList.add('big')); await sleep(300);
      const meta1 = await f.evaluate(() => { const e = document.getElementById('todayMeta'); return { h: Math.round(e.getBoundingClientRect().height), lh: parseFloat(getComputedStyle(e).lineHeight), text: e.textContent }; });
      out.devices[dev].largeText = { normal: meta0, large: meta1, linesNormal: Math.round(meta0.h / meta0.lh), linesLarge: Math.round(meta1.h / meta1.lh) };
      await f.evaluate(() => window.scrollTo(0, 0)); await sleep(150);
      await shot(d.page, 'layout-large-text-iphone.png');
      await f.evaluate(() => document.body.classList.remove('big'));
    }
    if (dev === 'ipad-portrait') {
      // glanceability: rendered size of the key strings in mm on an 11-inch iPad (1 CSS px ≈ 0.192 mm); cap height ≈ 0.7 em
      const mm = px => +(px * 0.192).toFixed(1);
      const t = m.type;
      out.devices[dev].glance = Object.fromEntries(['todayTitle', 'done', 'streak', 'todayMeta', 'ringN', 'h1'].map(k => [k, { fontPx: t[k].fs, capHeightMm: mm(t[k].fs * 0.7), legibleUpToM: +((t[k].fs * 0.7 * 0.192) * 200 / 1000).toFixed(2) }]));
    }
    await d.close();
  }
  // Practice-again chips (overflow household)
  await L.reset('overflow');
  {
    const d = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: DEMO });
    await noWrites(d);
    const f = await d.openApp('f260'); await ready(f);
    out.chips = await f.evaluate(() => { const row = document.querySelector('.week.current .recallrow'); if (!row) return null; const b = [...row.querySelectorAll('button')]; const d1 = document.querySelector('.week.current .day'); const wk = document.querySelector('.week.current'); return { chips: b.length, h: b.map(x => Math.round(x.getBoundingClientRect().height)).filter((v, i, a) => a.indexOf(v) === i), rowH: Math.round(row.getBoundingClientRect().height), weekOpen: wk.classList.contains('open'), day1BelowRowPx: Math.round(d1.getBoundingClientRect().top - row.getBoundingClientRect().top) }; });
    await f.evaluate(() => { const r = document.querySelector('.week.current .recallrow'); if (r) r.scrollIntoView({ block: 'start' }); }); await sleep(250);
    await shot(d.page, 'layout-practice-chips-overflow-iphone.png');
    await d.close();
  }
  // Accent: two profiles on the same device class
  await L.reset('typical');
  out.accent = {};
  for (const pid of ['eli', 'christian', 'mom']) {
    const d = await L.device({ device: 'iphone-pwa', profile: pid, installClock: DEMO });
    await noWrites(d);
    const f = await d.openApp('f260'); await ready(f);
    out.accent[pid] = await f.evaluate(() => ({ accent: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(), doneBg: getComputedStyle(document.getElementById('todayDone')).backgroundColor, switchBg: getComputedStyle(document.querySelector('.switch')).backgroundImage.includes('color-mix') || getComputedStyle(document.querySelector('.switch')).backgroundImage.slice(0, 80), ringStroke: getComputedStyle(document.querySelector('#todayRing .fg')).stroke, kickColor: getComputedStyle(document.getElementById('todayKind')).color }));
    await d.close();
  }
  // Loading: the static page before hub.ready (first data pull held for 5 s on a cold device)
  {
    const d = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: DEMO });
    await d.ctx.route(u => u.href.startsWith(L.api + '/api/data/'), async r => { await sleep(5000); r.fallback(); });
    await d.goto('#f260');
    let f; for (let i = 0; i < 100 && !f; i++) { f = d.frame('f260'); if (!f) await sleep(100); }
    await f.waitForSelector('#todayDone'); await sleep(1200);
    out.loading = await f.evaluate(() => ({ title: document.getElementById('todayTitle').textContent, doneText: document.getElementById('todayDone').textContent, ariaDisabled: document.getElementById('todayDone').getAttribute('aria-disabled'), strip: document.querySelector('.strip').innerText.replace(/\s+/g, ' ') }));
    await f.locator('#todayDone').tap({ timeout: 2000 }).catch(() => {}); await sleep(300);
    out.loading.afterTapToast = await f.evaluate(() => document.getElementById('toasts').textContent);
    await shot(d.page, 'layout-loading-iphone.png');
    await d.close();
  }
} finally { await L.close(); }
for (const [dev, m] of Object.entries(out.devices)) {
  console.log(dev, 'heat today', JSON.stringify(m.heat.today), 'other', JSON.stringify(m.heat.otherCell));
  console.log('   weeks', JSON.stringify(m.weeks), 'small targets', m.smallTargets, JSON.stringify(m.smallTargetKinds));
  console.log('   type', JSON.stringify(Object.fromEntries(Object.entries(m.type).map(([k, v]) => [k, v && v.fs + (v.fw >= 600 ? 'b' : '')]))));
  if (m.undo) console.log('   undo', JSON.stringify(m.undo));
  if (m.largeText) console.log('   large text', JSON.stringify(m.largeText));
  if (m.glance) console.log('   glance', JSON.stringify(m.glance));
}
console.log('chips', JSON.stringify(out.chips));
console.log('accent', JSON.stringify(out.accent));
console.log('loading', JSON.stringify(out.loading));
console.log('evidence →', save('layout.json', out));
