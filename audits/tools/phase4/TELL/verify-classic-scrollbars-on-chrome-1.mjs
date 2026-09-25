// Skeptic #1 for TELL "classic-scrollbars-on-chrome". Independent re-measure, not a copy of scrollbars.mjs.
//   node audits/tools/phase4/TELL/verify-classic-scrollbars-on-chrome-1.mjs
//   → audits/evidence/p4/TELL/verify-classic-scrollbars-on-chrome-1.json (+ one 1x crop of the shell gutter)
// Two runs of the same probes on the same local rig:
//   A = the harness default (lib/local.mjs L.device, headless Chromium with Playwright's default args, i.e. --hide-scrollbars)
//   B = a second headless Chromium with ignoreDefaultArgs ['--hide-scrollbars'] (what a Windows PC / mouse Mac paints)
// For each target: bar px = offsetWidth - clientWidth - borders (vertical) or offsetHeight - clientHeight - borders
// (horizontal), scrollHeight/clientHeight, computed scrollbar-width / scrollbar-color, and (B only) the RGB of the
// gutter pixel column vs the page background pixel next to it, sampled from a 1x screenshot.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep, playwright } from '../../lib/local.mjs';
import { contextOptions } from '../../lib/devices.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const EV = path.join(ROOT, 'audits/evidence/p4/TELL');
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));

// area → [profile, device, [[label, frame?, selector, openAction?]]]
const T = {
  shell: ['eli', 'desktop', [['#views', null, '#views']]],
  tv: ['tv', 'tv', [['#views', null, '#views']]],
  f260: ['eli', 'desktop', [['document', 'f260', ':root'], ['.side', 'f260', '.side']]],
  leftovers: ['eli', 'desktop', [['document', 'leftovers', ':root']]],
  prayer: ['eli', 'desktop', [['document', 'prayer', ':root']]],
  tally: ['eli', 'desktop', [['document', 'tally', ':root']]],
  timer: ['eli', 'desktop', [['document', 'timer', ':root']]],
  kidverse: ['ezra', 'desktop', [['document', 'kidverse', ':root']]],
  verses: ['eli', 'desktop', [['document', 'verses', ':root']]],
  dollywood: ['eli', 'desktop', [['document', 'dollywood', ':root'], ['#chips', 'dollywood', '#chips'], ['#tab-list', 'dollywood', '#tab-list']]],
  'dollywood-live': ['eli', 'desktop', [['.lv-body (after #lv-search)', 'dollywood-live', '.lv-body', '#lv-search']]],
};
const PROBE = (sel) => {
  const px = v => parseFloat(v) || 0;
  if (sel === ':root') {
    const se = document.scrollingElement;
    return { found: true, sh: se.scrollHeight, ch: se.clientHeight, v: innerWidth - document.documentElement.clientWidth, h: innerHeight - document.documentElement.clientHeight, sw: getComputedStyle(document.documentElement).scrollbarWidth, sc: getComputedStyle(document.documentElement).scrollbarColor, ov: getComputedStyle(document.documentElement).overflowY + '/' + getComputedStyle(document.body).overflowY };
  }
  const all = [...document.querySelectorAll(sel)].filter(e => e.getBoundingClientRect().width > 1);
  const e = all[0];
  if (!e) return { found: false };
  const s = getComputedStyle(e); const r = e.getBoundingClientRect();
  return { found: true, n: all.length, sh: e.scrollHeight, ch: e.clientHeight, swd: e.scrollWidth, cw: e.clientWidth, v: Math.round(e.offsetWidth - e.clientWidth - px(s.borderLeftWidth) - px(s.borderRightWidth)), h: Math.round(e.offsetHeight - e.clientHeight - px(s.borderTopWidth) - px(s.borderBottomWidth)), sw: s.scrollbarWidth, sc: s.scrollbarColor, ov: s.overflowX + '/' + s.overflowY, rect: [r.x, r.y, r.width, r.height].map(Math.round) };
};

async function ctxFor(browser, L, profile, dev) {
  const ctx = await browser.newContext({ ...contextOptions(dev, 'light'), serviceWorkers: 'block' });
  await ctx.route('https://house-hub-api.catalystfarm1.workers.dev/**', r => r.abort());
  const S = L.S;
  const cfg = { site: L.site, api: L.api, device: S.info.device, session: S.sessions[profile], profiles: S.profiles, last: profile };
  await ctx.addInitScript(c => { try { if (location.origin === c.site && !localStorage.getItem('rig.init')) { localStorage.clear(); localStorage.setItem('hub.api', JSON.stringify(c.api)); localStorage.setItem('hub.device', JSON.stringify(c.device)); localStorage.setItem('hub.session', JSON.stringify(c.session)); localStorage.setItem('hub.profiles', JSON.stringify(c.profiles)); localStorage.setItem('hub.lastProfile', JSON.stringify(c.last)); localStorage.setItem('rig.init', '1'); } } catch {} }, cfg);
  return ctx;
}
// read pixel RGBs out of a PNG buffer by decoding it in the page
async function pixels(page, buf, pts) {
  return page.evaluate(async ({ b64, pts }) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    return pts.map(([x, y]) => [...g.getImageData(x, y, 1, 1).data].slice(0, 3));
  }, { b64: buf.toString('base64'), pts });
}

const out = { finding: 'classic-scrollbars-on-chrome', chrome: CHROME, runs: {} };
const L = await local({ variant: 'typical', engine: 'chromium' });
const pw = playwright();
const bB = await pw.chromium.launch({ executablePath: CHROME, headless: true, ignoreDefaultArgs: ['--hide-scrollbars'] });
try {
  out.defaultArgsHaveHideScrollbars = pw.chromium._defaultArgs ? 'n/a' : 'see run A';
  for (const [run, browser] of [['A_default', L.browser], ['B_noHide', bB]]) {
    out.runs[run] = {};
    for (const [area, [profile, dev, targets]] of Object.entries(T)) {
      const ctx = await ctxFor(browser, L, profile, dev);
      const page = await ctx.newPage();
      const R = {};
      try {
        const shellArea = area === 'shell' || area === 'tv';
        await page.goto(L.site + '/index.html#' + (shellArea ? 'home' : area), { waitUntil: 'load' });
        await sleep(/dollywood/.test(area) ? 4500 : 3000);
        for (const [label, fid, sel, open] of targets) {
          const fr = fid ? page.frames().find(f => f.url().includes(`/apps/${fid}.html`)) : page.mainFrame();
          if (!fr) { R[label] = { err: 'no frame' }; continue; }
          if (open) { await fr.click(open, { timeout: 4000 }).catch(e => { R[label + ' open'] = e.message.split('\n')[0]; }); await sleep(1500); }
          const m = await fr.evaluate(PROBE, sel).catch(e => ({ err: e.message.slice(0, 80) }));
          if (run === 'B_noHide' && m.found && (m.v > 0 || m.h > 0)) {
            const buf = await page.screenshot({ scale: 'css' });
            const off = fid ? await page.$eval('#frame', e => { const r = e.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; }) : [0, 0, 0, 0];
            const vp = page.viewportSize();
            let pts;
            if (sel === ':root') { const x1 = Math.round(off[0] + off[2] - 5), y = Math.round(off[1] + Math.min(off[3] - 40, 400)); pts = [[x1, y], [x1 - 25, y]]; }
            else if (m.v > 0) { const x1 = Math.round(off[0] + m.rect[0] + m.rect[2] - 3), y = Math.round(off[1] + m.rect[1] + Math.min(m.rect[3] - 5, 300)); pts = [[Math.min(x1, vp.width - 1), Math.min(y, vp.height - 1)], [Math.min(x1, vp.width - 1) - 25, Math.min(y, vp.height - 1)]]; }
            else { const x = Math.round(off[0] + m.rect[0] + 200), y1 = Math.round(off[1] + m.rect[1] + m.rect[3] - 3); pts = [[x, Math.min(y1, vp.height - 1)], [x, Math.min(y1, vp.height - 1) - 14]]; }
            m.px = { gutterOrBar: (await pixels(page, buf, pts))[0], inside: (await pixels(page, buf, pts))[1], at: pts };
            if (area === 'shell' && label === '#views') {
              const f = path.join(EV, 'verify-classic-scrollbars-on-chrome-1-shell-views.png');
              await page.screenshot({ path: f, scale: 'css', clip: { x: vp.width - 200, y: 0, width: 200, height: 500 } });
              m.shot = path.relative(ROOT, f).replace(/\\/g, '/');
            }
          }
          R[label] = m;
        }
      } catch (e) { R.error = String(e.message).split('\n')[0]; }
      await ctx.close();
      out.runs[run][area] = R;
      console.log(run, area, JSON.stringify(Object.fromEntries(Object.entries(R).map(([k, m]) => [k, m && m.found ? `v${m.v} h${m.h} sw=${m.sw} ov=${m.ov}${m.sh != null ? ` sh${m.sh}/ch${m.ch}` : ''}${m.px ? ` bar${JSON.stringify(m.px.gutterOrBar)} in${JSON.stringify(m.px.inside)}` : ''}` : m]))));
    }
  }
  fs.writeFileSync(path.join(EV, 'verify-classic-scrollbars-on-chrome-1.json'), JSON.stringify(out, null, 1));
} finally { await bB.close().catch(() => {}); await L.close(); }
