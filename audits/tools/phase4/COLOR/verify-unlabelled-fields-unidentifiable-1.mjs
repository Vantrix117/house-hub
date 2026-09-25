// Skeptic #1 for P4 COLOR "unlabelled-fields-unidentifiable": re-measure, from computed styles, the placeholder colour
// against the field fill and the field boundary (border vs field fill and vs the surface behind), per theme, for the
// shell's #remtext / #chat-in and the app fields named in the finding. Also records whether each field has a visible
// <label>. Colours with alpha are composited over the nearest opaque ancestor background (token-level, no pixel sampling).
// Usage: node audits/tools/phase4/COLOR/verify-unlabelled-fields-unidentifiable-1.mjs
import { local, sleep } from '../../lib/local.mjs';
import fs from 'node:fs'; import path from 'node:path';
const EV = path.resolve('audits/evidence/p4/COLOR'); fs.mkdirSync(EV, { recursive: true });
const probe = ({ sel }) => {
  const parse = s => { if (!s) return null; const srgb = /^color\(srgb/.test(s); const m = s.replace(/^color\(srgb/, '').match(/[\d.]+/g); if (!m) return null; const v = m.map(Number); return { c: v.slice(0, 3).map(x => srgb ? x * 255 : x), a: v.length > 3 ? v[3] : 1 }; };
  const over = (f, b) => f.c.map((v, i) => v * f.a + b[i] * (1 - f.a));
  const lin = v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; };
  const lum = ([r, g, b]) => .2126 * lin(r) + .7152 * lin(g) + .0722 * lin(b);
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return +((x + .05) / (y + .05)).toFixed(2); };
  const e = document.querySelector(sel); if (!e) return { sel, error: 'not found' };
  // backdrop: composite ancestors' backgrounds from the root down
  const chain = []; for (let n = e.parentElement; n; n = n.parentElement) chain.push(n);
  let back = [255, 255, 255]; for (const n of chain.reverse()) { const p = parse(getComputedStyle(n).backgroundColor); if (p && p.a > 0) back = over(p, back); }
  const cs = getComputedStyle(e), fillP = parse(cs.backgroundColor), fill = fillP && fillP.a > 0 ? over(fillP, back) : back;
  const ph = parse(getComputedStyle(e, '::placeholder').color), phC = over(ph, fill);
  const bw = parseFloat(cs.borderTopWidth), bd = parse(cs.borderTopColor), bdC = bw > 0 && cs.borderTopStyle !== 'none' ? over(bd, back) : null;
  const id = e.id; const lab = (id && document.querySelector(`label[for="${id}"]`)) || e.closest('label');
  const visibleLabel = lab ? (lab.innerText || '').replace(e.value || '', '').trim().slice(0, 60) : null;
  return { sel, placeholder: e.placeholder, phColor: getComputedStyle(e, '::placeholder').color, fill: cs.backgroundColor, border: `${cs.borderTopWidth} ${cs.borderTopStyle} ${cs.borderTopColor}`,
    theme: document.documentElement.dataset.theme || 'system', scheme: document.documentElement.dataset.scheme,
    phVsFill: ratio(phC, fill), borderVsFill: bdC ? ratio(bdC, fill) : null, borderVsBack: bdC ? ratio(bdC, back) : null, fillVsBack: ratio(fill, back),
    visibleLabel, ariaLabel: e.getAttribute('aria-label'), fontSize: cs.fontSize };
};
async function themed(L, profile, theme, mode) {
  await L.reset('typical');
  if (!theme.startsWith('system')) { const r = await L.apiAs(profile, '/api/data/hub/theme?scope=person', { method: 'PUT', body: { value: theme } }); if (r.status >= 300) throw new Error('theme PUT ' + r.status); }
  return L.device({ device: 'ipad-portrait', mode, profile, localStorage: theme.startsWith('system') ? {} : { 'hub.theme': JSON.stringify(theme) } });
}
const THEMES = [['system', 'light'], ['system', 'dark'], ['hearth', 'light'], ['parchment', 'light'], ['frost', 'light'], ['midnight', 'light'], ['forest', 'light']];
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const out = [];
const log = (tag, r) => { out.push({ tag, ...r }); console.log(tag, JSON.stringify(r)); };
// ONLY=chatform: the chat composer's visible pane (#chat-form, glass-strong) vs the chat view behind it. Pixel-sampled:
// median of a 6 px band inside the pane's top edge vs a 6 px band just above it, text hidden. PNG crops saved.
const FORM = process.env.ONLY === 'chatform';
const lin = v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; };
const lum = ([r, g, b]) => .2126 * lin(r) + .7152 * lin(g) + .0722 * lin(b);
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return +((x + .05) / (y + .05)).toFixed(2); };
async function formEdge(d, tag) {
  await d.page.addStyleTag({ content: '*,*::placeholder{color:transparent!important;-webkit-text-fill-color:transparent!important;caret-color:transparent!important}' }); await sleep(300);
  const r = await d.page.evaluate(() => { const f = document.querySelector('#chat-form'); const b = f.getBoundingClientRect(); const cs = getComputedStyle(f); return { x: b.x, y: b.y, w: b.width, h: b.height, bg: cs.backgroundColor, border: `${cs.borderTopWidth} ${cs.borderTopStyle} ${cs.borderTopColor}` }; });
  const clip = { x: Math.max(0, r.x - 16), y: Math.max(0, r.y - 16), width: Math.min(r.w + 32, 820 - Math.max(0, r.x - 16)), height: r.h + 32 };
  const buf = await d.page.screenshot({ scale: 'css', animations: 'disabled', clip }); const pth = path.join(EV, `verify-unlabelled-fields-unidentifiable-1-chatform-${tag}.png`); fs.writeFileSync(pth, buf);
  // sample with page.evaluate on a canvas of the PNG
  const px = await d.page.evaluate(async ({ b64, r, clip }) => { const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode(); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0);
    const band = (y0) => { const v = []; for (let y = y0; y < y0 + 6; y++) for (let x = Math.round(r.x - clip.x + r.w * .3); x < Math.round(r.x - clip.x + r.w * .7); x += 2) { const d = g.getImageData(x, y, 1, 1).data; v.push([d[0], d[1], d[2]]); } v.sort((a, b) => (a[0] + a[1] + a[2]) - (b[0] + b[1] + b[2])); return v[v.length >> 1]; };
    const top = Math.round(r.y - clip.y); return { inside: band(top + Math.round(r.h / 2) - 3), outside: band(Math.max(0, top - 10)) }; }, { b64: buf.toString('base64'), r, clip });
  return { ...r, inside: px.inside, outside: px.outside, paneVsBehind: ratio(px.inside, px.outside), png: path.basename(pth) };
}
try {
  if (FORM) for (const [th, mode] of THEMES) { const d = await themed(L, 'eli', th, mode); await d.goto('#chat'); await d.page.waitForSelector('#chat-form:not([hidden])', { timeout: 15000 }); await sleep(1500);
    log(`${th}/${mode} chat-form`, await formEdge(d, `${th}-${mode}`)); await d.close(); }
  else for (const [th, mode] of THEMES) {
    const d = await themed(L, 'eli', th, mode);
    await d.goto('#home'); await d.page.waitForSelector('#remtext', { timeout: 15000 }); await sleep(1500);
    log(`${th}/${mode}`, await d.page.evaluate(probe, { sel: '#remtext' }));
    await d.goto('#chat'); await sleep(1500);
    log(`${th}/${mode}`, await d.page.evaluate(probe, { sel: '#chat-in' }));
    if (th === 'system' || th === 'midnight' || th === 'frost') {
      for (const [app, sels] of [['f260', ['#pass1', '#pass2']], ['prayer', ['#f-title', '#f-for', '#f-phone']], ['leftovers', ['#name']]]) {
        await d.goto('#home'); const f = await d.openApp(app); await sleep(3000);
        for (const s of sels) log(`${th}/${mode} ${app}`, await f.evaluate(probe, { sel: s }));
      }
    }
    if (th === 'system' && mode === 'light') await d.page.goto(d.page.url().split('#')[0] + '#home').catch(() => {});
    await d.close();
  }
  // Build guide #q: generated file, open in the shell
  if (!FORM) for (const [th, mode] of [['system', 'light'], ['midnight', 'light']]) {
    const d = await themed(L, 'eli', th, mode); await d.goto('#home'); const f = await d.openApp('dollywood'); await sleep(5000);
    log(`${th}/${mode} dollywood`, await f.evaluate(probe, { sel: '#q' }));
    await d.close();
  }
} finally { fs.writeFileSync(path.join(EV, FORM ? 'verify-unlabelled-fields-unidentifiable-1-chatform.json' : 'verify-unlabelled-fields-unidentifiable-1.json'), JSON.stringify(out, null, 1)); await L.close(); }
