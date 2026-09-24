// PROF (audit Phase 2), brief item 4 (theme): the next person on the shared iPad inherits the previous person's theme
// until their own first pull lands (and for good if that pull fails). Eli picks Forest (online, saved to the server),
// switches to Ezra while /api/data answers are held for 4 s (a slow network), and the script shoots Ezra's Home during
// the hold and after it. Then the same switch with /api/data unreachable. Local rig only.
//
//   node "audits/tools/phase2/PROF/switch-theme.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/PROF');
fs.mkdirSync(OUT, { recursive: true });
const shot = async (d, name) => { const f = path.join(OUT, name); await d.page.screenshot({ path: f, scale: 'css', animations: 'disabled', caret: 'hide' }); return path.relative(ROOT, f); };
const log = (k, v) => console.log(k.padEnd(46), typeof v === 'string' ? v : JSON.stringify(v));
const L = await local({ variant: 'typical', clock: 'real' });
try {
  const d = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false }); const { page } = d;
  const theme = () => page.evaluate(() => (hub.profile ? hub.profile.id : '(picker)') + ' → ' + (document.documentElement.dataset.theme || 'hearth/system') + ' / ' + document.documentElement.dataset.scheme);
  await d.goto('#me'); await page.waitForSelector('#theme [data-theme="forest"]'); await page.waitForFunction(() => hub.sync.lastPull > 0);
  await page.click('#theme [data-theme="forest"]'); await sleep(1500);
  log('Eli picked Forest; server row', JSON.stringify((await L.apiAs('eli', '/api/data/hub?scope=person&key=theme')).body.item.value));
  // slow network: hold every /api/data answer 4 s
  await d.ctx.route(/\/api\/data\//, async r => { await sleep(4000); await r.continue(); });
  const lp0 = await page.evaluate(() => hub.sync.lastPull);
  await page.click('#switch'); await page.waitForSelector('#profiles .pcard[data-id="ezra"]');
  log('picker', await theme());
  await page.click('#profiles .pcard[data-id="ezra"]'); await page.waitForFunction(() => hub.profile && hub.profile.id === 'ezra');
  await page.click('.tab[data-tab="home"]'); await sleep(500);
  log('Ezra, first pull still in flight', await theme());
  log('evidence', await shot(d, 'switch-theme-ezra-inherits-forest.png'));
  const tHold = Date.now(); await page.waitForFunction(p => hub.sync.lastPull > p, lp0, { timeout: 90000 });
  log('Ezra, after his pull (' + Math.round((Date.now() - tHold) / 1000) + ' s later: 10 channels pulled one by one)', await theme());
  log('evidence', await shot(d, 'switch-theme-ezra-after-pull.png'));
  await d.ctx.unroute(/\/api\/data\//);
  // the data server unreachable after sign-in: the inherited theme stays
  await page.click('.tab[data-tab="me"]'); await page.waitForSelector('#theme [data-theme="midnight"]'); await page.click('#theme [data-theme="midnight"]'); await sleep(1200);
  await d.ctx.route(/\/api\/data\//, r => r.abort('internetdisconnected'));
  await page.click('#switch'); await page.waitForSelector('#profiles .pcard[data-id="kiara"]');
  await page.click('#profiles .pcard[data-id="kiara"]'); await page.waitForFunction(() => hub.profile && hub.profile.id === 'kiara'); await sleep(3000);
  log('Kiara after Ezra picked Midnight, data unreachable', await theme());
  await d.close();
} finally { await L.close(); }
