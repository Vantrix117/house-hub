// round 7: Show above the fold, the result line (jump on appear/fade, wrap, kid size), focus order, modes at 375
import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
const REPO = 'C:/Users/ex_bo/OneDrive/Claude Related/App Hub';
const { local, sleep, DEMO } = await import(pathToFileURL(REPO + '/audits/tools/lib/local.mjs').href);
const OUT = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'));
const SHOTS = path.join(OUT, 'shots8'); fs.mkdirSync(SHOTS, { recursive: true });
const engine = process.env.ENGINE || 'webkit';
const L = await local({ variant: 'typical', clock: 'demo', engine });
const PH = 'Alpha bravo charlie, delta echo foxtrot golf; hotel india juliet kilo lima mike november oscar papa quebec romeo sierra tango.';
const res = {}; const log = (k, v) => { res[k] = v; console.log(k, JSON.stringify(v)); };
const fakeMic = () => { window.__tracks = []; if (navigator.mediaDevices) navigator.mediaDevices.getUserMedia = async () => { const ac = new (window.AudioContext || window.webkitAudioContext)(); const o = ac.createOscillator(); const dst = ac.createMediaStreamDestination(); o.connect(dst); o.start(); return dst.stream; };
  if (typeof window.MediaRecorder !== 'function') window.MediaRecorder = class { constructor(s) { this.state = 'inactive'; this.mimeType = 'audio/webm'; } start() { this.state = 'recording'; } stop() { this.state = 'inactive'; if (this.onstop) this.onstop(); } }; };
async function open(d) { const f = await d.openApp('verses'); await f.waitForFunction(() => document.getElementById('trainer').getAttribute('aria-busy') === 'false', null, { timeout: 15000 }).catch(() => {}); await sleep(800); return f; }
async function dev(profile, w, h, rec = true) { const d = await L.device({ device: 'iphone-pwa', profile, installClock: DEMO }); await d.page.setViewportSize({ width: w, height: h }); if (rec) await d.ctx.addInitScript(fakeMic); await d.ctx.route(u => /\/api\/data\/[^/]+\/batch$/.test(u.pathname), r => r.abort('internetdisconnected')); return d; }
const geo = f => f.evaluate(() => { const g = id => { const e = document.getElementById(id); if (!e || e.hidden || !e.getClientRects().length) return null; const r = e.getBoundingClientRect(); return [Math.round(r.top), Math.round(r.bottom)]; }; return { vh: innerHeight, y: Math.round(scrollY), rated: g('rated'), ref: g('ref'), show: g('show'), say: g('say'), actRate: g('act-rate'), rec: g('rec'), addtext: g('addtext'), edittext: g('edittext'), pm: g('pm'), trH: Math.round(document.getElementById('trainer').getBoundingClientRect().height), text: !!(window.verses && verses.textOf(verses.currentId())) }; });
try {
  // 1. Show on the first screen, with / without text, with the recorder
  for (const [w, h] of [[375, 667], [390, 844]]) for (const withText of [false, true]) {
    const d = await dev('eli', w, h); const f = await open(d);
    if (withText) { const id = await f.evaluate(() => verses.trained().find(i => verses.textOf(i))); if (id) { await f.evaluate(i => verses.practise(i), id); await f.evaluate(() => scrollTo(0, 0)); await sleep(500); } }
    else { const id = await f.evaluate(() => verses.trained().find(i => !verses.textOf(i))); await f.evaluate(i => verses.practise(i), id); await f.evaluate(() => scrollTo(0, 0)); await sleep(500); }
    const g = await geo(f);
    log(`fold-${engine}-${w}x${h}-${withText ? 'text' : 'notext'}`, { ...g, showVisible: !!g.show && g.show[1] <= g.vh });
    await d.page.screenshot({ path: path.join(SHOTS, `fold-${engine}-${w}-${withText ? 'text' : 'notext'}.png`) });
    await d.close();
  }
  // 2. the result line: jump on first appearance (within the 400 ms), on the next card, on fade; wrap; focus order
  for (const [who, w, h] of [['eli', 390, 844], ['eli', 375, 667], ['ezra', 390, 844], ['eli', 1180, 820]]) {
    const d = await dev(who, w, h); const f = await open(d);
    await f.evaluate(() => document.getElementById('show').click()); await sleep(500);
    const a = await geo(f);
    await f.evaluate(() => document.querySelector('#act-rate [data-rate="almost"]').click()); await sleep(60);
    const b = await geo(f);   // during the 400 ms guard, the rated card
    await sleep(800);
    const c = await geo(f);   // the next card
    const line = await f.evaluate(() => { const l = document.getElementById('rated'), t = document.getElementById('rated-text'), u = document.getElementById('rated-undo'); const lh = parseFloat(getComputedStyle(t).lineHeight) || 18; return { text: t.textContent, lines: Math.round(t.getBoundingClientRect().height / lh), h: Math.round(l.getBoundingClientRect().height), undo: [Math.round(u.getBoundingClientRect().width), Math.round(u.getBoundingClientRect().height)], parent: l.parentElement.id, role: l.getAttribute('role'), live: l.getAttribute('aria-live'), fs: getComputedStyle(t).fontSize, color: getComputedStyle(t).color }; });
    await d.page.screenshot({ path: path.join(SHOTS, `line-${engine}-${who}-${w}.png`) });
    // fade after 10 s (fast-forward the page clock if possible)
    try { await d.ctx.clock.runFor(10500); } catch { await sleep(10500); }
    await sleep(400);
    const e = await geo(f);
    const faded = await f.evaluate(() => ({ cls: document.getElementById('rated').className, vis: getComputedStyle(document.getElementById('rated')).visibility }));
    log(`line-${engine}-${who}-${w}x${h}`, { beforeTap: { rated: a.rated, ref: a.ref, actRate: a.actRate }, during: { rated: b.rated, ref: b.ref, actRate: b.actRate }, next: { rated: c.rated, ref: c.ref, show: c.show }, line, afterFade: { rated: e.rated, ref: e.ref, show: e.show, faded } });
    await d.close();
  }
  // 3. focus order on a card with text, after Show (rating row, then the text link, editor, recorder)
  {
    const d = await dev('eli', 390, 844); const f = await open(d);
    const id = await f.evaluate(() => verses.trained().find(i => verses.textOf(i))); await f.evaluate(i => verses.practise(i), id); await sleep(400);
    await f.evaluate(() => document.getElementById('show').click()); await sleep(500);
    const order = await f.evaluate(() => [...document.querySelectorAll('#trainer button, #trainer textarea')].filter(e => !e.disabled && e.tabIndex >= 0 && e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden').map(e => [e.id || e.dataset.rate || e.dataset.mode, Math.round(e.getBoundingClientRect().top)]));
    log(`focusOrder-${engine}`, { order, visualSorted: order.every((x, i) => !i || x[1] >= order[i - 1][1] - 2) });
    await d.page.screenshot({ path: path.join(SHOTS, `revealed-text-${engine}-390.png`), fullPage: true });
    // editor below the ratings
    await f.click('#edittext'); await sleep(300);
    log(`editorPlacement-${engine}`, await f.evaluate(() => { const r = id => Math.round(document.getElementById(id).getBoundingClientRect().top); return { actRate: r('act-rate'), textedit: r('textedit'), actRateHidden: document.getElementById('act-rate').hidden, focus: document.activeElement.id }; }));
    await d.page.screenshot({ path: path.join(SHOTS, `editor-${engine}-390.png`) });
    await d.close();
  }
  // 4. practice modes at 375 (one-row switch), XXL
  for (const ts of [null, 'xxl']) {
    const d = await dev('eli', 375, 667); const f = await open(d);
    const id = await f.evaluate(() => verses.trained().find(i => verses.textOf(i))); await f.evaluate(i => verses.practise(i), id); await sleep(400);
    if (ts) { await f.evaluate(t => document.documentElement.setAttribute('data-text-size', t), ts); await sleep(300); }
    const out = {};
    for (const mode of ['recall', 'letters', 'gaps', 'order']) {
      await f.evaluate(m => versesB.setMode(m), mode); await sleep(300);
      out[mode] = await f.evaluate(() => { const segs = [...document.querySelectorAll('#pm-modes button')].map(b => { const r = b.getBoundingClientRect(); const lh = parseFloat(getComputedStyle(b).lineHeight) || 18; return [b.textContent, Math.round(r.width), Math.round(r.height), Math.round(r.top)]; }); const rows = new Set(segs.map(s => s[3])).size; const small = [...document.querySelectorAll('#pm-area button')].filter(b => { const r = b.getBoundingClientRect(); return r.height < 44 || r.width < 44; }).length; const s = document.getElementById('show').getBoundingClientRect(); return { rows, segs: segs.map(s => s.slice(0, 3)), small, hscroll: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, show: [Math.round(s.top), Math.round(s.bottom)], vh: innerHeight }; });
      await f.evaluate(() => document.getElementById('trainer').scrollIntoView()); await sleep(150);
      await d.page.screenshot({ path: path.join(SHOTS, `mode-${engine}-375-${ts || 'm'}-${mode}.png`) });
      await f.evaluate(() => scrollTo(0, 0));
    }
    log(`modes-${engine}-375-${ts || 'm'}`, out);
    await f.evaluate(() => versesB.setMode('recall'));
    await d.close();
  }
} catch (e) { console.error('ERR', e); }
finally { fs.writeFileSync(path.join(OUT, `r8-${engine}.json`), JSON.stringify(res, null, 1)); await L.close(); }
