// Weber: a clean glass web browser.
// The window's own page (weber://app) draws the tabs, address bar and panels;
// each tab is a sandboxed WebContentsView laid out underneath it. A private
// loopback control channel lets J.A.R.V.I.S. open sites and read the page.
import { app, BrowserWindow, WebContentsView, ipcMain, protocol, session, shell, Menu, clipboard, nativeTheme, dialog } from 'electron';
import { Readable } from 'node:stream';
import { ElectronChromeExtensions } from 'electron-chrome-extensions';
import { installChromeWebStore, uninstallExtension } from 'electron-chrome-web-store';
import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as uiagent from './uiagent.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UI = path.join(__dirname, 'ui');
const data = (...p) => path.join(app.getPath('userData'), ...p);
const PARTITION = 'persist:weber';

protocol.registerSchemesAsPrivileged([{ scheme: 'weber', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);

let win;
const tabs = new Map();
let order = [];
let active = null;
let nextId = 1;
let bounds = { left: 6, top: 44, right: 6, bottom: 66 }; // where the page card sits; the UI draws around it
let fullscreen = false;
let extensions = null; // Chrome extension APIs for tabs (set up in setupSession)
let frozen = false; // page swapped for a screenshot while a dropdown covers it

// ---------- storage ----------

let store = { bookmarks: [], history: [], downloads: [], sitePerms: {}, settings: { engine: 'bing', adblock: true, theme: 'aurora', bgMode: 'theme', bgColor: '#14151c', bgWallpaper: 'mountains', bgScene: 'aurora', bgFile: null, bgDim: 25 } };
async function loadStore() {
  try {
    const s = JSON.parse(await fsp.readFile(data('weber.json'), 'utf8'));
    store = { ...store, ...s, settings: { ...store.settings, ...s.settings } };
  } catch {}
}
let saveTimer;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => fsp.writeFile(data('weber.json'), JSON.stringify(store)).catch(() => {}), 400);
}

function addHistory(url, title) {
  if (!/^https?:/.test(url)) return;
  const last = store.history[0];
  if (last?.url === url) {
    if (title) last.title = title;
  } else store.history.unshift({ url, title: title || url, at: Date.now() });
  if (store.history.length > 5000) store.history.length = 5000;
  save();
}

// ---------- address bar input ----------

const ENGINES = {
  google: 'https://www.google.com/search?q=',
  bing: 'https://www.bing.com/search?q=',
  duckduckgo: 'https://duckduckgo.com/?q=',
  brave: 'https://search.brave.com/search?q=',
};
function resolveInput(text) {
  const s = String(text ?? '').trim();
  if (!s) return '';
  if (/^(https?|file):\/\//i.test(s)) return s;
  if (/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/\S*)?$/i.test(s)) return 'http://' + s;
  if (!/\s/.test(s) && /^[\w-]+(\.[\w-]+)+(:\d+)?([/?#]\S*)?$/.test(s)) return 'https://' + s;
  return (ENGINES[store.settings.engine] ?? ENGINES.bing) + encodeURIComponent(s);
}

/** What Windows asked us to open: a link (Weber as the default browser) or a file (.html, .pdf…). */
const OPENABLE = /\.(html?|xhtml|pdf|svg|xml|txt|json|png|jpe?g|gif|webp|avif|mp4|webm|mp3)$/i;
function launchTarget(argv) {
  for (const a of argv) {
    if (/^https?:\/\//i.test(a)) return a;
    if (OPENABLE.test(a) && path.isAbsolute(a) && fs.existsSync(a)) return pathToFileURL(a).href;
  }
  return null;
}

// ---------- new-tab widgets: weather, headlines, exchange rate (free sources, no accounts) ----------
const ntpCache = new Map(); // key -> { at, value }
async function cached(key, ttlMs, fn) {
  const hit = ntpCache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value;
  try {
    const value = await fn();
    ntpCache.set(key, { at: Date.now(), value });
    return value;
  } catch {
    return hit?.value ?? null; // offline: keep showing the last good data
  }
}
const getJson = async (url) => {
  const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
};
const WEATHER_TEXT = (c) => (c === 0 ? 'Clear' : c <= 2 ? 'Partly cloudy' : c === 3 ? 'Cloudy' : c <= 48 ? 'Foggy' : c <= 57 ? 'Drizzle' : c <= 67 ? 'Rain' : c <= 77 ? 'Snow' : c <= 82 ? 'Showers' : c <= 86 ? 'Snow showers' : 'Thunderstorms');
async function weather(city) {
  return cached('weather:' + city, 15 * 60e3, async () => {
    const g = (await getJson(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`)).results?.[0];
    if (!g) return null;
    const w = await getJson(`https://api.open-meteo.com/v1/forecast?latitude=${g.latitude}&longitude=${g.longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,is_day&daily=temperature_2m_max,temperature_2m_min,weather_code&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto&forecast_days=5`);
    const c = w.current;
    return { city: g.name, temp: Math.round(c.temperature_2m), humidity: c.relative_humidity_2m, wind: Math.round(c.wind_speed_10m), code: c.weather_code, day: !!c.is_day, text: WEATHER_TEXT(c.weather_code), high: Math.round(w.daily.temperature_2m_max[0]), low: Math.round(w.daily.temperature_2m_min[0]),
      days: w.daily.time.map((d, i) => ({ day: d, code: w.daily.weather_code[i], high: Math.round(w.daily.temperature_2m_max[i]), low: Math.round(w.daily.temperature_2m_min[i]) })) };
  });
}
// Stories by topic (movies, games, science, tech) rather than general world news.
const FEEDS = [
  { topic: 'Movies', source: 'Variety', url: 'https://variety.com/v/film/feed/' },
  { topic: 'Games', source: 'IGN', url: 'https://feeds.ign.com/ign/games-all' },
  { topic: 'Science', source: 'BBC Science', url: 'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml' },
  { topic: 'Tech', source: 'BBC Tech', url: 'https://feeds.bbci.co.uk/news/technology/rss.xml' },
];
const decode = (t) => t.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#8217;/g, '’').replace(/&#8216;/g, '‘').replace(/&#8220;|&#8221;/g, '"').replace(/&#8211;/g, '–').replace(/&#8212;/g, '—').replace(/&#038;/g, '&');
async function feed(f) {
  const xml = await (await fetch(f.url, { signal: AbortSignal.timeout(10000), headers: { 'user-agent': 'Mozilla/5.0 Weber' } })).text();
  const pick = (block, tag) => (block.match(new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${tag}>`)) || [])[1]?.trim() ?? '';
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 10).map(([, b]) => {
    let image = (b.match(/<media:(?:thumbnail|content)[^>]*url="([^"]+)"/) || b.match(/<enclosure[^>]*url="([^"]+)"/) || decode(b).match(/<img[^>]*src="(https:[^"]+)"/) || [])[1] ?? null;
    if (image) image = decode(image).replace('/standard/240/', '/standard/800/'); // BBC's feed images come at 240px; same picture at 800px
    return { topic: f.topic, source: f.source, title: decode(pick(b, 'title')), url: decode(pick(b, 'link')), at: Date.parse(pick(b, 'pubDate')) || null, image };
  }).filter((n) => n.title && /^https:\/\//.test(n.url));
}
async function headlines() {
  return cached('topics', 10 * 60e3, async () => {
    const lists = await Promise.all(FEEDS.map((f) => feed(f).catch(() => [])));
    // newest first within each topic, then take turns so every topic shows up
    lists.forEach((l) => l.sort((a, b) => (b.at ?? 0) - (a.at ?? 0)));
    const mixed = [];
    for (let i = 0; i < 10; i++) for (const l of lists) if (l[i]) mixed.push(l[i]);
    return mixed;
  });
}
async function exchangeRate(to) {
  return cached('rate:' + to, 60 * 60e3, async () => {
    const start = new Date(Date.now() - 35 * 864e5).toISOString().slice(0, 10);
    const j = await getJson(`https://api.frankfurter.dev/v1/${start}..?from=USD&to=${to}`);
    const series = Object.entries(j.rates).map(([d, r]) => ({ d, v: r[to] }));
    return { from: 'USD', to, series, latest: series.at(-1)?.v ?? null, first: series[0]?.v ?? null };
  });
}
/** The last YouTube video in history, for the "continue watching" card. */
function lastVideo() {
  for (const h of store.history) {
    const m = /youtube\.com\/watch\?(?:.*&)?v=([\w-]{11})/.exec(h.url);
    if (m) return { url: h.url, title: h.title.replace(/^\(\d+\)\s*/, '').replace(/\s*-\s*YouTube$/, ''), image: `https://i.ytimg.com/vi/${m[1]}/hqdefault.jpg`, at: h.at };
  }
  return null;
}

// ---------- ad and tracker blocking ----------

const AD_HOSTS = [
  'doubleclick.net', 'googlesyndication.com', 'googleadservices.com', 'adservice.google.com', 'google-analytics.com', 'googletagservices.com',
  'adnxs.com', 'advertising.com', 'taboola.com', 'outbrain.com', 'criteo.com', 'criteo.net', 'rubiconproject.com', 'pubmatic.com', 'openx.net',
  'scorecardresearch.com', 'quantserve.com', 'moatads.com', 'amazon-adsystem.com', 'adsrvr.org', 'casalemedia.com', 'smartadserver.com',
  'yieldmo.com', 'sharethrough.com', 'teads.tv', '3lift.com', 'hotjar.com', 'media.net', 'bidswitch.net', 'indexww.com', 'zemanta.com',
];
// Blocking an ad leaves its empty box behind; these hide the usual ad containers.
const AD_CSS = `
  ins.adsbygoogle, [id^="google_ads_"], [id^="div-gpt-ad"], [data-google-query-id], [data-ad-slot], [data-ad-unit],
  [data-concert], :has(> [data-concert]:only-child), .concert-ad, [data-ad], [data-adunit], [data-dfp], [data-testid*="ad-slot" i],
  [class*="ad-slot" i], [class*="adslot" i], [class*="ad-container" i], [class*="ad-wrapper" i], [class*="AdWrapper"], [class*="advert" i],
  [id*="ad-slot" i], [id*="adslot" i], [id*="ad-container" i], [class*="sponsored-ad" i], .taboola, [id^="taboola"], .OUTBRAIN, [id^="outbrain"],
  iframe[src*="doubleclick.net"], iframe[src*="googlesyndication"], iframe[id^="google_ads_iframe"], iframe[src*="amazon-adsystem"]
  { display: none !important; }`;
// Hidden ads often sit inside wrappers that reserve their height ("Advertisement"
// labels, fixed-height slots). This climbs out of each ad through wrappers that
// hold nothing else and hides the outermost one, so the space closes up. It runs
// in an isolated world, so pages can't see or tamper with it.
const AD_SELECTOR = AD_CSS.slice(0, AD_CSS.indexOf('{')).trim();
const COLLAPSE_JS = `(() => {
  if (window.__weberCollapse) return;
  window.__weberCollapse = true;
  const AD = ${JSON.stringify(AD_SELECTOR)};
  const LABEL = /^(advertisement|advertising|ad|ads|sponsored|story continues below( this)? (ad|advertisement)|scroll to continue( with content)?)$/i;
  const onlyAds = (el) => {
    for (const n of el.childNodes) {
      if (n.nodeType === 3 && n.textContent.trim() && !LABEL.test(n.textContent.trim())) return false;
      if (n.nodeType !== 1) continue;
      if (n.matches(AD) || n.dataset.weberAd) continue;
      if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'LINK'].includes(n.tagName)) continue;
      const text = (n.innerText || '').trim();
      if (text && !LABEL.test(text)) return false;
      if (n.querySelector('img, video, picture, canvas, input, button, a[href]') && !n.querySelector(AD)) return false;
    }
    return true;
  };
  const sweep = () => {
    for (const ad of document.querySelectorAll(AD)) {
      if (ad.dataset.weberAd) continue;
      let el = ad;
      for (let i = 0; i < 6 && el.parentElement && el.parentElement !== document.body && onlyAds(el.parentElement); i++) el = el.parentElement;
      el.dataset.weberAd = '1';
      el.style.setProperty('display', 'none', 'important');
    }
  };
  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    setTimeout(() => { queued = false; sweep(); }, 400);
  }).observe(document.documentElement, { childList: true, subtree: true });
  sweep();
})()`;
const isAd = (host) => AD_HOSTS.some((d) => host === d || host.endsWith('.' + d));

// ---------- tabs ----------

const tabOf = (wc) => [...tabs.values()].find((t) => t.view.webContents === wc);

function state() {
  return {
    active,
    fullscreen,
    tabs: order.map((id) => {
      const t = tabs.get(id);
      const wc = t.view.webContents;
      return {
        id,
        title: t.title,
        url: t.url,
        favicon: t.favicon,
        loading: t.loading,
        error: t.error,
        blocked: t.blocked,
        audible: !wc.isDestroyed() && wc.isCurrentlyAudible(),
        muted: !wc.isDestroyed() && wc.isAudioMuted(),
        canBack: !wc.isDestroyed() && wc.navigationHistory.canGoBack(),
        canForward: !wc.isDestroyed() && wc.navigationHistory.canGoForward(),
        zoom: t.zoom ?? 1,
      };
    }),
  };
}
let sendTimer;
function sendState() {
  clearTimeout(sendTimer);
  sendTimer = setTimeout(() => win && !win.isDestroyed() && win.webContents.send('state', state()), 16);
}

function layout() {
  if (!win) return;
  const [w, h] = win.getContentSize();
  for (const t of tabs.values()) {
    const show = t.id === active && !!t.url && !t.error && !frozen;
    t.view.setVisible(show);
    if (!show) continue;
    t.view.setBounds(fullscreen ? { x: 0, y: 0, width: w, height: h } : { x: bounds.left, y: bounds.top, width: Math.max(0, w - bounds.left - bounds.right), height: Math.max(0, h - bounds.top - bounds.bottom) });
    t.view.setBorderRadius?.(fullscreen ? 0 : 12);
  }
}

function createTab(url = '', { activate = true } = {}) {
  const id = nextId++;
  const view = new WebContentsView({ webPreferences: { partition: PARTITION, sandbox: true, contextIsolation: true, nodeIntegration: false, spellcheck: true, plugins: true } }); // plugins: the built-in PDF viewer
  view.setBackgroundColor('#ffffff');
  view.setVisible(false);
  view.setBorderRadius?.(12);
  const t = { id, view, title: 'New tab', url: '', favicon: null, loading: false, error: null, blocked: 0 };
  tabs.set(id, t);
  const at = active ? order.indexOf(active) + 1 : order.length;
  order.splice(at, 0, id);
  win.contentView.addChildView(view);
  extensions?.addTab(view.webContents, win);
  const wc = view.webContents;

  wc.setWindowOpenHandler(({ url: u, disposition }) => {
    // sign-in popups need a real window with an opener; everything else opens as a tab
    if (disposition === 'new-window') return { action: 'allow', overrideBrowserWindowOptions: { width: 520, height: 700, autoHideMenuBar: true, backgroundColor: '#ffffff' } };
    if (/^https?:/.test(u)) createTab(u, { activate: disposition !== 'background-tab' });
    return { action: 'deny' };
  });
  wc.on('page-title-updated', (_e, title) => {
    t.title = title;
    addHistory(wc.getURL(), title);
    sendState();
  });
  wc.on('page-favicon-updated', (_e, icons) => {
    t.favicon = icons[0] ?? null;
    sendState();
  });
  wc.on('did-start-loading', () => {
    t.loading = true;
    sendState();
  });
  wc.on('did-stop-loading', () => {
    t.loading = false;
    sendState();
  });
  wc.on('did-start-navigation', (d) => {
    if (d.isMainFrame && !d.isSameDocument) {
      t.error = null;
      t.blocked = 0;
      t.favicon = null;
      layout();
    }
  });
  const navigated = () => {
    t.url = wc.getURL();
    addHistory(t.url, wc.getTitle());
    layout();
    sendState();
  };
  wc.on('did-navigate', navigated);
  wc.on('did-navigate-in-page', (_e, _u, isMain) => isMain && navigated());
  wc.on('did-fail-load', (_e, code, desc, failedUrl, isMain) => {
    if (!isMain || code === -3) return; // -3 is an aborted load, not an error
    t.error = { code, desc, url: failedUrl };
    t.url = failedUrl;
    t.title = new URL(failedUrl).hostname || failedUrl;
    layout();
    sendState();
  });
  wc.on('dom-ready', () => {
    if (!store.settings.adblock) return;
    wc.insertCSS(AD_CSS, { cssOrigin: 'user' }).catch(() => {});
    wc.executeJavaScriptInIsolatedWorld(1001, [{ code: COLLAPSE_JS }]).catch(() => {});
  });
  wc.on('audio-state-changed', sendState);
  wc.on('found-in-page', (_e, r) => win.webContents.send('found', r));
  wc.on('enter-html-full-screen', () => setFullscreen(true));
  wc.on('leave-html-full-screen', () => setFullscreen(false));
  wc.on('before-input-event', (e, input) => shortcut(input) && e.preventDefault());
  wc.on('context-menu', (_e, p) => contextMenu(t, p));
  wc.on('zoom-changed', (_e, dir) => zoom(t, dir === 'in' ? 0.1 : -0.1));

  if (url) navigate(t, url);
  if (activate || !active) activateTab(id);
  else sendState();
  return t;
}

function navigate(t, input) {
  const url = resolveInput(input);
  if (!url) return;
  t.url = url;
  t.error = null;
  t.view.webContents.loadURL(url).catch(() => {});
  layout();
  sendState();
}

function activateTab(id) {
  if (!tabs.has(id)) return;
  active = id;
  extensions?.selectTab(tabs.get(id).view.webContents);
  layout();
  sendState();
  const t = tabs.get(id);
  if (t.url) t.view.webContents.focus();
  else win.webContents.send('focus-address');
}

function closeTab(id) {
  const t = tabs.get(id);
  if (!t) return;
  const i = order.indexOf(id);
  order = order.filter((x) => x !== id);
  tabs.delete(id);
  win.contentView.removeChildView(t.view);
  t.view.webContents.close();
  closed.push(t.url);
  if (!order.length) return createTab();
  if (active === id) activateTab(order[Math.min(i, order.length - 1)]);
  else sendState();
}
const closed = [];

function zoom(t, delta) {
  t.zoom = delta === 0 ? 1 : Math.min(3, Math.max(0.3, Math.round(((t.zoom ?? 1) + delta) * 10) / 10));
  t.view.webContents.setZoomFactor(t.zoom);
  sendState();
}

function setFullscreen(on) {
  fullscreen = on;
  win.setFullScreen(on);
  layout();
  sendState();
}

// ---------- keyboard shortcuts (work both in the UI and inside pages) ----------

function shortcut(input) {
  if (input.type !== 'keyDown') return false;
  const ctrl = input.control || input.meta;
  const k = input.key.toLowerCase();
  const t = tabs.get(active);
  const ui = (cmd) => win.webContents.send('command', cmd);
  if (ctrl && input.shift && k === 't') return closed.length && createTab(closed.pop()), true;
  if (ctrl && k === 't') return createTab(), true;
  if (ctrl && k === 'w') return closeTab(active), true;
  if (ctrl && (k === 'l' || k === 'e')) return win.webContents.focus(), ui('focus-address'), true;
  if (ctrl && k === 'f') return win.webContents.focus(), ui('find'), true;
  if (ctrl && k === 'd') return ui('bookmark'), true;
  if (ctrl && k === 'h') return ui('panel:history'), true;
  if (ctrl && k === 'j') return ui('panel:downloads'), true;
  if (ctrl && input.shift && k === 'b') return ui('toggle-sidebar'), true;
  if (ctrl && k === 'tab') {
    const i = order.indexOf(active) + (input.shift ? -1 : 1);
    return activateTab(order[(i + order.length) % order.length]), true;
  }
  if (ctrl && /^[1-9]$/.test(k)) return activateTab(k === '9' ? order.at(-1) : order[Number(k) - 1] ?? active), true;
  if (!t) return false;
  const wc = t.view.webContents;
  if ((ctrl && k === 'r') || k === 'f5') return input.shift ? wc.reloadIgnoringCache() : wc.reload(), true;
  if (input.alt && k === 'arrowleft') return wc.navigationHistory.goBack(), true;
  if (input.alt && k === 'arrowright') return wc.navigationHistory.goForward(), true;
  if (ctrl && (k === '=' || k === '+')) return zoom(t, 0.1), true;
  if (ctrl && k === '-') return zoom(t, -0.1), true;
  if (ctrl && k === '0') return zoom(t, 0), true;
  if (k === 'f12') return wc.toggleDevTools(), true;
  if (k === 'f11') return setFullscreen(!fullscreen), true;
  if (k === 'escape' && fullscreen) return setFullscreen(false), true;
  return false;
}

function contextMenu(t, p) {
  const wc = t.view.webContents;
  const items = [];
  if (p.linkURL) {
    items.push({ label: 'Open link in new tab', click: () => createTab(p.linkURL, { activate: false }) });
    items.push({ label: 'Copy link address', click: () => clipboard.writeText(p.linkURL) });
    items.push({ type: 'separator' });
  }
  if (p.hasImageContents) {
    items.push({ label: 'Open image in new tab', click: () => createTab(p.srcURL) });
    items.push({ label: 'Save image', click: () => wc.downloadURL(p.srcURL) });
    items.push({ label: 'Copy image', click: () => wc.copyImageAt(p.x, p.y) });
    items.push({ type: 'separator' });
  }
  if (p.isEditable) {
    for (const s of p.dictionarySuggestions.slice(0, 4)) items.push({ label: s, click: () => wc.replaceMisspelling(s) });
    if (p.dictionarySuggestions.length) items.push({ type: 'separator' });
    items.push({ role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { type: 'separator' });
  } else if (p.selectionText) {
    const q = p.selectionText.trim().slice(0, 60);
    items.push({ role: 'copy' });
    items.push({ label: `Search for “${q.length > 30 ? q.slice(0, 30) + '…' : q}”`, click: () => createTab(q) });
    items.push({ type: 'separator' });
  }
  items.push(
    { label: 'Back', enabled: wc.navigationHistory.canGoBack(), click: () => wc.navigationHistory.goBack() },
    { label: 'Forward', enabled: wc.navigationHistory.canGoForward(), click: () => wc.navigationHistory.goForward() },
    { label: 'Reload', click: () => wc.reload() },
    { type: 'separator' },
    { label: 'Inspect', click: () => wc.inspectElement(p.x, p.y) },
  );
  const extItems = extensions?.getContextMenuItems(wc, p) ?? [];
  if (extItems.length) items.splice(items.length - 5, 0, ...extItems, { type: 'separator' });
  Menu.buildFromTemplate(items).popup({ window: win });
}

// ---------- downloads and permissions ----------

const pendingPerms = new Map();
const ASK = new Set(['media', 'geolocation', 'notifications', 'midi', 'midiSysex', 'openExternal', 'display-capture', 'clipboard-read', 'idle-detection', 'hid', 'serial', 'usb']);

async function setupSession() {
  const ses = session.fromPartition(PARTITION);

  // Chrome extensions: the chrome.* APIs for tabs, plus installing from the Chrome Web Store.
  extensions = new ElectronChromeExtensions({
    session: ses,
    createTab: async (details) => {
      const t = createTab(details.url ?? '', { activate: details.active !== false });
      return [t.view.webContents, win];
    },
    selectTab: (wc) => {
      const t = tabOf(wc);
      if (t) activateTab(t.id);
    },
    removeTab: (wc) => {
      const t = tabOf(wc);
      if (t) closeTab(t.id);
    },
    createWindow: async (details) => {
      const url = [].concat(details.url ?? '')[0];
      createTab(url);
      return win;
    },
  });
  ElectronChromeExtensions.handleCRXProtocol(session.defaultSession); // extension icons in Weber's toolbar
  await installChromeWebStore({ session: ses, beforeInstall: askToInstall }).catch((e) => console.error('Chrome Web Store setup failed:', e));

  ses.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*'] }, (d, cb) => {
    if (!store.settings.adblock || d.resourceType === 'mainFrame') return cb({});
    let host;
    try {
      host = new URL(d.url).hostname;
    } catch {
      return cb({});
    }
    if (!isAd(host)) return cb({});
    const t = d.webContents && tabOf(d.webContents);
    if (t) {
      t.blocked++;
      sendState();
    }
    cb({ cancel: true });
  });

  const decision = (origin, permission) => store.sitePerms[origin]?.[permission];
  ses.setPermissionCheckHandler((_wc, permission, origin) => {
    if (permission === 'fullscreen' || permission === 'clipboard-sanitized-write') return true;
    try {
      return decision(new URL(origin).origin, permission) === 'allow';
    } catch {
      return false;
    }
  });
  ses.setPermissionRequestHandler((wc, permission, cb, details) => {
    if (permission === 'fullscreen' || permission === 'clipboard-sanitized-write' || permission === 'pointerLock' || permission === 'keyboardLock') return cb(true);
    if (!ASK.has(permission)) return cb(false);
    let origin;
    try {
      origin = new URL(details.requestingUrl || wc.getURL()).origin;
    } catch {
      return cb(false);
    }
    const kind = permission === 'media' ? (details.mediaTypes?.includes('video') ? 'camera' : 'microphone') : permission;
    // remembered per site, except opening other apps, which is asked each time unless allowed
    const saved = decision(origin, kind);
    if (saved) return cb(saved === 'allow');
    const t = tabOf(wc);
    if (!t) return cb(false);
    const reqId = crypto.randomUUID();
    pendingPerms.set(reqId, { cb, origin, kind });
    win.webContents.send('permission', { reqId, tabId: t.id, origin, kind, externalURL: details.externalURL });
  });

  ses.on('will-download', (_e, item) => {
    const dir = app.getPath('downloads');
    const ext = path.extname(item.getFilename());
    const stem = path.basename(item.getFilename(), ext);
    let file = path.join(dir, item.getFilename());
    for (let n = 1; fs.existsSync(file); n++) file = path.join(dir, `${stem} (${n})${ext}`);
    item.setSavePath(file);
    const d = { id: crypto.randomUUID(), name: path.basename(file), file, url: item.getURL(), total: item.getTotalBytes(), received: 0, state: 'progressing', at: Date.now() };
    store.downloads.unshift(d);
    store.downloads.length = Math.min(store.downloads.length, 100);
    const push = () => win.webContents.send('downloads', store.downloads);
    downloadItems.set(d.id, item);
    item.on('updated', (_ev, s) => {
      d.received = item.getReceivedBytes();
      d.total = item.getTotalBytes();
      d.state = s === 'interrupted' ? 'interrupted' : item.isPaused() ? 'paused' : 'progressing';
      push();
    });
    item.once('done', (_ev, s) => {
      d.state = s;
      d.received = item.getReceivedBytes();
      downloadItems.delete(d.id);
      save();
      push();
    });
    push();
    win.webContents.send('command', 'download-started');
  });
}
const downloadItems = new Map();

async function askToInstall(details) {
  const perms = [...new Set([...(details.manifest?.permissions ?? []), ...(details.manifest?.host_permissions ?? [])])].filter((x) => typeof x === 'string').slice(0, 8);
  const r = await dialog.showMessageBox(win, {
    type: 'question',
    buttons: ['Add extension', 'Cancel'],
    defaultId: 0,
    cancelId: 1,
    title: 'Add extension',
    message: `Add "${details.localizedName}" to Weber?`,
    detail: perms.length ? `It can:\n• ${perms.join('\n• ')}` : 'It needs no special permissions.',
    icon: details.icon,
  });
  return { action: r.response === 0 ? 'allow' : 'deny' };
}

// ---------- window ----------

function createWindow() {
  win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 640,
    minHeight: 420,
    title: 'Weber',
    icon: path.join(__dirname, '..', 'build', 'icon.ico'),
    backgroundColor: '#07080c',
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#00000000', symbolColor: '#ffffff', height: 44 },
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: false }, // our own UI only; pages stay sandboxed
  });
  win.loadURL('weber://app/index.html');
  win.on('resize', layout);
  win.webContents.on('before-input-event', (e, input) => shortcut(input) && e.preventDefault());
  // the browser's own page never navigates anywhere else
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.once('did-finish-load', () => {
    createTab(launchTarget(process.argv.slice(app.isPackaged ? 1 : 2)) ?? '');
  });
}

// ---------- IPC from the browser UI ----------

function registerIpc() {
  const fromUi = (e) => e.sender === win?.webContents;
  const on = (name, fn) => ipcMain.handle(name, (e, ...a) => (fromUi(e) ? fn(...a) : null));
  const cur = () => tabs.get(active);

  on('state', () => state());
  on('store', () => ({ bookmarks: store.bookmarks, settings: store.settings, downloads: store.downloads }));
  on('layout', (b) => {
    const n = (v) => Math.max(0, Number(v) || 0);
    bounds = { left: n(b.left), top: n(b.top), right: n(b.right), bottom: n(b.bottom) };
    layout();
  });
  on('new-tab', (url) => void createTab(typeof url === 'string' ? url : ''));
  on('close-tab', (id) => void closeTab(id));
  on('activate', (id) => activateTab(id));
  on('move-tab', (id, to) => {
    order = order.filter((x) => x !== id);
    order.splice(Math.max(0, Math.min(order.length, to)), 0, id);
    sendState();
  });
  on('navigate', (input) => void (cur() && navigate(cur(), input)));
  on('back', () => cur()?.view.webContents.navigationHistory.goBack());
  on('forward', () => cur()?.view.webContents.navigationHistory.goForward());
  on('reload', () => cur()?.view.webContents.reload());
  on('stop', () => cur()?.view.webContents.stop());
  on('mute', (id) => {
    const wc = tabs.get(id)?.view.webContents;
    if (wc) wc.setAudioMuted(!wc.isAudioMuted());
    sendState();
  });
  on('zoom', (d) => cur() && zoom(cur(), d));
  on('find', (text, opts) => {
    const wc = cur()?.view.webContents;
    if (!wc) return;
    if (!text) return wc.stopFindInPage('clearSelection');
    wc.findInPage(String(text), { forward: opts?.forward !== false, findNext: !!opts?.next });
  });
  on('find-stop', () => cur()?.view.webContents.stopFindInPage('keepSelection'));
  on('freeze', async (on) => {
    const t = cur();
    let shot = null;
    if (on && t?.url && !t.error) shot = (await t.view.webContents.capturePage()).toDataURL();
    frozen = !!on;
    layout();
    return shot;
  });
  on('focus-page', () => cur()?.url && cur().view.webContents.focus());

  on('bookmark-toggle', (url, title, favicon) => {
    const i = store.bookmarks.findIndex((b) => b.url === url);
    if (i >= 0) store.bookmarks.splice(i, 1);
    else if (/^https?:/.test(url)) store.bookmarks.push({ url, title: title || url, favicon: favicon || null, at: Date.now() });
    save();
    return store.bookmarks;
  });
  on('bookmark-remove', (url) => {
    store.bookmarks = store.bookmarks.filter((b) => b.url !== url);
    save();
    return store.bookmarks;
  });
  on('history', (q) => {
    const s = String(q ?? '').toLowerCase();
    return (s ? store.history.filter((h) => h.url.toLowerCase().includes(s) || h.title.toLowerCase().includes(s)) : store.history).slice(0, 300);
  });
  on('history-clear', () => {
    store.history = [];
    save();
    session.fromPartition(PARTITION).clearCache();
  });
  on('suggest', (q) => {
    const s = String(q ?? '').toLowerCase();
    if (!s) return [];
    const seen = new Set();
    const pick = [];
    for (const h of [...store.bookmarks, ...store.history]) {
      if (seen.has(h.url) || !(h.url.toLowerCase().includes(s) || h.title.toLowerCase().includes(s))) continue;
      seen.add(h.url);
      pick.push({ url: h.url, title: h.title, bookmark: store.bookmarks.includes(h) });
      if (pick.length >= 6) break;
    }
    return pick;
  });
  on('top-sites', () => {
    // group by site, so en.wikipedia.org and wikipedia.org count as one
    const site = (h) => h.split('.').slice(-2).join('.');
    const count = new Map();
    for (const h of store.history.slice(0, 2000)) {
      let u;
      try {
        u = new URL(h.url);
      } catch {
        continue;
      }
      const key = site(u.hostname);
      const c = count.get(key) ?? { url: u.origin, title: '', n: 0 };
      if (u.hostname.replace(/^www\./, '') === key) c.url = u.origin;
      if (u.pathname === '/' && !c.home) [c.home, c.title] = [true, h.title]; // newest homepage title names the site
      c.n++;
      count.set(key, c);
    }
    return [...count.values()].sort((a, b) => b.n - a.n).slice(0, 8);
  });
  on('ntp-data', async () => {
    const [w, news, rate] = await Promise.all([weather(store.settings.weatherCity || 'Austin'), headlines(), exchangeRate(store.settings.rateTo || 'EUR')]);
    return { weather: w, news: news ?? [], rate, video: lastVideo() };
  });
  on('recent', () => {
    const seen = new Set();
    const out = [];
    for (const h of store.history) {
      if (seen.has(h.url) || /[?&](q|query|search_query)=/.test(h.url)) continue;
      seen.add(h.url);
      out.push(h);
      if (out.length >= 4) break;
    }
    return out;
  });
  on('settings', (patch) => {
    for (const k of ['engine', 'adblock', 'theme', 'bgMode', 'bgColor', 'bgWallpaper', 'bgScene', 'bgFile', 'bgDim', 'weatherCity', 'rateTo']) if (k in patch) store.settings[k] = patch[k];
    save();
    return store.settings;
  });
  on('permission-answer', (reqId, allow, remember) => {
    const p = pendingPerms.get(reqId);
    if (!p) return;
    pendingPerms.delete(reqId);
    if (remember) {
      store.sitePerms[p.origin] = { ...store.sitePerms[p.origin], [p.kind]: allow ? 'allow' : 'block' };
      save();
    }
    p.cb(!!allow);
  });
  on('download-open', (id) => {
    const d = store.downloads.find((x) => x.id === id);
    if (d?.state === 'completed') shell.openPath(d.file);
  });
  on('download-show', (id) => {
    const d = store.downloads.find((x) => x.id === id);
    if (d) shell.showItemInFolder(d.file);
  });
  on('download-cancel', (id) => downloadItems.get(id)?.cancel());
  on('downloads-clear', () => {
    store.downloads = store.downloads.filter((d) => d.state === 'progressing');
    save();
    return store.downloads;
  });
  // a background image, GIF or video of your own, copied into Weber's data folder
  const BG_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'mp4', 'webm'];
  on('bg-pick', async () => {
    const r = await dialog.showOpenDialog(win, { title: 'Choose a background', filters: [{ name: 'Images, GIFs and videos', extensions: BG_EXTS }], properties: ['openFile'] });
    const src = r.filePaths?.[0];
    if (r.canceled || !src) return null;
    const ext = path.extname(src).toLowerCase();
    if (!BG_EXTS.includes(ext.slice(1))) return null;
    await fsp.mkdir(data('backgrounds'), { recursive: true });
    const name = Date.now() + ext;
    await fsp.copyFile(src, data('backgrounds', name));
    return { url: `weber://app/_bg/${name}`, video: ext === '.mp4' || ext === '.webm' };
  });
  on('extensions', () =>
    session
      .fromPartition(PARTITION)
      .extensions.getAllExtensions()
      .map((e) => ({ id: e.id, name: e.name, version: e.version, description: e.manifest?.description ?? '' })),
  );
  on('extension-remove', async (id) => {
    await uninstallExtension(String(id), { session: session.fromPartition(PARTITION) });
    return true;
  });
  on('devtools', () => cur()?.view.webContents.toggleDevTools());
}

// ---------- control channel (lets J.A.R.V.I.S. open sites and read pages) ----------
// Listens on 127.0.0.1 only, on a random port, and only accepts commands that
// carry the per-launch secret written to control.json in this app's data folder.
const controlFile = () => data('control.json');
function startControl() {
  const token = crypto.randomBytes(24).toString('hex');
  const pageWc = () => {
    const t = tabs.get(active);
    return t?.url && !t.error ? t.view.webContents : null;
  };
  const run = {
    // what Jarvis sees: Weber's own controls (a…) and the web page that's open (p…)
    see: async () => ({
      app: await uiagent.inspect(win.webContents, 'a'),
      page: pageWc() ? { url: tabs.get(active).url, ...(await uiagent.inspect(pageWc(), 'p')) } : null,
    }),
    act: async ({ ui }) => {
      const onPage = ui.id ? ui.id.startsWith('p') : ui.target !== 'app' && !!pageWc();
      return uiagent.act(onPage ? pageWc() : win.webContents, { id: ui.id, action: ui.op, text: ui.text, submit: ui.submit });
    },
    show: () => {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
      return { shown: true };
    },
    open: ({ query, newTab }) => {
      // reuse an empty tab; otherwise only open a new tab when asked to
      const cur = tabs.get(active);
      const t = newTab && cur?.url ? createTab(query) : (navigate(cur, query), cur);
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
      return { opened: t.url };
    },
    tabs: () => ({ tabs: order.map((id) => ({ id, title: tabs.get(id).title, url: tabs.get(id).url, active: id === active })) }),
    current: () => ({ title: tabs.get(active)?.title, url: tabs.get(active)?.url }),
    switch: ({ value }) => (tabs.has(value) ? (activateTab(value), { switched: tabs.get(value).title }) : { error: 'no such tab' }),
    close: ({ value }) => {
      const id = tabs.has(value) ? value : active;
      const title = tabs.get(id)?.title;
      closeTab(id);
      return { closed: title };
    },
    // say so when there's nowhere to go, so Jarvis doesn't report a move that didn't happen
    back: () => {
      const h = tabs.get(active)?.view.webContents.navigationHistory;
      if (!h?.canGoBack()) return { error: 'There is no previous page in this tab.' };
      h.goBack();
      return { ok: true };
    },
    forward: () => {
      const h = tabs.get(active)?.view.webContents.navigationHistory;
      if (!h?.canGoForward()) return { error: 'There is no next page in this tab.' };
      h.goForward();
      return { ok: true };
    },
    reload: () => (tabs.get(active)?.view.webContents.reload(), { ok: true }),
    read: async () => {
      const t = tabs.get(active);
      if (!t?.url) return { error: 'No page is open' };
      const text = await t.view.webContents.executeJavaScript('document.body ? document.body.innerText : ""', false);
      return { title: t.title, url: t.url, text: String(text).replace(/\n{3,}/g, '\n\n').slice(0, 20000) };
    },
  };
  const server = http.createServer(async (req, res) => {
    const send = (code, obj) => res.writeHead(code, { 'content-type': 'application/json' }).end(JSON.stringify(obj));
    if (req.method !== 'POST' || req.url !== '/command') return send(404, { error: 'not found' });
    let body = '';
    for await (const chunk of req) {
      body += chunk;
      if (body.length > 10_000) return send(413, { error: 'too large' });
    }
    let cmd;
    try {
      cmd = JSON.parse(body);
    } catch {
      return send(400, { error: 'bad json' });
    }
    if (typeof cmd.token !== 'string' || !crypto.timingSafeEqual(Buffer.from(cmd.token.padEnd(48).slice(0, 48)), Buffer.from(token))) return send(403, { error: 'forbidden' });
    const fn = Object.hasOwn(run, cmd.action) && run[cmd.action];
    if (!fn) return send(400, { error: 'unknown action' });
    try {
      send(200, await fn({ query: String(cmd.query ?? '').slice(0, 2000), value: Number(cmd.value) || 0, newTab: !!cmd.newTab, ui: { id: String(cmd.id ?? '').slice(0, 12), op: String(cmd.op ?? '').slice(0, 12), text: String(cmd.text ?? '').slice(0, 2000), submit: !!cmd.submit, target: String(cmd.target ?? '').slice(0, 8) } }));
    } catch (e) {
      send(500, { error: e.message });
    }
  });
  server.listen(0, '127.0.0.1', () => fs.writeFileSync(controlFile(), JSON.stringify({ port: server.address().port, token })));
}

// ---------- app ----------

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.avif': 'image/avif', '.mp4': 'video/mp4', '.webm': 'video/webm', '.woff2': 'font/woff2',
};

/** Serve a user background; videos get byte ranges so they can loop and seek. */
async function serveBackground(name, range) {
  const dir = data('backgrounds');
  const file = path.normalize(path.join(dir, name));
  if (!file.startsWith(dir + path.sep)) return new Response('Forbidden', { status: 403 });
  let size;
  try {
    ({ size } = await fsp.stat(file));
  } catch {
    return new Response('Not found', { status: 404 });
  }
  const type = MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream';
  const m = /bytes=(\d*)-(\d*)/.exec(range ?? '');
  if (!m || !type.startsWith('video/')) return new Response(Readable.toWeb(fs.createReadStream(file)), { headers: { 'content-type': type, 'content-length': String(size), 'accept-ranges': 'bytes' } });
  const start = m[1] ? Number(m[1]) : 0;
  const end = Math.min(m[2] ? Number(m[2]) : size - 1, size - 1);
  return new Response(Readable.toWeb(fs.createReadStream(file, { start, end })), {
    status: 206,
    headers: { 'content-type': type, 'content-length': String(end - start + 1), 'content-range': `bytes ${start}-${end}/${size}`, 'accept-ranges': 'bytes' },
  });
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', (_e, argv) => {
    const url = launchTarget(argv.slice(1));
    if (url) createTab(url);
    if (win.isMinimized()) win.restore();
    win.focus();
  });
  app.whenReady().then(async () => {
    nativeTheme.themeSource = 'dark';
    app.setAppUserModelId('com.weber.browser'); // matches the installed shortcut, so the taskbar groups and pins correctly
    await session.defaultSession.clearCache(); // the UI is served fresh from disk
    await loadStore();
    protocol.handle('weber', async (req) => {
      const rel = decodeURIComponent(new URL(req.url).pathname);
      if (rel.startsWith('/_bg/')) return serveBackground(rel.slice(5), req.headers.get('range'));
      const file = path.normalize(path.join(UI, rel === '/' ? 'index.html' : rel.slice(1)));
      if (!file.startsWith(UI)) return new Response('Forbidden', { status: 403 });
      try {
        return new Response(await fsp.readFile(file), { headers: { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-cache' } });
      } catch {
        return new Response('Not found', { status: 404 });
      }
    });
    await setupSession();
    registerIpc();
    createWindow();
    startControl();
  });
}

app.on('will-quit', () => fs.rmSync(controlFile(), { force: true }));
app.on('window-all-closed', () => app.quit());
