// Phase 2 / PWA — skeptic #2 for "chat-composer-under-sensor-landscape".
//   node "audits/tools/phase2/PWA/verify2-chat-composer-under-sensor-landscape-2.mjs"
// Independent re-run. env(safe-area-inset-*) is 0 in the rig, so for each case we measure the composer twice:
//   (a) raw — no token override at all (proves the left/right geometry does not depend on the rig's missing env());
//   (b) with the shell's --safe-* tokens overridden with the device's real landscape insets (as iOS would resolve env()).
// Then we compare with what the rest of the shell does with the same tokens (#views content box, tab bar),
// and model the physical sensor housing (approximate Dynamic Island / notch outline, rotated into landscape) to see
// whether any painted pixel of the composer, mic or send button actually lies under it (vs. only inside the safe band).
// Evidence: audits/evidence/p2/PWA/verify2-chat-composer-under-sensor-landscape-2*.{json,png} (1x css).
import { local, sleep } from '../../lib/local.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const OUT = path.join(ROOT, 'audits/evidence/p2/PWA');
const TAG = 'verify2-chat-composer-under-sensor-landscape-2';
const rel = f => path.relative(ROOT, f).replace(/\\/g, '/');

// Landscape insets iOS reports (pt): Pro Max class (Dynamic Island) 932x430 L/R 59 B 21; notch class (iPhone 13/14) 844x390 L/R 47 B 21.
// Housing outlines are approximations from published portrait geometry, rotated so the top of the phone is on the left:
//   Dynamic Island ≈ 126 x 37 pt, 11 pt from the top edge  → landscape x 11..48, y centred, fully rounded ends (r 18.5).
//   Notch (13/14)  ≈ 162 x 33 pt at the top edge          → landscape x 0..33,  y centred.
const CASES = [
  { name: 'pro-max-932x430', vp: { width: 932, height: 430 }, ins: { left: 59, right: 59, bottom: 21 }, housing: { kind: 'island', x0: 11, x1: 48, len: 126 }, profile: 'mom' },
  { name: 'notch-844x390',   vp: { width: 844, height: 390 }, ins: { left: 47, right: 47, bottom: 21 }, housing: { kind: 'notch', x0: 0, x1: 33, len: 162 }, profile: 'mom' },
  { name: 'pro-max-932x430-kid', vp: { width: 932, height: 430 }, ins: { left: 59, right: 59, bottom: 21 }, housing: { kind: 'island', x0: 11, x1: 48, len: 126 }, profile: 'ezra' },
];
const tokenCss = ins => `:root:root{--safe-left:${ins.left}px !important;--safe-right:${ins.right}px !important;--safe-bottom:${ins.bottom}px !important}`;

const measure = page => page.evaluate(() => {
  const R = s => { const e = document.querySelector(s); if (!e) return null; const cs = getComputedStyle(e); if (e.hidden || cs.display === 'none') return 'hidden'; const r = e.getBoundingClientRect(); return { l: Math.round(r.left), t: Math.round(r.top), r: Math.round(r.right), b: Math.round(r.bottom), w: Math.round(r.width), h: Math.round(r.height), radius: cs.borderTopLeftRadius }; };
  const v = document.getElementById('views'), vcs = getComputedStyle(v);
  const bubbles = [...document.querySelectorAll('#chat-log .msg')].map(e => e.getBoundingClientRect());
  return {
    W: innerWidth, H: innerHeight,
    form: R('#chat-form'), mic: R('#chat-mic'), input: R('#chat-in'), send: R('#chat-send'),
    viewsPadding: { left: vcs.paddingLeft, right: vcs.paddingRight },
    chatLog: R('#chat-log'),
    bubblesMinLeft: bubbles.length ? Math.round(Math.min(...bubbles.map(b => b.left))) : null,
    bubblesMaxRight: bubbles.length ? Math.round(Math.max(...bubbles.map(b => b.right))) : null,
    tabbarPadding: (() => { const t = document.getElementById('tabbar'); if (!t) return null; const cs = getComputedStyle(t); return { left: cs.paddingLeft, right: cs.paddingRight }; })(),
    tabsBox: R('#tabbar .tabs'),
    chatFormRule: [...document.styleSheets].flatMap(s => { try { return [...s.cssRules]; } catch { return []; } }).filter(r => r.selectorText === '.chat-form').map(r => ({ left: r.style.left, right: r.style.right, width: r.style.width, margin: r.style.margin, padding: r.style.padding }))[0] || null,
  };
});

// Is a point inside a rounded rect (CSS box with uniform radius)?
const inRRect = (px, py, b) => {
  const rad = Math.min(parseFloat(b.radius) || 0, b.w / 2, b.h / 2);
  if (px < b.l || px > b.r || py < b.t || py > b.b) return false;
  const cx = Math.min(Math.max(px, b.l + rad), b.r - rad), cy = Math.min(Math.max(py, b.t + rad), b.b - rad);
  return (px - cx) ** 2 + (py - cy) ** 2 <= rad ** 2 + 1e-6;
};
// Housing shape on one side (side 'left' = top of phone to the left; 'right' = mirrored).
const housingBox = (hs, W, H, side) => {
  const y0 = (H - hs.len) / 2, y1 = y0 + hs.len;
  const x0 = side === 'left' ? hs.x0 : W - hs.x1, x1 = side === 'left' ? hs.x1 : W - hs.x0;
  const radius = hs.kind === 'island' ? String((hs.x1 - hs.x0) / 2) : '8';
  return { l: x0, r: x1, t: y0, b: y1, w: x1 - x0, h: y1 - y0, radius };
};
const overlapPx = (el, hb) => {
  if (!el || el === 'hidden') return null;
  let n = 0; const pts = [];
  for (let x = Math.floor(Math.max(el.l, hb.l)); x <= Math.ceil(Math.min(el.r, hb.r)); x++)
    for (let y = Math.floor(Math.max(el.t, hb.t)); y <= Math.ceil(Math.min(el.b, hb.b)); y++)
      if (inRRect(x + .5, y + .5, el) && inRRect(x + .5, y + .5, hb)) { n++; if (pts.length < 3) pts.push([x, y]); }
  return { px: n, sample: pts };
};
const bandCheck = (el, ins, W, H) => {
  if (!el || el === 'hidden') return el;
  const bad = [];
  if (el.l < ins.left) bad.push(`left ${el.l} < ${ins.left} (${ins.left - el.l} px into band)`);
  if (el.r > W - ins.right) bad.push(`right ${el.r} > ${W - ins.right} (${el.r - (W - ins.right)} px into band)`);
  if (el.b > H - ins.bottom) bad.push(`bottom ${el.b} > ${H - ins.bottom}`);
  return bad.length ? bad : 'clear';
};

const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const log = { cases: {} };
try {
  for (const c of CASES) {
    const d = await L.device({ device: 'iphone-pwa', profile: c.profile });
    await d.page.setViewportSize(c.vp);
    await d.goto('#chat'); await sleep(1800);
    const raw = await measure(d.page);
    await d.page.addStyleTag({ content: tokenCss(c.ins) }); await sleep(600);
    const inj = await measure(d.page);
    const res = { viewport: c.vp, insets: c.ins, profile: c.profile, raw: { form: raw.form, mic: raw.mic, send: raw.send, viewsPadding: raw.viewsPadding }, injected: inj };
    res.bandCheck = { form: bandCheck(inj.form, c.ins, inj.W, inj.H), mic: bandCheck(inj.mic, c.ins, inj.W, inj.H), input: bandCheck(inj.input, c.ins, inj.W, inj.H), send: bandCheck(inj.send, c.ins, inj.W, inj.H), chatLog: bandCheck(inj.chatLog, c.ins, inj.W, inj.H), tabs: bandCheck(inj.tabsBox, c.ins, inj.W, inj.H) };
    res.housing = {};
    for (const side of ['left', 'right']) {
      const hb = housingBox(c.housing, inj.W, inj.H, side);
      res.housing[side] = { outline: { x: [hb.l, hb.r], y: [Math.round(hb.t), Math.round(hb.b)] }, overlapPx: { form: overlapPx(inj.form, hb), mic: overlapPx(inj.mic, hb), input: overlapPx(inj.input, hb), send: overlapPx(inj.send, hb) } };
    }
    // screenshot: red safe bands + blue approximate housing outline on both sides
    await d.page.evaluate(({ ins, hs }) => {
      const W = innerWidth, H = innerHeight;
      const add = s => { const e = document.createElement('div'); e.style.cssText = 'position:fixed;z-index:2147483647;pointer-events:none;' + s; document.body.appendChild(e); };
      add(`left:0;top:0;bottom:0;width:${ins.left}px;background:rgba(255,0,0,.25)`);
      add(`right:0;top:0;bottom:0;width:${ins.right}px;background:rgba(255,0,0,.25)`);
      add(`left:0;right:0;bottom:0;height:${ins.bottom}px;background:rgba(255,0,0,.25)`);
      const y0 = (H - hs.len) / 2, r = hs.kind === 'island' ? (hs.x1 - hs.x0) / 2 : 8;
      add(`left:${hs.x0}px;top:${y0}px;width:${hs.x1 - hs.x0}px;height:${hs.len}px;border-radius:${r}px;background:rgba(0,0,0,.85);outline:2px solid #06f`);
      add(`right:${hs.x0}px;top:${y0}px;width:${hs.x1 - hs.x0}px;height:${hs.len}px;border-radius:${r}px;outline:2px dashed #06f`);
    }, { ins: c.ins, hs: c.housing });
    const f = path.join(OUT, `${TAG}-${c.name}-light.png`);
    await d.page.screenshot({ path: f, scale: 'css', animations: 'disabled', caret: 'hide' });
    res.shot = rel(f);
    log.cases[c.name] = res;
    console.log('\n== ' + c.name + '\n' + JSON.stringify(res, null, 1));
    await d.close();
  }
} finally {
  fs.writeFileSync(path.join(OUT, TAG + '.json'), JSON.stringify(log, null, 1));
  await L.close();
}
