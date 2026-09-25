// Phase 4 · completeness verifier of the token proposal · scope probe.
//   node audits/tools/phase4/tokens/verify/scope-probe.mjs  → audits/evidence/p4/tokens/verify-scope-probe.json
// Loads ONLY proposed-tokens.css into a blank page (no app code, no network) in WebKit and Chromium and checks:
//  (a) whether --sheen-x written on a glass element (the GLASS-7 route) moves the --glass-bg it inherits from :root;
//  (b) what an F260-style theme button <button data-theme="midnight"> (apps/f260.html:2028) resolves inside a Hearth root;
//  (c) what closest('[data-theme]') returns for a click outside any button when System resolves to hearth.
// Always closes both browsers.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..', '..');
const css = fs.readFileSync(path.join(HERE, '..', 'proposed-tokens.css'), 'utf8');
const H = (process.env.HUB_AUDIT_HOME || path.join(process.env.LOCALAPPDATA, 'house-hub-audit'));
process.env.PLAYWRIGHT_BROWSERS_PATH = path.join(H, 'browsers');
const { webkit, chromium } = createRequire(path.join(H, 'noop.js'))('playwright-core');
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));
const out = {};
for (const [name, launcher, opts] of [['webkit', webkit, {}], ['chromium', chromium, CHROME ? { executablePath: CHROME } : {}]]) {
  const browser = await launcher.launch(opts);
  try {
    const page = await browser.newPage();
    await page.route('**/*', r => r.abort());
    await page.setContent(`<!doctype html><html data-theme="hearth" data-theme-choice="system" data-scheme="light" data-accent="mint"><head><style>${css}</style></head>
      <body><div class="seg" id="themeSeg" style="display:flex;gap:8px"><button id="bm" data-theme="midnight">Midnight</button></div><div id="glass" style="background:var(--glass-bg)">x</div></body></html>`);
    out[name] = await page.evaluate(() => {
      const g = document.getElementById('glass'), root = document.documentElement, bm = document.getElementById('bm');
      const cs = el => getComputedStyle(el);
      const before = cs(g).getPropertyValue('--glass-bg').trim();
      g.style.setProperty('--sheen-x', '77%');
      const onEl = cs(g).getPropertyValue('--glass-bg').trim();
      root.style.setProperty('--sheen-x', '77%');
      const onRoot = cs(g).getPropertyValue('--glass-bg').trim();
      return {
        sheen: { rootDefault: before.includes('30%'), afterElementWrite_containsNew: onEl.includes('77%'), afterRootWrite_containsNew: onRoot.includes('77%') },
        f260Button: { text: cs(bm).getPropertyValue('--text').trim(), surface: cs(bm).getPropertyValue('--surface').trim(), muted: cs(bm).getPropertyValue('--muted').trim(), colorScheme: cs(bm).colorScheme, rootText: cs(root).getPropertyValue('--text').trim() },
        closestFromSegGap: (document.getElementById('themeSeg').closest('[data-theme]') || {}).tagName || null,
        closestTheme: (document.getElementById('themeSeg').closest('[data-theme]') || { dataset: {} }).dataset.theme || null,
      };
    });
  } finally { await browser.close(); }
}
const file = path.join(ROOT, 'audits', 'evidence', 'p4', 'tokens', 'verify-scope-probe.json');
fs.writeFileSync(file, JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
