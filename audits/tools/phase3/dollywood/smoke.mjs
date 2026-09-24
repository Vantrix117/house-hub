// Phase 3 / dollywood: smoke test of the harness with the build guide (load time, profile, progress adopted, sessions list).
// node "audits/tools/phase3/dollywood/smoke.mjs"
import { local, sleep } from '../../lib/local.mjs';
const L = await local({ variant: 'typical', engine: 'webkit' });
try {
  console.log('sessions:', Object.keys(L.S.sessions).join(','));
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
  const t0 = Date.now();
  const f = await d.openApp('dollywood', { wait: '#b-count' });
  await f.waitForFunction(() => /of \d+ done/.test(document.getElementById('b-count').textContent), null, { timeout: 20000 });
  console.log('frame url', f.url(), 'loaded+adopted in', Date.now() - t0, 'ms');
  console.log(await f.evaluate(() => ({ count: document.getElementById('b-count').textContent, sec: document.getElementById('b-sec').textContent, profile: hub.profile, plot: document.getElementById('sc-plot').value, scheme: document.documentElement.dataset.scheme, theme: document.documentElement.dataset.theme || '(none)', accent: getComputedStyle(document.documentElement).getPropertyValue('--accent') })));
  console.log('logs:', d.logs.slice(0, 10));
} finally { await L.close(); }
