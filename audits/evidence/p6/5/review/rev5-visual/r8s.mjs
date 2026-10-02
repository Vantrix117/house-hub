// round 7b: after Show, are the ratings on screen (adult, with/without text, recorder in Chromium); recorder placement
import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
const REPO = 'C:/Users/ex_bo/OneDrive/Claude Related/App Hub';
const { local, sleep, DEMO } = await import(pathToFileURL(REPO + '/audits/tools/lib/local.mjs').href);
const OUT = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'));
const SHOTS = path.join(OUT, 'shots8'); fs.mkdirSync(SHOTS, { recursive: true });
const engine = process.env.ENGINE || 'chromium';
const L = await local({ variant: 'typical', clock: 'demo', engine });
const res = {}; const log = (k, v) => { res[k] = v; console.log(k, JSON.stringify(v)); };
const fakeMic = () => { if (navigator.mediaDevices) navigator.mediaDevices.getUserMedia = async () => { const ac = new AudioContext(); const dst = ac.createMediaStreamDestination(); const o = ac.createOscillator(); o.connect(dst); o.start(); return dst.stream; }; };
try {
  for (const [w, h] of [[375, 667], [390, 844]]) for (const withText of [false, true]) {
    const d = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: DEMO }); await d.page.setViewportSize({ width: w, height: h }); await d.ctx.addInitScript(fakeMic);
    await d.ctx.route(u => /\/api\/data\/[^/]+\/batch$/.test(u.pathname), r => r.abort('internetdisconnected'));
    const f = await d.openApp('verses'); await f.waitForFunction(() => document.getElementById('trainer').getAttribute('aria-busy') === 'false', null, { timeout: 15000 }).catch(() => {}); await sleep(800);
    const id = await f.evaluate(t => verses.trained().find(i => !!verses.textOf(i) === t), withText); await f.evaluate(i => verses.practise(i), id); await f.evaluate(() => scrollTo(0, 0)); await sleep(500);
    const g = id => f.evaluate(i => { const e = document.getElementById(i); if (!e || e.hidden || !e.getClientRects().length) return null; const r = e.getBoundingClientRect(); return [Math.round(r.top), Math.round(r.bottom)]; }, id);
    const before = { vh: await f.evaluate(() => innerHeight), say: await g('say'), show: await g('show'), rec: await g('rec'), addtext: await g('addtext') };
    await d.page.screenshot({ path: path.join(SHOTS, `rec-${engine}-${w}-${withText ? 'text' : 'notext'}-before.png`) });
    await f.locator('#show').tap(); await sleep(1000);
    const after = { y: await f.evaluate(() => Math.round(scrollY)), actRate: await g('act-rate'), say: await g('say'), rec: await g('rec'), edittext: await g('edittext') };
    log(`${engine}-${w}x${h}-${withText ? 'text' : 'notext'}`, { before, after, ratingsVisible: !!after.actRate && after.actRate[0] >= 0 && after.actRate[1] <= before.vh });
    await d.page.screenshot({ path: path.join(SHOTS, `rec-${engine}-${w}-${withText ? 'text' : 'notext'}-after.png`) });
    await d.close();
  }
} catch (e) { console.error('ERR', e); }
finally { fs.writeFileSync(path.join(OUT, `r8s-${engine}.json`), JSON.stringify(res, null, 1)); await L.close(); }
