// KV: visual measurements of Kid Verse opened standalone (apps/kidverse.html) after sign-in, typical variant.
//   node "audits/tools/phase3/kidverse/visual.mjs"      (about 3 min)
// T  type: computed size/weight/family of every text role, kid (Ezra) and adult (Eli), iPhone 430 and iPad 820; nearest
//    iOS Dynamic Type step; anything under 11 px.
// C  contrast: rendered contrast of every visible text item, top to bottom, in all five palettes (Hearth, Parchment, Frost,
//    Midnight, Forest), kid and adult, iPhone 430 (lib-vis contrastSweep; text hidden, background sampled).
// A  accent: --accent, --accent-deep, --gold and the painted colour of Done ★ / I heard it for Ezra and Kiara.
// G  targets, radii nesting, glass layers, clipped text (lib-vis), kid + adult (+ overflow long names) at 430.
// P  positions at 430×932 (kid): top of Done ★, I heard it, stars card, story card; page height; the reach zone.
// K  glanceability on the iPad (820×1180): font size and estimated cap height (0.7 em) in mm at 0.192 mm per CSS px.
import { local, sleep, log, saveJson, shot } from './_kv.mjs';
import { install, contrastSweep, nearestDT } from '../../phase2/VIS/lib-vis.mjs';

const out = { T: {}, C: {}, A: {}, G: {}, P: {}, K: {} };
async function page(L, profile, device = 'iphone-pwa', mode = 'light') {
  const d = await L.device({ device, profile, fixedTime: false, mode });
  await d.page.goto(L.site + '/apps/kidverse.html', { waitUntil: 'load' });
  await d.page.waitForFunction(() => window.hub && hub.sync && hub.sync.lastPull > 0, null, { timeout: 15000 }); await sleep(1200);
  return d;
}
const TYPE = () => {
  const pick = [['who pill', '#who b'], ['kicker', '#kick'], ['ref h1', '#ref'], ['also', '#also'], ['words kicker', '.words .kicker'], ['paraphrase', '#words'], ['disclaimer', '.words small'],
    ['button label', '#say span'], ['star count', '#star-count'], ['stars sub', '#mine .sub'], ['day dot letter', '#mine .days span:not(.on)'], ['story kicker', '#story-kick'], ['story title', '#story-title'],
    ['story span', '#story-span'], ['story text', '#story-text'], ['story small', '.story small'], ['story sub', '#story-sub'], ['rewards h2', '#rewards h2'], ['bank number', '#rw-total'],
    ['bank label', '#rw-bank span'], ['badge name', '.badges .bname'], ['badge hint', '.badges li small'], ['badge glyph', '.badges .bicon'], ['how', '.rewards .how'], ['grown h2', '#grown h2'],
    ['week number', '#week-now'], ['week small', '#week-now small'], ['hint', '.grown .hint'], ['kid name', '.kids .kn'], ['kid dot letter', '.kids .days span:not(.on)']];
  return pick.map(([role, s]) => { const e = document.querySelector(s); if (!e || !e.offsetParent && getComputedStyle(e).position !== 'fixed') return null; const cs = getComputedStyle(e); return { role, sel: s, fs: parseFloat(cs.fontSize), fw: cs.fontWeight, ff: cs.fontFamily.split(',')[0].replace(/"/g, '').trim(), lh: cs.lineHeight, ls: cs.letterSpacing }; }).filter(Boolean);
};
const L = await local({ variant: 'typical', clock: 'real' });
try {
  // T + K + P
  for (const [who, dev] of [['ezra', 'iphone-pwa'], ['ezra', 'ipad-portrait'], ['eli', 'iphone-pwa'], ['eli', 'ipad-portrait']]) {
    const d = await page(L, who, dev);
    const t = await d.page.evaluate(TYPE);
    out.T[`${who}-${dev}`] = t.map(x => ({ ...x, dt: nearestDT(x.fs)[0] + ' ' + nearestDT(x.fs)[1], under11: x.fs < 11 }));
    out.T[`${who}-${dev}-fonts`] = await d.page.evaluate(() => ({ body: getComputedStyle(document.body).fontFamily, h1: getComputedStyle(document.querySelector('#ref')).fontFamily }));
    if (dev === 'iphone-pwa' && who === 'ezra') {
      out.P = await d.page.evaluate(() => { const y = s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { top: Math.round(r.top + scrollY), bottom: Math.round(r.bottom + scrollY), h: Math.round(r.height), w: Math.round(r.width) }; };
        return { vh: innerHeight, vw: innerWidth, docH: document.documentElement.scrollHeight, scene: y('.scene'), ref: y('#ref'), say: y('#say'), done: y('#done'), stars: y('#mine'), story: y('#story'), storySay: y('#story-say'), heard: y('#story-heard'), rewards: y('#rewards') }; });
      out.P_shot = await shot(d.page, 'visual-P-kid-iphone-first-screen.png');
    }
    if (dev === 'ipad-portrait') {
      out.K[who] = t.filter(x => ['ref h1', 'paraphrase', 'star count', 'story title', 'story text', 'button label', 'week number', 'kid name'].includes(x.role)).map(x => ({ role: x.role, fs: x.fs, capMm: +(x.fs * 0.7 * 0.192).toFixed(1), readableAtM: +((x.fs * 0.7 * 0.192) * 200 / 1000).toFixed(2) }));
      if (who === 'ezra') out.K_shot = await shot(d.page, 'visual-K-kid-ipad-portrait-first-screen.png');
    }
    await d.close();
  }
  // A — accent
  for (const who of ['ezra', 'kiara', 'eli', 'christian']) {
    const d = await page(L, who);
    out.A[who] = await d.page.evaluate(() => { const r = getComputedStyle(document.documentElement); const bt = s => { const e = document.querySelector(s); if (!e || e.hidden) return null; const c = getComputedStyle(e); return { bg: c.backgroundImage !== 'none' ? c.backgroundImage.slice(0, 120) : c.backgroundColor, color: c.color, accentOnEl: c.getPropertyValue('--accent').trim(), accentDeepOnEl: c.getPropertyValue('--accent-deep').trim().slice(0, 80) }; };
      return { accent: r.getPropertyValue('--accent').trim(), gold: r.getPropertyValue('--gold').trim(), goldInk: r.getPropertyValue('--gold-ink').trim(), done: bt('#done'), heard: bt('#story-heard'), pill: getComputedStyle(document.querySelector('#who')).boxShadow.slice(0, 80), stepper: bt('#week-up') }; });
    if (who === 'kiara') { await d.page.evaluate(() => document.querySelector('#done').scrollIntoView({ block: 'center' })); out.A_shot = await shot(d.page, 'visual-A-kiara-done-button.png'); }
    await d.close();
  }
  // G — targets, radii, glass, clipped; kid and adult at 430
  for (const who of ['ezra', 'eli']) {
    const d = await page(L, who); await install(d.page);
    out.G[who] = await d.page.evaluate(() => ({ targets: __vis.targets(), radii: __vis.radii().filter(r => !r.ok), glass: __vis.glass(), clipped: __vis.clipped() }));
    if (who === 'eli') { await d.page.evaluate(() => document.querySelector('#kids').scrollIntoView({ block: 'center' })); out.G_shot = await shot(d.page, 'visual-G-adult-kids-panel-430.png');
      out.G.kidsOverlap = await d.page.evaluate(() => [...document.querySelectorAll('#kids li[data-kid]')].map(li => { const b = li.querySelector('.kn b').getBoundingClientRect(), dd = li.querySelector('.days').getBoundingClientRect(), kn = li.querySelector('.kn'); return { kid: li.dataset.kid, count: li.querySelector('.kn b').textContent, countRight: Math.round(b.right), dotsLeft: Math.round(dd.left), covered: b.right > dd.left + 0.5, knScrollW: kn.scrollWidth, knClientW: kn.clientWidth }; })); }
    await d.close();
  }
  // C — contrast in the five palettes, kid + adult
  for (const who of ['ezra', 'eli']) {
    for (const theme of ['hearth', 'parchment', 'frost', 'midnight', 'forest']) {
      const dark = theme === 'midnight' || theme === 'forest';
      const d = await page(L, who, 'iphone-pwa', dark ? 'dark' : 'light');
      await d.page.evaluate(([t, s]) => { const r = document.documentElement; if (t === 'hearth') delete r.dataset.theme; else r.dataset.theme = t; r.dataset.scheme = s; }, [theme, dark ? 'dark' : 'light']);
      await sleep(400);
      const res = await contrastSweep(d.page, 'html');
      const bad = res.measured.filter(m => m.p10 < (m.large ? 3 : 4.5)).map(m => ({ sel: m.sel, text: m.text.slice(0, 40), fs: m.fs, large: m.large, p10: m.p10, med: m.med }));
      out.C[`${who}-${theme}`] = { measured: res.measured.length, failing: bad, min: Math.min(...res.measured.map(m => m.p10)) };
      if (who === 'ezra' && (theme === 'midnight' || theme === 'forest')) { await d.page.evaluate(() => scrollTo(0, 0)); out.C[`shot-${theme}`] = await shot(d.page, `visual-C-kid-${theme}-top.png`); await d.page.evaluate(() => document.querySelector('#rewards').scrollIntoView({ block: 'center' })); out.C[`shot-${theme}-rewards`] = await shot(d.page, `visual-C-kid-${theme}-rewards.png`); }
      await d.close();
    }
  }
} finally { await L.close(); }
// overflow: long names in the adult panel
{
  const L2 = await local({ variant: 'overflow', clock: 'real' });
  try {
    const d = await page(L2, 'eli'); await install(d.page);
    out.G.overflowKids = await d.page.evaluate(() => [...document.querySelectorAll('#kids li[data-kid]')].map(li => { const b = li.querySelector('.kn b').getBoundingClientRect(), dd = li.querySelector('.days').getBoundingClientRect(); return { kid: li.dataset.kid, text: li.querySelector('.kn').textContent, countRight: Math.round(b.right), countTop: Math.round(b.top), dotsLeft: Math.round(dd.left), dotsTop: Math.round(dd.top), dotsBottom: Math.round(dd.bottom), coveredX: b.right > dd.left + 0.5 && b.bottom > dd.top && b.top < dd.bottom }; }));
    await d.page.evaluate(() => document.querySelector('#kids').scrollIntoView({ block: 'center' }));
    out.G.overflowShot = await shot(d.page, 'visual-G-adult-kids-panel-overflow-430.png');
    await d.close();
  } finally { await L2.close(); }
}
for (const [k, v] of Object.entries(out.T)) if (!k.endsWith('fonts')) log('T', k, v.map(x => `${x.role}=${x.fs}/${x.fw}${x.under11 ? '(<11!)' : ''}[${x.ff}]`).join(' · ')); else log('T', k, JSON.stringify(v));
log('P', JSON.stringify(out.P));
log('K', JSON.stringify(out.K));
log('A', JSON.stringify(out.A));
for (const who of ['ezra', 'eli']) { const g = out.G[who]; log('G', who, 'targets<44', JSON.stringify(g.targets.filter(t => t.w < 44 || t.h < 44))); log('G', who, 'targets', JSON.stringify(g.targets.map(t => `${t.label}:${t.w}x${t.h}`))); log('G', who, 'radii off', JSON.stringify(g.radii)); log('G', who, 'glass', JSON.stringify(g.glass)); log('G', who, 'clipped', JSON.stringify(g.clipped)); }
log('G kidsOverlap', JSON.stringify(out.G.kidsOverlap)); log('G overflow', JSON.stringify(out.G.overflowKids));
for (const [k, v] of Object.entries(out.C)) if (!k.startsWith('shot')) log('C', k, 'measured', v.measured, 'min p10', v.min, 'failing', JSON.stringify(v.failing));
saveJson('visual.json', out);
