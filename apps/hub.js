/* House Hub SDK — include in every app:
 *   <link rel="stylesheet" href="design.css">
 *   <script src="hub.js" data-app="tally" data-scope="person"></script>   (scope: person | family | both)
 *
 * Then:
 *   await hub.ready();                      // profile + cached data available; pulls in the background
 *   hub.profile                             // { id, name, kind, isAdmin, color, emoji }
 *   hub.get(key, {scope}) / hub.set(key, value, {scope}) / hub.remove(key, {scope})
 *   hub.list(prefix, {scope})               // live items [{key, value, updated_at}]
 *   hub.onChange(({scope, key, value}) => …) // fires when another device changed something
 *   hub.activity('Checked off Week 3 Day 2')
 *   hub.voiceInput(text => …)               // Web Speech; returns null when unsupported
 *   hub.sync.state                          // 'synced' | 'pending' | 'offline' | 'error'
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
    migrated: 'hub.migrated', activityQueue: 'hub.activityQueue', profiles: 'hub.profiles',
    cache: (app, scope, pid) => `hub.cache.${app}.${scope}${scope === 'person' ? '.' + pid : ''}`,
    queue: (app, scope, pid) => `hub.queue.${app}.${scope}${scope === 'person' ? '.' + pid : ''}`,
  };
  const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } };
  const lsSet = (k, v) => { try { v === undefined ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch {} };
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

  const hub = {
    appId, api: lsGet(LS.api, null) || DEFAULT_API,
    device: lsGet(LS.device, null), session: lsGet(LS.session, null),
    profile: null, skew: 0,
    sync: { state: 'offline', pending: 0, lastError: null, lastPull: 0 },
    HubError,
  };
  const listeners = { change: new Set(), sync: new Set(), auth: new Set() };
  const store = {};          // 'app|scope' -> { items: {key:{v,t}}, since }
  const queue = {};          // 'app|scope' -> { key: {value, updated_at} }
  let readyPromise = null, flushTimer = null, pullTimer = null, flushing = false, pulling = null, wired = false;

  // ── profile / theme (applied synchronously so there is no flash) ──────────
  function publicProfile(p) {
    return p ? { id: p.id, name: p.name, kind: p.kind, isAdmin: !!p.is_admin, color: p.color, emoji: p.emoji, hasPin: !!p.has_pin, photo: p.photo || null } : null;
  }
  function applyTheme() {
    const root = document.documentElement;
    const t = lsGet(LS.theme, 'system');
    if (t === 'dark' || t === 'light') root.dataset.theme = t; else delete root.dataset.theme;
    if (hub.profile) { root.dataset.kind = hub.profile.kind; root.style.setProperty('--accent', hub.profile.color); }
    else { delete root.dataset.kind; root.style.removeProperty('--accent'); }
  }
  hub.setTheme = t => { lsSet(LS.theme, t === 'system' ? undefined : t); applyTheme(); tell({ type: 'hub:theme', theme: t }); };
  hub.theme = () => lsGet(LS.theme, 'system');
  hub.setSession = s => {
    hub.session = s || null; lsSet(LS.session, s || undefined);
    hub.profile = publicProfile(s && s.profile);
    if (s && s.profile) lsSet(LS.last, s.profile.id);
    applyTheme();
  };
  hub.profile = publicProfile(hub.session && hub.session.profile);
  applyTheme();
  Object.defineProperty(hub, 'isKid', { get: () => !!hub.profile && hub.profile.kind === 'kid' });
  Object.defineProperty(hub, 'isKiosk', { get: () => !!hub.profile && hub.profile.kind === 'kiosk' });
  Object.defineProperty(hub, 'canWrite', { get: () => !!hub.profile && hub.profile.kind !== 'kiosk' });

  // ── transport ──────────────────────────────────────────────────────────────
  function setSync(patch) {
    Object.assign(hub.sync, patch);
    hub.sync.pending = Object.values(queue).reduce((n, q) => n + Object.keys(q).length, 0);
    if (hub.sync.pending && hub.sync.state === 'synced') hub.sync.state = 'pending';
    for (const cb of listeners.sync) { try { cb({ ...hub.sync }); } catch (e) { console.error(e); } }
    tell({ type: 'hub:sync', sync: { ...hub.sync } });
  }
  hub.onSync = cb => { listeners.sync.add(cb); cb({ ...hub.sync }); return () => listeners.sync.delete(cb); };
  hub.onAuthLoss = cb => { listeners.auth.add(cb); return () => listeners.auth.delete(cb); };

  hub.request = async function (path, { method = 'GET', body, profile = true, device = true, timeout = 12000 } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (device && hub.device) headers['X-Device-Token'] = hub.device.token;
    if (profile && hub.session) headers['X-Profile-Token'] = hub.session.token;
    const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), timeout);
    let r;
    try {
      r = await fetch(hub.api.replace(/\/$/, '') + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), cache: 'no-store', signal: ctl.signal });
    } catch (e) {
      throw new HubError(0, 'network', e.name === 'AbortError' ? 'The house server took too long.' : 'No connection.');
    } finally { clearTimeout(timer); }
    let data = null; try { data = await r.json(); } catch {}
    if (!r.ok) {
      const err = new HubError(r.status, (data && data.error) || 'http_' + r.status, (data && data.message) || 'Request failed');
      if (r.status === 401) handleAuthLoss(err);
      throw err;
    }
    return data;
  };
  function handleAuthLoss(err) {
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
  hub.pair = async (code, name) => {
    const d = await hub.request('/api/pair', { method: 'POST', body: { code, name }, device: false, profile: false });
    hub.device = { id: d.device_id, token: d.device_token, name: name || '' }; lsSet(LS.device, hub.device);
    return hub.device;
  };
  hub.profiles = () => hub.request('/api/profiles', { profile: false }).then(r => { lsSet(LS.profiles, r.profiles); return r.profiles; });
  /** Everyone in the house, from the last profiles pull (cached in localStorage) — for faces in apps. */
  hub.people = () => lsGet(LS.profiles, null) || [];
  hub.login = async (profileId, pin) => {
    const r = await hub.request('/api/login', { method: 'POST', body: { profile_id: profileId, pin }, profile: false });
    hub.setSession({ token: r.profile_token, profile: r.profile }); return hub.profile;
  };
  hub.createPin = async (profileId, pin) => {
    const r = await hub.request(`/api/profiles/${encodeURIComponent(profileId)}/pin`, { method: 'POST', body: { pin }, profile: false });
    hub.setSession({ token: r.profile_token, profile: r.profile }); return hub.profile;
  };
  hub.signOut = async () => {
    try { if (hub.session) await hub.request('/api/logout', { method: 'POST', body: {} }); } catch {}
    hub.setSession(null); tell({ type: 'hub:reauth', reason: 'signed_out' });
  };
  hub.lastProfile = () => lsGet(LS.last, null);

  // ── local store ───────────────────────────────────────────────────────────
  const pid = () => (hub.profile ? hub.profile.id : 'nobody');
  function loadScope(ch) {
    const { app, scope } = CH.get(ch);
    store[ch] = lsGet(LS.cache(app, scope, pid()), { items: {}, since: 0 });
    queue[ch] = lsGet(LS.queue(app, scope, pid()), {});
  }
  const saveStore = ch => { const { app, scope } = CH.get(ch); lsSet(LS.cache(app, scope, pid()), store[ch]); };
  const saveQueue = ch => { const { app, scope } = CH.get(ch); lsSet(LS.queue(app, scope, pid()), queue[ch]); };
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
  hub.set = (key, value, opts) => {
    const ch = scopeOf(opts);
    if (!hub.profile) throw new HubError(401, 'profile_required', 'Choose a profile first.');
    if (hub.isKiosk) throw new HubError(403, 'read_only', 'This profile can only look, not change things.');
    if (typeof key !== 'string' || !/^[A-Za-z0-9_.:\-\/]{1,200}$/.test(key)) throw new Error('hub.set: bad key ' + key);
    const t = Math.max(Date.now() + hub.skew, (store[ch].items[key] ? store[ch].items[key].t : 0) + 1);
    const v = value === undefined ? null : value;
    store[ch].items[key] = { v, t }; saveStore(ch);
    queue[ch][key] = { value: v, updated_at: t }; saveQueue(ch);
    setSync({ state: navigator.onLine === false ? 'offline' : 'pending' });
    scheduleFlush();
    return v;
  };
  hub.remove = (key, opts) => hub.set(key, null, opts);
  hub.onChange = cb => { listeners.change.add(cb); return () => listeners.change.delete(cb); };

  // ── sync ──────────────────────────────────────────────────────────────────
  function scheduleFlush(ms = 250) { clearTimeout(flushTimer); flushTimer = setTimeout(() => flush(), ms); }
  async function flush() {
    if (flushing || !hub.session || navigator.onLine === false) return;
    flushing = true;
    try {
      for (const ch of Object.keys(queue)) {
        const { app, scope } = CH.get(ch);
        const snap = { ...queue[ch] };
        const items = Object.entries(snap).map(([key, q]) => ({ key, value: q.value, updated_at: q.updated_at }));
        if (!items.length) continue;
        let res;
        try {
          res = await hub.request(`/api/data/${app}/batch?scope=${scope}`, { method: 'POST', body: { items } });
        } catch (e) {
          if (e.status === 403 && e.error === 'read_only') { queue[ch] = {}; saveQueue(ch); setSync({ state: 'error', lastError: e.error }); continue; }
          setSync({ state: e.status ? 'error' : 'offline', lastError: e.error });
          if (e.status && e.status !== 401 && e.status < 500) { queue[ch] = {}; saveQueue(ch); }   // bad request: drop rather than retry forever
          else scheduleFlush(e.status ? 30000 : 5000);
          return;
        }
        for (const r of res.results) {
          if (queue[ch][r.key] && queue[ch][r.key].updated_at === snap[r.key].updated_at) delete queue[ch][r.key];
          if (!r.applied) { store[ch].items[r.key] = { v: r.value, t: r.updated_at }; emit(ch, r.key, r.value, r.updated_at); }
        }
        saveQueue(ch); saveStore(ch);
      }
      setSync({ state: 'synced', lastError: null });
      if (Object.values(queue).some(q => Object.keys(q).length)) scheduleFlush();
    } finally { flushing = false; }
  }
  hub.flush = () => { clearTimeout(flushTimer); return flush(); };

  async function pullScope(ch) {
    if (!store[ch]) loadScope(ch);
    const { app, scope } = CH.get(ch);
    const res = await hub.request(`/api/data/${app}?scope=${scope}&since=${store[ch].since || 0}`, { profile: scope === 'person' || !!hub.session });
    hub.skew = res.now - Date.now();
    let changed = false;
    for (const it of res.items) {
      const q = queue[ch][it.key]; const local = store[ch].items[it.key];
      if (q && q.updated_at >= it.updated_at) continue;              // our pending write is newer
      if (local && local.t >= it.updated_at) continue;
      store[ch].items[it.key] = { v: it.value, t: it.updated_at }; changed = true;
      emit(ch, it.key, it.value, it.updated_at);
    }
    store[ch].since = res.now;
    saveStore(ch);
    return changed;
  }
  hub.pull = function () {
    if (pulling) return pulling;
    pulling = (async () => {
      if (!hub.device) return false;
      try {
        let changed = false;
        for (const ch of CH.keys()) { if (CH.get(ch).scope === 'person' && !hub.session) continue; changed = (await pullScope(ch)) || changed; }
        setSync({ state: Object.values(queue).some(q => Object.keys(q).length) ? 'pending' : 'synced', lastError: null, lastPull: Date.now() });
        if (hub.sync.pending) scheduleFlush(0);
        return changed;
      } catch (e) {
        setSync({ state: e.status ? 'error' : 'offline', lastError: e.error });
        return false;
      } finally { pulling = null; }
    })();
    return pulling;
  };

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
      const seen = [...CH.keys()].some(ch => store[ch].since > 0);
      if (navigator.onLine === false) setSync({ state: 'offline' });
      const first = hub.pull();
      if (!seen) await Promise.race([first, new Promise(r => setTimeout(r, 6000))]);
      if (!wired) { wired = true;
      document.addEventListener('visibilitychange', () => { if (!document.hidden) { hub.pull(); scheduleFlush(0); } });
      window.addEventListener('online', () => { setSync({ state: 'pending' }); scheduleFlush(0); hub.pull(); });
      window.addEventListener('offline', () => setSync({ state: 'offline' }));
      window.addEventListener('pagehide', () => { if (hub.sync.pending && navigator.sendBeacon) beaconFlush(); });
      clearInterval(pullTimer); pullTimer = setInterval(() => { if (!document.hidden) hub.pull(); }, 30000);
      window.addEventListener('message', ev => {
        if (ev.origin !== location.origin || !ev.data || ev.data.source !== 'hubshell') return;
        if (ev.data.type === 'hub:pull') hub.pull();
        if (ev.data.type === 'hub:theme') applyTheme();
      });
      // The hub shell and the app iframe are two copies of this SDK on one origin sharing one localStorage.
      // When the other window writes a cache or queue we hold, reload it so neither side clobbers the other.
      window.addEventListener('storage', ev => {
        if (!ev.key || !ev.key.startsWith('hub.')) return;
        if (ev.key === LS.theme) { applyTheme(); return; }
        for (const ch of CH.keys()) {
          const { app, scope } = CH.get(ch);
          if (ev.key === LS.cache(app, scope, pid())) {
            const sig = it => JSON.stringify(Object.keys(it).sort().map(k => [k, it[k].t, it[k].v]));
            const before = sig((store[ch] || {}).items || {});
            store[ch] = lsGet(ev.key, { items: {}, since: 0 });
            if (sig(store[ch].items) !== before) {
              for (const cb of listeners.change) { try { cb({ app, scope, key: null, value: null, updated_at: 0, remote: true, bulk: true }); } catch (e) { console.error(e); } }
            }
          } else if (ev.key === LS.queue(app, scope, pid())) { queue[ch] = lsGet(ev.key, {}); setSync({}); if (hub.sync.pending) scheduleFlush(500); }
        }
      });
      }
      return hub;
    })();
    return readyPromise;
  };
  function beaconFlush() {
    // Best effort on page close: the batch endpoint needs headers, and sendBeacon can't set them, so
    // the queue simply stays in localStorage and flushes on the next open. Kept as a hook for later.
  }
  hub.reset = () => { readyPromise = null; for (const k of Object.keys(store)) delete store[k]; for (const k of Object.keys(queue)) delete queue[k]; clearInterval(pullTimer); };

  // ── activity feed ─────────────────────────────────────────────────────────
  hub.activity = async function (text, app = appId) {
    if (!hub.canWrite || !text) return;
    const q = lsGet(LS.activityQueue, []); q.push({ app_id: app, text: String(text).slice(0, 200), at: Date.now() }); lsSet(LS.activityQueue, q.slice(-50));
    return drainActivity();
  };
  async function drainActivity() {
    let q = lsGet(LS.activityQueue, []);
    while (q.length && hub.canWrite && navigator.onLine !== false) {
      try { await hub.request('/api/activity', { method: 'POST', body: { app_id: q[0].app_id, text: q[0].text } }); }
      catch (e) { if (e.status && e.status !== 429 && e.status < 500) q.shift(); else break; continue; }
      q.shift();
    }
    lsSet(LS.activityQueue, q);
  }
  hub.activityFeed = (limit = 30) => hub.request(`/api/activity?limit=${limit}`, { profile: false }).then(r => r.activity);

  // ── legacy migration ──────────────────────────────────────────────────────
  /* entries: [{ from: 'tally.count', to: 'count', scope: 'person', parse: raw => value }]
     Runs once per device per (app, scope). Person-scope data goes to the first ADULT who opens the app on
     this device and only if that key is still empty on the server. Originals are left untouched. */
  hub.migrate = function (entries) {
    const done = lsGet(LS.migrated, {});
    const moved = [];
    for (const e of entries) {
      const s = e.scope || SCOPES[0];
      const mark = `${appId}.${s}`;
      if (done[mark] || !CH.has(chKey(appId, s)) || !hub.canWrite) continue;
      if (s === 'person' && hub.profile.kind !== 'adult') continue;
      let raw; try { raw = localStorage.getItem(e.from); } catch { raw = null; }
      if (raw == null) continue;
      let value; try { value = e.parse ? e.parse(raw) : JSON.parse(raw); } catch { value = raw; }
      if (value == null) continue;
      if (typeof e.to === 'function') { for (const [k, v] of e.to(value)) if (!hub.has(k, { scope: s })) { hub.set(k, v, { scope: s }); moved.push(k); } }
      else if (!hub.has(e.to, { scope: s })) { hub.set(e.to, value, { scope: s }); moved.push(e.to); }
    }
    if (moved.length || entries.length) for (const e of entries) done[`${appId}.${e.scope || SCOPES[0]}`] = Date.now();
    lsSet(LS.migrated, done);
    return moved;
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
  hub.toast = (msg, ms = 2200) => {
    let el = document.getElementById('hub-toast');
    if (!el) { const w = document.createElement('div'); w.className = 'ds'; el = document.createElement('div'); el.id = 'hub-toast'; el.className = 'toast'; el.setAttribute('role', 'status'); w.appendChild(el); document.body.appendChild(w); }
    el.textContent = msg; el.hidden = false; clearTimeout(el._t); el._t = setTimeout(() => { el.hidden = true; }, ms);
  };
  hub.escape = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  hub.uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  // ── faces: photos + avatars ───────────────────────────────────────────────
  /** Absolute URL of a person's (or album entry's) photo, or null. size: 'sm' (256) | 'lg' (1024). */
  hub.photoUrl = (p, size = 'sm') => { const ph = p && (p.photo || (p.sm ? p : null)); const rel = ph && (typeof ph === 'string' ? ph : ph[size] || ph.sm); return rel ? (rel.startsWith('http') ? rel : hub.api.replace(/\/$/, '') + rel) : null; };
  /** An .avatar element (design.css): the photo if there is one, else the emoji on the person's colour. */
  hub.avatarHtml = (p, cls = '', size = 'sm') => {
    const url = hub.photoUrl(p, size); const e = hub.escape;
    return `<span class="avatar ${cls}" style="--tint:${e((p && p.color) || '#8A6A4B')}">${url ? `<img src="${e(url)}" alt="" loading="lazy">` : e((p && p.emoji) || '·')}</span>`;
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
    return publicProfile(r.profile);
  };
  hub.removePhoto = async (profileId = hub.profile && hub.profile.id) => {
    const r = await hub.request(`/api/profiles/${encodeURIComponent(profileId)}/photo`, { method: 'DELETE' });
    if (hub.session && hub.profile && hub.profile.id === profileId) hub.setSession({ token: hub.session.token, profile: { ...hub.session.profile, ...r.profile } });
    return publicProfile(r.profile);
  };
  /** Family album: rows live in app_data (family, 'hub', 'album:<id>'); list them with hub.list('album:', { app: 'hub', scope: 'family' }). */
  hub.addAlbumPhoto = async (file, caption = '') => {
    const r = await hub.request('/api/album', { method: 'POST', body: { ...(await twoSizes(file)), caption }, timeout: 60000 });
    hub.pull(); return r.photo;
  };
  hub.removeAlbumPhoto = async id => { await hub.request(`/api/album/${encodeURIComponent(id)}`, { method: 'DELETE' }); hub.pull(); };

  window.hub = hub;
})();
