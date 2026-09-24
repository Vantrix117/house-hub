// Skeptic #2 for "critic-err-line-below-aa-hearth-4": is the add bar's voice-error line below WCAG AA in Hearth?
// Independent of the investigator's script: the error is raised through the REAL code path (a stubbed
// webkitSpeechRecognition that fires onerror -> hub.voiceInput onError -> setErr, apps/leftovers.html:322), and the
// background is read from RENDERED pixels of the glass bar (blur, saturate, brightness, sheen and accent pickup
// included), both over the bare page and with list cards scrolled behind the bar. WebKit, iPhone PWA, Eli, Hearth.
import { local, sleep } from '../../lib/local.mjs';
import fs from 'node:fs';
import path from 'node:path';
const EV = path.resolve('audits/evidence/p3/leftovers'); fs.mkdirSync(EV, { recursive: true });
const PFX = 'verify-critic-err-line-below-aa-hearth-4-2';
const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
const cr = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return +((x + .05) / (y + .05)).toFixed(2); };

const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const out = { engine: 'webkit', device: 'iphone-pwa', profile: 'eli', theme: 'hearth', cases: {} };
try {
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli' });
  // Stub speech recognition in every frame: start() then an async 'no-speech' error, as Safari does on silence.
  await d.ctx.addInitScript(() => {
    class FakeSR { start() { setTimeout(() => { this.onerror && this.onerror({ error: 'no-speech' }); this.onend && this.onend(); }, 50); } stop() {} abort() {} }
    window.webkitSpeechRecognition = FakeSR;
  });
  await d.goto('#home');
  const f = await d.openApp('leftovers');
  await f.waitForSelector('.item .done', { timeout: 20000 }); await sleep(800);
  const theme = await f.evaluate(() => document.documentElement.dataset.theme || '(unset)');
  out.frameTheme = theme;
  await f.click('#mic'); await sleep(500);
  const info = await f.evaluate(() => { const e = document.getElementById('err'); const cs = getComputedStyle(e);
    return { hidden: e.hidden, text: e.textContent, color: cs.color, fontSize: cs.fontSize, fontWeight: cs.fontWeight }; });
  out.err = info; console.log('err line:', JSON.stringify(info));
  const rgb = info.color.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number);

  async function measure(label) {
    await sleep(400);
    // the #err box in page coordinates (frame offset + element rect)
    const fr = await (await f.frameElement()).boundingBox();
    const r = await f.evaluate(() => { const b = document.getElementById('err').getBoundingClientRect(); const s = document.createRange(); s.selectNodeContents(document.getElementById('err')); const t = s.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height, tx: t.x, tw: t.width }; });
    const clip = { x: Math.round(fr.x + r.x), y: Math.round(fr.y + r.y) - 2, width: Math.round(r.w), height: Math.round(r.h) + 4 };
    const png = path.join(EV, `${PFX}-${label}.png`);
    await d.page.screenshot({ path: png, clip, scale: 'css' });
    const b64 = fs.readFileSync(png).toString('base64');
    const textEnd = Math.round(r.tx - r.x + r.tw);
    // decode in a blank page: background = median of pixels right of the text; ink = darkest pixel inside the text box
    const pg = await d.ctx.newPage();
    const px = await pg.evaluate(async ({ b64, textEnd }) => {
      const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0);
      const D = x.getImageData(0, 0, c.width, c.height).data; const bg = [], ink = [];
      for (let yy = 0; yy < c.height; yy++) for (let xx = 0; xx < c.width; xx++) { const i = (yy * c.width + xx) * 4; const p = [D[i], D[i + 1], D[i + 2]];
        if (xx > textEnd + 6) bg.push(p); else if (xx < textEnd) ink.push(p); }
      const L = p => .2126 * p[0] + .7152 * p[1] + .0722 * p[2];
      bg.sort((a, b) => L(a) - L(b)); ink.sort((a, b) => L(a) - L(b));
      return { w: c.width, h: c.height, bgMin: bg[0], bgMed: bg[bg.length >> 1], bgMax: bg[bg.length - 1], inkDarkest: ink[0], nBg: bg.length };
    }, { b64, textEnd });
    await pg.close();
    const res = { clip, png: path.relative(process.cwd(), png).split(path.sep).join('/'), ...px,
      cr_errColour_vs_bgMedian: cr(rgb, px.bgMed), cr_errColour_vs_bgDarkest: cr(rgb, px.bgMin), cr_errColour_vs_bgLightest: cr(rgb, px.bgMax),
      cr_renderedInk_vs_bgMedian: cr(px.inkDarkest, px.bgMed) };
    out.cases[label] = res; console.log(label, JSON.stringify(res));
  }
  // case 1: as it lands (list scrolled to the top; whatever sits behind the bar at rest)
  await measure('at-rest');
  // case 2: list scrolled so cards pass behind the bar
  await f.evaluate(() => { window.scrollTo(0, document.documentElement.scrollHeight / 3); });
  await measure('cards-behind');
  // case 3: scrolled to the end (bare page below the last card)
  await f.evaluate(() => { window.scrollTo(0, document.documentElement.scrollHeight); });
  await measure('scrolled-end');
  await d.page.screenshot({ path: path.join(EV, `${PFX}-full.png`), scale: 'css' });
  // kiosk: is the form (and so the "read only" error line at :293) reachable at all?
  const tv = await L.device({ device: 'tv', profile: 'tv' });
  await tv.goto('#home'); let kioskForm = 'n/a';
  try { const tf = await tv.openApp('leftovers'); await sleep(1500); kioskForm = await tf.evaluate(() => getComputedStyle(document.getElementById('add')).display); } catch (e) { kioskForm = 'openApp failed: ' + e.message.slice(0, 120); }
  out.kioskFormDisplay = kioskForm; console.log('kiosk form display:', kioskForm);
} finally { await L.close(); }
fs.writeFileSync(path.join(EV, `${PFX}.json`), JSON.stringify(out, null, 1));
console.log('saved', `audits/evidence/p3/leftovers/${PFX}.json`);
