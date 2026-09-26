// Skeptic s2, UX-DOLLYWOOD-LIVE-1: what a kid with the beacon on (Ezra) sees when location is denied, vs an adult;
// both the error-handler text (:1404-1405) and the designed denied state (:1267, reached by calling updLoc()).
// Run: node "audits/tools/phase5/ux-verify/UX-DOLLYWOOD-LIVE-1/s2-denied-kid.mjs"
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { local, sleep } from '../../../lib/local.mjs';
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../evidence/p5/ux-verify/UX-DOLLYWOOD-LIVE-1/s2');
fs.mkdirSync(OUT, { recursive: true });
const L = await local({ variant: 'park', clock: 'real', engine: 'webkit' });
const out = {};
const pill = f => f.evaluate(() => { const g = id => document.getElementById(id); const em = g('lv-emoji');
  return { state: g('lv-pill').dataset.state, title: g('loc-sec').textContent, sub: g('loc-acc').textContent, act: g('lv-act').hidden ? null : g('lv-act').textContent,
    glyph: em ? { hidden: em.hidden, text: em.textContent.trim(), statusGlyph: em.classList.contains('st'), hasImg: !!em.querySelector('img') } : null,
    subOverflows: g('loc-acc').scrollWidth > g('loc-acc').clientWidth + 1, subVisibleW: g('loc-acc').clientWidth, subFullW: g('loc-acc').scrollWidth,
    kind: document.documentElement.dataset.kind || null, profileKind: window.hub && hub.profile && hub.profile.kind, viewOnly: VIEW_ONLY() }; });
async function run(profile, key) {
  const d = await L.device({ device: 'iphone-pwa', profile, fixedTime: false });
  try {
    await d.goto('#home'); await sleep(1200);
    const f = await d.openApp('dollywood-live');
    await f.waitForSelector('#lv-pill[data-state]', { timeout: 15000 });
    await f.waitForFunction(() => window.hub && hub.profile, null, { timeout: 10000 }).catch(() => {});
    await sleep(1500);
    const r = { atOpen: await pill(f) };
    const locBtnVisible = await f.evaluate(() => { const b = document.getElementById('loc-btn'); return !!b && !b.hidden && getComputedStyle(b).display !== 'none'; });
    r.locBtnVisible = locBtnVisible;
    if (locBtnVisible) { await f.locator('#loc-btn').click({ timeout: 3000 }).catch(e => r.clickErr = String(e).slice(0, 120)); await sleep(2500); }
    r.afterDenied = await pill(f);
    await d.page.screenshot({ path: path.join(OUT, `${key}-denied-iphone.png`) });
    await f.evaluate(() => updLoc()); await sleep(300);
    r.designedState = await pill(f);
    await d.page.screenshot({ path: path.join(OUT, `${key}-designed-iphone.png`) });
    out[key] = r;
  } finally { await d.close(); }
}
try { await run('ezra', 'ezra'); await run('eli', 'eli'); await run('kiara', 'kiara'); }
finally { fs.writeFileSync(path.join(OUT, 'denied-kid.json'), JSON.stringify(out, null, 2)); console.log(JSON.stringify(out, null, 2)); await L.close(); }
