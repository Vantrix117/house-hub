// Skeptic 2 (intent & context) for "veiled verse text exposed to assistive technology before Show".
// Independent of the investigator's script: no _lib.mjs. Eli, iPhone PWA, typical seed, demo clock.
// Batch writes are aborted so the server stays at the seed. Walks Eli's queue with real taps until a card
// whose #text is present (F260 text on file), unrevealed, then records: the element's attributes/computed
// state, whether any ancestor is aria-hidden/inert, Playwright's ariaSnapshot of #trainer and the order of
// text vs the Show button in it; then taps Show and records the same (control). Runs in WebKit and Chromium;
// in Chromium it also reads the real browser AX tree over CDP (Accessibility.getFullAXTree).
// Run: node "audits/tools/phase3/verses/verify-critic-veiled-text-exposed-to-screen-readers-3-2.mjs"
import fs from 'node:fs';
import { local, sleep, DEMO } from '../../lib/local.mjs';
const EV = 'audits/evidence/p3/verses/verify-critic-veiled-text-exposed-to-screen-readers-3-2';
const out = {};
for (const engine of ['webkit', 'chromium']) {
  const L = await local({ variant: 'typical', clock: 'demo', engine });
  const r = out[engine] = {};
  try {
    const d = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: DEMO });
    await d.ctx.route(u => /\/api\/data\/[^/]+\/batch$/.test(u.pathname), rt => rt.abort('internetdisconnected'));
    await d.goto('#home');
    const f = await d.openApp('verses');
    await f.waitForSelector('#trainer:not([hidden])', { timeout: 12000 });
    await sleep(400);
    const probe = () => f.evaluate(() => {
      const e = document.getElementById('text'), cs = getComputedStyle(e);
      const anc = []; for (let n = e; n; n = n.parentElement) { if (n.getAttribute('aria-hidden') || n.inert || n.hasAttribute('inert')) anc.push(n.id || n.tagName); }
      return { ref: document.getElementById('ref').textContent, hint: document.getElementById('hint').textContent,
        present: !e.hidden, veiled: e.classList.contains('veiled'), filter: cs.filter, visibility: cs.visibility, display: cs.display,
        ariaHidden: e.getAttribute('aria-hidden'), role: e.getAttribute('role'), hiddenOrInertAncestors: anc,
        showVisible: !document.getElementById('act-show').hidden, chars: e.textContent.length, head: e.textContent.slice(0, 30) };
    });
    let p = await probe(), steps = 0;
    while (!p.present && steps < 12) { await f.click('#show'); await f.waitForSelector('#act-rate:not([hidden])'); await f.click('#act-rate [data-rate="got"]'); await sleep(700); p = await probe(); steps++; }
    r.ratedBeforeTextCard = steps;
    r.before = p;
    const snap = await f.locator('#trainer').ariaSnapshot();
    r.snapshotBefore = snap;
    r.snapshotBeforeHasText = snap.includes(p.head.slice(0, 20));
    r.textBeforeShowButtonInSnapshot = snap.indexOf(p.head.slice(0, 20)) >= 0 && snap.indexOf(p.head.slice(0, 20)) < snap.indexOf('button "Show"');
    if (engine === 'chromium') {
      const cdp = await d.ctx.newCDPSession(d.page);
      const { frameTree } = await cdp.send('Page.getFrameTree');
      const all = []; const walk = t => { all.push(t.frame); (t.childFrames || []).forEach(walk); }; walk(frameTree);
      const fr = all.find(x => /verses\.html/.test(x.url));
      r.cdpFrame = fr ? fr.url.replace(/^https?:\/\/[^/]+/, '') : null;
      const { nodes } = await cdp.send('Accessibility.getFullAXTree', fr ? { frameId: fr.id } : {});
      const key = p.head.slice(0, 20);
      const hits = nodes.filter(n => !n.ignored && String((n.name && n.name.value) || '').includes(key));
      r.cdpNonIgnoredNodesWithText = hits.map(n => ({ role: n.role && n.role.value, name: String(n.name && n.name.value).slice(0, 60) }));
      r.cdpIgnoredNodesWithText = nodes.filter(n => n.ignored && String((n.name && n.name.value) || '').includes(key)).length;
      await cdp.detach();
    }
    await d.page.screenshot({ path: `${EV}-${engine}-before.png`, scale: 'css' });
    await f.click('#show'); await sleep(500);
    r.after = await probe();
    r.snapshotAfterHasText = (await f.locator('#trainer').ariaSnapshot()).includes(p.head.slice(0, 20));
  } catch (e) { r.error = String(e.stack || e).slice(0, 600); }
  finally { await L.close(); }
}
console.log(JSON.stringify(out, null, 1));
fs.writeFileSync(EV + '.json', JSON.stringify(out, null, 1));
