// Per-profile accent, dark mode (data-scheme, not prefers-color-scheme), and the location-denied wording.
// Run: node "audits/tools/phase3/dollywood-live/theme-denied.mjs"
import { local, sleep, save, shot, openMap, pill } from './_lib.mjs';
const L = await local({ variant: 'park', clock: 'real', engine: 'webkit' });
const out = {};
try {
  // A. accent reaches the app, and differs per profile
  const readAccent = async f => f.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    return { accent: root.getPropertyValue('--accent').trim(), theme: document.documentElement.dataset.theme, scheme: document.documentElement.dataset.scheme };
  });
  let d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
  await d.goto('#home'); await sleep(800);
  let f = await openMap(d, { settle: 1500 });
  out.eli = await readAccent(f); await d.close();
  d = await L.device({ device: 'iphone-pwa', profile: 'mom', fixedTime: false });
  await d.goto('#home'); await sleep(800);
  f = await openMap(d, { settle: 1500 });
  out.mom = await readAccent(f); await d.close();

  // B. dark mode via a dark palette (Midnight) set on the person; the app must key off data-scheme not prefers-color-scheme.
  // Set Eli's theme to Midnight through hub, then reopen and read the resolved scheme + a glass surface background.
  d = await L.device({ device: 'ipad-portrait', profile: 'eli', mode: 'light', fixedTime: false });
  await d.goto('#home'); await sleep(800);
  await d.page.evaluate(() => hub.setTheme && hub.setTheme('midnight')); await sleep(600);
  f = await openMap(d, { settle: 1500 });
  out.midnightOnLightOS = await f.evaluate(() => ({ theme: document.documentElement.dataset.theme, scheme: document.documentElement.dataset.scheme, pillBg: getComputedStyle(document.getElementById('lv-pill')).backgroundColor }));
  await shot(d, 'theme-midnight-ipad.png'); await d.close();
  // Hearth (light palette) on a dark OS: the app should stay light because it reads data-scheme, not the OS.
  d = await L.device({ device: 'ipad-portrait', profile: 'mom', mode: 'dark', fixedTime: false });
  await d.goto('#home'); await sleep(800);
  await d.page.evaluate(() => hub.setTheme && hub.setTheme('hearth')); await sleep(600);
  f = await openMap(d, { settle: 1500 });
  out.hearthOnDarkOS = await f.evaluate(() => ({ theme: document.documentElement.dataset.theme, scheme: document.documentElement.dataset.scheme, bodyBg: getComputedStyle(document.body).backgroundColor }));
  await shot(d, 'theme-hearth-darkos-ipad.png'); await d.close();

  // C. location denied on an adult who is sharing: the wording written straight into the pill vs the designed denied state
  d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
  // do NOT grant geolocation; WebKit denies watchPosition with code 1
  await d.goto('#home'); await sleep(1500);
  f = await openMap(d, { settle: 1500 });
  await f.click('#loc-btn').catch(() => {});   // Find me -> startGps -> watchPosition error code 1
  await sleep(2500);
  out.C_deniedAdult = { pill: await pill(f), pillState: await f.evaluate(() => document.getElementById('lv-pill').dataset.state), actShown: await f.evaluate(() => !document.getElementById('lv-act').hidden) };
  await shot(d, 'denied-adult-iphone.png'); await d.close();

  // D. a kid with the beacon on (Ezra), denied: does he get the adult "Settings › Safari" wording?
  d = await L.device({ device: 'iphone-pwa', profile: 'ezra', fixedTime: false });
  await d.goto('#home'); await sleep(1500);
  f = await openMap(d, { settle: 1500 });
  out.D_ezra = { viewOnly: await f.evaluate(() => VIEW_ONLY()), beaconOn: await f.evaluate(() => kidBeaconOn()) };
  await f.click('#loc-btn').catch(() => {});
  await sleep(2500);
  out.D_ezraDenied = { pill: await pill(f) };
  await shot(d, 'denied-kid-iphone.png');
} finally { save('theme-denied.json', out); console.log(JSON.stringify(out, null, 2)); await L.close(); }
