// Skeptic #2 for "reading mode hides the This-week reflections card it means to keep" (apps/f260.html:184-186 vs 427).
// Independent re-run: iPhone (WebKit) with an unlocked journal + one Apply line, and desktop 1440 (Chromium, locked
// journal) to rule out an engine / width artefact. For #reflect it lists every stylesheet rule that sets display on
// .side and which one wins, then flips reading mode off again to show the card does render outside reading mode.
// The passcode is a throwaway value on the local demo database.
//   node "audits/tools/phase3/f260/verify-reading-mode-hides-reflections-2.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep, DEMO } from '../../lib/local.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EVID = path.resolve(HERE, '..', '..', '..', 'evidence', 'p3', 'f260');
const P = 'verify-reading-mode-hides-reflections-2';
const out = {};
const ready = f => f.waitForFunction(() => { const t = document.getElementById('todayTitle'); return t && t.textContent.trim().length > 0; }, null, { timeout: 15000 });

const probe = f => f.evaluate(() => {
  const vis = e => { for (let x = e; x && x.nodeType === 1; x = x.parentElement) { if (getComputedStyle(x).display === 'none') return 'hidden by ' + (x.id ? '#' + x.id : '.' + [...x.classList].join('.')); } return 'shown'; };
  const side = document.querySelector('.side'), rf = document.getElementById('reflect');
  const rules = [];
  for (const ss of document.styleSheets) { let rs; try { rs = ss.cssRules; } catch (e) { continue; }
    const walk = list => { for (const r of list) { if (r.cssRules && !r.selectorText) { if (!r.media || matchMedia(r.media.mediaText).matches) walk(r.cssRules); continue; }
      if (r.selectorText && r.style && r.style.display && (side.matches(r.selectorText) || rf.matches(r.selectorText))) rules.push(r.selectorText + ' {display:' + r.style.display + '}'); } };
    walk(rs); }
  const b = rf.getBoundingClientRect();
  return { planViewReadmode: document.getElementById('planView').classList.contains('readmode'), sideDisplay: getComputedStyle(side).display,
    reflectOwnDisplay: getComputedStyle(rf).display, reflect: vis(rf), reflectBox: [Math.round(b.width), Math.round(b.height)],
    rfItems: rf.querySelectorAll('.rf-item').length, rfText: rf.innerText.replace(/\s+/g, ' ').trim().slice(0, 120), matchingDisplayRulesInOrder: rules };
});

const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
try {
  const ph = await L.newDevice({ name: 'Eli phone', profiles: ['eli'] });
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: DEMO, as: ph });
  const f = await d.openApp('f260'); await ready(f); await sleep(400);
  // unlock the journal from a HEAR panel and write one Apply line in the current week
  const day0 = await f.evaluate(() => { const t = document.getElementById('todayDone').dataset.target; return t.split('-')[0] + '-0'; });
  await f.evaluate(i => document.querySelector(`[data-jr="${i}"]`).scrollIntoView({ block: 'center' }), day0);
  await f.locator(`[data-jr="${day0}"]`).tap();
  await f.waitForSelector('#pass.on', { timeout: 5000 }); await sleep(150);
  await f.fill('#pass1', '1357'); await f.fill('#pass2', '1357'); await f.locator('#passOk').tap();
  await f.waitForSelector('#pass.on', { state: 'detached', timeout: 8000 }).catch(() => {}); await sleep(300);
  await f.locator(`#jf-${day0}-a`).tap(); await f.locator(`#jf-${day0}-a`).fill('Call Grandma on Thursday.');
  await f.locator(`#jf-${day0}-h`).tap(); await sleep(800);
  out.iphoneBeforeReadingMode = await probe(f);
  await f.evaluate(() => document.getElementById('readBtn').click()); await sleep(800);
  out.iphoneReadingMode = await probe(f);
  await f.evaluate(() => window.scrollTo(0, 0)); await sleep(200);
  await d.page.screenshot({ path: path.join(EVID, P + '-iphone-readmode.png'), scale: 'css', animations: 'disabled', caret: 'hide' });
  await f.evaluate(() => document.getElementById('readExit').click()); await sleep(500);
  out.iphoneAfterExit = await probe(f);
} finally { await L.close(); }

const L2 = await local({ variant: 'typical', clock: 'demo', engine: 'chromium' });
try {
  const d = await L2.device({ device: 'desktop', profile: 'eli' });
  const f = await d.openApp('f260'); await ready(f); await sleep(400);
  await f.evaluate(() => document.getElementById('readBtn').click()); await sleep(800);
  out.desktopChromiumReadingMode = await probe(f);
  await f.evaluate(() => document.getElementById('readExit').click()); await sleep(400);
} finally { await L2.close(); }

fs.writeFileSync(path.join(EVID, P + '.json'), JSON.stringify(out, null, 1));
for (const [k, v] of Object.entries(out)) console.log(k, JSON.stringify(v));
