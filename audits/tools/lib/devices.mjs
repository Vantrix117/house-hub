// The device matrix (HUB-AUDIT-PROMPT.md → DEVICE MATRIX), as Playwright WebKit contexts.
// Sizes are CSS pixels. `platform`/`touchPoints` are patched into navigator so the shell's own device sniffing
// (index.html DEVICE_NAME / IOS) sees what a real iPad or iPhone reports: iPadOS Safari sends a Mac user agent
// and is recognised by MacIntel + touch points. `standalone` sets navigator.standalone (home-screen PWA).
const UA_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15';
const UA_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1';

export const DEVICES = {
  // iPad Air 11" (820×1180), installed to the Home Screen, open 24/7. The primary device.
  'ipad-portrait':  { viewport: { width: 820, height: 1180 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: UA_MAC, platform: 'MacIntel', touchPoints: 5, standalone: true },
  'ipad-landscape': { viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: UA_MAC, platform: 'MacIntel', touchPoints: 5, standalone: true },
  // iPhone Pro Max (430×932): as a Home Screen app (full height) …
  'iphone-pwa':     { viewport: { width: 430, height: 932 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: UA_IPHONE, platform: 'iPhone', touchPoints: 5, standalone: true },
  // … and in a Safari tab, where the status bar and Safari's bottom toolbar take ~190 px (approximation).
  'iphone-safari':  { viewport: { width: 430, height: 740 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: UA_IPHONE, platform: 'iPhone', touchPoints: 5, standalone: false },
  // Desktop browser at 1440 wide.
  'desktop':        { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false, userAgent: UA_MAC, platform: 'MacIntel', touchPoints: 0, standalone: false },
  // The kiosk TV: 1920×1080, 10-foot, read-only.
  'tv':             { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false, userAgent: UA_MAC, platform: 'MacIntel', touchPoints: 0, standalone: true },
};

// Screens use these unless they name their own. The TV is only for the kiosk board.
export const DEFAULT_DEVICES = ['ipad-portrait', 'ipad-landscape', 'iphone-pwa', 'iphone-safari', 'desktop'];
// iphone-safari differs from iphone-pwa only by height and standalone mode, so it is captured for the typical state only.
export const SAFARI_STATES = ['typical', 'error'];
export const MODES = ['light', 'dark'];
export const STATES = ['empty', 'typical', 'overflow', 'loading', 'offline', 'error'];

export function contextOptions(name, mode) {
  const d = DEVICES[name];
  return {
    viewport: d.viewport, deviceScaleFactor: d.deviceScaleFactor, isMobile: d.isMobile, hasTouch: d.hasTouch, userAgent: d.userAgent,
    colorScheme: mode, timezoneId: 'America/New_York', locale: 'en-US', serviceWorkers: 'allow', reducedMotion: 'no-preference',
  };
}
