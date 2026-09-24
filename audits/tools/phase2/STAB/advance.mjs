// STAB helper: advance a device's installed Playwright clock by `ms` of simulated time in slices, letting the page's real
// network requests finish between slices.
//
// Why slices of 10 s: hub.request aborts a request after 12 s of *page* time (apps/hub.js:132). runFor() fires timers
// back to back without letting a response in, so any request started early in a slice longer than 12 s is aborted by the
// fake clock before the local Worker (2 ms away) can answer. Slices under 12 s plus a settle step that waits until no
// request is in flight keep every pull real. Measured: with 30 s slices and a fixed 150 ms pause, ~40% of pulls aborted.
import { sleep } from '../../lib/local.mjs';

export function track(d) {
  if (d._track) return d._track;
  const T = { inflight: 0, total: 0, byKind: {}, failed: 0, failedUrls: {} };
  const kind = u => /\/api\/data\//.test(u) ? 'data' : /\/api\/activity/.test(u) ? 'activity' : /\/api\//.test(u) ? 'api' : 'site';
  d.page.on('request', r => { T.inflight++; T.total++; const k = kind(r.url()); T.byKind[k] = (T.byKind[k] || 0) + 1; });
  d.page.on('requestfinished', () => { T.inflight--; });
  d.page.on('requestfailed', r => { T.inflight--; T.failed++; const k = (r.failure() && r.failure().errorText) + ' ' + r.url().replace(/^https?:\/\/[^/]+/, '').slice(0, 50); T.failedUrls[k] = (T.failedUrls[k] || 0) + 1; });
  d._track = T; return T;
}

export async function settle(d, { min = 15, max = 3000, quietChecks = 6 } = {}) {
  const T = track(d); const until = Date.now() + max; let quiet = 0;
  await sleep(min);
  while (Date.now() < until) { if (T.inflight <= 0) { if (++quiet >= quietChecks) return; } else quiet = 0; await sleep(12); }
}

export async function advance(d, ms, { slice = 10000, onSlice } = {}) {
  track(d);
  for (let t = 0; t < ms; t += slice) {
    const step = Math.min(slice, ms - t);
    await d.ctx.clock.runFor(step);
    await settle(d);
    if (onSlice) await onSlice(t + step);
  }
}

/** Screenshot at 1 image pixel per CSS pixel (the audit's evidence rule), viewport only. */
export async function shot1x(d, file) {
  const fs = await import('node:fs'); const path = await import('node:path');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await d.page.screenshot({ path: file, scale: 'css', animations: 'disabled', caret: 'hide' });
  return file;
}
