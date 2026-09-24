// Skeptic #2 for "switch-lands-on-me": after Me → Switch, where does the next person land?
// Cases on the rig's Kitchen iPad (WebKit, ipad-portrait):
//   A  Eli on Home → tap Me tab → tap Switch → tap Ezra (kid, opens on tap)          → expect Home?
//   B  Eli on Me   → Switch → tap Mae (adult with PIN? — uses the PIN pad if needed)   (only reports whether a PIN pad shows)
//   C  control: Eli on Home → tap Apps tab → go to Me → Switch → Ezra (same as A, different route)
//   D  control: Ezra lands; is a reload / fresh boot on #me also Me? (shows routing is by hash, not by tap)
// Run: node "audits/tools/phase2/HOME/verify-switch-lands-on-me-2.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';

const OUT = path.resolve('audits/evidence/p2/HOME');
fs.mkdirSync(OUT, { recursive: true });
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const res = {};
const state = page => page.evaluate(() => ({
  hash: location.hash,
  tab: document.documentElement.dataset.tab,
  kind: document.documentElement.dataset.kind || null,
  profile: window.hub && hub.profile && hub.profile.id,
  gateHidden: document.getElementById('gate') ? document.getElementById('gate').hidden : null,
  visibleView: [...document.querySelectorAll('.view')].filter(v => getComputedStyle(v).display !== 'none').map(v => v.id),
  h1: (document.querySelector('.view.on h1') || {}).textContent || null,
  cardHeads: [...document.querySelectorAll('.view.on .card h2')].map(h => h.textContent.trim().slice(0, 30)),
  forgetVisible: (() => { const b = document.getElementById('forget'); if (!b) return false; const r = b.getBoundingClientRect(); return r.width > 0 && getComputedStyle(b).display !== 'none' && document.querySelector('#view-me.on') != null; })(),
  letsPlay: [...document.querySelectorAll('#view-home button, #view-home a')].some(b => /let.?s play/i.test(b.textContent)),
}));
try {
  const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli' });
  const p = ipad.page;
  await ipad.goto('#home');
  await p.waitForSelector('#view-home.on', { timeout: 10000 });
  res.before = await state(p);
  await p.click('.tab[data-tab="me"]');
  await p.waitForSelector('#switch', { timeout: 10000 });
  res.onMe = await state(p);
  await p.click('#switch');
  await p.waitForSelector('#profiles .pcard[data-id="ezra"]', { timeout: 10000 });
  res.picker = await state(p);
  await p.click('#profiles .pcard[data-id="ezra"]');
  await p.waitForFunction(() => window.hub && hub.profile && hub.profile.id === 'ezra' && !document.getElementById('shell').hidden, null, { timeout: 10000 });
  await sleep(800);
  res.A_afterEzra = await state(p);
  await p.screenshot({ path: path.join(OUT, 'verify2-switch-lands-on-me-ezra.png'), scale: 'css', animations: 'disabled', caret: 'hide' });
  console.log('[A] Eli Home → Me → Switch → Ezra:', JSON.stringify(res.A_afterEzra));

  // Ezra himself on Me → Switch → Kiara (kid → kid hand-over)
  await p.click('#switch');
  await p.waitForSelector('#profiles .pcard[data-id="kiara"]', { timeout: 10000 });
  await p.click('#profiles .pcard[data-id="kiara"]');
  await p.waitForFunction(() => window.hub && hub.profile && hub.profile.id === 'kiara' && !document.getElementById('shell').hidden, null, { timeout: 10000 });
  await sleep(800);
  res.B_kiaraAfterEzra = await state(p);
  console.log('[B] Ezra (on Me) → Switch → Kiara:', JSON.stringify(res.B_kiaraAfterEzra));

  // Kiara taps Home, then Me → Switch → the picker for an adult (Mae): what does the picker offer
  await p.click('.tab[data-tab="me"]'); await p.waitForSelector('#switch');
  await p.click('#switch');
  await p.waitForSelector('#profiles .pcard[data-id="christian"]', { timeout: 10000 });
  res.C_pickerHash = await p.evaluate(() => location.hash);
  console.log('[C] hash while picker shows (after Kiara switched from Me):', res.C_pickerHash);

  // Control D: the TV's Switch path — kiosk is always routed to home by enterShell (index.html:626)
  // Control E: a switch from a tab other than Me is impossible (Switch only exists in renderMe) — count #switch-like buttons
  res.E_switchButtons = await p.evaluate(() => [...document.querySelectorAll('button')].filter(b => /^\s*switch\s*$/i.test(b.textContent)).map(b => b.id));
  console.log('[E] buttons labelled Switch in DOM now:', JSON.stringify(res.E_switchButtons));
  console.log('pageerrors:', ipad.logs.filter(l => l.startsWith('pageerror')));
  fs.writeFileSync(path.join(OUT, 'verify2-switch-lands-on-me.json'), JSON.stringify(res, null, 2));
} finally {
  await L.close();
}
