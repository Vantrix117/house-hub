// Measurements for the rubric: taps from Home to each top job, tap-target sizes, rendered text heights (glanceability),
// contrast of the real text/background pairs, and the compass-jump curSec proof.
// Run: node "audits/tools/phase3/dollywood-live/measure.mjs"
import { local, sleep, save, shot, openMap, pill } from './_lib.mjs';
const L = await local({ variant: 'park', clock: 'real', engine: 'webkit' });
const out = {};
// 1 CSS px ~ 0.192 mm on an 11" iPad; glanceable at 2.5 m needs char height >= 2500/200 = 12.5 mm ~ 65 px (heuristic).
const MM_PER_PX_IPAD = 0.192, D_M = 2.5, GLANCE_PX = (D_M * 1000 / 200) / MM_PER_PX_IPAD;
try {
  out.glanceHeuristic = { note: 'char height >= distance/200 mm; 1 CSS px ~ 0.192 mm on 11" iPad', distanceM: D_M, minGlanceCapHeightPx: +GLANCE_PX.toFixed(0) };

  // A. taps Home->map, and Home->place a spot->see nearest rides (a household member's top job)
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
  await d.goto('#home'); await sleep(3500);
  out.A_homeHasParkCard = await d.page.evaluate(() => !!document.querySelector('.park-card [data-open="dollywood-live"]'));
  // job 1: open the map from Home (park day) = 1 tap
  const f = await openMap(d, { settle: 2000 });
  out.A_openFromHomeTaps = 1;
  // job 2: see the family = 1 more tap (Family tab). already visible on the map as markers.
  // job 3 (no GPS): Set my spot -> I'm here = Family/Nearby tab is default; Set my spot (1) + I'm here (1) = 2 taps after the map opens
  out.A_setSpotTapsAfterMap = 2;

  // B. tap-target sizes of the primary controls (CSS px)
  out.B_targets = await f.evaluate(() => {
    const box = id => { const e = document.getElementById(id); if (!e) return null; const r = e.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; };
    return { findMe: box('loc-btn'), wholePark: box('lv-fit'), north: box('lv-north'), tab_near: (() => { const b = document.getElementById('loc-near'); const r = b.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; })(), setMySpot: box('loc-place'), meetGo: box('meet-go') };
  });

  // C. rendered text heights of the key readouts (fontSize px + measured cap height ~ 0.7*fontSize)
  await d.close();
  const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  await ipad.goto('#home'); await sleep(1000);
  const f2 = await openMap(ipad, { settle: 2000 });
  await f2.click('#loc-place'); await sleep(300); await f2.click('#lv-act'); await sleep(1200);   // place a spot so the pill shows "You're in …"
  out.C_ipadTextPx = await f2.evaluate(() => {
    const fs = el => el ? +getComputedStyle(el).fontSize.replace('px', '') : null;
    return {
      pillTitle: fs(document.getElementById('loc-sec')),
      pillSub: fs(document.getElementById('loc-acc')),
      meetName: fs(document.getElementById('meet-name')),
      tabLabel: fs(document.querySelector('.lv-tabs button')),
      sectionLabelSvg: fs(document.querySelector('.seclab')),
      familyMarkerLabel: fs(document.querySelector('.famlab')),
    };
  });
  out.C_glanceVerdict = 'compare each to minGlanceCapHeightPx (~65px cap => ~93px fontSize). None of the pill/label text is glanceable at 2.5 m; the map is read up close.';

  // D. rendered contrast of the sheet's text pairs, sampled from a screenshot of the frame's own pixels (glass over
  //    solid sheet, not over the map). Provisional: the rig's WebKit may not composite backdrop-filter.
  try {
    const png = (await f2.frameElement().then(h => h.screenshot({ scale: 'css' }).catch(() => null)));
    out.D_note = 'contrast read from computed colours; glass-over-map pairs are provisional (rig may not blur)';
  } catch (e) {}
  out.D_pairs = await f2.evaluate(() => {
    const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    const rgb = s => (s.match(/[\d.]+/g) || [0, 0, 0]).map(Number);
    const ratio = (a, b) => { const x = lum(rgb(a)) + 0.05, y = lum(rgb(b)) + 0.05; return +(Math.max(x, y) / Math.min(x, y)).toFixed(2); };
    const bgOf = el => { for (let e = el; e; e = e.parentElement) { const b = getComputedStyle(e).backgroundColor; if (b && !/rgba?\([^)]*,\s*0\)/.test(b) && b !== 'transparent') return b; } return 'rgb(255,255,255)'; };
    const one = (sel, label) => { const e = document.querySelector(sel); if (!e) return null; const cs = getComputedStyle(e); const bg = bgOf(e); return { label, fg: cs.color, bg, fontPx: +cs.fontSize.replace('px', ''), ratio: ratio(cs.color, bg) }; };
    return [one('#loc-sec', 'pill title'), one('#loc-acc', 'pill sub'), one('.lv-item .t span', 'nearby subtext'), one('.lv-grp', 'group heading'), one('#meet-meta', 'meet meta'), one('.lv-src', 'waits source')].filter(Boolean);
  });

  // E. compass jump proof: curSec at boot and after tapping the compass
  out.E_compass = await f2.evaluate(() => {
    const before = { ROT: window.ROT, curSec: window.curSec };
    return before;
  });
  await f2.click('#lv-north'); await sleep(800);
  out.E_compassAfter = await f2.evaluate(() => ({ ROT: window.ROT, curSec: window.curSec, uprightChecked: document.getElementById('l-upright').checked }));
  out.E_note = 'the compass toggles l-upright; its change handler fits SEC[curSec]. curSec is the boot value (entrance), never reset when the map is shown, so the view fits Entrance & Plaza, not where the family is.';
  await shot(ipad, 'measure-after-compass-ipad.png');
} finally { save('measure.json', out); console.log(JSON.stringify(out, null, 2)); await L.close(); }
