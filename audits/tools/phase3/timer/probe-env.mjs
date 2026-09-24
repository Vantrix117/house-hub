// Environment probe: API shape for the timer channel, and whether the rig's WebKit / Chromium expose AudioContext.
import { local } from '../../lib/local.mjs';
for (const engine of ['webkit', 'chromium']) {
  const L = await local({ variant: 'typical', clock: 'real', engine });
  try {
    if (engine === 'webkit') console.log('API mom timer:', JSON.stringify((await L.apiAs('mom', '/api/data/timer?scope=person')).body).slice(0, 400));
    const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
    await d.goto('#home');
    console.log(engine, 'AudioContext:', await d.page.evaluate(() => ({ ac: typeof window.AudioContext, wk: typeof window.webkitAudioContext, wl: 'wakeLock' in navigator, notif: typeof window.Notification })));
  } finally { await L.close(); }
}
