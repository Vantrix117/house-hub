// Shared helpers for the SYNC experiments (audit Phase 2). Not part of the rig core.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sleep } from '../../lib/local.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, '..', '..', '..', '..');
export const EVID = path.join(ROOT, 'audits', 'evidence', 'p2', 'SYNC');
fs.mkdirSync(EVID, { recursive: true });

export const t0 = Date.now();
export const stamp = () => ((Date.now() - t0) / 1000).toFixed(1).padStart(6) + 's';
export const log = (...a) => console.log(stamp(), ...a);

/** Poll fn() until it returns truthy (returns that value) or the timeout passes (returns null). */
export async function waitFor(fn, { timeout = 10000, every = 250 } = {}) {
  const until = Date.now() + timeout;
  while (Date.now() < until) { try { const v = await fn(); if (v) return v; } catch {} await sleep(every); }
  return null;
}

/** The server's copy of one row (as a profile), via the real API. */
export async function serverRow(L, profile, app, key, scope = 'person') {
  const r = await L.apiAs(profile, `/api/data/${app}?scope=${scope}&key=${encodeURIComponent(key)}`);
  return r.body && r.body.item;
}

/** A 1x (CSS pixel) screenshot of a page, for evidence. */
export async function shot(page, name) {
  const file = path.join(EVID, name);
  await page.screenshot({ path: file, scale: 'css', animations: 'disabled', caret: 'hide' });
  return path.relative(ROOT, file).split(path.sep).join('/');
}

/** Record every /api/ request a page (and its frames) makes: [{t, method, url, frame}] */
export function netLog(page) {
  const rows = [];
  page.on('request', r => { const u = r.url(); if (u.includes('/api/')) rows.push({ t: Date.now(), method: r.method(), url: u.replace(/^https?:\/\/[^/]+/, ''), frame: r.frame() && r.frame().url().replace(/^https?:\/\/[^/]+/, '').slice(0, 40) }); });
  return rows;
}

/** Write a small JSON evidence file; returns its repo-relative path. */
export function writeEvidence(name, obj) {
  const file = path.join(EVID, name);
  fs.writeFileSync(file, JSON.stringify(obj, null, 2));
  return path.relative(ROOT, file).split(path.sep).join('/');
}

/** Make document.hidden / visibilityState report `hidden` in the page and every frame, and fire visibilitychange. */
export async function setHidden(page, hidden) {
  for (const f of page.frames()) {
    await f.evaluate(h => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => h });
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (h ? 'hidden' : 'visible') });
      document.dispatchEvent(new Event('visibilitychange'));
    }, hidden).catch(() => {});
  }
}
