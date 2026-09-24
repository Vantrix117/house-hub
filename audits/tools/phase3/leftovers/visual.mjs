// Visual measurements of the Larder, opened standalone (site/apps/leftovers.html, signed in as Eli) so the page IS the app:
//   A contrast of every freshness state (chip text/fill, group ink/page, stripe and bar vs card) + the other text pairs,
//     from computed colours, in all five palettes; plus rendered contrast (lib-vis contrastSweep, p10) of every text item.
//   B the three state tints under simulated deuteranopia/protanopia (Machado 2009, severity 1): can they be told apart?
//   C type scale vs iOS Dynamic Type, tap targets (iPhone 430 + iPad 820), cap heights in mm on the 11" iPad.
import { local, save, shot, sleep } from './_lib.mjs';
import { install, contrastSweep, nearestDT } from '../../phase2/VIS/lib-vis.mjs';
const L = await local({ variant: 'typical', clock: 'demo' });
const THEMES = ['hearth', 'parchment', 'frost', 'midnight', 'forest'];
const out = { pairs: {}, rendered: {}, cvd: {}, type: null, targets: {}, glance: null };
async function open(device = 'ipad-portrait', profile = 'eli', mode = 'light') {
  const d = await L.device({ device, profile, mode });
  await d.page.goto(L.site + '/apps/leftovers.html', { waitUntil: 'load' });
  await d.page.waitForFunction(() => window.__larder && tally.textContent.length > 0);
  await install(d.page);
  return d;
}
const PAIRS = () => {
  const V = window.__vis; const cs = (el, p) => getComputedStyle(el)[p];
  const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const flat = (fg, bg) => { const a = fg[3]; return [0, 1, 2].map(i => fg[i] * a + bg[i] * (1 - a)); };
  const R = (a, b) => +V.ratio(a, b).toFixed(2);
  const pageBg = V.rgba(cs(document.body, 'backgroundColor'))[3] > 0 ? V.rgba(cs(document.body, 'backgroundColor')) : V.rgba(cs(document.documentElement, 'backgroundColor'));
  const res = { theme: document.documentElement.dataset.theme || 'hearth', scheme: document.documentElement.dataset.scheme, pageBg: pageBg.slice(0, 3) };
  const card = document.querySelector('.item'); const cardBg = flat(V.rgba(cs(card, 'backgroundColor')), pageBg);
  for (const tone of ['urgent', 'warn', 'fresh']) {
    const c = document.querySelector(`.item[data-tone="${tone}"]`); const chip = c.querySelector('.status');
    const chipBg = flat(V.rgba(cs(chip, 'backgroundColor')), cardBg), chipFg = V.rgba(cs(chip, 'color'));
    const stripe = flat(V.rgba(cs(c.querySelector('.stripe'), 'backgroundColor')), cardBg);
    const track = flat(V.rgba(cs(c.querySelector('.bar'), 'backgroundColor')), cardBg);
    const tint = V.rgba(getComputedStyle(c).getPropertyValue('--tint').trim() ? cs(c.querySelector('.stripe'), 'backgroundColor') : '#000');
    const h2 = document.querySelector(`.group[data-tone="${tone}"] h2`);
    res[tone] = { chipText_on_chip: R(flat(chipFg, chipBg), chipBg), chipFill_vs_card: R(chipBg, cardBg), groupInk_on_page: R(flat(V.rgba(cs(h2, 'color')), pageBg), pageBg),
      stripe_vs_card: R(stripe, cardBg), barTint_vs_track: R(tint, track), track_vs_card: R(track, cardBg), tint: tint.slice(0, 3) };
  }
  const T = (sel, bgEl) => { const el = document.querySelector(sel); if (!el) return null; const bg = bgEl ? flat(V.rgba(cs(document.querySelector(bgEl), 'backgroundColor')), cardBg) : pageBg; return R(flat(V.rgba(cs(el, 'color')), bg), bg); };
  res.text = { name_on_card: R(flat(V.rgba(cs(document.querySelector('.nm'), 'color')), cardBg), cardBg), meta_on_card: R(flat(V.rgba(cs(document.querySelector('.meta'), 'color')), cardBg), cardBg),
    lede_on_page: T('.lede'), tally_on_page: T('#tally'), groupSub_on_page: T('.group h2 small'), alert_on_banner: T('.alert', '.alert'),
    hearthNote_on_page: T('.hearth p'), log_label_on_button: T('.log', '.log'), check_icon_on_button: T('.done', '.done') };
  return res;
};
// Machado et al. 2009, severity 1.0
const M = { deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
            protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]] };
const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const unl = v => 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);
const sim = (rgb, m) => { const l = rgb.map(lin); return m.map(r => Math.max(0, Math.min(255, unl(r[0] * l[0] + r[1] * l[1] + r[2] * l[2])))); };
const Y = rgb => 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
const ratio = (a, b) => { const x = Y(a), y = Y(b); return +((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)).toFixed(2); };
const dist = (a, b) => +Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]).toFixed(1);
try {
  for (const th of THEMES) {
    const d = await open('ipad-portrait', 'eli', ['midnight', 'forest'].includes(th) ? 'dark' : 'light');
    await d.page.evaluate(t => hub.setTheme(t), th); await sleep(400); await install(d.page);
    out.pairs[th] = await d.page.evaluate(PAIRS);
    const sw = await contrastSweep(d.page, 'html');
    out.rendered[th] = sw.measured.map(m => ({ text: m.text.slice(0, 40), fs: m.fs, p10: m.p10, med: m.med, sel: m.sel.slice(-40) })).sort((a, b) => a.p10 - b.p10);
    await shot(d.page, `visual-${th}-ipad.png`);
    const t = { urgent: out.pairs[th].urgent.tint, warn: out.pairs[th].warn.tint, fresh: out.pairs[th].fresh.tint };
    out.cvd[th] = {};
    for (const [k, m] of Object.entries({ normal: null, ...M })) {
      const s = Object.fromEntries(Object.entries(t).map(([n, c]) => [n, m ? sim(c, m).map(Math.round) : c]));
      out.cvd[th][k] = { tints: s, lumRatio: { urgent_warn: ratio(s.urgent, s.warn), urgent_fresh: ratio(s.urgent, s.fresh), warn_fresh: ratio(s.warn, s.fresh) }, rgbDist: { urgent_warn: dist(s.urgent, s.warn), urgent_fresh: dist(s.urgent, s.fresh), warn_fresh: dist(s.warn, s.fresh) } };
    }
    const p = out.pairs[th];
    console.log(`\n[${th}/${p.scheme}] chip text: urgent ${p.urgent.chipText_on_chip} warn ${p.warn.chipText_on_chip} fresh ${p.fresh.chipText_on_chip} | group ink: ${p.urgent.groupInk_on_page}/${p.warn.groupInk_on_page}/${p.fresh.groupInk_on_page} | stripe vs card ${p.urgent.stripe_vs_card}/${p.warn.stripe_vs_card}/${p.fresh.stripe_vs_card} | bar vs track ${p.urgent.barTint_vs_track}/${p.warn.barTint_vs_track}/${p.fresh.barTint_vs_track}`);
    console.log('   text:', JSON.stringify(p.text));
    console.log('   rendered lowest p10:', JSON.stringify(out.rendered[th].slice(0, 4).map(r => `${r.text} ${r.fs}px ${r.p10}`)));
    console.log('   CVD deutan lum ratios:', JSON.stringify(out.cvd[th].deutan.lumRatio), 'rgbDist', JSON.stringify(out.cvd[th].deutan.rgbDist), '| protan', JSON.stringify(out.cvd[th].protan.lumRatio));
    await d.close();
  }
  // C: type, targets, glance (Hearth)
  for (const dev of ['iphone-pwa', 'ipad-portrait']) {
    const d = await open(dev);
    out.targets[dev] = (await d.page.evaluate(() => __vis.targets())).map(t => `${t.sel.split(' > ').pop()} "${t.label}" ${t.w}x${t.h}`);
    if (dev === 'ipad-portrait') {
      out.type = await d.page.evaluate(() => {
        const q = { h1: 'h1', lede: '.lede', tally: '#tally', alert: '.alert', groupTitle: '.group h2', groupSub: '.group h2 small',
          name: '.nm', meta: '.meta', chip: '.status', logLabel: '.log', nameInput: '#name', select: '#size', dateBox: '#date',
          hearthNote: '.hearth p', copyBtn: '.copy', modeLine: '#mode', err: '.err' };
        const cv = document.createElement('canvas').getContext('2d');
        const one = s => {
          const el = document.querySelector(s); if (!el) return null;
          const c = getComputedStyle(el); cv.font = `${c.fontWeight} ${c.fontSize} ${c.fontFamily}`;
          const cap = cv.measureText('H').actualBoundingBoxAscent;
          return { px: parseFloat(c.fontSize), weight: c.fontWeight, family: c.fontFamily.split(',')[0], capPx: +cap.toFixed(1), capMm: +(cap * 0.1924).toFixed(2) };
        };
        return Object.fromEntries(Object.entries(q).map(([k, s]) => [k, one(s)]));
      });
      for (const [k, v] of Object.entries(out.type)) if (v) {
        const dt = nearestDT(v.px); v.nearestDT = `${dt[0]} ${dt[1]}`;
        v.at2m = v.capMm >= 10 ? 'H1' : v.capMm >= 5.8 ? 'H2' : 'fail';
        v.at3m = v.capMm >= 15 ? 'H1' : v.capMm >= 8.7 ? 'H2' : 'fail';
      }
    }
    await d.close();
  }
  console.log('\ntype (iPad):'); for (const [k, v] of Object.entries(out.type)) console.log(' ', k, JSON.stringify(v));
  console.log('targets:', JSON.stringify(out.targets, null, 1));
  console.log('saved', save('visual.json', out));
} finally { await L.close(); }
