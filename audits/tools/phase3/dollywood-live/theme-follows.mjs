import { local, sleep, openMap } from './_lib.mjs';
const L = await local({ variant: 'park', clock: 'real', engine: 'webkit' });
try {
  // Set Eli's theme to Forest (dark palette) and confirm it follows into the app after adoption.
  let d = await L.device({ device: 'ipad-portrait', profile: 'eli', mode: 'light', fixedTime: false });
  await d.goto('#home'); await sleep(1000);
  await d.page.evaluate(() => hub.setTheme('forest')); await sleep(1500);
  const f = await openMap(d, { settle: 2500 });
  console.log('shell html', await d.page.evaluate(()=>({t:document.documentElement.dataset.theme,s:document.documentElement.dataset.scheme})));
  console.log('app html', await f.evaluate(()=>({t:document.documentElement.dataset.theme,s:document.documentElement.dataset.scheme,bg:getComputedStyle(document.body).backgroundColor})));
  await d.close();
  // Parchment (light) explicitly on a dark-OS iPad
  d = await L.device({ device: 'ipad-portrait', profile: 'mom', mode: 'dark', fixedTime: false });
  await d.goto('#home'); await sleep(1000);
  await d.page.evaluate(() => hub.setTheme('parchment')); await sleep(1500);
  const f2 = await openMap(d, { settle: 2500 });
  console.log('parchment/darkOS shell', await d.page.evaluate(()=>({t:document.documentElement.dataset.theme,s:document.documentElement.dataset.scheme})));
  console.log('parchment/darkOS app', await f2.evaluate(()=>({t:document.documentElement.dataset.theme,s:document.documentElement.dataset.scheme,bg:getComputedStyle(document.body).backgroundColor})));
} finally { await L.close(); }
