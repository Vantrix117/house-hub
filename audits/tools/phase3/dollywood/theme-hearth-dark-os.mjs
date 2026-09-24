// Phase 3 / dollywood: how P2-VIS-03 (Hearth chosen on a dark-mode device still paints Midnight) shows in the build guide.
// Eli with hub.theme = "hearth" on an iPad whose OS is in dark mode; compares with Hearth on a light OS.
//   node "audits/tools/phase3/dollywood/theme-hearth-dark-os.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';
const EV = path.resolve('audits/evidence/p3/dollywood');
const out = {};
const L = await local({ variant: 'typical', engine: 'webkit' });
try {
  for (const mode of ['light', 'dark']) {
    const d = await L.device({ device: 'ipad-portrait', mode, profile: 'eli', fixedTime: false, localStorage: { 'hub.theme': JSON.stringify('hearth') } });
    await d.page.goto(L.site + '/apps/dollywood.html');
    await d.page.waitForFunction(() => /of \d+ done/.test((document.getElementById('b-count') || {}).textContent || ''), null, { timeout: 30000 }); await sleep(800);
    out[mode + 'OS'] = await d.page.evaluate(() => { const cs = getComputedStyle(document.documentElement); return { dataTheme: document.documentElement.dataset.theme || null, dataScheme: document.documentElement.dataset.scheme, bodyBg: getComputedStyle(document.body).backgroundColor, text: cs.getPropertyValue('--text').trim(), dimResolved: getComputedStyle(document.querySelector('.stat span')).color, attrMapInk: cs.getPropertyValue('--attr').trim() }; });
    await d.page.screenshot({ path: path.join(EV, `hearth-on-${mode}-os.png`), scale: 'css', clip: { x: 0, y: 0, width: 820, height: 600 } });
    console.log(mode + 'OS', JSON.stringify(out[mode + 'OS']));
    await d.close();
  }
} finally { fs.writeFileSync(path.join(EV, 'theme-hearth-dark-os.json'), JSON.stringify(out, null, 1)); await L.close(); }
