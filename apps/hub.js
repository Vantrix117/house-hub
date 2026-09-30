/* House Hub SDK — include in every app:
 *   <link rel="stylesheet" href="design.css">
 *   <script src="hub.js" data-app="tally" data-scope="person"></script>   (scope: person | family | both)
 *
 * Then:
 *   await hub.ready();                      // profile + cached data available; pulls in the background
 *   hub.isLoaded() / await hub.loaded()     // this app's data has been pulled from the server at least once on this
 *                                           // device. Until then hub.set refuses (HubError 'not_loaded'): a value
 *                                           // computed from an empty cache must never overwrite the real row.
 *   hub.today() / hub.onDay(fn)             // the household's date (America/New_York, 'YYYY-MM-DD'); fn at midnight
 *   hub.profile                             // { id, name, kind, isAdmin, isGuest, color, hue, emoji }; hub.hueOf(p) = the
 *                                           // colour family for data-accent (design.css)
 *   hub.setTheme(t) / hub.setTextSize(s) / hub.setContrast(v) / hub.setGlass(v) / hub.setMotion(v) / hub.prefs()
 *                                           // the person's look, one person-scope hub row each; hub:theme fires on window
 *   hub.get(key, {scope}) / hub.set(key, value, {scope}) / hub.remove(key, {scope})
 *   hub.list(prefix, {scope})               // live items [{key, value, updated_at}]
 *   hub.onChange(({scope, key, value}) => …) // fires when another device changed something
 *   hub.activity('Checked off Week 3 Day 2')
 *   hub.voiceInput(text => …)               // Web Speech; returns null when unsupported
 *   hub.immersive(true|false)               // in the hub's viewer: hide / bring back the shell's top bar (full screen);
 *                                           // standalone it does nothing. The app keeps its own Close.
 *   hub.sync.state                          // 'synced' | 'pending' | 'offline' | 'error' ('pending' until the first pull answers)
 *
 * Offline-first: every scope has a localStorage cache and a write queue. Writes apply locally at once,
 * flush in batches when online, and resolve conflicts by updated_at (last write wins). Data is pulled on
 * open, on visibilitychange, when the network comes back, and every 30 s while visible.
 *
 * Tokens (device + profile session) are stored hub-wide in localStorage by index.html; apps run on the
 * same origin so they see them. Nothing here depends on the parent frame — postMessage is best-effort.
 */
(function () {
  'use strict';
  const script = document.currentScript;
  const DEFAULT_API = 'https://house-hub-api.catalystfarm1.workers.dev';
  const LS = {
    device: 'hub.device', session: 'hub.session', last: 'hub.lastProfile', api: 'hub.api', theme: 'hub.theme',
    migrated: 'hub.migrated', profiles: 'hub.profiles', skew: 'hub.skew',
    legacyActivity: 'hub.activityQueue',       // before batch 0c: one device-wide feed queue with no author
    retiring: 'hub.retiring',                  // [{token, pid}] sessions signed out here whose queue or logout has not reached the server
    personTheme: pid => `hub.theme.${pid}`,    // each person's look on this device, restored when they sign in again
    prefs: 'hub.prefs',                        // text size, contrast, glass, motion: the mirror the <head> bootstrap reads
    personPrefs: pid => `hub.prefs.${pid}`,    // each person's preferences on this device, like personTheme
    meAt: 'hub.meAt',                          // when this device last refreshed the session profile (ACCENT-9)
    lastSync: 'hub.lastSync',                  // when this device last finished a pull, kept across a reopen (P2-SYNC-14)
    activity: pid => `hub.aqueue.${pid}`,      // feed lines waiting to post, per author
    cache: (app, scope, pid) => `hub.cache.${app}.${scope}${scope === 'person' ? '.' + pid : ''}`,
    // Every queue belongs to the person who wrote it, family writes too: only their own session ever sends it.
    queue: (app, scope, pid) => `hub.queue.${app}.${scope}.${pid}`,
    legacyFamilyQueue: app => `hub.queue.${app}.family`,
  };
  const QUEUE_RE = /^hub\.queue\.([^.]+)\.(person|family)\.([^.]+)$/, LEGACY_FAMILY_RE = /^hub\.queue\.([^.]+)\.family$/;
  const PERSON_CACHE_RE = /^hub\.cache\.[^.]+\.person\.([^.]+)$/;
  const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } };
  const lsKeys = () => { try { return Object.keys(localStorage); } catch { return []; } };
  const isQuota = e => !!e && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22 || e.code === 1014);
  // Returns false only when the value could not be stored because the device is out of space: other people's caches and
  // the feed copy go first (they come back with a pull), then it tries once more.
  function lsSet(k, v) {
    try { v === undefined ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); return true; }
    catch (e) {
      if (!isQuota(e)) return true;
      const me = hub && hub.profile ? hub.profile.id : null;
      for (const key of lsKeys()) { const m = key.match(PERSON_CACHE_RE); if ((m && m[1] !== me) || key === 'hub.feed') try { localStorage.removeItem(key); } catch {} }
      try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e2) { return !isQuota(e2); }
    }
  }
  const inFrame = (() => { try { return window.parent !== window; } catch { return true; } })();
  const tell = msg => { if (inFrame) { try { window.parent.postMessage({ source: 'hub', ...msg }, location.origin); } catch {} } };

  const appId = (script && script.dataset.app) || ((location.pathname.match(/\/apps\/([^/]+)\.html$/) || [])[1]) || 'hub';
  const declared = (script && script.dataset.scope) || 'person';
  const SCOPES = declared === 'both' ? ['person', 'family'] : [declared];
  // Every (app, scope) pair this page syncs. Apps sync themselves; the hub shell adds others with hub.use().
  const CH = new Map();                       // 'app|scope' -> { app, scope }
  const chKey = (app, scope) => app + '|' + scope;
  for (const s of SCOPES) CH.set(chKey(appId, s), { app: appId, scope: s });

  class HubError extends Error { constructor(status, error, message) { super(message || error); this.status = status; this.error = error; } }

  const freshSync = () => ({ state: 'pending', pending: 0, lastError: null, lastPull: 0 });   // not 'offline' before the first pull has even answered
  const hub = {
    appId, api: lsGet(LS.api, null) || DEFAULT_API,
    device: lsGet(LS.device, null), session: lsGet(LS.session, null),
    // server clock − device clock, from the last answer the server gave on this device (kept, so a device reopened
    // offline with a wrong clock still stamps its writes in server time)
    profile: null, skew: +lsGet(LS.skew, 0) || 0,
    sync: freshSync(),
    HubError,
  };
  const listeners = { change: new Set(), sync: new Set(), auth: new Set() };
  const store = {};          // 'app|scope' -> { items: {key:{v,t}}, since }
  const queue = {};          // 'app|scope' -> { key: {value, updated_at} }
  const unsaved = new Set(); // channels whose queue could not be written to localStorage (device full): memory is the truth
  let readyPromise = null, flushTimer = null, pullTimer = null, flushing = null, pulling = null, wired = false;
  // gen changes on every hub.reset() (a Switch): an answer to a request made for the previous person is never applied
  let gen = 0; const inflight = new Set();
  const setSkew = now => { if (!Number.isFinite(+now)) return; hub.skew = +now - Date.now(); lsSet(LS.skew, Math.round(hub.skew)); };

  // ── profile / theme / preferences (applied synchronously so there is no flash) ──────────
  // The inline <head> bootstrap (audits/tools/phase4/tokens/bootstrap.js, copied into every page) sets the same attributes
  // before the first paint; everything here must agree with it (HEX_HUE is its H, THEME_BG its B).
  function publicProfile(p) {
    return p ? { id: p.id, name: p.name, kind: p.kind, isAdmin: !!p.is_admin, isGuest: !!p.is_guest, color: p.color, hue: p.hue || null, emoji: p.emoji, hasPin: !!p.has_pin, photo: p.photo || null } : null;
  }
  // The 18 colour families design.css knows: the nine people's and the nine apps' (D5, "Admin-assigned colours").
  hub.HUES = ['bubblegum', 'peach', 'butter', 'mint', 'aqua', 'sky', 'periwinkle', 'lavender', 'graphite', 'coral', 'apricot', 'honey', 'pistachio', 'leaf', 'seafoam', 'lagoon', 'cornflower', 'orchid'];
  // A record stored before profiles carried a hue maps its hex here (D3's starting colours); an unknown hex is graphite,
  // never another person's family (ACCENT-6).
  const HEX_HUE = { '#4f5d8c': 'periwinkle', '#bc5a38': 'peach', '#137f77': 'aqua', '#b4861b': 'lavender', '#8a6a4b': 'bubblegum', '#3d5a3d': 'mint', '#5b8143': 'butter', '#4c4c58': 'graphite', '#8c4f7a': 'sky', '#4c7b6a': 'sky', '#5e7a6e': 'graphite' };
  /** A person's colour family for data-accent: their stored hue, else a guest's sky, else their hex's family, else graphite. */
  hub.hueOf = p => !p ? 'graphite' : hub.HUES.includes(p.hue) ? p.hue : (p.is_guest || p.isGuest) ? 'sky' : HEX_HUE[String(p.color || '').toLowerCase()] || 'graphite';
  // Named palettes in design.css. 'system' = Hearth by day, Midnight at night. 'light'/'dark' are kept as aliases.
  hub.THEMES = [
    { id: 'system', name: 'System', scheme: null, blurb: 'Hearth by day, Midnight at night' },
    { id: 'hearth', name: 'Hearth', scheme: 'light', blurb: 'Warm grouped neutrals' },
    { id: 'parchment', name: 'Parchment', scheme: 'light', blurb: 'Soft tan reading paper' },
    { id: 'frost', name: 'Frost', scheme: 'light', blurb: 'Cool pale glass' },
    { id: 'midnight', name: 'Midnight', scheme: 'dark', blurb: 'Warm dark' },
    { id: 'forest', name: 'Forest', scheme: 'dark', blurb: 'Deep green, gold ink' },
    { id: 'graphite', name: 'Graphite', scheme: 'dark', blurb: 'True black, as on iPhone' },   // D2
  ];
  const SCHEME_OF = { hearth: 'light', parchment: 'light', frost: 'light', midnight: 'dark', forest: 'dark', graphite: 'dark' };
  // each palette's --bg, for the theme-color meta when the stylesheet cannot be asked
  const THEME_BG = { hearth: '#F4F1EC', parchment: '#ECE2CD', frost: '#F2F2F7', midnight: '#0B0A09', forest: '#070F0D', graphite: '#000000' };
  const themeId = t => t === 'light' ? 'hearth' : t === 'dark' ? 'midnight' : (hub.THEMES.some(x => x.id === t) ? t : 'system');
  const mq = q => { try { return !!(window.matchMedia && window.matchMedia(q).matches); } catch { return false; } };
  const prefersDark = () => mq('(prefers-color-scheme: dark)');
  /** The palette a choice paints: System resolves to Hearth by day and Midnight by night, here and in the bootstrap. */
  const paletteOf = c => c === 'system' ? (prefersDark() ? 'midnight' : 'hearth') : c;

  // Person preferences (GLASS-1, TYPE-9, D8, D11): one person-scope hub row each, beside 'theme', so two devices changing
  // different settings never overwrite each other; LS.prefs is the device mirror the bootstrap reads before the first
  // paint. The glass level Solid IS Reduce Transparency.
  const PREF_VALUES = { textSize: ['xs', 's', 'm', 'l', 'xl', 'xxl'], contrast: ['more', 'standard'], transparency: ['reduce', 'full'], motion: ['reduce', 'full'], glass: ['clear', 'current', 'frosted', 'solid'] };
  const PREF_KEYS = Object.keys(PREF_VALUES);
  const cleanPrefs = o => { const r = {}; if (o && typeof o === 'object') for (const k of PREF_KEYS) if (PREF_VALUES[k].includes(o[k]) && !(k === 'textSize' && o[k] === 'm')) r[k] = o[k]; return r; };
  const prefsNow = () => cleanPrefs(lsGet(LS.prefs, {}));
  // the display and the kitchen keep their look on the device, as they keep their theme: they are not a person
  const localPrefs = () => !!hub.profile && (hub.profile.kind === 'kiosk' || hub.profile.kind === 'kitchen');
  // D17: an adult who chose Large in F260 before batch 1 keeps it everywhere until F260 moves it to the hub row on its next
  // open (f260.bigMoved); read from F260's cache on this device, and only while the person has never chosen a hub size
  // (no textSize row at all: choosing Normal in Me writes an empty row, which ends the fallback on every device). F260
  // itself keeps its old zoom until the move (apps/f260.html paintSize), so the fallback is not applied there as well.
  const f260Big = () => {
    const p = hub.profile; if (!p || appId === 'f260' || ['kid', 'kiosk', 'kitchen'].includes(p.kind)) return false;
    const hc = lsGet(LS.cache('hub', 'person', p.id), null); if (hc && hc.items && hc.items.textSize) return false;
    const c = lsGet(LS.cache('f260', 'person', p.id), null), it = c && c.items;
    return !!(it && it['f260.big'] && it['f260.big'].v === true && !(it['f260.bigMoved'] && it['f260.bigMoved'].v));
  };
  function applyPrefs(root) {
    const r = prefsNow(), kiosk = !!hub.profile && hub.profile.kind === 'kiosk';
    const set = (a, v) => { if (v) root.setAttribute(a, v); else root.removeAttribute(a); };
    set('data-text-size', r.textSize || (f260Big() ? 'l' : null));
    set('data-contrast', r.contrast || null);
    set('data-motion', r.motion || null);
    // as the bootstrap does: a chosen glass level other than Solid also opts out of the OS setting, so the choice holds
    let tr = r.transparency || null, gl = null;
    if (r.glass && !kiosk) { if (r.glass === 'solid') tr = 'reduce'; else { gl = r.glass; tr = 'full'; } }
    set('data-transparency', tr); set('data-glass', gl);
  }
  function applyTheme() {
    const root = document.documentElement;
    const c = themeId(lsGet(LS.theme, 'system')), t = paletteOf(c), scheme = SCHEME_OF[t];
    // data-theme is ALWAYS the resolved palette, never deleted (P2-VIS-03); the choice is kept beside it
    root.dataset.theme = t; root.dataset.themeChoice = c;
    root.dataset.scheme = scheme;                                   // resolved, for apps with their own dark CSS
    root.style.colorScheme = scheme;                                // UA controls follow the chosen palette (P4-COLOR-04)
    root.style.removeProperty('--accent');                          // v3: the person is data-accent, never an inline hex
    if (hub.profile) { root.dataset.kind = hub.profile.kind; root.dataset.accent = hub.hueOf(hub.profile); }
    else { delete root.dataset.kind; delete root.dataset.accent; }   // signed out: graphite, nobody's colour (CONS-ACCENT-1)
    // the display reads its board from across the room: the 10-foot scale (design.css section 7, live at 1600 px+; decision D16,
    // batch 2c). Set here, not in the pre-paint bootstrap (a byte-identical copy in every page): the shell's gate and views
    // stay hidden until after this script has run, so the board never paints a frame at the kiosk's smaller sizes.
    if (hub.profile && hub.profile.kind === 'kiosk') root.dataset.tvScale = '10ft'; else delete root.dataset.tvScale;
    applyPrefs(root);
    // every theme-color meta follows the palette on every call, a pull included (P4-DARK-04)
    let bg = ''; try { bg = getComputedStyle(root).getPropertyValue('--bg').trim(); } catch {}
    if (!/^(#|rgb)/.test(bg)) bg = THEME_BG[t];
    for (const m of document.querySelectorAll('meta[name="theme-color"]')) { m.removeAttribute('media'); m.setAttribute('content', bg); }
    try { window.dispatchEvent(new CustomEvent('hub:theme', { detail: { theme: t, choice: c, scheme } })); } catch {}
  }
  // live: the OS scheme (System) and the OS motion / contrast / transparency settings the CSS mirrors, re-announced so
  // apps that read them, and the theme-color meta, follow at once
  for (const q of ['(prefers-color-scheme: dark)', '(prefers-reduced-motion: reduce)', '(prefers-contrast: more)', '(prefers-reduced-transparency: reduce)']) {
    try { window.matchMedia(q).addEventListener('change', () => applyTheme()); } catch {}
  }
  // The theme is a person preference (app_data person/hub/theme) so it follows the person to every device;
  // LS.theme is the device-local mirror that applies before the first pull. The kiosk keeps a device-local theme.
  const PREFS = { app: 'hub', scope: 'person' };
  const hasPrefs = () => CH.has(chKey('hub', 'person')) && !!hub.profile && store[chKey('hub', 'person')];
  const mirrorTheme = t => { lsSet(LS.theme, t === 'system' ? undefined : t); if (hub.profile) lsSet(LS.personTheme(hub.profile.id), t); };
  const mirrorPrefs = r => { r = cleanPrefs(r); lsSet(LS.prefs, Object.keys(r).length ? r : undefined); if (hub.profile) lsSet(LS.personPrefs(hub.profile.id), r); };
  hub.setTheme = t => {
    t = themeId(t);
    mirrorTheme(t); applyTheme();
    // the chosen theme depends on nothing stored, so it may be written before the prefs have pulled (it is newer, so it wins)
    if (hasPrefs() && hub.canWrite && !localPrefs() && hub.get('theme', PREFS) !== t) try { hub.set('theme', t, { ...PREFS, unloaded: true }); } catch (e) { console.error(e); }
    tell({ type: 'hub:theme', theme: t });
  };
  hub.theme = () => themeId(lsGet(LS.theme, 'system'));
  hub.scheme = () => document.documentElement.dataset.scheme || (prefersDark() ? 'dark' : 'light');
  /** The person's preferences: { textSize, contrast, transparency, motion, glass }; null = the default, following the OS. */
  hub.prefs = () => { const r = prefsNow(); return { textSize: r.textSize || (f260Big() ? 'l' : 'm'), contrast: r.contrast || null, transparency: r.transparency || null, motion: r.motion || null, glass: r.glass || null }; };
  // Each setter validates, writes the device mirror, applies the attribute at once and, for a person, writes their row, as
  // hub.setTheme does. The display and the kitchen keep the setting on the device: no row, no toast, nothing thrown.
  function setPref(k, v) {
    if (!PREF_VALUES[k]) throw new HubError(400, 'bad_pref', 'Unknown preference ' + k + '.');
    v = v == null || v === '' ? undefined : String(v);
    if (v !== undefined && !PREF_VALUES[k].includes(v)) throw new HubError(400, 'bad_pref', `${k} must be one of: ${PREF_VALUES[k].join(', ')}.`);
    if (k === 'textSize' && v === 'm') v = undefined;
    const legacy = k === 'textSize' && f260Big();   // D17: any choice here ends F260's old Large, so it is always written
    const next = prefsNow(); if (v === undefined) delete next[k]; else next[k] = v;
    mirrorPrefs(next); applyTheme();
    if (!localPrefs()) {
      if (hasPrefs() && hub.canWrite) {
        const cur = hub.get(k, PREFS);
        try { if (legacy || (v === undefined ? cur !== undefined : cur !== v)) hub.set(k, v === undefined ? null : v, { ...PREFS, unloaded: true }); } catch (e) { console.error(e); }
        if (legacy) applyTheme();
      } else tell({ type: 'hub:pref', key: k, value: v === undefined ? null : v });   // an app frame: the shell writes the row
    }
    // no hub:theme to the shell here: it would make the shell write a 'theme' row the person never touched; the shell
    // re-applies the look from the hub.prefs storage event instead
    return hub.prefs();
  }
  hub.setTextSize = size => setPref('textSize', size);     // 'xs' | 's' | 'm' | 'l' | 'xl' | 'xxl'
  hub.setContrast = v => setPref('contrast', v);           // 'more' | 'standard' (opts out of the OS) | null (follows the OS)
  hub.setTransparency = v => setPref('transparency', v);   // 'reduce' | 'full' | null
  hub.setMotion = v => setPref('motion', v);               // 'reduce' | 'full' | null
  hub.setGlass = v => setPref('glass', v);                 // 'clear' | 'current' | 'frosted' | 'solid' (= Reduce Transparency) | null
  hub.setPref = setPref;
  // called after the person's prefs load or change: the server's copy wins over the device mirror
  function adoptTheme() {
    if (!hasPrefs() || localPrefs()) return;
    let t = hub.get('theme', PREFS);
    if (t === undefined) { if (!store[chKey('hub', 'person')].since) return; t = 'system'; }   // pulled before and nothing set: this person uses the system look
    t = themeId(t);
    if (t === hub.theme()) { lsSet(LS.personTheme(hub.profile.id), t); return; }
    mirrorTheme(t); applyTheme(); tell({ type: 'hub:theme', theme: t });
  }
  // the same for the other preferences: a row wins; once the scope has been pulled, a key with no row is the default
  function adoptPrefs() {
    if (!hasPrefs() || localPrefs()) return;
    const pulled = !!store[chKey('hub', 'person')].since, cur = prefsNow(), next = { ...cur };
    for (const k of PREF_KEYS) {
      const v = hub.get(k, PREFS);
      if (v === undefined) { if (pulled) delete next[k]; }
      else if (PREF_VALUES[k].includes(v)) next[k] = v;
    }
    const shown = document.documentElement.getAttribute('data-text-size') || 'm';
    const same = JSON.stringify(cleanPrefs(next)) === JSON.stringify(cur) && shown === hub.prefs().textSize;   // D17: the fallback reads the row
    mirrorPrefs(next);
    if (!same) { applyTheme(); tell({ type: 'hub:theme', theme: hub.theme() }); }
  }
  // The look a person had on this device: their own mirror, else their cached rows, else System and the defaults.
  function themeFor(id) {
    const own = lsGet(LS.personTheme(id), null); if (own) return themeId(own);
    const c = lsGet(LS.cache('hub', 'person', id), null); const it = c && c.items && c.items.theme;
    return themeId(it && it.v);
  }
  function prefsFor(id) {
    const own = lsGet(LS.personPrefs(id), null); if (own) return cleanPrefs(own);
    const c = lsGet(LS.cache('hub', 'person', id), null), r = {};
    if (c && c.items) for (const k of PREF_KEYS) if (c.items[k] && c.items[k].v != null) r[k] = c.items[k].v;
    return cleanPrefs(r);
  }
  hub.setSession = s => {
    const was = hub.profile ? hub.profile.id : null;
    hub.session = s || null; lsSet(LS.session, s || undefined);
    hub.profile = publicProfile(s && s.profile);
    if (s && s.profile) lsSet(LS.last, s.profile.id);
    // A different person (or nobody, at the picker) never inherits the previous person's look.
    const now = hub.profile ? hub.profile.id : null;
    if (now !== was) {
      const t = now ? themeFor(now) : 'system'; lsSet(LS.theme, t === 'system' ? undefined : t);
      const r = now ? prefsFor(now) : {}; lsSet(LS.prefs, Object.keys(r).length ? r : undefined);
      tell({ type: 'hub:theme', theme: t });
    }
    applyTheme();
  };
  // ACCENT-9: an admin recolour (or a rename, a new photo) reaches a person who is already signed in. After a pull, at most
  // once a minute across the shell and its app frame, the session's profile is refreshed from /api/me; the other window
  // re-applies it through the storage listener.
  async function refreshProfile() {
    if (!hub.session || !hub.profile || !hub.device) return;
    if (Date.now() - (+lsGet(LS.meAt, 0) || 0) < 60000) return;
    lsSet(LS.meAt, Date.now());
    const token = hub.session.token;
    let r; try { r = await hub.request('/api/me', { timeout: 8000 }); } catch { return; }
    if (!r || !r.profile || !hub.session || hub.session.token !== token || !hub.profile || r.profile.id !== hub.profile.id) return;
    const old = hub.session.profile || {}, keys = ['name', 'emoji', 'color', 'hue', 'kind', 'photo', 'is_admin', 'is_guest', 'has_pin'];
    if (keys.every(k => JSON.stringify(old[k] ?? null) === JSON.stringify(r.profile[k] ?? null))) return;
    hub.setSession({ ...hub.session, profile: { ...old, ...r.profile } });
    tell({ type: 'hub:profile' });
    try { window.dispatchEvent(new CustomEvent('hub:profile')); } catch {}   // the page redraws the name, face and colour
  }
  hub.refreshProfile = refreshProfile;
  hub.profile = publicProfile(hub.session && hub.session.profile);
  applyTheme();
  Object.defineProperty(hub, 'isKid', { get: () => !!hub.profile && hub.profile.kind === 'kid' });
  Object.defineProperty(hub, 'isKiosk', { get: () => !!hub.profile && hub.profile.kind === 'kiosk' });
  // the shared kitchen device (KITCHEN-1): writes the family apps, credits people by a face tap, has no personal sign-in
  Object.defineProperty(hub, 'isKitchen', { get: () => !!hub.profile && hub.profile.kind === 'kitchen' });
  /** A household adult (not a guest, the kitchen or the TV): the people who hold the household's controls. */
  Object.defineProperty(hub, 'isHouseholdAdult', { get: () => !!hub.profile && hub.profile.kind === 'adult' && !hub.profile.isGuest });
  Object.defineProperty(hub, 'canWrite', { get: () => !!hub.profile && hub.profile.kind !== 'kiosk' });

  // ── transport ──────────────────────────────────────────────────────────────
  function setSync(patch) {
    Object.assign(hub.sync, patch);
    if (patch && patch.lastPull) lsSet(LS.lastSync, patch.lastPull);
    hub.sync.pending = pendingCount();
    if (hub.sync.pending && hub.sync.state === 'synced') hub.sync.state = 'pending';
    for (const cb of listeners.sync) { try { cb({ ...hub.sync }); } catch (e) { console.error(e); } }
    tell({ type: 'hub:sync', sync: { ...hub.sync } });
  }
  hub.onSync = cb => { listeners.sync.add(cb); cb({ ...hub.sync }); return () => listeners.sync.delete(cb); };
  /** When this device last finished a pull (ms), this session or an earlier one; 0 = never. hub.sync.lastPull is this session's. */
  hub.lastSynced = () => hub.sync.lastPull || +lsGet(LS.lastSync, 0) || 0;
  hub.onAuthLoss = cb => { listeners.auth.add(cb); return () => listeners.auth.delete(cb); };

  // token: send this profile token instead of the current one (a signed-out person's queue); signal: abort from outside
  hub.request = async function (path, { method = 'GET', body, profile = true, device = true, timeout = 12000, token, signal } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    const dt = device && hub.device ? hub.device.token : null;
    const pt = token || (profile && hub.session ? hub.session.token : null);
    if (dt) headers['X-Device-Token'] = dt;
    if (pt) headers['X-Profile-Token'] = pt;
    const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), timeout);
    let cut = false; const onCut = () => { cut = true; ctl.abort(); };
    if (signal) { if (signal.aborted) onCut(); else signal.addEventListener('abort', onCut); }
    let r;
    try {
      r = await fetch(hub.api.replace(/\/$/, '') + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), cache: 'no-store', signal: ctl.signal });
    } catch (e) {
      if (cut) throw new HubError(0, 'aborted', 'Cancelled.');
      throw new HubError(0, 'network', e.name === 'AbortError' ? 'The house server took too long.' : 'No connection.');
    } finally { clearTimeout(timer); if (signal) signal.removeEventListener('abort', onCut); }
    let data = null; try { data = await r.json(); } catch {}
    if (!r.ok) {
      const err = new HubError(r.status, (data && data.error) || 'http_' + r.status, (data && data.message) || 'Request failed'); err.data = data || {};   // the body's extra fields (retry_after on a 429: the PIN pad's countdown)
      if (r.status === 401) handleAuthLoss(err, dt, pt);
      throw err;
    }
    return data;
  };
  // A 401 signs out only the tokens that are still in use: an answer to a request the previous person made, or to a
  // signed-out person's queue being sent with their own token, must never throw the next person back to the picker.
  function handleAuthLoss(err, dt, pt) {
    if (err.error === 'device_not_paired' && dt !== (hub.device && hub.device.token)) return;
    if (err.error !== 'device_not_paired' && pt !== (hub.session ? hub.session.token : null)) return;
    if (err.error === 'device_not_paired') { hub.device = null; lsSet(LS.device, undefined); }
    if (err.error === 'device_not_paired' || err.error === 'profile_session_invalid' || err.error === 'profile_required') {
      hub.setSession(null);
      setSync({ state: 'error', lastError: err.error });
      tell({ type: 'hub:reauth', reason: err.error });
      for (const cb of listeners.auth) { try { cb(err.error); } catch (e) { console.error(e); } }
      if (!inFrame && appId !== 'hub') location.replace('../index.html');
    }
  }

  // ── auth helpers (used by index.html) ─────────────────────────────────────
  // A random id for this install, sent while pairing so the Worker limits wrong codes per device, not per house (UX-PROF-a7).
  const installId = () => { let f = lsGet('hub.fp', null); if (!f || !/^[A-Za-z0-9_-]{8,64}$/.test(f)) { f = hub.uid().replace(/[^A-Za-z0-9_-]/g, '') + Math.random().toString(36).slice(2, 10); lsSet('hub.fp', f); } return f; };
  hub.pair = async (code, name) => {
    const d = await hub.request('/api/pair', { method: 'POST', body: { code, name, fp: installId() }, device: false, profile: false });
    hub.device = { id: d.device_id, token: d.device_token, name: name || '' }; lsSet(LS.device, hub.device);
    hub.persistStorage();
    return hub.device;
  };
  // Ask the browser to keep this site's storage (unsent changes and the pairing live there) instead of evicting it
  // under pressure or, in a Safari tab, after a week without a visit. Resolves true when granted.
  hub.persistStorage = async () => { try { return !!(navigator.storage && navigator.storage.persist && await navigator.storage.persist()); } catch { return false; } };
  /** True in an iPhone/iPad Safari tab (not the Home Screen app), where the browser may clear the hub's storage. */
  // (an iPad's Safari says Macintosh; the touch points give it away)
  hub.isSafariTab = () => { try { return (/iP(hone|ad|od)/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)) && !navigator.standalone && !matchMedia('(display-mode: standalone)').matches; } catch { return false; } };
  /**
   * "Forget this device". Everything waiting to send goes first; if anything is still waiting afterwards (offline, or a
   * signed-out person's changes this device cannot send for them), it refuses with HubError 'unsent' and
   * err.unsent = [{pid, n}]. Otherwise the server deletes this device, its sessions and its push subscriptions, and only
   * then is local storage cleared.
   */
  hub.forgetDevice = async () => {
    await hub.flush(); await retire();
    const known = new Set(hub.people().map(p => p.id)); if (hub.profile) known.add(hub.profile.id);
    const waiting = hub.unsent().filter(w => known.has(w.pid));
    if (waiting.length) { const e = new HubError(409, 'unsent', 'Changes are still waiting to reach the house.'); e.unsent = waiting; throw e; }
    await hub.request('/api/device/forget', { method: 'POST', body: {} });
    try { const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration(); const sub = reg && reg.pushManager && await reg.pushManager.getSubscription(); if (sub) await sub.unsubscribe(); } catch {}
    for (const k of lsKeys()) if (k.startsWith('hub.')) try { localStorage.removeItem(k); } catch {}
    hub.device = null; hub.session = null; hub.profile = null;
  };
  hub.profiles = () => hub.request('/api/profiles', { profile: false }).then(r => { lsSet(LS.profiles, r.profiles); return r.profiles; });
  /** Everyone in the house, from the last profiles pull (cached in localStorage) — for faces in apps. The kitchen is not a person. */
  hub.people = () => (lsGet(LS.profiles, null) || []).filter(p => p && p.kind !== 'kitchen');
  /** What this device is: { role: null | 'kitchen', kitchen_profile } (KITCHEN-1). Remembered for an offline boot. */
  /** Drops every person-scope cache on this device except `keep`'s (the kitchen device keeps nobody's private rows). */
  hub.dropPersonCaches = keep => { for (const k of lsKeys()) { const m = k.match(PERSON_CACHE_RE); if (m && m[1] !== keep) lsSet(k, undefined); } };
  hub.deviceRole = async () => {
    const r = await hub.request('/api/device', { profile: false, timeout: 5000 });
    lsSet('hub.role', r.role || undefined);
    return r;
  };
  hub.login = async (profileId, pin) => {
    const r = await hub.request('/api/login', { method: 'POST', body: { profile_id: profileId, pin }, profile: false });
    hub.setSession({ token: r.profile_token, profile: r.profile }); return hub.profile;
  };
  // code: the one-time code the admin was shown when they reset this person's PIN (P2-PROF-04)
  hub.createPin = async (profileId, pin, code) => {
    const r = await hub.request(`/api/profiles/${encodeURIComponent(profileId)}/pin`, { method: 'POST', body: { pin, ...(code ? { code } : {}) }, profile: false });
    hub.setSession({ token: r.profile_token, profile: r.profile }); return hub.profile;
  };
  /** Me → Change my PIN (household adults): the current PIN, then the new one. */
  hub.changePin = (current, pin) => hub.request('/api/me/pin', { method: 'POST', body: { current, pin } });
  // Switch / sign out. The person's unsent writes and feed lines stay on the device under their id and are sent with
  // their own session before it is ended (now if online, else on reconnect or before the next sign-in here); a queue
  // that still cannot be sent waits for their next sign-in on this device. Nothing of theirs is dropped, and their
  // private caches leave the device at once. Waits at most `wait` ms for the network part.
  hub.signOut = async ({ wait = 4000 } = {}) => {
    const s = hub.session;
    if (s && s.profile) {
      const who = s.profile.id;
      retireLater({ token: s.token, pid: who });
      for (const k of lsKeys()) { const m = k.match(PERSON_CACHE_RE); if (m && m[1] === who) lsSet(k, undefined); }
      for (const ch of [...unsaved]) saveQueue(ch);          // the space just freed may take a queue the device was holding in memory
    }
    hub.setSession(null); hub.reset();
    tell({ type: 'hub:reauth', reason: 'signed_out' });
    if (s) await Promise.race([retire(), new Promise(r => setTimeout(r, wait))]);
  };
  hub.lastProfile = () => lsGet(LS.last, null);

  // ── local store ───────────────────────────────────────────────────────────
  const pid = () => (hub.profile ? hub.profile.id : 'nobody');
  function loadScope(ch) {
    const { app, scope } = CH.get(ch);
    store[ch] = lsGet(LS.cache(app, scope, pid()), { items: {}, since: 0 });
    queue[ch] = lsGet(LS.queue(app, scope, pid()), {});
    unsaved.delete(ch); delete unsavedPrev[ch];
    overlay(ch);
  }
  // A write still waiting to send is what this device shows, whatever the cache holds: after a Switch the person's cache
  // is gone but their queue stays, and a value missing from the store would let the app write its default over it.
  function overlay(ch) {
    const items = store[ch].items;
    for (const [k, e] of Object.entries(queue[ch] || {})) if (!items[k] || items[k].t < e.updated_at) items[k] = { v: e.value, t: e.updated_at };
  }
  // Two windows (the hub shell and an app iframe) sync the same channel through one localStorage. After an await,
  // re-read it so a write the other window made meanwhile (a Pause tombstone, say) is never overwritten by a stale copy,
  // and tell the app about every value that changed, so it never keeps painting (and later writes back) the old one.
  function refreshScope(ch) {
    const { app, scope } = CH.get(ch);
    const c = lsGet(LS.cache(app, scope, pid()), null), q = lsGet(LS.queue(app, scope, pid()), null);
    if (unsaved.has(ch)) { const mem = queue[ch] || {}; queue[ch] = { ...(q || {}) }; for (const [k, e] of Object.entries(mem)) if (!queue[ch][k] || queue[ch][k].updated_at < e.updated_at) queue[ch][k] = e; }
    else queue[ch] = q || {};
    if (c && c.items) {
      const old = (store[ch] && store[ch].items) || {};
      store[ch] = c; overlay(ch);
      for (const k of new Set([...Object.keys(old), ...Object.keys(c.items)])) {
        const a = old[k], b = c.items[k];
        if ((a && a.t) !== (b && b.t) || JSON.stringify(a && a.v) !== JSON.stringify(b && b.v)) emit(ch, k, b ? b.v : null, b ? b.t : 0);
      }
    }
  }
  // While a channel's queue lives only in memory (device full), the stored cache keeps each unsent key's previous value:
  // after a reload the device must not show a change it could not keep, as if it were saved.
  const unsavedPrev = {};   // ch -> { key: the item the cache held before the unsent write (undefined: none) }
  function saveStore(ch) {
    const { app, scope } = CH.get(ch); let c = store[ch];
    const prev = unsaved.has(ch) && unsavedPrev[ch];
    if (prev) { c = { ...c, items: { ...c.items } }; for (const [k, it] of Object.entries(prev)) { if (it) c.items[k] = it; else delete c.items[k]; } }
    lsSet(LS.cache(app, scope, pid()), c);
  }
  // A queue that cannot be stored (device full) stays in memory, is still sent, and the person is told once.
  function saveQueue(ch) {
    const { app, scope } = CH.get(ch); const q = queue[ch] || {};
    if (lsSet(LS.queue(app, scope, pid()), Object.keys(q).length ? q : undefined)) { if (unsaved.delete(ch)) { delete unsavedPrev[ch]; saveStore(ch); } return true; }
    unsaved.add(ch); fullNudge(); return false;
  }
  let fullAt = 0;
  function fullNudge() {
    if (Date.now() - fullAt < 20000) return; fullAt = Date.now();
    hub.sync.lastError = 'storage_full';
    hub.toast("This device's storage is full — your change is kept, but keep the hub open until it syncs.", 5000);
  }
  // Every queue on this device that belongs to `who`: the channels this window syncs and any other app's queue left in
  // localStorage (Tally's taps after Tally closed, a queue from before a Switch).
  function queuesOf(who) {
    const out = new Map();
    for (const k of lsKeys()) { const m = k.match(QUEUE_RE); if (m && m[3] === who) out.set(chKey(m[1], m[2]), { app: m[1], scope: m[2] }); }
    if (who === pid()) for (const [ch, q] of Object.entries(queue)) if (Object.keys(q).length) out.set(ch, CH.get(ch));
    return [...out.values()];
  }
  function pendingCount() {
    const who = pid(); let n = 0; const seen = new Set();
    for (const [ch, q] of Object.entries(queue)) { n += Object.keys(q).length; const { app, scope } = CH.get(ch); seen.add(LS.queue(app, scope, who)); }
    for (const k of lsKeys()) { const m = k.match(QUEUE_RE); if (m && m[3] === who && !seen.has(k)) n += Object.keys(lsGet(k, {})).length; }
    return n;
  }
  // Before batch 0c a family queue had no owner, so whoever signed in next sent it (or, as the display, emptied it).
  // A household writer now takes such a queue over as their own; the display never touches it.
  function adoptLegacyFamilyQueues() {
    if (!hub.profile || !hub.canWrite) return;
    for (const k of lsKeys()) {
      const m = k.match(LEGACY_FAMILY_RE); if (!m) continue;
      const old = lsGet(k, {}), nk = LS.queue(m[1], 'family', pid()), mine = lsGet(nk, {});
      for (const [key, e] of Object.entries(old)) if (!mine[key] || mine[key].updated_at < e.updated_at) mine[key] = e;
      if (lsSet(nk, Object.keys(mine).length ? mine : undefined)) lsSet(k, undefined);
      const ch = chKey(m[1], 'family'); if (CH.has(ch) && store[ch]) refreshScope(ch);
    }
  }
  function scopeOf(opts) {
    const app = (opts && opts.app) || appId;
    const s = (opts && opts.scope) || (app === appId ? SCOPES[0] : 'person');
    const ch = chKey(app, s);
    if (!CH.has(ch)) throw new Error(`hub: scope '${s}' not declared for app '${app}' (declare with data-scope or hub.use())`);
    if (!store[ch]) loadScope(ch);
    return ch;
  }
  function emit(ch, key, value, updated_at) {
    const { app, scope } = CH.get(ch);
    if (app === 'hub' && scope === 'person' && key === 'theme') adoptTheme();
    if (app === 'hub' && scope === 'person' && PREF_VALUES[key]) adoptPrefs();
    for (const cb of listeners.change) { try { cb({ app, scope, key, value, updated_at, remote: true }); } catch (e) { console.error(e); } }
  }
  /** Sync another app's data too (used by the hub shell for the dashboard). scopes: 'person' | 'family' | 'both'. */
  hub.use = (app, scopes = 'person') => {
    for (const s of (scopes === 'both' ? ['person', 'family'] : [scopes])) {
      const ch = chKey(app, s);
      if (!CH.has(ch)) { CH.set(ch, { app, scope: s }); if (readyPromise) loadScope(ch); }
    }
    return hub;
  };

  hub.get = (key, opts) => {
    const ch = scopeOf(opts); const it = store[ch].items[key];
    return it && it.v != null ? it.v : (opts && 'default' in opts ? opts.default : undefined);
  };
  hub.has = (key, opts) => { const ch = scopeOf(opts); const it = store[ch].items[key]; return !!(it && it.v != null); };
  hub.list = (prefix = '', opts) => {
    const ch = scopeOf(opts);
    return Object.entries(store[ch].items)
      .filter(([k, it]) => k.startsWith(prefix) && it.v != null)
      .map(([k, it]) => ({ key: k, value: it.v, updated_at: it.t }));
  };
  /**
   * A map kept as one row per entry (batch 0e, P2-SYNC-01): `<prefix><id>` rows, each overriding the same entry of the
   * old whole-map row `legacyKey` (kept read-only as the base; false = the entry is off). Two devices changing different
   * entries never erase each other, because each writes only its own row. Returns a plain { id: value } object.
   */
  hub.rowMap = (prefix, legacyKey, opts) => {
    const base = legacyKey ? hub.get(legacyKey, opts) : null;
    const out = base && typeof base === 'object' && !Array.isArray(base) ? { ...base } : {};
    for (const r of hub.list(prefix, opts)) { const id = r.key.slice(prefix.length); if (r.value === false) delete out[id]; else out[id] = r.value; }
    return out;
  };
  hub.set = (key, value, opts) => {
    const ch = scopeOf(opts);
    if (!hub.profile) throw new HubError(401, 'profile_required', 'Choose a profile first.');
    if (hub.isKiosk) { kioskNudge(); throw new HubError(403, 'read_only', 'This screen only looks.'); }
    if (typeof key !== 'string' || !/^[A-Za-z0-9_.:\-\/]{1,200}$/.test(key)) throw new Error('hub.set: bad key ' + key);
    // Never write into data this device has not pulled yet: whatever the app computed came from an empty cache and,
    // under last-write-wins, would replace the real row for good. opts.unloaded = true is for a brand-new row whose
    // value depends on nothing stored (a fresh item:<id>).
    if (!(store[ch].since > 0) && !(opts && opts.unloaded)) { loadingNudge(); throw new HubError(0, 'not_loaded', 'Still loading — try again in a moment.'); }
    const t = Math.max(Date.now() + hub.skew, (store[ch].items[key] ? store[ch].items[key].t : 0) + 1);
    const v = value === undefined ? null : value;
    const before = store[ch].items[key];
    store[ch].items[key] = { v, t };
    queue[ch][key] = { value: v, updated_at: t };
    if (!saveQueue(ch)) { const p = unsavedPrev[ch] || (unsavedPrev[ch] = {}); if (!(key in p)) p[key] = before; }
    saveStore(ch);
    setSync({ state: navigator.onLine === false ? 'offline' : 'pending' });
    scheduleFlush();
    return v;
  };
  hub.remove = (key, opts) => hub.set(key, null, opts);
  hub.onChange = cb => { listeners.change.add(cb); return () => listeners.change.delete(cb); };
  // The display profile can look but not change things: say so once in a while instead of failing silently.
  let nudgedAt = 0;
  function kioskNudge() { if (Date.now() - nudgedAt < 2500) return; nudgedAt = Date.now(); hub.toast('This screen only looks — sign in on a phone to change things.', 2600); }
  hub.kioskNudge = kioskNudge;
  let loadNudgedAt = 0;
  function loadingNudge() { if (Date.now() - loadNudgedAt < 2500) return; loadNudgedAt = Date.now(); hub.toast('Still loading your data — try again in a moment.', 2600); }

  // ── first load ────────────────────────────────────────────────────────────
  // A channel is loaded once a pull of it has completed on this device (its cache carries the server's `since`),
  // whichever window pulled it: the shell and an app frame share one localStorage.
  const chLoaded = ch => { if (!store[ch]) loadScope(ch); return store[ch].since > 0; };
  const channelsOf = (app, scope) => [...CH.keys()].filter(ch => CH.get(ch).app === app && (!scope || CH.get(ch).scope === scope));
  /** True when every channel of `app` (default: this app), or just its `scope`, has been pulled at least once. */
  hub.isLoaded = (app = appId, scope) => { const chs = channelsOf(app, scope); return chs.length > 0 && chs.every(chLoaded); };
  const loadWaiters = new Set();
  function checkLoaded() { for (const w of [...loadWaiters]) if (hub.isLoaded(w.app, w.scope)) { loadWaiters.delete(w); w.resolve(true); } }
  /** Resolves (true) once hub.isLoaded(app, scope); it waits as long as that takes, through offline spells. */
  hub.loaded = (app = appId, scope) => new Promise(resolve => { if (hub.isLoaded(app, scope)) resolve(true); else loadWaiters.add({ app, scope, resolve }); });

  // ── sync ──────────────────────────────────────────────────────────────────
  function scheduleFlush(ms = 250) { clearTimeout(flushTimer); flushTimer = setTimeout(() => flush(), ms); }
  const BATCH = 200;                                    // the Worker's limit per request
  const tracked = () => { const c = new AbortController(); inflight.add(c); return c; };
  /**
   * Sends one person's queue for one channel, at most 200 rows a request, until it is empty. Works from localStorage, so
   * it can send a channel this window does not sync (Tally's, from the shell) or a signed-out person's queue with their
   * own token. A row the server refuses on its own (a bad key, too big) is dropped and counted; everything else that
   * fails stays queued. Returns { sent, rejected }.
   */
  async function flushQueue(app, scope, who, token, g) {
    const ch = chKey(app, scope), mine = () => g === gen && who === pid() && CH.has(ch);
    const qk = LS.queue(app, scope, who), ck = LS.cache(app, scope, who);
    const snapshot = () => { const q = { ...lsGet(qk, {}) }; if (mine() && queue[ch]) for (const [k, e] of Object.entries(queue[ch])) if (!q[k] || q[k].updated_at < e.updated_at) q[k] = e; return q; };
    const snap = snapshot();
    const rows = Object.entries(snap).map(([key, q]) => ({ key, value: q.value, updated_at: q.updated_at }));
    let sent = 0, rejected = 0, refused = 0;
    const post = async items => {
      const c = g === null ? null : tracked();
      try { return await hub.request(`/api/data/${encodeURIComponent(app)}/batch?scope=${scope}`, { method: 'POST', body: { items }, token, signal: c && c.signal }); }
      finally { if (c) inflight.delete(c); }
    };
    for (let i = 0; i < rows.length; i += BATCH) {
      const chunk = rows.slice(i, i + BATCH);
      let results;
      try { const res = await post(chunk); setSkew(res.now); results = res.results; }
      catch (e) {
        if (!isRowError(e)) throw e;
        // one bad row fails the whole request: send the rows one by one so only that row is dropped
        results = [];
        for (const it of chunk) {
          try { const res = await post([it]); results.push(res.results[0]); }
          catch (e2) { if (!isRowError(e2)) throw e2; results.push({ key: it.key, rejected: e2.error, updated_at: it.updated_at }); }
        }
      }
      // apply the answer to what is stored now (another window may have written meanwhile)
      const q = lsGet(qk, {}), c = scope === 'family' || who === pid() ? lsGet(ck, null) : null;
      for (const r of results) {
        const s = snap[r.key]; if (!s) continue;
        if (q[r.key] && q[r.key].updated_at === s.updated_at) delete q[r.key];
        if (mine() && queue[ch] && queue[ch][r.key] && queue[ch][r.key].updated_at === s.updated_at) { delete queue[ch][r.key]; if (unsavedPrev[ch]) delete unsavedPrev[ch][r.key]; }
        if (r.rejected) {
          rejected++;
          // a row the house's rules refuse (batch 0d: a kid, a guest or the kitchen writing what it may not) comes back
          // with what the house holds: put that back, unless a newer change to the same row is still waiting
          const waiting = q[r.key] || (mine() && queue[ch] && queue[ch][r.key]);
          // …and unless a pull has meanwhile brought a newer copy than the one refused
          const had = c && c.items[r.key], stale = !had || had.t === s.updated_at || had.t <= (+r.updated_at || 0);
          if ('value' in r) { refused++; if (c && !waiting && stale) c.items[r.key] = { v: r.value == null ? null : r.value, t: +r.updated_at || 0 }; }
          continue;
        }
        sent++;
        const local = c && c.items[r.key];
        if (!c) continue;
        if (r.applied) {
          if (!local) c.items[r.key] = { v: s.value, t: r.updated_at };                                          // a cache emptied by a Switch: the sent value is the row
          else if (local.t === s.updated_at && r.updated_at < local.t) local.t = r.updated_at;                       // the server's stamp (it clamps a fast clock), so later edits by others are not skipped
        } else if (!(local && local.t > r.updated_at)) c.items[r.key] = { v: r.value, t: r.updated_at };
      }
      lsSet(qk, Object.keys(q).length ? q : undefined);
      if (c) lsSet(ck, c);
      if (mine()) { refreshScope(ch); if (unsaved.has(ch)) saveQueue(ch); }   // adopt what is stored now, telling the app about every value that changed
    }
    return { sent, rejected, refused };
  }
  // A 4xx that belongs to the rows, not to the session or the network: retrying the same rows can never succeed.
  // Only the Worker's own row refusals count; any other refusal (read_only, an older Worker's 404) keeps the queue.
  const ROW_ERRORS = new Set(['bad_key', 'value_too_large', 'bad_batch']);
  const isRowError = e => e.status >= 400 && e.status < 500 && ROW_ERRORS.has(e.error);
  let rejectedNudgeAt = 0;
  function rejectedNudge(n, refused = 0) {
    if (!n || Date.now() - rejectedNudgeAt < 5000) return; rejectedNudgeAt = Date.now();
    if (refused >= n) { hub.toast(`That is not something ${hub.profile ? hub.profile.name : 'this profile'} can change, so it was put back.`, 5000); return; }
    hub.toast(n === 1 ? '1 change could not be saved to the house (it was refused as it is).' : `${n} changes could not be saved to the house (they were refused as they are).`, 5000);
  }
  /** Sends everything this person has waiting on this device. Resolves { sent, rejected, pending }. */
  function flush() {
    if (flushing) { flushAgain = true; return flushing; }
    let p;
    p = (async () => {
      await null;
      const total = { sent: 0, rejected: 0, refused: 0 };
      try {
        if (navigator.onLine === false) { if (pendingCount()) setSync({ state: 'offline' }); return total; }
        if (lsGet(LS.retiring, []).length) await retire();
        if (!hub.session || !hub.profile) return total;
        const g = gen, who = pid(), token = hub.session.token;
        adoptLegacyFamilyQueues();
        for (const { app, scope } of queuesOf(who)) {
          if (g !== gen) return total;
          const r = await flushQueue(app, scope, who, token, g);
          total.sent += r.sent; total.rejected += r.rejected; total.refused += r.refused;
        }
        if (g !== gen) return total;
        rejectedNudge(total.rejected, total.refused);
        setSync({ state: hub.sync.lastPull ? 'synced' : 'pending', lastError: total.rejected ? 'refused' : null });
        if (pendingCount()) scheduleFlush();
      } catch (e) {
        if (e.error === 'aborted') return total;
        setSync({ state: e.status ? 'error' : 'offline', lastError: e.error });
        scheduleFlush(e.status ? 30000 : 5000);
      } finally {
        if (flushing === p) flushing = null;
        if (flushAgain) { flushAgain = false; scheduleFlush(0); }
      }
      return total;
    })().then(t => ({ ...t, pending: pendingCount() }));
    flushing = p;
    return p;
  }
  let flushAgain = false;
  // A flush already running may have started before the caller's last write: wait for it, then send what is left.
  hub.flush = () => { clearTimeout(flushTimer); return flushing ? flushing.then(() => flush()) : flush(); };
  /** Changes waiting on this device, per person: [{ pid, n }] (the current person's included). */
  hub.unsent = () => {
    const by = {};
    for (const k of lsKeys()) { const m = k.match(QUEUE_RE); if (m) by[m[3]] = (by[m[3]] || 0) + Object.keys(lsGet(k, {})).length; }
    for (const [ch, q] of Object.entries(queue)) { const { app, scope } = CH.get(ch); if (unsaved.has(ch) || !lsGet(LS.queue(app, scope, pid()), null)) by[pid()] = (by[pid()] || 0) + Object.keys(q).length; }
    for (const k of lsKeys()) { const m = k.match(/^hub.aqueue.([^.]+)$/); if (m) by[m[1]] = (by[m[1]] || 0) + lsGet(k, []).length; }   // feed lines too
    return Object.entries(by).filter(([, n]) => n > 0).map(([id, n]) => ({ pid: id, n }));
  };

  // ── signed-out sessions ───────────────────────────────────────────────────
  // A Switch keeps the person's token until their queue and feed lines have gone with it and the server has ended the
  // session, so a Switch made offline still logs out once the device is back online (P2-SEC-03).
  function retireLater(r) { const list = lsGet(LS.retiring, []).filter(x => x.token !== r.token); list.push({ ...r, at: Date.now() }); lsSet(LS.retiring, list); }
  const forget = token => lsSet(LS.retiring, (l => l.length ? l : undefined)(lsGet(LS.retiring, []).filter(x => x.token !== token)));
  let retiring = null, retireAgain = false;
  // A sign-out made while this runs is picked up by a second pass, so a caller waiting on retire() sees it done.
  function retire() {
    if (retiring) { retireAgain = true; return retiring.then(() => retire()); }
    let p;
    p = (async () => {
      await null;
      try {
        do {
          retireAgain = false;
          for (const r of lsGet(LS.retiring, [])) {
            if (navigator.onLine === false || !hub.device) return;
            try {
              for (const { app, scope } of queuesOf(r.pid)) await flushQueue(app, scope, r.pid, r.token, null);
              // the session ends only once its feed lines have posted (or been refused): never strand them behind a logout
              if (!(await drainActivityFor(r.pid, r.token))) return;
              await hub.request('/api/logout', { method: 'POST', body: {}, token: r.token });
              forget(r.token);
            } catch (e) {
              if (e.status === 401) { forget(r.token); continue; }   // already ended: what is left waits for their next sign-in
              return;                                               // offline or a server error: try again later
            }
          }
        } while (retireAgain);
      } finally { if (retiring === p) retiring = null; }
    })();
    retiring = p;
    return p;
  }

  async function pullScope(ch) {
    if (!store[ch]) loadScope(ch);
    const { app, scope } = CH.get(ch);
    const g = gen, tok = hub.session ? hub.session.token : null;
    const c = tracked();
    let res;
    try { res = await hub.request(`/api/data/${app}?scope=${scope}&since=${store[ch].since || 0}`, { profile: scope === 'person' || !!hub.session, signal: c.signal }); }
    finally { inflight.delete(c); }
    // an answer for the previous person (a Switch happened meanwhile) is never saved under the next person's name
    if (g !== gen || tok !== (hub.session ? hub.session.token : null)) throw new HubError(0, 'aborted', 'Cancelled.');
    setSkew(res.now);
    refreshScope(ch);
    let changed = false;
    for (const it of res.items) {
      const q = queue[ch][it.key]; const local = store[ch].items[it.key];
      if (q && q.updated_at >= it.updated_at) continue;              // our pending write is newer
      // a cached stamp ahead of the server's own clock cannot be real (a fast clock before batch 0c): the server's row wins
      if (local && local.t >= it.updated_at && !(local.t > res.now + 30000 && !q)) continue;
      store[ch].items[it.key] = { v: it.value, t: it.updated_at }; changed = true;
      emit(ch, it.key, it.value, it.updated_at);
    }
    store[ch].since = res.now;
    saveStore(ch);
    checkLoaded();
    return changed;
  }
  hub.pull = function () {
    if (pulling) return pulling;
    let p;
    p = (async () => {
      await null;
      if (!hub.device) return false;
      const g = gen;
      try {
        // Every channel at once: each is its own cache and request, and one after another a slow network multiplied the
        // time every app and Home card spent on its loading state. A failed channel still fails the pull (as before),
        // but no longer stops the others from arriving.
        // A channel declared while this pull is in flight (the TV board adds the family prayer list after boot, and its
        // hub.pull() gets this promise) is pulled in a further round rather than waiting for the next 30 s tick.
        let changed = false; const done = new Set();
        for (;;) {
          const chs = [...CH.keys()].filter(ch => !done.has(ch) && !(CH.get(ch).scope === 'person' && !hub.session));
          if (!chs.length) break;
          chs.forEach(ch => done.add(ch));
          const res = await Promise.allSettled(chs.map(ch => pullScope(ch)));
          changed = res.some(r => r.status === 'fulfilled' && r.value) || changed;
          const bad = res.find(r => r.status === 'rejected'); if (bad) throw bad.reason;
        }
        setSync({ state: pendingCount() ? 'pending' : 'synced', lastError: null, lastPull: Date.now() });
        if (hub.sync.pending || lsGet(LS.retiring, []).length) scheduleFlush(0);
        adoptTheme(); adoptPrefs();
        refreshProfile();
        if (lsGet(LS.activity(pid()), []).length) drainActivity();
        return changed;
      } catch (e) {
        if (e.error !== 'aborted' && g === gen) setSync({ state: e.status ? 'error' : 'offline', lastError: e.error });
        return false;
      } finally { if (pulling === p) pulling = null; }
    })();
    pulling = p;
    return p;
  };

  // pagehide: an app closing (Tally back to Home, the PWA swiped away) still hands its queue to the network. keepalive
  // lets the request outlive the page; the queue stays until an answer is seen, so the next flush confirms it.
  // hub.onLeave(fn): runs just before that send, so a write an app makes on its way out (the Larder's finishing items,
  // batch 0h) goes with it.
  const leaveFns = [];
  hub.onLeave = fn => { if (typeof fn === 'function') leaveFns.push(fn); };
  // the shell calls this on the app in its frame before it closes it or signs the person out, so those writes are
  // queued before the shell reads the queues (the frame's own pagehide comes later)
  hub.leaveNow = () => { for (const fn of leaveFns) { try { fn(); } catch (e) { console.error(e); } } };
  window.addEventListener('pagehide', () => {
    hub.leaveNow();
    if (!hub.session || !hub.device || navigator.onLine === false) return;
    let budget = 60000;                                   // browsers cap keepalive bodies at 64 KB in flight
    for (const { app, scope } of queuesOf(pid())) {
      const ch = chKey(app, scope);
      const q = { ...lsGet(LS.queue(app, scope, pid()), {}), ...(queue[ch] || {}) };
      const items = Object.entries(q).slice(0, BATCH).map(([key, e]) => ({ key, value: e.value, updated_at: e.updated_at }));
      if (!items.length) continue;
      const body = JSON.stringify({ items }); if (body.length > budget) continue; budget -= body.length;
      try {
        fetch(hub.api.replace(/\/$/, '') + `/api/data/${encodeURIComponent(app)}/batch?scope=${scope}`, { method: 'POST', keepalive: true, body,
          headers: { 'Content-Type': 'application/json', 'X-Device-Token': hub.device.token, 'X-Profile-Token': hub.session.token } }).catch(() => {});
      } catch {}
    }
  });

  // ── lifecycle ─────────────────────────────────────────────────────────────
  hub.ready = function ({ optional = false } = {}) {
    if (readyPromise) return readyPromise;
    readyPromise = (async () => {
      if (!hub.profile && !optional) {
        tell({ type: 'hub:reauth', reason: 'no_profile' });
        if (!inFrame && appId !== 'hub') { location.replace('../index.html#' + appId); await new Promise(() => {}); }
        if (inFrame) await new Promise(() => {});      // the hub shell will reload this frame after sign-in
      }
      for (const ch of CH.keys()) loadScope(ch);
      adoptTheme(); adoptPrefs();                     // this person's look from the cache, before the first paint settles
      const seen = hub.isLoaded();                   // this app's own channels, not whatever the shell happened to cache
      if (navigator.onLine === false) setSync({ state: 'offline' });
      const first = hub.pull();
      if (!seen) await Promise.race([first, new Promise(r => setTimeout(r, 6000))]);
      // the 30 s poll is re-armed on every ready(): hub.reset() (a Switch) stops it, and the next person must not go stale
      clearInterval(pullTimer); pullTimer = setInterval(() => { if (!document.hidden) hub.pull(); }, 30000);
      if (lsGet(LS.retiring, []).length) retire();
      if (hub.canWrite && lsGet(LS.activity(pid()), []).length) drainActivity();
      if (!wired) { wired = true;
      document.addEventListener('visibilitychange', () => { if (!document.hidden) { hub.pull(); scheduleFlush(0); } });
      window.addEventListener('online', () => { setSync({ state: 'pending' }); scheduleFlush(0); hub.pull(); retire(); drainActivity(); });
      window.addEventListener('offline', () => setSync({ state: 'offline' }));
      window.addEventListener('message', ev => {
        if (ev.origin !== location.origin || !ev.data || ev.data.source !== 'hubshell') return;
        if (ev.data.type === 'hub:pull') hub.pull();
        if (ev.data.type === 'hub:theme') applyTheme();
      });
      // The hub shell and the app iframe are two copies of this SDK on one origin sharing one localStorage.
      // When the other window writes a cache or queue we hold, reload it so neither side clobbers the other.
      window.addEventListener('storage', ev => {
        if (!ev.key || !ev.key.startsWith('hub.')) return;
        if (ev.key === LS.theme || ev.key === LS.prefs) { applyTheme(); return; }
        // the other window refreshed this session's profile (ACCENT-9): the same person with the same token, new colours
        if (ev.key === LS.session) {
          const s2 = lsGet(LS.session, null);
          if (s2 && s2.profile && hub.session && s2.token === hub.session.token && hub.profile && s2.profile.id === hub.profile.id) { hub.session = s2; hub.profile = publicProfile(s2.profile); applyTheme(); try { window.dispatchEvent(new CustomEvent('hub:profile')); } catch {} }
          return;
        }
        for (const ch of CH.keys()) {
          const { app, scope } = CH.get(ch);
          if (ev.key === LS.cache(app, scope, pid())) {
            const sig = it => JSON.stringify(Object.keys(it).sort().map(k => [k, it[k].t, it[k].v]));
            const before = sig((store[ch] || {}).items || {});
            store[ch] = lsGet(ev.key, { items: {}, since: 0 });
            checkLoaded();
            if (sig(store[ch].items) !== before) {
              for (const cb of listeners.change) { try { cb({ app, scope, key: null, value: null, updated_at: 0, remote: true, bulk: true }); } catch (e) { console.error(e); } }
            }
          } else if (ev.key === LS.queue(app, scope, pid()) && !unsaved.has(ch)) { queue[ch] = lsGet(ev.key, {}); setSync({}); if (hub.sync.pending) scheduleFlush(500); }
        }
      });
      }
      return hub;
    })();
    return readyPromise;
  };
  // A Switch: stop everything that belonged to the previous person. Requests in flight are aborted and their answers
  // ignored (gen), the poll stops until the next ready() re-arms it, and the sync counters start again.
  hub.reset = () => {
    gen++; for (const c of inflight) { try { c.abort(); } catch {} } inflight.clear();
    readyPromise = null; pulling = null; flushing = null; flushAgain = false; clearTimeout(flushTimer); clearInterval(pullTimer);
    for (const k of Object.keys(store)) delete store[k]; for (const k of Object.keys(queue)) delete queue[k]; unsaved.clear(); for (const k of Object.keys(unsavedPrev)) delete unsavedPrev[k];
    hub.sync = freshSync(); setSync({});
  };

  // ── activity feed ─────────────────────────────────────────────────────────
  // Lines wait in their author's own queue, stamped with when they happened, and only the author's session posts them:
  // an offline line never lands under whoever acts next on a shared device, and it keeps its time in the feed.
  // hub.activity(text, app?, { as }?): on the kitchen device `as` is the household member whose face was tapped, and the
  // Worker files the line under them (KITCHEN-1); anywhere else a line is always filed under the person signed in.
  hub.activity = async function (text, app = appId, opts) {
    if (app && typeof app === 'object') { opts = app; app = appId; }
    if (!hub.canWrite || !text) return;
    const k = LS.activity(pid());
    const line = { id: hub.uid(), app_id: app || appId, text: String(text).slice(0, 200), at: Math.round(Date.now() + hub.skew) };
    if (opts && opts.as && hub.isKitchen) line.as = String(opts.as);
    const q = lsGet(k, []); q.push(line); lsSet(k, q.slice(-50));
    return drainActivity();
  };
  let draining = null;
  // One drain at a time in this window; a second call while one runs waits for it and then drains what is left.
  function drainActivity() {
    if (!hub.session || !hub.canWrite) return Promise.resolve();
    if (draining) { drainAgain = true; return draining; }
    let p;
    p = (async () => {
      await null;
      // wait for a sign-out's drain of the same queue in this window: two posting at once would post a line twice
      try { adoptLegacyActivity(); if (retiring) await retiring; if (hub.session) await drainActivityFor(pid(), hub.session.token); } catch {}
      finally { if (draining === p) draining = null; if (drainAgain) { drainAgain = false; drainActivity(); } }
    })();
    draining = p;
    return p;
  }
  let drainAgain = false;
  const ACTIVITY_MAX_AGE = 7 * 86400000;
  // Posts `who`'s lines oldest first with `token`, removing each by id once the server has it (never re-posting the
  // copy another call is holding). Stops, keeping the line, on no network, a server error, 429 or 401 (a signed-out
  // session: the line waits for its author's next sign-in).
  async function drainActivityFor(who, token) {
    const k = LS.activity(who), lock = 'hub.alock.' + who, me = WINDOW_ID;
    const held = lsGet(lock, null); if (held && held.until > Date.now() && held.by !== me) return false;   // the other window is posting these
    for (;;) {
      if (navigator.onLine === false) return false;
      lsSet(lock, { by: me, until: Date.now() + 20000 });
      const q = lsGet(k, []).filter(x => x && x.at > Date.now() + hub.skew - ACTIVITY_MAX_AGE);
      const head = q[0];
      if (!head) { lsSet(k, undefined); break; }
      try { await hub.request('/api/activity', { method: 'POST', body: { app_id: head.app_id, text: head.text, at: head.at, ...(head.as ? { as: head.as } : {}) }, token }); }
      catch (e) { if (!e.status || e.status === 401 || e.status === 429 || e.status >= 500) { lsSet(lock, undefined); return false; } }   // any other 4xx: the line itself is refused, drop it
      const rest = lsGet(k, []).filter(x => x && x.id !== head.id);
      lsSet(k, rest.length ? rest : undefined);
    }
    lsSet(lock, undefined);
    return true;
  }
  const WINDOW_ID = Math.random().toString(36).slice(2);   // this window's claim on a feed queue (the shell and an app frame are two)
  // Lines queued before batch 0c carry no author: the first household writer to drain takes them, as before.
  function adoptLegacyActivity() {
    const old = lsGet(LS.legacyActivity, null); if (!old) return;
    const k = LS.activity(pid()); const q = lsGet(k, []);
    for (const x of old) if (x && x.text) q.push({ id: hub.uid(), app_id: x.app_id || 'hub', text: x.text, at: x.at || Date.now() });
    if (lsSet(k, q.slice(-50))) lsSet(LS.legacyActivity, undefined);
  }
  hub.activityFeed = (limit = 30) => hub.request(`/api/activity?limit=${limit}`, { profile: false }).then(r => r.activity);

  // ── legacy migration ──────────────────────────────────────────────────────
  /* entries: [{ from: 'tally.count', to: 'count', scope: 'person', parse: raw => value }]
     Runs once per device per (app, scope). Person-scope data goes to the first household ADULT (never a guest) who
     opens the app on this device, and only if that key is still empty on the server: it waits until the scope has
     loaded and then for a fresh pull that succeeds, so the check reads the server's rows, not an empty cache.
     Originals are left untouched. Returns a promise of the keys moved; a change event (key null, migrated: true)
     tells the app to re-render. */
  hub.migrate = async function (entries) {
    const eligible = e => { const s = e.scope || SCOPES[0]; return CH.has(chKey(appId, s)) && hub.canWrite && !(hub.profile && hub.profile.isGuest) && !(s === 'person' && hub.profile.kind !== 'adult'); };
    const todo = entries.filter(e => eligible(e) && !lsGet(LS.migrated, {})[`${appId}.${e.scope || SCOPES[0]}`]);
    if (!todo.length) return [];
    const who = pid();
    for (const s of new Set(todo.map(e => e.scope || SCOPES[0]))) await hub.loaded(appId, s);
    for (;;) {                                       // one pull that succeeds, started after the scope loaded
      const before = hub.sync.lastPull; await hub.pull();
      if (hub.sync.lastPull > before && !hub.sync.lastError) break;
      await new Promise(r => setTimeout(r, 15000));
    }
    if (pid() !== who) return [];                    // the person switched meanwhile: the next open migrates
    try { return migrateNow(todo); } catch (e) { console.error(e); return []; }
  };
  function migrateNow(entries) {
    const done = lsGet(LS.migrated, {});
    const moved = [], ran = new Set();   // a scope is marked done only when an adult writer actually looked at it
    for (const e of entries) {
      const s = e.scope || SCOPES[0];
      const mark = `${appId}.${s}`;
      if (done[mark] || !CH.has(chKey(appId, s)) || !hub.canWrite || (hub.profile && hub.profile.isGuest)) continue;
      if (s === 'person' && hub.profile.kind !== 'adult') continue;
      ran.add(mark);
      let raw; try { raw = localStorage.getItem(e.from); } catch { raw = null; }
      if (raw == null) continue;
      let value; try { value = e.parse ? e.parse(raw) : JSON.parse(raw); } catch { value = raw; }
      if (value == null) continue;
      if (typeof e.to === 'function') { for (const [k, v] of e.to(value)) if (!hub.has(k, { scope: s })) { hub.set(k, v, { scope: s }); moved.push(k); } }
      else if (!hub.has(e.to, { scope: s })) { hub.set(e.to, value, { scope: s }); moved.push(e.to); }
    }
    for (const mark of ran) done[mark] = Date.now();
    if (ran.size) lsSet(LS.migrated, done);
    if (moved.length) for (const cb of listeners.change) { try { cb({ app: appId, scope: null, key: null, value: null, updated_at: 0, remote: false, migrated: true }); } catch (e) { console.error(e); } }
    return moved;
  }

  // ── the household's day ───────────────────────────────────────────────────
  // One "today" for every device: the Worker, the 8 am / 8 pm jobs and chat all use America/New_York, so a phone set to
  // another zone must file a tick, a star or a prayed mark under the house's date, not its own.
  const NY_DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' });
  /** 'YYYY-MM-DD' in New York for a time (default now). */
  hub.today = (t = Date.now()) => { const p = {}; for (const x of NY_DAY.formatToParts(new Date(t))) p[x.type] = x.value; return `${p.year}-${p.month}-${p.day}`; };
  const dayNum = d => { const [y, m, dd] = String(d).split('-').map(Number); return Date.UTC(y, m - 1, dd) / 86400000; };
  /** Whole calendar days from date a to date b ('YYYY-MM-DD'); DST cannot shift it. */
  hub.daysBetween = (a, b) => Math.round(dayNum(b) - dayNum(a));
  /** The date n days after d ('YYYY-MM-DD'). */
  hub.addDays = (d, n) => new Date((dayNum(d) + n) * 86400000).toISOString().slice(0, 10);
  // hub.onDay(fn): fn(today) when the household's date changes while the page is open (checked every 20 s, on focus
  // and when the page becomes visible, so a sleeping iPad catches up the moment it wakes).
  const dayCbs = new Set(); let dayNow = null, dayTimer = null;
  function checkDay() { const d = hub.today(); if (d === dayNow) return; const was = dayNow; dayNow = d; if (was) for (const cb of dayCbs) { try { cb(d); } catch (e) { console.error(e); } } }
  hub.onDay = cb => {
    dayCbs.add(cb);
    if (!dayTimer) {
      dayNow = hub.today(); dayTimer = setInterval(checkDay, 20000);
      document.addEventListener('visibilitychange', () => { if (!document.hidden) checkDay(); });
      window.addEventListener('focus', checkDay); window.addEventListener('pageshow', checkDay);
    }
    return () => dayCbs.delete(cb);
  };

  // ── voice input ───────────────────────────────────────────────────────────
  hub.voiceInput = function (onResult, { lang = 'en-US', onEnd, onError } = {}) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return null;
    let rec;
    try { rec = new SR(); } catch { return null; }
    rec.lang = lang; rec.interimResults = false; rec.maxAlternatives = 1; rec.continuous = false;
    rec.onresult = ev => { const t = Array.from(ev.results).map(r => r[0].transcript).join(' ').trim(); if (t) onResult(t); };
    rec.onerror = ev => { if (onError) onError(ev.error || 'error'); };
    rec.onend = () => { if (onEnd) onEnd(); };
    try { rec.start(); } catch (e) { if (onError) onError('start_failed'); return null; }
    return { stop: () => { try { rec.stop(); } catch {} }, abort: () => { try { rec.abort(); } catch {} } };
  };
  hub.voiceSupported = !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  // ── misc ──────────────────────────────────────────────────────────────────
  hub.open = id => { tell({ type: 'hub:open', appId: id }); if (!inFrame) location.href = '../index.html#' + id; };
  // hub.immersive(on) (UX-PRAYER-9): inside the hub's viewer, asks the shell to hide its top bar so the app has the whole
  // screen (Prayer's Pray now); hub.immersive(false) brings it back. Standalone it does nothing and returns false. The
  // shell also brings the bar back when the viewer closes, the frame reloads or navigates, and on Escape: an Escape the
  // app does not handle (no preventDefault, still immersive after it) brings the bar back rather than trapping anyone. An
  // app that goes immersive keeps its own visible Close that calls hub.immersive(false). When the shell puts the bar back
  // by itself, 'hub:immersive' fires on window with detail { on: false }; hub.isImmersive() reads the state.
  let immersed = false;
  const immersiveOff = () => { if (!immersed) return; immersed = false; try { window.dispatchEvent(new CustomEvent('hub:immersive', { detail: { on: false } })); } catch {} };
  hub.immersive = on => { if (!inFrame) return false; immersed = !!on; tell({ type: 'hub:immersive', on: immersed }); return true; };
  hub.isImmersive = () => immersed;
  if (inFrame) {
    window.addEventListener('message', ev => { if (ev.origin === location.origin && ev.data && ev.data.source === 'hubshell' && ev.data.type === 'hub:immersive' && !ev.data.on) immersiveOff(); });
    window.addEventListener('keydown', ev => { if (ev.key === 'Escape' && immersed) setTimeout(() => { if (immersed && !ev.defaultPrevented) { tell({ type: 'hub:immersive', on: false }); immersiveOff(); } }, 0); });
    window.addEventListener('pagehide', () => { if (immersed) { immersed = false; tell({ type: 'hub:immersive', on: false }); } });
  }
  // hub.toast(msg, ms, { action: 'Undo', onAction }) adds one button to the toast (batch 0h: the Larder's Undo); the
  // toast then stays up for ms and the button closes it. A tap anywhere else on the toast puts it away (UX-KIDVERSE-8, UX-VERSES-6).
  hub.toast = (msg, ms = 2200, opts = {}) => {
    let el = document.getElementById('hub-toast');
    if (!el) { const w = document.createElement('div'); w.className = 'ds'; el = document.createElement('div'); el.id = 'hub-toast'; el.className = 'toast'; el.setAttribute('role', 'status'); w.appendChild(el); document.body.appendChild(w);
      el.addEventListener('click', e => { if (!e.target.closest('.toast-act')) { el.hidden = true; clearTimeout(el._t); } }); }
    el.textContent = msg;
    if (opts && opts.action && typeof opts.onAction === 'function') {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'toast-act'; b.textContent = opts.action;
      b.onclick = () => { el.hidden = true; clearTimeout(el._t); opts.onAction(); };
      el.append(' ', b);
    }
    el.hidden = false; clearTimeout(el._t); el._t = setTimeout(() => { el.hidden = true; }, ms);
  };
  // hub.confirm(message, { title, ok: 'Delete', cancel: 'Cancel', danger: true }) → Promise<boolean>: the one confirm sheet
  // in place of the browser's confirm() (CONS-TELL-2). design.css's .ds .sheet and .ds .btn in a div.ds of its own, so it
  // works in any page, .ds or not. True only from the confirm button or Enter; Cancel, Escape and a tap on the backdrop give
  // false. Focus starts on the safe button (Cancel; OK when there is none), stays in the sheet and goes back afterwards.
  // Enter presses the button that has focus, so with focus on Cancel it cancels (a keyboard or VoiceOver user hears
  // "Cancel" and gets Cancel). Only the topmost sheet answers a key. hub.alert(message, { title, ok })
  // is the one-button notice (→ Promise<void>). Motion comes from the tokens, so Reduce Motion stills it.
  hub.confirm = (message, opts = {}) => new Promise(resolve => {
    const o = Object.assign({ title: '', ok: 'OK', cancel: 'Cancel', danger: false }, opts || {});
    const prev = document.activeElement, id = 'hub-ask-' + hub.uid();
    const w = document.createElement('div'); w.className = 'ds';
    const bd = document.createElement('div'); bd.className = 'sheet-backdrop hub-ask';
    const sh = document.createElement('div'); sh.className = 'sheet'; sh.setAttribute('role', 'alertdialog'); sh.setAttribute('aria-modal', 'true');
    if (o.title) { const h = document.createElement('h2'); h.id = id + '-t'; h.textContent = o.title; sh.appendChild(h); sh.setAttribute('aria-labelledby', h.id); }
    if (message) { const p = document.createElement('p'); p.id = id + '-m'; p.className = o.title ? 'text-2' : 'hub-ask-lead'; p.textContent = message; sh.appendChild(p); sh.setAttribute(o.title ? 'aria-describedby' : 'aria-labelledby', p.id); }
    const row = document.createElement('div'); row.className = 'sheet-actions';
    const btn = (label, cls) => { const b = document.createElement('button'); b.type = 'button'; b.className = cls; b.textContent = label; row.appendChild(b); return b; };
    const no = o.cancel ? btn(o.cancel, 'btn') : null;
    const yes = btn(o.ok, 'btn ' + (o.danger ? 'btn-danger' : 'btn-primary'));
    sh.appendChild(row); bd.appendChild(sh); w.appendChild(bd);
    let over = false;
    const done = v => {
      if (over) return; over = true;
      document.removeEventListener('keydown', key, true); w.remove();
      try { if (prev && prev.isConnected && prev.focus) prev.focus({ preventScroll: true }); } catch {}
      resolve(v);
    };
    const key = e => {
      if (over || w !== [...document.querySelectorAll('body > .ds')].filter(x => x.querySelector('.hub-ask')).pop()) return;   // the topmost sheet only
      if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); done(false); return; }
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopImmediatePropagation(); done(document.activeElement === yes); return; }
      if (e.key === 'Tab') {   // keep focus on the sheet's buttons
        e.preventDefault();
        const bs = [no, yes].filter(Boolean), i = bs.indexOf(document.activeElement);
        bs[(i + (e.shiftKey ? bs.length - 1 : 1) + bs.length) % bs.length].focus();
      }
    };
    yes.onclick = () => done(true);
    if (no) no.onclick = () => done(false);
    bd.addEventListener('click', e => { if (e.target === bd) done(false); });
    document.addEventListener('keydown', key, true);
    (document.body || document.documentElement).appendChild(w);
    (no || yes).focus({ preventScroll: true });
  });
  hub.alert = (message, opts = {}) => hub.confirm(message, Object.assign({ ok: 'OK' }, opts || {}, { cancel: null, danger: false })).then(() => {});
  // hub.whoDidThis({ who: 'household' | 'adults', title, message }) → Promise<person | null> (KITCHEN-2). On a shared device (the
  // kitchen) an action that credits someone first shows a row of the household's faces to tap, no PIN: attribution, not a
  // sign-in. 'household' is every household adult and kid (Prayed: a kid earns the prayer ★); 'adults' leaves the kids out
  // (the Larder's finish and the album, P5-D2). Guests, the TV and the kitchen are never on the row, and the Worker checks
  // the credit again. Null on Cancel, Escape or a tap on the backdrop. Same sheet, keys and focus rules as hub.confirm.
  const faceRow = who => hub.people().filter(p => p && !p.is_guest && !p.isGuest && (p.kind === 'adult' || (who !== 'adults' && p.kind === 'kid')));
  hub.whoDidThis = async (opts = {}) => {
    const o = Object.assign({ who: 'household', title: 'Who is this?', message: '' }, opts || {});
    let people = faceRow(o.who);
    if (!people.length) { try { await hub.profiles(); } catch {} people = faceRow(o.who); }
    if (!people.length) { hub.toast('No faces yet — this device has not loaded the household.', 3200); return null; }
    return new Promise(resolve => {
      const prev = document.activeElement, id = 'hub-who-' + hub.uid();
      const w = document.createElement('div'); w.className = 'ds';
      const bd = document.createElement('div'); bd.className = 'sheet-backdrop hub-ask hub-who';
      const sh = document.createElement('div'); sh.className = 'sheet'; sh.setAttribute('role', 'dialog'); sh.setAttribute('aria-modal', 'true');
      const h = document.createElement('h2'); h.id = id + '-t'; h.textContent = o.title; sh.appendChild(h); sh.setAttribute('aria-labelledby', h.id);
      if (o.message) { const p = document.createElement('p'); p.id = id + '-m'; p.className = 'text-2'; p.textContent = o.message; sh.appendChild(p); sh.setAttribute('aria-describedby', p.id); }
      const grid = document.createElement('div'); grid.className = 'hub-faces'; grid.setAttribute('role', 'group'); grid.setAttribute('aria-label', o.title);
      grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(104px,1fr));gap:var(--sp-3);margin-top:var(--sp-4)';
      const faces = people.map(p => {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'btn hub-face'; b.dataset.id = p.id;
        b.style.cssText = 'flex-direction:column;gap:var(--sp-2);min-height:128px;height:auto;padding:var(--sp-3) var(--sp-2);white-space:normal;text-align:center';
        b.innerHTML = hub.avatarHtml(p, 'avatar-lg') + '<span class="hub-face-name">' + hub.escape(p.name) + '</span>';
        b.setAttribute('aria-label', p.name); grid.appendChild(b); return b;
      });
      sh.appendChild(grid);
      const row = document.createElement('div'); row.className = 'sheet-actions';
      const no = document.createElement('button'); no.type = 'button'; no.className = 'btn'; no.textContent = 'Cancel'; row.appendChild(no);
      sh.appendChild(row); bd.appendChild(sh); w.appendChild(bd);
      let over = false;
      const done = v => {
        if (over) return; over = true;
        document.removeEventListener('keydown', key, true); w.remove();
        try { if (prev && prev.isConnected && prev.focus) prev.focus({ preventScroll: true }); } catch {}
        resolve(v);
      };
      const all = [...faces, no];
      const key = e => {
        if (over || w !== [...document.querySelectorAll('body > .ds')].filter(x => x.querySelector('.hub-ask')).pop()) return;   // the topmost sheet only
        if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); done(null); return; }
        const i = all.indexOf(document.activeElement);
        if (e.key === 'Tab' || ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && i >= 0)) {   // focus stays on the sheet's buttons
          e.preventDefault();
          all[(i + ((e.shiftKey && e.key === 'Tab') || e.key === 'ArrowLeft' ? all.length - 1 : 1) + all.length) % all.length].focus();
        }
      };
      grid.addEventListener('click', e => { const b = e.target.closest('.hub-face'); if (b) done(people.find(p => p.id === b.dataset.id) || null); });
      no.onclick = () => done(null);
      bd.addEventListener('click', e => { if (e.target === bd) done(null); });
      document.addEventListener('keydown', key, true);
      (document.body || document.documentElement).appendChild(w);
      faces[0].focus({ preventScroll: true });
    });
  };
  hub.escape = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  hub.uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  // ── liquid glass: the person's colour caught in the two bars drifts with scroll (GLASS-7) ──
  // --sheen-x is written on the VISIBLE tab bar and top bar only, never on :root, and only their ::after layer's transform
  // reads it (design.css), so a scroll frame re-resolves one layer and restyles nothing else (P4-GLASS-01). Skipped with no
  // visible bar, under Reduce Motion (the switch or the OS, read live) and on the TV. The tilt drift is gone: iOS never
  // hands out the orientation without a prompt (CONS-GLASS-3).
  (function sheen() {
    const root = document.documentElement; let scroller = null, raf = 0, last = -1;
    const still = () => root.dataset.motion === 'reduce' || (root.dataset.motion !== 'full' && mq('(prefers-reduced-motion: reduce)')) || (!!hub.profile && hub.profile.kind === 'kiosk');
    const bars = () => [...document.querySelectorAll('.ds .tabbar, .ds .topbar')].filter(el => el.getClientRects().length);
    const paint = () => {
      raf = 0; if (still()) return;
      const on = bars(); if (!on.length) return;
      const el = scroller || document.scrollingElement || root; const max = Math.max(1, el.scrollHeight - el.clientHeight); const p = Math.min(1, Math.max(0, el.scrollTop / max));
      const x = Math.round(20 + p * 50); if (x === last) return; last = x;
      for (const b of on) b.style.setProperty('--sheen-x', x + '%');
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(paint); };
    /** Drift the bars with this scroller's position instead of the page's (the shell's #views, an app's own scroller). */
    hub.sheenFrom = el => { if (scroller) scroller.removeEventListener('scroll', kick); scroller = el; last = -1; if (el) el.addEventListener('scroll', kick, { passive: true }); kick(); };
    window.addEventListener('scroll', kick, { passive: true });
    kick();
  })();
  // iOS shows :active (the .pressable press, every .ds button) only in a document with a touch listener (GAP-MOTION-3)
  try { document.addEventListener('touchstart', () => {}, { passive: true }); } catch {}

  // ── faces: photos + avatars ───────────────────────────────────────────────
  /** Absolute URL of a person's (or album entry's) photo, or null. size: 'sm' (256) | 'lg' (1024). */
  hub.photoUrl = (p, size = 'sm') => { const ph = p && (p.photo || (p.sm ? p : null)); const rel = ph && (typeof ph === 'string' ? ph : ph[size] || ph.sm); return rel ? (rel.startsWith('http') ? rel : hub.api.replace(/\/$/, '') + rel) : null; };
  /** An .avatar element (design.css): the photo if there is one, else the emoji on the person's colour. The avatar carries
   *  the person's own data-accent, so its fill, ink and ring are theirs inside any page (a record with no colour is graphite). */
  hub.avatarHtml = (p, cls = '', size = 'sm') => {
    const url = hub.photoUrl(p, size); const e = hub.escape;
    return `<span class="avatar ${cls}" data-accent="${e(hub.hueOf(p))}">${url ? `<img src="${e(url)}" alt="" loading="lazy">` : e((p && p.emoji) || '·')}</span>`;
  };
  // Square-crop + resize on the device; the server only ever receives two small JPEGs.
  async function squareJpeg(file, size, quality) {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => createImageBitmap(file));
    const s = Math.min(bmp.width, bmp.height), out = Math.min(size, s);
    const cv = document.createElement('canvas'); cv.width = out; cv.height = out;
    cv.getContext('2d').drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, out, out);
    bmp.close && bmp.close();
    const blob = await new Promise(res => cv.toBlob(res, 'image/jpeg', quality));
    const buf = new Uint8Array(await blob.arrayBuffer()); let bin = ''; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
    return btoa(bin);
  }
  async function twoSizes(file) {
    let lgQ = .82, lg = await squareJpeg(file, 1024, lgQ);
    while (lg.length * .75 > 400 * 1024 && lgQ > .5) { lgQ -= .1; lg = await squareJpeg(file, 1024, lgQ); }
    return { sm: await squareJpeg(file, 256, .85), lg };
  }
  /** Sets a profile's photo from a File/Blob (own profile, or any profile for the admin). Updates the session profile. */
  hub.uploadPhoto = async (file, profileId = hub.profile && hub.profile.id) => {
    const r = await hub.request(`/api/profiles/${encodeURIComponent(profileId)}/photo`, { method: 'PUT', body: await twoSizes(file), timeout: 60000 });
    if (hub.session && hub.profile && hub.profile.id === profileId) hub.setSession({ token: hub.session.token, profile: { ...hub.session.profile, ...r.profile } });
    hub.profiles().catch(() => {});   // refresh the cached faces (hub.people) on this device too
    return publicProfile(r.profile);
  };
  hub.removePhoto = async (profileId = hub.profile && hub.profile.id) => {
    const r = await hub.request(`/api/profiles/${encodeURIComponent(profileId)}/photo`, { method: 'DELETE' });
    if (hub.session && hub.profile && hub.profile.id === profileId) hub.setSession({ token: hub.session.token, profile: { ...hub.session.profile, ...r.profile } });
    hub.profiles().catch(() => {});   // refresh the cached faces (hub.people) on this device too
    return publicProfile(r.profile);
  };
  /** Family album: rows live in app_data (family, 'hub', 'album:<id>'); list them with hub.list('album:', { app: 'hub', scope: 'family' }). */
  // { as }: on the kitchen, the household adult whose face was tapped (hub.whoDidThis); the Worker files the photo under them
  hub.addAlbumPhoto = async (file, caption = '', opts = {}) => {
    const as = opts && opts.as && hub.isKitchen ? String(opts.as) : undefined;
    const r = await hub.request('/api/album', { method: 'POST', body: { ...(await twoSizes(file)), caption, ...(as ? { as } : {}) }, timeout: 60000 });
    hub.pull(); return r.photo;
  };
  hub.removeAlbumPhoto = async id => { await hub.request(`/api/album/${encodeURIComponent(id)}`, { method: 'DELETE' }); hub.pull(); };

  window.hub = hub;
})();
