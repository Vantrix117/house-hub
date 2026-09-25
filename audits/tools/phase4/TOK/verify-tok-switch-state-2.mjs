// Phase 4 TOK skeptic 2: tok-switch-state. Re-measures the shell's .switch (apps/design.css:455-462) as RENDERED in Me →
// Notifications (index.html:1262-1270), per theme, from screenshot pixels (not tokens): off track vs the card behind it
// (.card.glass = --surface 78% into --bg, design.css:400, no backdrop-filter so no rig blur artefact), knob vs track, on
// track vs card. States: as shipped in the rig (push unsupported → disabled, off, opacity .4), then enabled-off and
// enabled-on by flipping the attributes in the DOM for measurement only.
//   node audits/tools/phase4/TOK/verify-tok-switch-state-2.mjs → audits/evidence/p4/TOK/verify-tok-switch-state-2.json (+ PNGs)
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits', 'evidence', 'p4', 'TOK');
const lum = ([r, g, b]) => { const f = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const cr = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return +((x + 0.05) / (y + 0.05)).toFixed(2); };
const SCEN = [['hearth', 'light'], ['parchment', 'light'], ['frost', 'light'], ['midnight', 'light'], ['forest', 'light'], ['hearth', 'dark']];

async function pixels(page, buf, pts) {
  return page.evaluate(async ({ b64, pts }) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const o = {}; for (const [k, x, y] of pts) { const d = g.getImageData(Math.round(x), Math.round(y), 1, 1).data; o[k] = [d[0], d[1], d[2]]; } return o;
  }, { b64: buf.toString('base64'), pts });
}

const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const res = { script: 'audits/tools/phase4/TOK/verify-tok-switch-state-2.mjs', scenarios: [] };
try {
  for (const [theme, mode] of SCEN) {
    await L.apiAs('eli', '/api/data/hub/theme?scope=person', { method: 'PUT', body: { value: theme, updated_at: Date.now() } });
    const d = await L.device({ device: 'iphone-pwa', mode, profile: 'eli', localStorage: { 'hub.theme': JSON.stringify(theme) } });
    await d.goto('#me'); await sleep(3500);
    const p = d.page;
    const meta = await p.evaluate(() => { const t = document.querySelector('#notif-toggle'); if (!t) return null; t.scrollIntoView({ block: 'center' });
      const cs = getComputedStyle(t), ka = getComputedStyle(t, '::after'); return { dataTheme: document.documentElement.dataset.theme, scheme: document.documentElement.dataset.scheme,
        disabled: t.disabled, checked: t.getAttribute('aria-checked'), opacity: cs.opacity, trackBg: cs.backgroundColor, knobBg: ka.backgroundColor,
        cardBg: getComputedStyle(t.closest('.card')).backgroundColor, cardBgImg: getComputedStyle(t.closest('.card')).backgroundImage.slice(0, 200),
        help: document.querySelector('#notif-help')?.textContent, prefsHidden: document.querySelector('#notif-prefs')?.hidden, nSwitch: document.querySelectorAll('.switch').length }; });
    await sleep(300);
    const row = { theme, os: mode, meta, states: {} };
    for (const st of ['shipped', 'enabled-off', 'enabled-on']) {
      await p.evaluate(st => { const t = document.querySelector('#notif-toggle'); if (st !== 'shipped') { t.disabled = false; t.setAttribute('aria-checked', st === 'enabled-on' ? 'true' : 'false'); } }, st);
      await sleep(700);
      const r = await p.evaluate(() => { const b = document.querySelector('#notif-toggle').getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; });
      const buf = await p.screenshot({ scale: 'css', animations: 'disabled', caret: 'hide' });
      const on = st === 'enabled-on';
      const px = await pixels(p, buf, [['track', r.x + (on ? 10 : 42), r.y + r.h / 2], ['knob', r.x + (on ? 36 : 16), r.y + r.h / 2], ['cardLeft', r.x - 10, r.y + r.h / 2], ['cardAbove', r.x + r.w / 2, r.y - 8]]);
      row.states[st] = { rect: r, px, trackVsCard: cr(px.track, px.cardLeft), trackVsCardAbove: cr(px.track, px.cardAbove), knobVsTrack: cr(px.knob, px.track), knobVsCard: cr(px.knob, px.cardLeft) };
      if (st === 'enabled-off' || (st === 'enabled-on' && (theme === 'midnight'))) {
        const f = path.join(OUT, `verify-tok-switch-state-2-${theme}${mode === 'dark' ? '-darkos' : ''}-${st}.png`);
        await p.screenshot({ path: f, scale: 'css', animations: 'disabled', caret: 'hide', clip: { x: Math.max(0, r.x - 330), y: r.y - 40, width: Math.min(400, r.x + r.w + 20), height: r.h + 80 } });
        row.states[st].png = path.relative(ROOT, f).split(path.sep).join('/');
      }
    }
    res.scenarios.push(row);
    const s = row.states; console.log(`${theme}/${mode} data-theme=${meta.dataTheme} scheme=${meta.scheme} disabled=${meta.disabled} op=${meta.opacity} card=${meta.cardBg} | shipped trk/card ${s.shipped.trackVsCard} knob/trk ${s.shipped.knobVsTrack} | off trk/card ${s['enabled-off'].trackVsCard}/${s['enabled-off'].trackVsCardAbove} knob/trk ${s['enabled-off'].knobVsTrack} knob/card ${s['enabled-off'].knobVsCard} | on trk/card ${s['enabled-on'].trackVsCard} knob/trk ${s['enabled-on'].knobVsTrack} | help="${(meta.help || '').slice(0, 60)}"`);
    await d.ctx.close();
  }
} catch (e) { res.error = String(e && e.stack || e); console.log('ERROR', res.error); }
finally { await L.close(); }
fs.writeFileSync(path.join(OUT, 'verify-tok-switch-state-2.json'), JSON.stringify(res, null, 1));
console.log('wrote audits/evidence/p4/TOK/verify-tok-switch-state-2.json');
