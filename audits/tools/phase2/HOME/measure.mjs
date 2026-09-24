// Shared DOM measurement helpers for the HOME dimension (audit Phase 2). Nothing here writes app data.
//
// measureText(frame, specs): for each { name, sel, all } returns the computed font-size/weight/family, the rendered
// line-box height and line count (from a Range over the element's text), and the glyph cap height / digit height /
// x-height measured with canvas measureText() in the element's own computed font. `all: true` measures every match and
// reports the smallest (the weakest link on screen). The fonts on this rig are Segoe UI / Palatino (01-capture.md §3.1);
// their cap-height ratios (0.70 / 0.69 em) are within ~2 % of SF Pro / New York (0.705 / 0.70 em), so the physical
// sizes below transfer to the iPad within that margin.
export async function measureText(frame, specs) {
  return frame.evaluate(specs => {
    const cv = document.createElement('canvas').getContext('2d');
    const glyph = (cs, ch) => { cv.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`; const m = cv.measureText(ch); return +(m.actualBoundingBoxAscent).toFixed(1); };
    const one = el => {
      const cs = getComputedStyle(el);
      const r = document.createRange(); r.selectNodeContents(el);
      const rects = [...r.getClientRects()].filter(x => x.width > 0 && x.height > 0);
      const tops = [...new Set(rects.map(x => Math.round(x.top)))];
      const box = el.getBoundingClientRect();
      const text = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
      const sample = /\d/.test(text) ? '0123456789'.split('').find(d => text.includes(d)) : null;
      return {
        text: text.slice(0, 70), fontSize: parseFloat(cs.fontSize), weight: cs.fontWeight, family: cs.fontFamily.split(',')[0].replace(/"/g, ''),
        lineBox: rects.length ? +Math.max(...rects.map(x => x.height)).toFixed(1) : 0, lines: tops.length,
        capH: glyph(cs, 'H'), digitH: sample ? glyph(cs, sample) : null, xH: glyph(cs, 'x'),
        top: Math.round(box.top), bottom: Math.round(box.bottom), visible: box.width > 0 && box.height > 0 && cs.visibility !== 'hidden',
        aboveFold: box.top < innerHeight && box.bottom > 0,
      };
    };
    const out = {};
    for (const s of specs) {
      const els = [...document.querySelectorAll(s.sel)].filter(e => e.getBoundingClientRect().height > 0);
      if (!els.length) { out[s.name] = null; continue; }
      if (!s.all) { out[s.name] = one(els[0]); continue; }
      const ms = els.map(one); const min = ms.reduce((a, b) => (b.capH < a.capH ? b : a));
      out[s.name] = { ...min, count: ms.length };
    }
    return out;
  }, specs);
}

// Physical size. iPad Air 11" (2360×1640 at 264 ppi, CSS px = 2 device px): 1 CSS px = 2/264 in = 0.1924 mm.
export const MM_PER_PX = { ipad: 0.1924 };
// A 1920×1080 TV: mm per px = panel width / 1920. Width of a 16:9 panel = diagonal × 0.8716.
for (const d of [43, 55, 65]) MM_PER_PX['tv' + d] = +(d * 25.4 * 0.8716 / 1920).toFixed(4);

// Named heuristics (labelled as heuristics, not standards):
//   H1 "comfortable glance": cap height >= distance / 200  (~17 arcmin): 10 mm at 2 m, 15 mm at 3 m (the brief's rule).
//   H2 "threshold, 20/40 eye": cap height >= distance / 344 (10 arcmin, the letter height a 20/40 eye can just resolve):
//      5.8 mm at 2 m, 8.7 mm at 3 m. Below H2 the text cannot be read at that distance by a grandparent with 20/40 vision.
export const HEUR = { H1: d => d / 200, H2: d => d / 344 };
export function verdict(capMm, distM) {
  const d = distM * 1000;
  if (capMm >= HEUR.H1(d)) return 'H1 pass';
  if (capMm >= HEUR.H2(d)) return 'H2 only';
  return 'fail';
}
