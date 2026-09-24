// Skeptic #1 for "chat-composer-under-sensor-landscape": in iPhone landscape, does the Chat composer (#chat-form, #chat-mic,
// #chat-send) really ignore the left/right safe-area insets, and does it really sit under the sensor housing?
//   node "audits/tools/phase2/PWA/verify2-chat-composer-under-sensor-landscape-1.mjs"
// WebKit, typical household, Mom (adult) on the iphone-pwa device, #chat. The rig cannot set env(safe-area-inset-*), so as in
// standalone.mjs the shell's --safe-* tokens (apps/design.css:34-37, the only way index.html reads the insets) are overridden.
// For each landscape iPhone size: once with insets 0 (control) and once with that model's landscape insets; measure the
// composer, mic, send, the #views content box and the tab bar. If the composer does not move while #views/tab bar do,
// the composer does not use the insets. Then compare against an APPROXIMATE sensor-housing rectangle (Dynamic Island
// ~126x37 pt, ~11 pt from the edge, centred along the short edge; notch ~162x32 / ~209x30 pt at the edge) to see whether
// the controls are physically under the hardware or only inside the unsafe band.
// Evidence: audits/evidence/p2/PWA/verify2-chat-composer-under-sensor-landscape-1.json + PNGs (1x css).
import { local, sleep } from '../../lib/local.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const OUT = path.join(ROOT, 'audits/evidence/p2/PWA');
fs.mkdirSync(OUT, { recursive: true });
const rel = f => path.relative(ROOT, f).split(path.sep).join('/');
const TAG = 'verify2-chat-composer-under-sensor-landscape-1';
const inset = ({ top = 0, bottom = 0, left = 0, right = 0 }) => `:root:root{--safe-top:${top}px !important;--safe-bottom:${bottom}px !important;--safe-left:${left}px !important;--safe-right:${right}px !important}`;

// housing: { kind, w (along the edge), d (depth from the edge incl. offset) } in CSS px, approximate public device metrics
const MODELS = [
  { name: 'iPhone 14/15 Pro Max 932x430', vp: { width: 932, height: 430 }, ins: { left: 59, right: 59, bottom: 21 }, housing: { kind: 'Dynamic Island', w: 126, off: 11, depth: 37 }, shot: true },
  { name: 'iPhone 16 Pro Max 956x440', vp: { width: 956, height: 440 }, ins: { left: 62, right: 62, bottom: 20 }, housing: { kind: 'Dynamic Island', w: 126, off: 14, depth: 37 } },
  { name: 'iPhone 15/16 & 14/15 Pro 852x393', vp: { width: 852, height: 393 }, ins: { left: 59, right: 59, bottom: 21 }, housing: { kind: 'Dynamic Island', w: 126, off: 11, depth: 37 }, shot: true },
  { name: 'iPhone 13/14 844x390', vp: { width: 844, height: 390 }, ins: { left: 47, right: 47, bottom: 21 }, housing: { kind: 'notch', w: 162, off: 0, depth: 32 } },
  { name: 'iPhone X/XS/11 Pro 812x375', vp: { width: 812, height: 375 }, ins: { left: 44, right: 44, bottom: 21 }, housing: { kind: 'notch', w: 209, off: 0, depth: 30 } },
  { name: 'iPhone SE 667x375 (no insets, control)', vp: { width: 667, height: 375 }, ins: { left: 0, right: 0, bottom: 0 }, housing: null },
];

const measure = page => page.evaluate(() => {
  const R = sel => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return { l: Math.round(r.left), r: Math.round(r.right), t: Math.round(r.top), b: Math.round(r.bottom), w: Math.round(r.width), h: Math.round(r.height), shown: !!(r.width && r.height && cs.display !== 'none' && cs.visibility !== 'hidden') }; };
  const v = document.getElementById('views'), vcs = getComputedStyle(v);
  const tb = document.querySelector('#tabbar'), tbcs = tb ? getComputedStyle(tb) : null;
  const fcs = getComputedStyle(document.getElementById('chat-form'));
  return {
    W: innerWidth, H: innerHeight, tab: document.documentElement.dataset.tab,
    safeLeftToken: getComputedStyle(document.documentElement).getPropertyValue('--safe-left').trim(),
    form: R('#chat-form'), mic: R('#chat-mic'), input: R('#chat-in'), send: R('#chat-send'),
    formCss: { left: fcs.left, right: fcs.right, width: fcs.width, marginLeft: fcs.marginLeft, paddingLeft: fcs.paddingLeft, bottom: fcs.bottom },
    viewsPadding: { left: vcs.paddingLeft, right: vcs.paddingRight },
    chatTitle: R('#view-chat .view-title'), lastMsg: (() => { const m = [...document.querySelectorAll('#chat-log .msg')].pop(); if (!m) return null; const r = m.getBoundingClientRect(); return { l: Math.round(r.left), r: Math.round(r.right) }; })(),
    tabbarPadding: tbcs ? { left: tbcs.paddingLeft, right: tbcs.paddingRight } : null,
    firstTab: R('#tabbar .tab'), lastTab: (() => { const t = [...document.querySelectorAll('#tabbar .tab')].pop(); if (!t) return null; const r = t.getBoundingClientRect(); return { l: Math.round(r.left), r: Math.round(r.right) }; })(),
  };
});

const intoBand = (m, ins) => {
  const out = {};
  for (const k of ['form', 'mic', 'send']) {
    const r = m[k]; if (!r || !r.shown) { out[k] = 'not shown'; continue; }
    const bad = [];
    if (ins.left && r.l < ins.left) bad.push(`left ${r.l} < ${ins.left} (${Math.min(ins.left, r.r) - r.l}px of ${r.w} in band)`);
    if (ins.right && r.r > m.W - ins.right) bad.push(`right ${r.r} > ${m.W - ins.right} (${r.r - Math.max(m.W - ins.right, r.l)}px of ${r.w} in band)`);
    out[k] = bad.length ? bad : 'clear';
  }
  return out;
};

// approximate housing rectangle on either short edge (landscape left or right), centred vertically
const underHousing = (m, h) => {
  if (!h) return 'no housing';
  const y0 = m.H / 2 - h.w / 2, y1 = m.H / 2 + h.w / 2, xL0 = h.off, xL1 = h.off + h.depth, xR0 = m.W - h.off - h.depth, xR1 = m.W - h.off;
  const out = { housing: `${h.kind}: y ${Math.round(y0)}-${Math.round(y1)}, x ${xL0}-${xL1} (left) or ${xR0}-${xR1} (right)` };
  for (const k of ['form', 'mic', 'send']) {
    const r = m[k]; if (!r || !r.shown) { out[k] = 'not shown'; continue; }
    const vy = Math.max(0, Math.min(r.b, y1) - Math.max(r.t, y0));
    const lx = Math.max(0, Math.min(r.r, xL1) - Math.max(r.l, xL0));
    const rx = Math.max(0, Math.min(r.r, xR1) - Math.max(r.l, xR0));
    out[k] = { yRange: `${r.t}-${r.b}`, overlapY: Math.round(vy), overlapLeftX: Math.round(lx), overlapRightX: Math.round(rx), coveredPx2: Math.round(vy * Math.max(lx, rx)) };
  }
  return out;
};

const L = await local({ variant: 'typical', clock: 'demo' });
const res = { note: 'insets are injected by overriding the --safe-* tokens (env() is 0 in the rig); housing rectangles are approximate' };
try {
  for (const M of MODELS) {
    const r = {};
    for (const withIns of [false, true]) {
      if (!withIns && !M.housing) continue;
      const ins = withIns ? M.ins : { left: 0, right: 0, bottom: 0 };
      const d = await L.device({ device: 'iphone-pwa', profile: 'mom' });
      await d.page.setViewportSize(M.vp);
      await d.goto('#chat');
      await d.page.addStyleTag({ content: inset(ins) });
      await sleep(1500);
      const m = await measure(d.page);
      const k = withIns ? 'withInsets' : 'insets0';
      r[k] = { ins, ...m, intoBand: intoBand(m, M.ins), underHousing: withIns ? underHousing(m, M.housing) : undefined };
      if (withIns && M.shot) {
        await d.page.evaluate(({ ins, h }) => {
          const add = s => { const e = document.createElement('div'); e.style.cssText = 'position:fixed;z-index:2147483647;pointer-events:none;' + s; document.body.appendChild(e); };
          if (ins.left) add(`top:0;bottom:0;left:0;width:${ins.left}px;background:rgba(255,0,0,.25)`);
          if (ins.right) add(`top:0;bottom:0;right:0;width:${ins.right}px;background:rgba(255,0,0,.25)`);
          if (ins.bottom) add(`left:0;right:0;bottom:0;height:${ins.bottom}px;background:rgba(255,0,0,.25)`);
          if (h) { const H = innerHeight, W = innerWidth; add(`left:${h.off}px;top:${H / 2 - h.w / 2}px;width:${h.depth}px;height:${h.w}px;background:#000;border-radius:18px`); add(`left:${W - h.off - h.depth}px;top:${H / 2 - h.w / 2}px;width:${h.depth}px;height:${h.w}px;background:rgba(0,0,0,.35);border-radius:18px`); }
        }, { ins, h: M.housing });
        const f = path.join(OUT, `${TAG}-${M.vp.width}x${M.vp.height}-iphone-pwa-light.png`);
        await d.page.screenshot({ path: f, scale: 'css', animations: 'disabled' });
        r.shot = rel(f);
      }
      await d.close();
    }
    if (r.insets0 && r.withInsets) {
      r.formMovedWithInsets = r.insets0.form.l !== r.withInsets.form.l || r.insets0.form.r !== r.withInsets.form.r;
      r.viewsMovedWithInsets = r.insets0.viewsPadding.left !== r.withInsets.viewsPadding.left;
      r.tabbarMovedWithInsets = r.insets0.tabbarPadding && r.insets0.tabbarPadding.left !== r.withInsets.tabbarPadding.left;
    }
    res[M.name] = r;
    console.log('\n== ' + M.name + '\n' + JSON.stringify({ withInsets: r.withInsets && { form: r.withInsets.form, mic: r.withInsets.mic, send: r.withInsets.send, formCss: r.withInsets.formCss, views: r.withInsets.viewsPadding, tabbar: r.withInsets.tabbarPadding, chatTitle: r.withInsets.chatTitle, lastMsg: r.withInsets.lastMsg, intoBand: r.withInsets.intoBand, underHousing: r.withInsets.underHousing }, insets0Form: r.insets0 && r.insets0.form, formMovedWithInsets: r.formMovedWithInsets, viewsMovedWithInsets: r.viewsMovedWithInsets, tabbarMovedWithInsets: r.tabbarMovedWithInsets, shot: r.shot }, null, 1));
  }
} finally {
  fs.writeFileSync(path.join(OUT, TAG + '.json'), JSON.stringify(res, null, 1));
  await L.close();
}
