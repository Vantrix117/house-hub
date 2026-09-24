// Skeptic #2 for SYNC finding "me-sync-card-stale": is the Me -> Sync card really painted once and left stale, and does
// that happen in real household flows or only in a rig-only deep link?
//   node "audits/tools/phase2/SYNC/verify-me-sync-card-stale-2.mjs"
// Fresh local instance (WebKit, real clock), a second paired phone for Eli. Each step prints the card's first three rows,
// the tab-bar dot and the real hub.sync so they can be compared.
// A. Cold open straight onto #me (the URL a browser reload keeps while on Me), wait for the first pull.
// B. Wait for the 30 s periodic pull: does "Last checked" move?
// C. Control: Home -> Me by tab tap repaints.
// D. Pick a theme on Me (a person-scope write): card at once, 3 s and 8 s later, vs hub.sync and the server's row.
// F. Warm reload on #me (cache present): card vs hub.sync after the pull.
// E. Realistic shared-iPad flow: Me -> Switch -> tap Ezra (kid, opens on tap). Where does he land, and is his card right?
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const EVID = path.join(ROOT, 'audits', 'evidence', 'p2', 'SYNC');
fs.mkdirSync(EVID, { recursive: true });
const t0 = Date.now();
const log = (...a) => console.log(((Date.now() - t0) / 1000).toFixed(1).padStart(6) + 's', ...a);
const waitFor = async (fn, timeout = 15000) => { const until = Date.now() + timeout; while (Date.now() < until) { try { const v = await fn(); if (v) return v; } catch {} await sleep(200); } return null; };
const out = {};

const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
try {
  const ph = await L.newDevice({ name: 'Eli phone', profiles: ['eli'] });
  const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: ph });
  const page = phone.page;
  const read = () => page.evaluate(() => {
    const c = [...document.querySelectorAll('#view-me .card')].find(c => c.querySelector('h2') && c.querySelector('h2').textContent.trim() === 'Sync');
    const card = c ? [...c.querySelectorAll('.kv')].slice(0, 3).map(k => k.textContent.replace(/\s+/g, ' ').trim()).join(' | ') : null;
    return { hash: location.hash, tab: document.documentElement.dataset.tab, who: window.hub && hub.profile && hub.profile.id, card, dot: document.getElementById('syncdot').className,
      sync: { state: hub.sync.state, pending: hub.sync.pending, lastPull: hub.sync.lastPull ? new Date(hub.sync.lastPull).toLocaleTimeString() : 0 } };
  });
  // scroll the Sync card into view (it sits below the fold on a phone) so the screenshot shows it beside the tab-bar dot
  const shot = async name => {
    await page.evaluate(() => { const c = [...document.querySelectorAll('#view-me .card')].find(c => c.querySelector('h2') && c.querySelector('h2').textContent.trim() === 'Sync'); if (c) c.scrollIntoView({ block: 'center' }); });
    await sleep(300);
    const f = path.join(EVID, `verify-me-sync-card-stale-2-${name}.png`); await page.screenshot({ path: f, scale: 'css', animations: 'disabled', caret: 'hide' }); return path.relative(ROOT, f).split(path.sep).join('/'); };
  const show = (k, r) => log(`${k}: card "${r.card}" · dot "${r.dot}" · hub.sync ${JSON.stringify(r.sync)} · ${r.who} on ${r.tab} (${r.hash})`);

  // A
  await phone.goto('#me');
  out.A0 = await read(); show('A0 cold open on #me, at load', out.A0);
  await waitFor(() => page.evaluate(() => hub.sync.lastPull > 0));
  await sleep(1500);
  out.A1 = await read(); show('A1 same page after the first pull', out.A1);
  out.A1shot = await shot('A1-cold-me-after-pull');

  // B
  const first = await page.evaluate(() => hub.sync.lastPull);
  await waitFor(() => page.evaluate(fp => hub.sync.lastPull > fp, first), 40000);
  out.B = await read(); show('B after the 30 s periodic pull', out.B);

  // C
  await page.click('#tabbar .tab[data-tab="home"]'); await sleep(300);
  await page.click('#tabbar .tab[data-tab="me"]'); await sleep(300);
  out.C = await read(); show('C control: Home -> Me tab tap', out.C);

  // D
  const cur = await page.evaluate(() => hub.theme());
  const pick = cur === 'frost' ? 'parchment' : 'frost';
  await page.click(`#theme [data-theme="${pick}"]`);
  out.D0 = await read(); show(`D0 right after picking ${pick}`, out.D0);
  await sleep(3000); out.D3 = await read(); show('D3 3 s later', out.D3);
  await sleep(5000); out.D8 = await read(); show('D8 8 s later', out.D8);
  out.D8shot = await shot('D8-me-8s-after-theme');
  const srv = await L.apiAs('eli', '/api/data/hub?scope=person');
  const row = ((srv.body && srv.body.items) || []).find(i => i.key === 'theme');
  out.Dserver = row ? { value: row.value, updated_at: row.updated_at } : null;
  log(`D server's hub/theme row for eli: ${JSON.stringify(out.Dserver)}; localStorage queue: ${JSON.stringify((await phone.hub()).queue)}`);

  // F  (warm reload while on Me: the cache is present now)
  await page.reload({ waitUntil: 'load' });
  out.F0 = await read(); show('F0 warm reload on #me, at load', out.F0);
  await waitFor(() => page.evaluate(() => hub.sync.lastPull > 0)); await sleep(1500);
  out.F1 = await read(); show('F1 warm reload, after the first pull', out.F1);
  out.F1shot = await shot('F1-warm-me-after-pull');

  // E  (Switch lives on the Me hero; kids open on tap)
  await page.click('#switch');
  await waitFor(() => page.$('#profiles .pcard[data-id="ezra"]'));
  await page.click('#profiles .pcard[data-id="ezra"]');
  await waitFor(() => page.evaluate(() => hub.profile && hub.profile.id === 'ezra' && !document.getElementById('shell').hidden));
  out.E0 = await read(); show('E0 Ezra signed in via Switch from Me', out.E0);
  await sleep(4000);
  out.E4 = await read(); show('E4 Ezra 4 s later', out.E4);
  out.E4shot = await shot('E4-ezra-after-switch');
  if (phone.logs && phone.logs.length) out.consoleLogs = phone.logs.slice(0, 20);
} finally { await L.close(); }
const f = path.join(EVID, 'verify-me-sync-card-stale-2.json');
fs.writeFileSync(f, JSON.stringify(out, null, 1));
log('evidence', path.relative(ROOT, f));
