// UX-LEFTOVERS-2, skeptic s1: what a kid gets in the Larder (Ezra on the Kitchen iPad, Kiara on an iPhone PWA).
// Counts ✓ buttons, form/mic/Hearth visibility, computed type sizes vs the kid tokens, card radius, pictures, and whether
// one ✓ from Kiara removes a family row on the server. Run from the repo root.
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../../lib/local.mjs';

const OUT = path.resolve('audits/evidence/p5/ux-verify/UX-LEFTOVERS-2/s1');
fs.mkdirSync(OUT, { recursive: true });
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const out = {};
const live = async () => { const r = await L.apiAs('eli', '/api/data/leftovers?scope=family'); return (r.body.items || r.body.rows || r.body.data || []).filter(x => x.value).map(x => x.value.name); };
try {
  for (const [profile, device] of [['ezra', 'ipad-portrait'], ['kiara', 'iphone-pwa']]) {
    const d = await L.device({ device, profile });
    await d.goto('#apps'); await sleep(1500);
    const r = { device };
    r.appsGrid = await d.page.$$eval('.tile[data-id]', ts => ts.map(t => t.dataset.id));
    const f = await d.openApp('leftovers');
    await f.waitForFunction(() => window.__larder && document.getElementById('tally').textContent.length > 0, null, { timeout: 15000 });
    await sleep(800);
    r.page = await f.evaluate(() => {
      const cs = s => getComputedStyle(document.querySelector(s));
      const vis = el => !!el && getComputedStyle(el).display !== 'none' && !el.hidden && el.getBoundingClientRect().height > 0;
      const box = s => (q => [Math.round(q.width), Math.round(q.height)])(document.querySelector(s).getBoundingClientRect());
      return {
        kind: document.documentElement.dataset.kind, canWrite: hub.canWrite,
        doneButtons: document.querySelectorAll('.done').length, doneBox: box('.done'),
        formVisible: vis(document.getElementById('add')), micVisible: vis(document.getElementById('mic')), hearthVisible: vis(document.querySelector('.hearth')),
        logBox: box('.log'), micBox: vis(document.getElementById('mic')) ? box('#mic') : null,
        fontPx: { h1: cs('h1').fontSize, name: cs('.nm').fontSize, meta: cs('.meta').fontSize, chip: cs('.status').fontSize, group: cs('.group h2').fontSize, groupSub: cs('.group h2 small').fontSize, lede: cs('.lede').fontSize },
        kidTokens: { fsMd: getComputedStyle(document.documentElement).getPropertyValue('--fs-md').trim(), tap: getComputedStyle(document.documentElement).getPropertyValue('--tap').trim() },
        itemRadius: cs('.item').borderRadius,
        picturesInCards: document.querySelectorAll('.item img, .item picture, .item svg:not([aria-hidden="true"])').length,
        kidRulesInStyle: /data-kind="kid"/.test(document.querySelector('style').textContent),
      };
    });
    await d.shot(path.join(OUT, `kid-${profile}-${device}.png`));
    if (profile === 'kiara') {
      const before = await live();
      const target = await f.evaluate(() => document.querySelectorAll('.nm')[2].textContent);
      await f.tap(`.item:has(.nm:text-is("${target}")) .done`);
      await sleep(3000);
      const after = await live();
      r.tapTarget = target;
      r.removedOnServerByKid = before.filter(n => !after.includes(n));
      const feed = (await L.apiAs('eli', '/api/activity?limit=3')).body;
      r.feedTop = (feed.activity || feed).slice(0, 1).map(a => `${a.profile_id || a.by}: ${a.text}`);
    }
    out[profile] = r;
    await d.close();
  }
  fs.writeFileSync(path.join(OUT, 'kid.json'), JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out, null, 1));
} finally { await L.close(); }
