// Skeptic #2 for finding "tally-taps-glass-cost". Independent re-measurement (does not import perf.mjs).
// Chromium (installed Chrome, headless) on the local instance, Ezra (kid) on ipad-portrait, light, System theme.
// Arms, interleaved in rounds (order reversed on odd rounds), same page state:
//   A  shipped
//   B  every backdrop-filter off (page + app iframe)
//   T  backdrop-filter off on the +/- buttons only (.tbtn) - the dial, who and reset keep theirs
//   X  shipped glass, but the .tbtn press transform suppressed (transform:none) - does the scale drive the cost?
//   N  no backdrop AND no transform
// Action: tap #plus every 450 ms for WIN ms; plus one idle window for A and B.
// Cost: CDP SystemInfo.getProcessInfo cpuTime deltas per wall second, by process type.
// Also: pixel difference of the dial/buttons between A and B (does the blur/saturate change what is seen?).
//   node audits/tools/phase4/GLASS/verify-tally-taps-glass-cost-2.mjs
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const WIN = 5000, ROUNDS = 4;
const OUT = path.join(ROOT, 'audits/evidence/p4/GLASS/verify-tally-taps-glass-cost-2.json');
const OFF = '*,*::before,*::after{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}';
const NOX = '.tbtn,.tbtn:active{transform:none!important;transition:none!important}';
const CSS = { A: null, B: OFF, T: '.tbtn{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}', X: NOX, N: OFF + NOX };
const out = { method: 'see script header', env: {}, layers: [], backdrop: {}, idle: {}, taps: {}, pixel: {} };
const L = await local({ variant: 'typical', engine: 'chromium' });
try {
  const b = await L.browser.newBrowserCDPSession();
  out.env.version = (await b.send('Browser.getVersion')).product;
  const gi = await b.send('SystemInfo.getInfo');
  out.env.gpu = (gi.gpu.devices || []).map(g => g.deviceString); out.env.gpuCompositing = gi.gpu.featureStatus.gpu_compositing;
  const cpu = async () => { const r = await b.send('SystemInfo.getProcessInfo'); const by = {}; for (const p of r.processInfo) by[p.type] = (by[p.type] || 0) + p.cpuTime; return by; };
  const d = await L.device({ device: 'ipad-portrait', mode: 'light', profile: 'ezra' });
  const f = await d.openApp('tally');
  await f.waitForSelector('.dial');
  await f.waitForFunction(() => document.getElementById('who').textContent.trim().length > 0, null, { timeout: 8000 }).catch(() => {});
  await sleep(2500);
  out.kind = await f.evaluate(() => document.documentElement.dataset.kind);
  const setArm = async arm => {
    for (const fr of d.page.frames()) await fr.evaluate(css => { let s = document.getElementById('v2arm'); if (!css) { if (s) s.remove(); return; } if (!s) { s = document.createElement('style'); s.id = 'v2arm'; document.head.appendChild(s); } s.textContent = css; }, CSS[arm]).catch(() => {});
    await sleep(1000);
  };
  for (const fr of d.page.frames()) out.layers.push(...await fr.evaluate(() => [...document.querySelectorAll('*')].filter(e => { const s = getComputedStyle(e); return (s.backdropFilter && s.backdropFilter !== 'none') || (s.webkitBackdropFilter && s.webkitBackdropFilter !== 'none'); }).filter(e => { const r = e.getBoundingClientRect(); return r.width > 1 && r.bottom > 0 && r.top < innerHeight && getComputedStyle(e).display !== 'none'; }).map(e => { const r = e.getBoundingClientRect(); return (location.pathname.split('/').pop()) + ' ' + (e.id ? '#' + e.id : e.tagName.toLowerCase() + '.' + [...e.classList].join('.')) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height) + ' @' + Math.round(r.left) + ',' + Math.round(r.top) + ' bf=' + getComputedStyle(e).backdropFilter; })).catch(() => []));
  out.backdrop = await f.evaluate(() => {
    const bs = getComputedStyle(document.body); const art = document.querySelector('.art'); const ar = art && art.getBoundingClientRect();
    const ov = [...document.querySelectorAll('.dial,.tbtn,#who,#reset')].map(e => { const r = e.getBoundingClientRect(); const o = ar && !(r.right < ar.left || r.left > ar.right || r.bottom < ar.top || r.top > ar.bottom); return (e.id || e.className) + (o ? ' OVERLAPS art' : ' clear of art'); });
    return { bodyBackgroundImage: bs.backgroundImage.slice(0, 240), attachment: bs.backgroundAttachment, art: ar ? [Math.round(ar.left), Math.round(ar.top), Math.round(ar.width), Math.round(ar.height), getComputedStyle(art).opacity] : null, overlap: ov, dialBg: getComputedStyle(document.querySelector('.dial')).backgroundColor, tbtnBg: getComputedStyle(document.querySelector('.tbtn')).backgroundColor };
  });
  // pixel diff A vs B over the glass controls (Chromium paints backdrop-filter)
  const box = await f.evaluate(() => { const r = [...document.querySelectorAll('.dial,.tbtn,#reset')].map(e => e.getBoundingClientRect()); const x = Math.min(...r.map(q => q.left)), y = Math.min(...r.map(q => q.top)); return { x, y, w: Math.max(...r.map(q => q.right)) - x, h: Math.max(...r.map(q => q.bottom)) - y }; });
  const fb = await (await d.page.$('#frame')).boundingBox();
  const clip = { x: fb.x + box.x, y: fb.y + box.y, width: box.w, height: box.h };
  await setArm('A'); const pA = await d.page.screenshot({ clip, scale: 'css' });
  await setArm('B'); const pB = await d.page.screenshot({ clip, scale: 'css' });
  await setArm('A');
  fs.writeFileSync(path.join(ROOT, 'audits/evidence/p4/GLASS/verify-tally-taps-glass-cost-2-A.png'), pA);
  fs.writeFileSync(path.join(ROOT, 'audits/evidence/p4/GLASS/verify-tally-taps-glass-cost-2-B.png'), pB);
  out.pixel = await d.page.evaluate(async ([a, b2]) => {
    const load = s => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = 'data:image/png;base64,' + s; });
    const [ia, ib] = await Promise.all([load(a), load(b2)]);
    const c = document.createElement('canvas'); c.width = ia.width; c.height = ia.height; const x = c.getContext('2d');
    x.drawImage(ia, 0, 0); const da = x.getImageData(0, 0, c.width, c.height).data; x.clearRect(0, 0, c.width, c.height); x.drawImage(ib, 0, 0); const db = x.getImageData(0, 0, c.width, c.height).data;
    let n = 0, sum = 0, max = 0, over5 = 0, over10 = 0;
    for (let i = 0; i < da.length; i += 4) { const dd = Math.max(Math.abs(da[i] - db[i]), Math.abs(da[i + 1] - db[i + 1]), Math.abs(da[i + 2] - db[i + 2])); n++; sum += dd; if (dd > max) max = dd; if (dd > 5) over5++; if (dd > 10) over10++; }
    return { w: c.width, h: c.height, meanMaxChannelDiff: +(sum / n).toFixed(2), maxDiff: max, shareOver5: +(over5 / n).toFixed(3), shareOver10: +(over10 / n).toFixed(3) };
  }, [pA.toString('base64'), pB.toString('base64')]);
  const measure = async (arm, action) => {
    await setArm(arm); const n0 = await f.evaluate(() => document.querySelector('.count').textContent); const c0 = await cpu(); const w0 = Date.now();
    let taps = 0;
    if (action === 'taps') { const plus = f.locator('#plus'); const until = Date.now() + WIN; while (Date.now() < until) { await plus.tap().catch(() => {}); taps++; await sleep(450); } }
    else await sleep(WIN);
    const secs = (Date.now() - w0) / 1000; const c1 = await cpu(); const n1 = await f.evaluate(() => document.querySelector('.count').textContent);
    const by = {}; for (const k of Object.keys(c1)) by[k] = +(((c1[k] || 0) - (c0[k] || 0)) / secs).toFixed(3);
    return { secs: +secs.toFixed(2), taps, count: [n0, n1], total: +Object.values(by).reduce((p, q) => p + q, 0).toFixed(3), renderer: by.renderer, gpu: by.GPU, browser: by.browser };
  };
  for (const arm of ['A', 'B', 'A', 'B']) { (out.idle[arm] ||= []).push(await measure(arm, 'idle')); console.log('idle', arm, JSON.stringify(out.idle[arm].at(-1))); }
  for (let r = 0; r < ROUNDS; r++) for (const arm of (r % 2 ? ['N', 'X', 'T', 'B', 'A'] : ['A', 'B', 'T', 'X', 'N'])) { const m = await measure(arm, 'taps'); (out.taps[arm] ||= []).push(m); console.log('taps', r, arm, JSON.stringify(m)); }
  const med = a => { const s = [...a].sort((x, y) => x - y); return s.length % 2 ? s[(s.length - 1) / 2] : +((s[s.length / 2 - 1] + s[s.length / 2]) / 2).toFixed(3); };
  out.summary = {};
  for (const [k, v] of Object.entries(out.taps)) out.summary[k] = { medianTotal: med(v.map(x => x.total)), medianGpu: med(v.map(x => x.gpu)), medianRenderer: med(v.map(x => x.renderer)), min: Math.min(...v.map(x => x.total)), max: Math.max(...v.map(x => x.total)) };
  out.summary.ratioAB = +(out.summary.A.medianTotal / out.summary.B.medianTotal).toFixed(2);
  await setArm('A');
  await d.close();
} finally {
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
  await L.close();
}
console.log(JSON.stringify({ summary: out.summary, pixel: out.pixel, backdrop: out.backdrop, layers: out.layers, kind: out.kind }, null, 1));
