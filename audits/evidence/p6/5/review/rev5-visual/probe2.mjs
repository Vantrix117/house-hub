// rev5-visual probe 2: record controls (fake mic), sprite icons in F260/Prayer/Verses inside the hub, reduce-motion flash,
// kid fold after "I said it", the toast's live region
import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
const REPO = process.env.REPO || 'C:/Users/ex_bo/OneDrive/Claude Related/App Hub';
const { local, sleep, DEMO } = await import(pathToFileURL(REPO + '/audits/tools/lib/local.mjs').href);
const OUT = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'));
const SHOTS = path.join(OUT, 'shots'); fs.mkdirSync(SHOTS, { recursive: true });
const engine = process.env.ENGINE || 'webkit';
const L = await local({ variant: 'typical', clock: 'demo', engine });
const PH = 'Alpha bravo charlie, delta echo foxtrot golf; hotel india juliet kilo lima mike november oscar papa quebec romeo sierra tango.';
const res = {};
const log = (k, v) => { res[k] = v; console.log(k, JSON.stringify(v)); };
async function open(d, id = 'verses') { const f = await d.openApp(id); await sleep(1800); return f; }
const fakeMic = () => {
  // a getUserMedia stand-in: an oscillator stream, and a record of the tracks handed out (to see they are stopped)
  window.__tracks = [];
  if (!navigator.mediaDevices) Object.defineProperty(navigator, 'mediaDevices', { value: {}, configurable: true });
  navigator.mediaDevices.getUserMedia = async () => { const ac = new (window.AudioContext || window.webkitAudioContext)(); const o = ac.createOscillator(); const dst = ac.createMediaStreamDestination(); o.connect(dst); o.start(); const s = dst.stream; window.__tracks.push(...s.getTracks()); return s; };
};
try {
  // ── 1. sprite icons render in F260, Prayer, Verses inside the hub ──
  {
    const d = await L.device({ device: 'ipad-portrait', profile: 'eli', installClock: DEMO });
    for (const app of ['f260', 'prayer', 'verses']) {
      const f = await open(d, app);
      await sleep(800);
      const m = await f.evaluate(() => {
        const uses = [...document.querySelectorAll('svg use')].filter(u => /sprite\.svg#/.test(u.getAttribute('href') || u.getAttribute('xlink:href') || ''));
        const vis = uses.filter(u => { const s = u.closest('svg'); const r = s.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(s).visibility !== 'hidden'; });
        const drawn = vis.map(u => { let b = null; try { b = u.getBBox(); } catch {} return { href: u.getAttribute('href').replace(/^.*#/, ''), w: b ? Math.round(b.width) : -1 }; });
        return { total: uses.length, visible: vis.length, empty: drawn.filter(x => x.w <= 0).map(x => x.href), sample: [...new Set(drawn.map(x => x.href))].slice(0, 20) };
      });
      log(`sprite-${app}-${engine}`, m);
      await d.page.screenshot({ path: path.join(SHOTS, `sprite-${app}-${engine}.png`) });
      await d.page.evaluate(() => { location.hash = '#home'; }); await sleep(800);
    }
    await d.close();
  }
  // ── 2. record yourself with a fake microphone ──
  {
    const d = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: DEMO });
    await d.ctx.addInitScript(fakeMic);
    await d.ctx.route(u => /\/api\/data\/[^/]+\/batch$/.test(u.pathname), r => r.abort('internetdisconnected'));
    const f = await open(d);
    const st = await f.evaluate(() => ({ canRecord: versesB.canRecord, MR: typeof MediaRecorder, recHidden: document.getElementById('rec').hidden, btn: document.getElementById('rec-btn').getBoundingClientRect().height }));
    log(`rec-${engine}`, st);
    if (!st.recHidden) {
      await f.click('#rec-btn'); await sleep(1200);
      log(`rec-recording-${engine}`, await f.evaluate(() => ({ state: versesB.recording(), pressed: document.getElementById('rec-btn').getAttribute('aria-pressed'), label: document.getElementById('rec-btn').textContent.trim(), tracks: window.__tracks.map(t => t.readyState) })));
      await d.page.screenshot({ path: path.join(SHOTS, `rec-on-${engine}.png`) });
      await f.click('#rec-btn'); await sleep(800);
      log(`rec-stopped-${engine}`, await f.evaluate(() => ({ state: versesB.recording(), play: !document.getElementById('rec-play').hidden, label: document.getElementById('rec-btn').textContent.trim(), tracks: window.__tracks.map(t => t.readyState), ls: Object.keys(localStorage).filter(k => /rec|audio|blob/i.test(k)) })));
      // rate the card: the recording is dropped
      await f.click('#show'); await sleep(300); await f.click('#act-rate [data-rate="got"]'); await sleep(900);
      log(`rec-afterRate-${engine}`, await f.evaluate(() => ({ state: versesB.recording(), play: !document.getElementById('rec-play').hidden })));
      // recording while the page is hidden: the mic is released
      await f.click('#rec-btn'); await sleep(800);
      await f.evaluate(() => { Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); }); await sleep(600);
      log(`rec-hidden-${engine}`, await f.evaluate(() => ({ state: versesB.recording(), tracks: window.__tracks.map(t => t.readyState) })));
    }
    await d.close();
  }
  // ── 3. kid: after "I said it", are the picture buttons in view? toast live region ──
  for (const [w, h] of [[390, 844], [430, 932], [375, 667]]) {
    const d = await L.device({ device: 'iphone-pwa', profile: 'ezra', installClock: DEMO });
    await d.page.setViewportSize({ width: w, height: h });
    await d.ctx.route(u => /\/api\/data\/[^/]+\/batch$/.test(u.pathname), r => r.abort('internetdisconnected'));
    const f = await open(d);
    if (await f.evaluate(() => document.getElementById('trainer').hidden)) { log(`kidfold-${w}`, 'no card'); await d.close(); continue; }
    const before = await f.evaluate(() => { const s = document.getElementById('show').getBoundingClientRect(); return { show: [Math.round(s.top), Math.round(s.bottom)], vh: innerHeight }; });
    await f.click('#show'); await sleep(500);
    const after = await f.evaluate(() => { const r = [...document.querySelectorAll('#act-rate [data-rate]')].map(b => b.getBoundingClientRect()); return { rateTop: Math.round(Math.min(...r.map(x => x.top))), rateBottom: Math.round(Math.max(...r.map(x => x.bottom))), vh: innerHeight, y: Math.round(scrollY), frameH: innerHeight }; });
    log(`kidfold-${w}x${h}`, { before, after, fullyVisible: after.rateBottom <= after.vh, partlyVisible: after.rateTop < after.vh });
    await d.page.screenshot({ path: path.join(SHOTS, `kidfold-${w}.png`) });
    await d.close();
  }
} catch (e) { console.error('ERR', e); }
finally { fs.writeFileSync(path.join(OUT, `probe2-${engine}.json`), JSON.stringify(res, null, 1)); await L.close(); }
