// s1 skeptic: GAP-LEFTOVERS-1. On the Kitchen iPad as Mae: what can be done to a card (every control inside it, what a
// tap on the name does), then the only fix path for a wrong entry (✓ then log again) on David's item: what the server row
// and the family feed say afterwards. Also: is the 4/7-day rule the same for every food (tone by age only)?
// Output: audits/evidence/p5/ux-verify/GAP-LEFTOVERS-1/s1/
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../../lib/local.mjs';
const OUT = path.resolve('audits/evidence/p5/ux-verify/GAP-LEFTOVERS-1/s1');
fs.mkdirSync(OUT, { recursive: true });
const out = {};
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
try {
  const d = await L.device({ device: 'ipad-portrait', profile: 'christian' });
  const f = await d.openApp('leftovers');
  await f.waitForFunction(() => window.__larder && document.getElementById('tally').textContent.length > 0, null, { timeout: 15000 });
  await sleep(800);
  out.cards = await f.evaluate(() => [...document.querySelectorAll('.item')].map(c => ({
    name: c.querySelector('.nm').textContent, days: +c.dataset.days, tone: c.dataset.tone, meta: c.querySelector('.meta').textContent,
    controls: [...c.querySelectorAll('button,input,select,textarea,a,[contenteditable],[tabindex],[role=button]')].map(e => e.tagName + '.' + e.className + ':' + (e.getAttribute('aria-label') || '')),
    cardHasClick: typeof c.onclick === 'function', nameHasClick: typeof c.querySelector('.nm').onclick === 'function' })));
  out.formFields = await f.evaluate(() => [...document.querySelectorAll('#add input,#add select')].map(e => e.id + ':' + e.type));
  out.anyExpiryField = await f.evaluate(() => /use.?by|expir|best before|keeps for/i.test(document.body.innerHTML));
  // Tap the name of the first card: does anything open?
  const htmlBefore = await f.evaluate(() => document.body.innerHTML.length);
  await f.click('.item .nm'); await sleep(500);
  out.tapName = { dialogs: await f.evaluate(() => document.querySelectorAll('dialog[open],.sheet,[role=dialog]').length), htmlLenChanged: (await f.evaluate(() => document.body.innerHTML.length)) !== htmlBefore };
  // Fix path: David's "Beef and bean chili" was logged Family-size; Mae corrects it to Large with ✓ + re-log.
  const target = out.cards.find(c => /David/.test(c.meta)) || out.cards[0];
  const tsBefore = Date.now();
  await f.click(`.item:has(.nm:text-is("${target.name}")) .done`); await sleep(400);
  const dateOf = target.meta.match(/logged (\d{4}-\d\d-\d\d)/)[1];
  await f.fill('#name', target.name); await f.selectOption('#size', 'Large'); await f.fill('#date', dateOf);
  await f.click('.log'); await sleep(3500);
  const rows = (await L.apiAs('christian', '/api/data/leftovers?scope=family')).body;
  const list = (rows.items || rows.rows || rows.data || []).filter(x => x.value && x.value.name === target.name).map(x => x.value);
  const feed = (await L.apiAs('christian', '/api/activity')).body;
  const lines = (feed.items || feed.activity || feed.rows || feed || []);
  out.fix = { target, afterRows: list,
    feedLines: (Array.isArray(lines) ? lines : []).slice(0, 6).map(x => (x.name || x.profile_name || x.profile_id || '') + ': ' + (x.text || x.message || JSON.stringify(x)).slice(0, 120)) };
  await d.page.screenshot({ path: path.join(OUT, 's1-after-fix-ipad.png'), scale: 'css', animations: 'disabled' });
  console.log(JSON.stringify(out, null, 1));
  fs.writeFileSync(path.join(OUT, 's1-edit.json'), JSON.stringify(out, null, 1));
  await d.close();
} finally { await L.close(); }
