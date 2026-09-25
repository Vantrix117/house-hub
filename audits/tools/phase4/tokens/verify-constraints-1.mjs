#!/usr/bin/env node
// Phase 4 — constraints verifier for the proposed token set (runtime half).
// Serves apps/design.css with its token section (lines 14-289, the part TOKENS.md says the token file replaces)
// swapped for audits/tools/phase4/tokens/proposed-tokens.css, on the local rig only, and measures three things the
// static gate cannot see:
//   A. the display profile (tv, 1920x1080): does the TV board still fit (no horizontal scroll, no clipped text)?
//   B. F260's theme segmented control (apps/f260.html:2028 puts data-theme on each <button>): do the bare
//      [data-theme=…] palette selectors repaint those buttons?
//   C. kid mode: which face do the kid-visible display/serif reads resolve to (house style: ui-rounded throughout)?
// Usage: node audits/tools/phase4/tokens/verify-constraints-1.mjs → audits/evidence/p4/tokens/verify-constraints-1.json
import fs from 'node:fs';
import path from 'node:path';
import { local, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p4/tokens/verify-constraints-1.json');
const lines = fs.readFileSync(path.join(ROOT, 'apps/design.css'), 'utf8').split('\n');
const PROPOSED = fs.readFileSync(path.join(ROOT, 'audits/tools/phase4/tokens/proposed-tokens.css'), 'utf8');
const swapped = [...lines.slice(0, 13), PROPOSED, ...lines.slice(289)].join('\n');
if (!/^:root \{/.test(lines[13]) || !/^\}/.test(lines[288])) throw new Error('design.css token section moved: ' + lines[13] + ' / ' + lines[288]);

const res = { generated: new Date().toISOString(), method: 'design.css lines 14-289 replaced by proposed-tokens.css through a route on the local rig; WebKit', A: {}, B: {}, C: {} };
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
try {
  async function dev(opts, proposed) {
    const d = await L.device(opts);
    if (proposed) await d.ctx.route('**/apps/design.css', r => r.fulfill({ status: 200, contentType: 'text/css', body: swapped }));
    return d;
  }

  // A. the TV board at 1920x1080 and 1024 (kiosk), today vs proposed
  for (const [w, h] of [[1920, 1080], [1024, 768]]) {
    for (const proposed of [false, true]) {
      const d = await dev({ device: 'tv', profile: 'tv' }, proposed);
      await d.page.setViewportSize({ width: w, height: h });
      await d.goto('#home');
      await d.page.waitForTimeout(2500);
      const m = await d.page.evaluate(() => {
        const de = document.documentElement, cs = getComputedStyle(de);
        const clipped = [];
        for (const el of document.querySelectorAll('.tv *')) {
          if (!el.childElementCount && el.textContent.trim() && el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflow !== 'visible')
            clipped.push((el.className || el.tagName) + ': ' + el.textContent.trim().slice(0, 40));
        }
        const tv = document.querySelector('.tv'); const r = tv && tv.getBoundingClientRect();
        const over = []; if (tv) for (const c of tv.children) { const b = c.getBoundingClientRect(); if (b.right > innerWidth + 1 || b.bottom > innerHeight + 1) over.push({ cls: c.className, right: Math.round(b.right), bottom: Math.round(b.bottom) }); }
        return { kind: de.dataset.kind, fsBody: cs.getPropertyValue('--fs-md').trim(), bodyFont: getComputedStyle(document.body).fontSize,
          scrollW: de.scrollWidth, clientW: de.clientWidth, scrollH: de.scrollHeight, innerH: innerHeight,
          tvRect: r && { w: Math.round(r.width), h: Math.round(r.height), bottom: Math.round(r.bottom) }, childrenPastViewport: over, clippedText: clipped.slice(0, 12) };
      });
      const key = `${w}x${h}-${proposed ? 'proposed' : 'today'}`;
      res.A[key] = m;
      if (w === 1920) { const f = path.join(ROOT, `audits/evidence/p4/tokens/verify-constraints-1-tv-${proposed ? 'proposed' : 'today'}.png`); await d.page.screenshot({ path: f, scale: 'css', type: 'png' }); res.A[key].shot = path.relative(ROOT, f).replace(/\\/g, '/'); }
      await d.close();
    }
  }

  // B. F260's theme buttons, proposed tokens, in a light and a dark theme
  for (const theme of ['hearth', 'midnight']) {
    const d = await dev({ device: 'ipad-portrait', profile: 'eli', localStorage: { 'hub.theme': theme } }, true);
    await L.apiAs('eli', '/api/data/hub/theme?scope=person', { method: 'PUT', body: { value: theme } }).catch(() => {});
    const f = await d.openApp('f260');
    await f.waitForTimeout(2000);
    res.B[theme] = await f.evaluate(() => {
      const seg = document.getElementById('themeSeg'); if (!seg) return { error: 'no #themeSeg' };
      const made = !seg.children.length;
      if (made) seg.innerHTML = hub.THEMES.concat([{ id: 'graphite', name: 'Graphite' }]).map(t => '<button data-theme="' + t.id + '">' + t.name + '</button>').join('');
      const root = getComputedStyle(document.documentElement);
      let bgEl = seg; let bg = 'rgba(0, 0, 0, 0)';
      while (bgEl && (bg = getComputedStyle(bgEl).backgroundColor) === 'rgba(0, 0, 0, 0)') bgEl = bgEl.parentElement;
      const out = { rootTheme: document.documentElement.dataset.theme || '(none)', rootScheme: document.documentElement.dataset.scheme, rootText2: root.getPropertyValue('--text-2').trim(), segBackdrop: bg, buttons: [] };
      for (const b of seg.querySelectorAll('button')) {
        const p = document.createElement('span'); p.style.color = 'var(--text-2)'; b.appendChild(p);
        const q = document.createElement('span'); q.style.color = 'var(--text)'; b.appendChild(q);
        const cs = getComputedStyle(b);
        out.buttons.push({ theme: b.dataset.theme, colorScheme: cs.colorScheme, labelColorToday: cs.color, text2InsideButton: getComputedStyle(p).color, textInsideButton: getComputedStyle(q).color, surfaceInsideButton: cs.getPropertyValue('--surface').trim() });
        p.remove(); q.remove();
      }
      if (made) seg.innerHTML = '';
      return out;
    });
    await d.close();
  }
  await L.apiAs('eli', '/api/data/hub/theme?scope=person', { method: 'PUT', body: { value: 'system' } }).catch(() => {});

  // C. kid mode fonts, today vs proposed
  for (const proposed of [false, true]) {
    const d = await dev({ device: 'ipad-portrait', profile: 'ezra' }, proposed);
    const out = {};
    const kv = await d.openApp('kidverse'); await kv.waitForTimeout(2000);
    out.kidverse = await kv.evaluate(() => {
      const r = {}; const cs = getComputedStyle(document.documentElement);
      r.kind = document.documentElement.dataset.kind;
      for (const v of ['--font-sans', '--font-display', '--font-serif', '--font-ui', '--font-numeral']) r[v] = cs.getPropertyValue(v).trim();
      for (const sel of ['.ref h1', '.stars .count', '.rewards .bank b', '.story-head h2', 'body']) { const el = document.querySelector(sel); r[sel] = el ? getComputedStyle(el).fontFamily : 'NOT RENDERED'; }
      return r;
    });
    const lo = await d.openApp('leftovers'); await lo.waitForTimeout(1500);
    out.leftovers = await lo.evaluate(() => ({ kind: document.documentElement.dataset.kind, body: getComputedStyle(document.body).fontFamily }));
    const ta = await d.openApp('tally'); await ta.waitForTimeout(1500);
    out.tally = await ta.evaluate(() => { const el = [...document.querySelectorAll('*')].find(e => /var\(--font-display\)/.test(e.getAttribute('style') || '')) || document.querySelector('.count, .digits, #count, .num'); return { kind: document.documentElement.dataset.kind, digitsSel: el ? (el.className || el.id || el.tagName) : null, digits: el ? getComputedStyle(el).fontFamily : 'NOT FOUND' }; });
    res.C[proposed ? 'proposed' : 'today'] = out;
    await d.close();
  }
} finally {
  await L.close();
}
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(res, null, 2));
console.log(JSON.stringify(res, null, 2));
