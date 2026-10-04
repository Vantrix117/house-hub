import { local, sleep } from 'file:///C:/Users/ex_bo/OneDrive/Claude%20Related/App%20Hub/audits/tools/lib/local.mjs';
const pulled = async (f, ms = 15000) => { const u = Date.now() + ms; while (Date.now() < u) { if (await f.evaluate(() => !!(window.hub && hub.sync && hub.sync.lastPull && hub.isLoaded())).catch(() => false)) return true; await sleep(150); } return false; };
const L = await local({ variant: 'typical', clock: 'real', engine: 'chromium' });
try {
  const d = await L.device({ device: 'iphone-pwa', profile: 'ezra', fixedTime: false });
  const f = await d.openApp('kidverse'); await pulled(f); await sleep(2500);
  const r = await f.evaluate(() => {
    const rw = window.kidverse.rewards, now = Date.now() + (hub.skew || 0), { has } = rw.starMap(hub.get('stars', { scope: 'person' }));
    const free = []; for (let i = 0; i < 12 && free.length < 3; i++) { const day = hub.addDays(hub.today(), -i); for (const k of ['story', 'prayed']) if (!has.has(k + ':' + day) && free.length < 3) free.push([k, day]); }
    const key = 'ledger:ezra:' + now.toString(36) + '-rv7b', P = { scope: 'person' };
    const b = rw.deriveStars(false);
    const [[k1, d1], [k2, d2], [k3, d3]] = free;
    hub.set(`star:${k1}:${d1}`, { at: now + 60000 }, P); hub.set(`reset:${k1}:${d1}`, { by: key, at: now }, P);   // new marker, star stamped after: must stay
    hub.set(`star:${k2}:${d2}`, { at: now + 60000 }, P); hub.set(`reset:${k2}:${d2}`, { by: key }, P);             // old marker (no at): still takes
    hub.set(`star:${k3}:${d3}`, { at: now - 60000 }, P); hub.set(`reset:${k3}:${d3}`, { by: key, at: now }, P);   // new marker, star earned before: taken
    const a = rw.deriveStars(false), ap = rw.deriveStars(true);
    return { free, after: [a.credited[k1][d1], a.credited[k2][d2], a.credited[k3][d3]], totalBefore: b.total, totalAfter: a.total, prunedTotal: ap.total, earnedBefore: b.earned, earnedAfter: a.earned };
  });
  console.log('C2', JSON.stringify(r));
} finally { await L.close(); }
process.exit(0);
