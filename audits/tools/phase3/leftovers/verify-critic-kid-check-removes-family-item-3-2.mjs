// Skeptic #2 for "a kid's tap on a ✓ in the Larder removes a family fridge item for everyone, with no undo".
// Fresh typical instance. Kiara (kid) on the iPhone PWA and Ezra (kid) on the Kitchen iPad reach the Larder through their own
// launcher, tap one ✓ each (touch tap), and we read the server as Eli, open Eli's own Larder on a second device, and look for
// any undo affordance. Also records what chat intends for kids (finish_leftover is not a kid tool: worker/src/chat.js:52, 336-339).
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';
const EVID = path.resolve('audits/evidence/p3/leftovers'); fs.mkdirSync(EVID, { recursive: true });
const P = 'verify-critic-kid-check-removes-family-item-3-2';
const shot = async (page, n) => { const f = path.join(EVID, `${P}-${n}.png`); await page.screenshot({ path: f, scale: 'css', animations: 'disabled', caret: 'hide' }); return 'audits/evidence/p3/leftovers/' + path.basename(f); };
const live = async (L, as = 'eli') => { const r = await L.apiAs(as, '/api/data/leftovers?scope=family'); const rows = r.body.items || r.body.rows || r.body.data || []; return { live: rows.filter(x => x.value).map(x => x.value.name), tomb: rows.filter(x => !x.value).map(x => x.key) }; };
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const out = { script: `audits/tools/phase3/leftovers/${P}.mjs` };
try {
  out.serverBefore = await live(L);
  async function kidRun(profile, device, label) {
    const ph = await L.newDevice({ name: label, profiles: [profile] });
    const d = await L.device({ device, profile, fixedTime: false, as: ph });
    await d.goto('#home'); await sleep(1500);
    const r = { profile, device };
    r.htmlKind = await d.page.evaluate(() => document.documentElement.dataset.kind);
    const kidApps = await d.page.$('#kid-apps');
    if (kidApps) { await kidApps.tap().catch(() => kidApps.click()); await sleep(700); }
    r.launcher = await d.page.$$eval('.tile[data-id]', ts => ts.filter(t => t.offsetParent).map(t => t.dataset.id));
    const tile = await d.page.$('.tile[data-id="leftovers"]');
    await tile.tap().catch(() => tile.click()); await sleep(600);
    let f; for (let i = 0; i < 80 && !(f = d.frame('leftovers')); i++) await sleep(100);
    await f.waitForFunction(() => window.__larder && document.getElementById('tally').textContent.length > 0, null, { timeout: 15000 });
    r.inApp = await f.evaluate(() => ({ kind: document.documentElement.dataset.kind, canWrite: hub.canWrite, profile: hub.profile.id,
      checks: [...document.querySelectorAll('.item .done')].map(b => { const q = b.getBoundingClientRect(); return { label: b.getAttribute('aria-label'), w: Math.round(q.width), h: Math.round(q.height) }; }),
      tally: document.getElementById('tally').textContent }));
    r.shotBefore = await shot(d.page, `${profile}-${device}-before`);
    const first = await f.$('.item .done');
    const name = await first.evaluate(b => b.closest('.item').querySelector('.nm').textContent);
    await first.tap(); r.tapped = name; await sleep(300);
    r.undoUi = await f.evaluate(() => [...document.querySelectorAll('button,[role=button],a,.toast,[role=status],[role=alert]')].filter(e => e.offsetParent && /undo|restore|put back|oops/i.test(e.textContent + ' ' + (e.getAttribute('aria-label') || ''))).map(e => e.textContent.trim()));
    r.shellToast = await d.page.evaluate(() => [...document.querySelectorAll('.toast,[role=status],[role=alert]')].filter(e => e.offsetParent).map(e => e.textContent.trim()).filter(Boolean));
    await sleep(3000);
    r.shotAfter = await shot(d.page, `${profile}-${device}-after`);
    r.server = await live(L);
    r.removedForHouse = !r.server.live.includes(name);
    return r;
  }
  out.kiara = await kidRun('kiara', 'iphone-pwa', 'Kiara phone');
  out.ezra = await kidRun('ezra', 'ipad-portrait', 'Kitchen iPad (Ezra)');
  // An adult's own device after a pull: the items are gone for everyone.
  const eliDev = await L.newDevice({ name: 'Eli phone', profiles: ['eli'] });
  const eli = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: eliDev });
  await eli.goto('#home'); await sleep(800);
  const ef = await eli.openApp('leftovers');
  await ef.waitForFunction(() => window.__larder && document.getElementById('tally').textContent.length > 0, null, { timeout: 15000 }); await sleep(1500);
  out.eliSees = await ef.evaluate(() => ({ tally: document.getElementById('tally').textContent, names: [...document.querySelectorAll('.item .nm')].map(n => n.textContent) }));
  out.eliShot = await shot(eli.page, 'eli-after-kids');
  const feed = (await L.apiAs('eli', '/api/activity?limit=5')).body;
  out.feedTop = (feed.activity || feed).slice(0, 3).map(a => `${a.profile_id || a.by}: ${a.text}`);
  // Contrast: chat's intent for kids (static facts from worker/src/chat.js).
  const chat = fs.readFileSync('worker/src/chat.js', 'utf8').split('\n');
  out.chatIntent = { kidTools: chat[51].trim(), kidPrompt: chat.find(l => l.includes('fridge clean-up')).trim().slice(0, 260) };
  console.log(JSON.stringify(out, null, 1));
  fs.writeFileSync(path.join(EVID, `${P}.json`), JSON.stringify(out, null, 1));
} finally { await L.close(); }
