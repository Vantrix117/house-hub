// round 2b: does a TAP on Show / I said it paint a focus ring on "Not yet"? and the hub viewer's frame vs the screen bottom
import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
const REPO = 'C:/Users/ex_bo/OneDrive/Claude Related/App Hub';
const { local, sleep, DEMO } = await import(pathToFileURL(REPO + '/audits/tools/lib/local.mjs').href);
const OUT = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'));
const SHOTS = path.join(OUT, 'shots2');
const engine = process.env.ENGINE || 'webkit';
const L = await local({ variant: 'typical', clock: 'demo', engine });
const res = {}; const log = (k, v) => { res[k] = v; console.log(k, JSON.stringify(v)); };
try {
  for (const who of ['ezra', 'eli']) {
    const d = await L.device({ device: 'iphone-pwa', profile: who, installClock: DEMO });
    await d.page.setViewportSize({ width: 390, height: 844 });
    await d.ctx.route(u => /\/api\/data\/[^/]+\/batch$/.test(u.pathname), r => r.abort('internetdisconnected'));
    const f = await d.openApp('verses'); await sleep(2500);
    await f.evaluate(() => document.getElementById('show').scrollIntoView({ block: 'nearest' })); await sleep(200);
    await f.locator('#show').tap(); await sleep(900);
    const m = await f.evaluate(() => { const a = document.activeElement; const cs = getComputedStyle(a); return { active: a.dataset.rate || a.id, focusVisible: a.matches(':focus-visible'), outline: cs.outlineStyle + ' ' + cs.outlineWidth, shadow: cs.boxShadow.slice(0, 80) }; });
    log(`tapShow-${who}-${engine}`, m);
    await d.page.screenshot({ path: path.join(SHOTS, `tapShow-${who}-${engine}.png`) });
    // tap a rating, after the cool-down: ring on the next Show?
    await f.locator('#act-rate [data-rate="got"]').tap(); await sleep(1000);
    log(`tapRate-${who}-${engine}`, await f.evaluate(() => { const a = document.activeElement; return { active: a.dataset.rate || a.id, focusVisible: a.matches(':focus-visible') }; }));
    await d.page.screenshot({ path: path.join(SHOTS, `tapRate-${who}-${engine}.png`) });
    // the viewer frame vs the page bottom
    log(`frame-${who}`, await d.page.evaluate(() => { const fr = document.querySelector('#viewer iframe, #frame'); const r = fr && fr.getBoundingClientRect(); return r && { top: Math.round(r.top), bottom: Math.round(r.bottom), vh: innerHeight }; }));
    await d.close();
  }
} catch (e) { console.error('ERR', e); }
finally { fs.writeFileSync(path.join(OUT, `r2b-${engine}.json`), JSON.stringify(res, null, 1)); await L.close(); }
