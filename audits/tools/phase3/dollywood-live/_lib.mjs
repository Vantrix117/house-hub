// Shared helpers for the Phase 3 dollywood-live experiments (read-only use of the harness).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
export { local, sleep, DEMO } from '../../lib/local.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url));
export const EV = path.resolve(HERE, '..', '..', '..', 'evidence', 'p3', 'dollywood-live');
export const APP = 'dollywood-live';
fs.mkdirSync(EV, { recursive: true });

/** Write a JSON evidence file and print where. */
export function save(name, obj) { const p = path.join(EV, name); fs.writeFileSync(p, JSON.stringify(obj, null, 2)); console.log('wrote', path.relative(process.cwd(), p)); return p; }
/** A 1x (CSS pixel) screenshot into the evidence folder. */
export async function shot(d, name) { const p = path.join(EV, name); await d.page.screenshot({ path: p, scale: 'css', animations: 'disabled', caret: 'hide' }); console.log('shot', path.relative(process.cwd(), p)); return p; }

/** Open the park map in the shell and wait until liveInit has run and hub.js has a profile. */
export async function openMap(d, { settle = 1200 } = {}) {
  const f = await d.openApp(APP);
  await f.waitForSelector('#lv-pill[data-state]', { timeout: 15000 });
  await f.waitForFunction(() => window.hub && hub.profile, null, { timeout: 10000 }).catch(() => {});
  await new Promise(r => setTimeout(r, settle));
  return f;
}
/** Map metres (x east, y north) -> lat/lon through the page's own equirectangular frame (D.geo, :1165). */
export async function latLon(f, x, y) { return f.evaluate(([x, y]) => ({ latitude: y / D.geo.my + D.geo.lat0, longitude: x / D.geo.mx + D.geo.lon0 }), [x, y]); }
/** Grant geolocation to the site origin and put the device at map point (x, y) with the given accuracy (m). */
export async function putAt(d, f, x, y, accuracy = 8) {
  const ll = await latLon(f, x, y);
  await d.ctx.setGeolocation({ ...ll, accuracy });
  return ll;
}
export async function grant(d, site) { await d.ctx.grantPermissions(['geolocation'], { origin: site }); }
/** The pill's state, title and subtitle. */
export async function pill(f) { return f.evaluate(() => ({ state: document.getElementById('lv-pill').dataset.state, title: document.getElementById('loc-sec').textContent, sub: document.getElementById('loc-acc').textContent, act: document.getElementById('lv-act').hidden ? null : document.getElementById('lv-act').textContent })); }
