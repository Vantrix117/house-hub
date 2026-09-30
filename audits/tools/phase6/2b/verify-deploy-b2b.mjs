// Phase 2 / PWA — skeptic #2 for "deploy-invisible-within-max-age".
// Claim: with GitHub Pages' Cache-Control: max-age=600, a VERSION-bump deploy precaches the OLD files (sw.js:22 c.add(u)
// goes through the HTTP cache), the open page still toasts "Hub updated", and the old build keeps loading.
//   node "audits/tools/phase2/PWA/verify-deploy-invisible-within-max-age-2.mjs"
// Independent of sw.mjs. A Chrome of our own with NO Playwright routes (a route turns the HTTP cache off), production made
// unreachable by DNS (--host-resolver-rules), the page pointed at the rig's API before any script runs. Four runs, each on a
// fresh local instance:
//   A  max-age=600, deploy (VERSION bump + marker in index.html and apps/hub.js) right after use → what the new cache holds,
//      the toast, two cold opens.
//   B  max-age=15, same deploy, cold opens after waiting 18 s → how long the lag lasts.
//   C  max-age=15, the device sits idle 18 s BEFORE the deploy (HTTP cache entries expired) → does the bump then work?
//   D  max-age=600, the same deploy but its sw.js precaches with new Request(u, { cache: 'reload' }) → does the proposed fix work?
// Overlays live under audits/tools/phase2/PWA/verify2-overlay-*/ and are deleted at the end.
const { local, sleep } = await import(new URL('file:///' + process.cwd().replace(/\\/g, '/') + '/audits/tools/lib/local.mjs').href);
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.cwd();   // PATCHED COPY (batch 2b)
const HERE = path.join(ROOT, 'audits/tools/phase2/PWA');
const OUT = path.join(ROOT, 'audits/evidence/p2/PWA');
const rel = f => path.relative(ROOT, f).replace(/\\/g, '/');

const idx = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const hubjs = fs.readFileSync(path.join(ROOT, 'apps/hub.js'), 'utf8');
const swSrc = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const VERSION = /const VERSION = '([^']+)'/.exec(swSrc)[1];
const NEWV = VERSION + '-v2check';
const MARK = 'DEPLOYED-BUILD-2';
function overlay(name, fix) {
  const dir = path.join(HERE, name);
  fs.mkdirSync(path.join(dir, 'apps'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), idx.replace('<head>', `<head>\n<meta name="audit-build" content="${MARK}">`));
  fs.writeFileSync(path.join(dir, 'apps/hub.js'), `/* ${MARK} */\n` + hubjs);
  let sw = swSrc.replace(`const VERSION = '${VERSION}'`, `const VERSION = '${NEWV}'`);
  if (fix) { const before = sw; sw = sw.replace('c.add(u)', "c.add(new Request(u, { cache: 'reload' }))"); if (sw === before && !/cache: 'reload'/.test(sw)) throw new Error('fix patch did not apply'); }
  fs.writeFileSync(path.join(dir, 'sw.js'), sw);
  return rel(dir);
}
const OV = overlay('verify2b2b-overlay-bump', false);
const OV_FIX = overlay('verify2b2b-overlay-fix', true);

const waitFor = async (page, fn, arg, ms = 20000) => { const end = Date.now() + ms; while (Date.now() < end) { try { if (await page.evaluate(fn, arg)) return true; } catch {} await sleep(250); } return false; };
const build = page => page.evaluate(() => { const m = document.querySelector('meta[name="audit-build"]'); return m ? m.content : 'ORIGINAL'; });

async function run(label, cc, { idleBeforeDeploy = 0, waitAfter = 0, ov = OV } = {}) {
  const L = await local({ variant: 'typical', clock: 'demo', engine: 'chromium', siteCacheControl: cc });
  const exe = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));
  const browser = await L.pw.chromium.launch({ executablePath: exe, headless: true,
    args: ['--host-resolver-rules=MAP house-hub-api.catalystfarm1.workers.dev 127.0.0.1:9, MAP *.workers.dev 127.0.0.1:9, MAP queue-times.com 127.0.0.1:9, MAP fonts.googleapis.com 127.0.0.1:9, MAP fonts.gstatic.com 127.0.0.1:9, MAP vantrix117.github.io 127.0.0.1:9'] });
  const r = { label, cacheControl: cc, idleBeforeDeployMs: idleBeforeDeploy, waitAfterUpdateMs: waitAfter, overlay: ov };
  try {
    const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 }, serviceWorkers: 'allow', timezoneId: 'America/New_York', locale: 'en-US' });
    await ctx.addInitScript(c => { try { if (location.origin === c.site && !localStorage.getItem('rig.init')) { localStorage.clear(); localStorage.setItem('hub.api', JSON.stringify(c.api)); localStorage.setItem('hub.device', JSON.stringify(c.device)); localStorage.setItem('hub.session', JSON.stringify(c.session)); localStorage.setItem('hub.profiles', JSON.stringify(c.profiles)); localStorage.setItem('hub.lastProfile', JSON.stringify('eli')); localStorage.setItem('rig.init', '1'); } } catch {} },
      { site: L.site, api: L.api, device: L.S.info.device, session: L.S.sessions.eli, profiles: L.S.profiles });
    await ctx.addInitScript(() => { window.__toasts = []; new MutationObserver(() => { const t = document.getElementById('hub-toast'); if (t && t.textContent && !window.__toasts.includes(t.textContent)) window.__toasts.push(t.textContent); }).observe(document, { subtree: true, childList: true, characterData: true }); });
    const prodHits = [];
    ctx.on('request', q => { if (/workers\.dev|github\.io/.test(q.url())) prodHits.push(q.url()); });
    const page = await ctx.newPage();
    const open = async () => { await page.goto('about:blank'); await page.goto(L.site + '/index.html#home', { waitUntil: 'load' }); await sleep(1500); return build(page); };
    await page.goto(L.site + '/index.html#home', { waitUntil: 'load' });
    await waitFor(page, () => !!navigator.serviceWorker.controller);
    await waitFor(page, async () => (await (await caches.open((await caches.keys())[0] || 'x')).keys()).length >= 60);
    r.warmOpen = await open();   // a second, controlled open: the old SW serves from Cache Storage and revalidates through the HTTP cache
    // Is the HTTP cache really on? only-if-cached answers from the HTTP cache alone (the SW passes it through with fetch(req)).
    r.httpCacheHoldsIndexBeforeDeploy = await page.evaluate(async () => { try { const x = await fetch('index.html', { cache: 'only-if-cached', mode: 'same-origin' }); return x.status; } catch (e) { return 'miss: ' + e.message; } });
    if (idleBeforeDeploy) await sleep(idleBeforeDeploy);
    await L.overlay(ov);
    const t0 = Date.now();
    await page.evaluate(() => navigator.serviceWorker.getRegistration().then(x => x.update()));
    r.newCacheActivated = await waitFor(page, v => caches.keys().then(k => k.includes(v) && k.length === 1), NEWV, 25000);
    await sleep(2500);
    r.secondsToActivate = Math.round((Date.now() - t0) / 100) / 10;
    r.toastsOnOpenPage = await page.evaluate(() => window.__toasts);
    r.newCache = await page.evaluate(async ({ v, mark }) => {
      const c = await caches.open(v); const out = {};
      for (const k of ['./', 'index.html', 'apps/hub.js', 'sw.js']) { const m = await c.match(k); out[k] = !m ? 'missing' : ((await m.text()).includes(mark) ? 'DEPLOYED' : 'OLD'); }
      return out;
    }, { v: NEWV, mark: MARK });
    if (waitAfter) await sleep(waitAfter);
    r.coldOpens = [await open(), await open(), await open()];
    r.productionRequests = prodHits.length;
    await ctx.close();
  } finally { await browser.close().catch(() => {}); await L.close(); }
  console.log('\n== ' + label + '\n' + JSON.stringify(r, null, 1));
  return r;
}

const results = [];
try {
  results.push(await run('A max-age=600, deploy right after use', 'max-age=600'));
  results.push(await run('B max-age=15, deploy right after use, cold opens 18 s later', 'max-age=15', { waitAfter: 18000 }));
  results.push(await run('C max-age=15, device idle 18 s before the deploy', 'max-age=15', { idleBeforeDeploy: 18000 }));
  results.push(await run("D max-age=600, deploy whose sw.js precaches with cache:'reload'", 'max-age=600', { ov: OV_FIX }));
} finally {
  fs.writeFileSync(path.join(OUT, 'verify-deploy-invisible-within-max-age-2-b2b.json'), JSON.stringify(results, null, 1));
  for (const o of [OV, OV_FIX]) fs.rmSync(path.join(ROOT, o), { recursive: true, force: true });
  console.log('\nwrote audits/evidence/p2/PWA/verify-deploy-invisible-within-max-age-2.json; overlays removed');
}
