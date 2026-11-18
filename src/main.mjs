// Weber: a clean glass web browser.
// The window's own page (weber://app) draws the tabs, address bar and panels;
// each tab is a sandboxed WebContentsView laid out underneath it. A private
// loopback control channel lets J.A.R.V.I.S. open sites and read the page.
//
// One Weber process = one window = one profile. Private windows and other profiles
// run as their own process with their own data folder, so nothing leaks between them;
// a private window's pages live in an in-memory session that is gone when it closes.
import { app, BrowserWindow, WebContentsView, ipcMain, protocol, session, shell, Menu, clipboard, nativeTheme, dialog, desktopCapturer } from 'electron';
import { Readable } from 'node:stream';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as uiagent from './uiagent.mjs';
import { USER_AGENT, addClientHints, noteAcceptCH, learnFromRenderer, acceptLanguages } from './compat.mjs';
import * as shieldLib from './shield.mjs';
import { Vault, generatePassword, verifyUser } from './vault.mjs';
import { importSources, readBookmarks } from './importer.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const UI = path.join(__dirname, 'ui');

// ---------- which Weber this is: normal, another profile, or private ----------
const argOf = (name) => {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : null;
};
const PRIVATE = process.argv.includes('--weber-private');
const PROFILE = (argOf('weber-profile') || '').replace(/[^\w-]/g, '').slice(0, 40) || null;
const DATA_DIR = argOf('weber-data'); // a separate data folder (used for testing)
if (DATA_DIR) app.setPath('userData', path.resolve(DATA_DIR));
const BASE_DATA = app.getPath('userData'); // the default profile's folder; holds the profile list
if (PRIVATE) app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'weber-private-')));
else if (PROFILE) {
  fs.mkdirSync(path.join(BASE_DATA, 'Profiles', PROFILE), { recursive: true });
  app.setPath('userData', path.join(BASE_DATA, 'Profiles', PROFILE));
}
const data = (...p) => path.join(app.getPath('userData'), ...p);
const PROFILE_ROOT = PRIVATE ? BASE_DATA : app.getPath('userData');
const PARTITION = PRIVATE ? 'weber-private' : 'persist:weber'; // no "persist:" = memory only
const PAGE_PRELOAD = path.join(__dirname, 'page-preload.cjs');

app.userAgentFallback = USER_AGENT;
protocol.registerSchemesAsPrivileged([{ scheme: 'weber', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);

let win;
const tabs = new Map();
let order = [];
let active = null;
let nextId = 1;
let bounds = { left: 8, top: 48, right: 8, bottom: 84 }; // where the page card sits; the UI draws around it
let sideRect = null; // where the sidebar's web panel sits, when one is open
let fullscreen = false;
let extensions = null; // Chrome extension APIs for tabs (set up in setupSession)
let dock = null; // the floating island: its own transparent view above the page
let dockSize = { width: 420, height: 84 };
let frozen = false; // page swapped for a screenshot while a dropdown covers it
// Split view: two tabs side by side. `active` is whichever side has focus; ratio is the left side's share.
let split = null; // { left, right, ratio }
let previous = null; // the tab that was active before this one, the default partner for a split
const SPLIT_GAP = 14;
// Tab groups: { id, name, color, collapsed }
const groups = new Map();
let nextGroup = 1;
const GROUP_COLORS = ['#8ab4ff', '#ff8a80', '#ffd166', '#7ee2a8', '#ff9ed2', '#c3a6ff', '#6fe0e6', '#ffb36b', '#b8bcc6'];
// The sidebar's web panels, one view per site so music and chats keep running
const sideViews = new Map();
let sideOpen = null;
let vault;

// ---------- storage ----------

const DEFAULT_SETTINGS = {
  engine: 'bing', adblock: true, theme: 'aurora', bgMode: 'theme', bgColor: '#14151c', bgWallpaper: 'mountains', bgScene: 'aurora', bgFile: null, bgDim: 25,
  // protection
  httpsOnly: true, safeBrowsing: true, thirdPartyCookies: 'block', gpc: true, dns: 'automatic', dnsCustom: '', passwords: true,
  // layout and features
  tabLayout: 'dock', bookmarksBar: true, sidebar: true,
  sidebarSites: ['https://web.whatsapp.com/', 'https://www.messenger.com/', 'https://web.telegram.org/', 'https://open.spotify.com/'],
  readerFont: 'serif', readerSize: 20, readerTheme: 'dark', translateTo: 'en',
};
let store = { bookmarks: [], history: [], downloads: [], sitePerms: {}, zoom: {}, settings: { ...DEFAULT_SETTINGS } };
async function loadStore() {
  try {
    // a private window starts from the main profile's settings and favorites, and never writes back
    const s = JSON.parse(await fsp.readFile(PRIVATE ? path.join(BASE_DATA, 'weber.json') : data('weber.json'), 'utf8'));
    store = { ...store, ...s, settings: { ...store.settings, ...s.settings } };
    if (PRIVATE) Object.assign(store, { history: [], downloads: [], sitePerms: {}, zoom: {} });
  } catch {}
  store.zoom ??= {};
  store.sitePerms ??= {};
}
let saveTimer;
function save() {
  if (PRIVATE) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => fsp.writeFile(data('weber.json'), JSON.stringify(store)).catch(() => {}), 400);
}

function addHistory(url, title) {
  if (PRIVATE || !/^https?:/.test(url)) return;
  const last = store.history[0];
  if (last?.url === url) {
    if (title) last.title = title;
  } else store.history.unshift({ url, title: title || url, at: Date.now() });
  if (store.history.length > 5000) store.history.length = 5000;
  save();
}

// ---------- profiles ----------

const profilesFile = () => path.join(BASE_DATA, 'profiles.json');
function profiles() {
  try {
    const list = JSON.parse(fs.readFileSync(profilesFile(), 'utf8'));
    if (Array.isArray(list) && list.length) return list;
  } catch {}
  return [{ id: 'default', name: 'Personal', color: '#9fb6ff' }];
}
const currentProfile = () => (PRIVATE ? { id: 'private', name: 'Private', color: '#b48cff' } : profiles().find((p) => p.id === (PROFILE ?? 'default')) ?? { id: PROFILE, name: PROFILE, color: '#9fb6ff' });
/** Start another Weber process: a private window, or a window for another profile. */
function launchWeber(flags) {
  const args = [...(app.isPackaged ? [] : [app.getAppPath()]), ...(DATA_DIR ? [`--weber-data=${path.resolve(DATA_DIR)}`] : []), ...flags];
  spawn(process.execPath, args, { detached: true, stdio: 'ignore' }).unref();
}
const openPrivate = (url) => launchWeber(['--weber-private', ...(url ? [url] : [])]);
// leftovers from private windows that didn't get to clean up (folders still in use are skipped)
function sweepPrivateLeftovers() {
  try {
    for (const d of fs.readdirSync(os.tmpdir())) if (d.startsWith('weber-private-') && path.join(os.tmpdir(), d) !== app.getPath('userData')) fs.rm(path.join(os.tmpdir(), d), { recursive: true, force: true }, () => {});
  } catch {}
}

// ---------- address bar input ----------

const ENGINES = {
  google: 'https://www.google.com/search?q=',
  bing: 'https://www.bing.com/search?q=',
  duckduckgo: 'https://duckduckgo.com/?q=',
  brave: 'https://search.brave.com/search?q=',
};
// What people search for that starts like this, from the chosen engine's suggestion service.
const SUGGEST = {
  google: (v) => `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(v)}`,
  bing: (v) => `https://api.bing.com/osjson.aspx?query=${encodeURIComponent(v)}`,
  duckduckgo: (v) => `https://duckduckgo.com/ac/?type=list&q=${encodeURIComponent(v)}`,
  // Brave has no public suggestion service that answers apps, so Brave uses DuckDuckGo (also private) for these
  brave: (v) => `https://duckduckgo.com/ac/?type=list&q=${encodeURIComponent(v)}`,
};
async function searchQueries(text) {
  const v = String(text ?? '').trim().slice(0, 200);
  if (!v || /^https?:\/\//i.test(v)) return [];
  try {
    const r = await fetch((SUGGEST[store.settings.engine] ?? SUGGEST.bing)(v), { signal: AbortSignal.timeout(2500) });
    const list = (await r.json())?.[1];
    return Array.isArray(list) ? list.filter((x) => typeof x === 'string' && x.toLowerCase() !== v.toLowerCase()).slice(0, 6) : [];
  } catch {
    return [];
  }
}
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
  const xml = await (await fetch(f.url, { signal: AbortSignal.timeout(10000), headers: { 'user-agent': USER_AGENT } })).text();
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

// ---------- ad slots left behind by blocked ads ----------

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
// what the page is about, for reader mode, translate and picture-in-picture buttons
const PAGE_FACTS_JS = `(() => {
  const ids = new Set(), classes = new Set();
  for (const el of document.querySelectorAll('[id],[class]')) {
    if (ids.size < 1500 && el.id) ids.add(el.id);
    if (classes.size < 1500) for (const c of el.classList) classes.add(c);
  }
  return {
    lang: (document.documentElement.lang || '').trim().toLowerCase(),
    readerable: typeof isProbablyReaderable === 'function' ? isProbablyReaderable(document) : false,
    video: [...document.querySelectorAll('video')].some((v) => v.readyState > 0 && v.getBoundingClientRect().width > 120),
    ids: [...ids], classes: [...classes],
  };
})()`;
const READABILITY = fs.readFileSync(require.resolve('@mozilla/readability/Readability.js'), 'utf8');
const READERABLE = fs.readFileSync(require.resolve('@mozilla/readability/Readability-readerable.js'), 'utf8');
const READER_JS = `(() => {
  const a = new Readability(document.cloneNode(true), { charThreshold: 400 }).parse();
  if (!a) return null;
  return { title: a.title, byline: a.byline, siteName: a.siteName, content: a.content, length: a.length, lang: a.lang, published: a.publishedTime, url: location.href };
})()`;
const PIP_JS = `(async () => {
  if (document.pictureInPictureElement) { await document.exitPictureInPicture(); return 'exit'; }
  const v = [...document.querySelectorAll('video')].filter((x) => x.readyState > 0).sort((a, b) => b.clientWidth * b.clientHeight - a.clientWidth * a.clientHeight)[0];
  if (!v) return 'none';
  v.disablePictureInPicture = false;
  await v.requestPictureInPicture();
  return 'on';
})()`;

// ---------- tabs ----------

const tabOf = (wc) => [...tabs.values()].find((t) => t.view.webContents === wc);
const hostOf = (u) => {
  try {
    return new URL(u).hostname;
  } catch {
    return '';
  }
};
const originOf = (u) => {
  try {
    return new URL(u).origin;
  } catch {
    return '';
  }
};
const perm = (origin, kind) => store.sitePerms[origin]?.[kind];

function state() {
  return {
    active,
    fullscreen,
    split,
    splitGap: SPLIT_GAP,
    private: PRIVATE,
    profile: currentProfile(),
    side: sideOpen,
    groups: [...groups.values()],
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
        trackers: [...t.trackers].slice(0, 30),
        group: t.group ?? null,
        reader: !!t.reader,
        readerable: !!t.facts?.readerable,
        video: !!t.facts?.video,
        lang: t.facts?.lang ?? '',
        popups: t.popups.length,
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
  sendTimer = setTimeout(() => {
    if (!win || win.isDestroyed()) return;
    const s = state();
    win.webContents.send('state', s);
    dock?.webContents.send('state', s);
  }, 16);
}

function layout() {
  if (!win) return;
  const [w, h] = win.getContentSize();
  const area = { x: bounds.left, y: bounds.top, width: Math.max(0, w - bounds.left - bounds.right), height: Math.max(0, h - bounds.top - bounds.bottom) };
  const halves = split && !fullscreen ? splitRects(area) : null;
  for (const t of tabs.values()) {
    const rect = halves ? (t.id === split.left ? halves[0] : t.id === split.right ? halves[1] : null) : t.id === active ? (fullscreen ? { x: 0, y: 0, width: w, height: h } : area) : null;
    const show = !!rect && !!t.url && !t.error && !t.reader && !frozen;
    t.view.setVisible(show);
    if (!show) continue;
    t.view.setBounds(rect);
    t.view.setBorderRadius?.(fullscreen ? 0 : 12);
  }
  for (const [url, v] of sideViews) {
    const show = url === sideOpen && !!sideRect && !fullscreen && !frozen;
    v.setVisible(show);
    if (show) v.setBounds(sideRect);
  }
  if (dock) {
    const dw = Math.min(dockSize.width, w - 16);
    dock.setVisible(!fullscreen && !frozen && store.settings.tabLayout !== 'vertical');
    dock.setBounds({ x: Math.round((w - dw) / 2), y: h - dockSize.height, width: dw, height: dockSize.height });
  }
}

function splitRects(a) {
  const lw = Math.round((a.width - SPLIT_GAP) * split.ratio);
  return [{ x: a.x, y: a.y, width: lw, height: a.height }, { x: a.x + lw + SPLIT_GAP, y: a.y, width: a.width - lw - SPLIT_GAP, height: a.height }];
}
// Put the current tab next to another one (by default the tab you were on before, else a fresh search page).
function splitWith(other) {
  if (!active) return;
  if (!tabs.has(other) || other === active) other = previous && previous !== active && tabs.has(previous) ? previous : null;
  const keep = active;
  if (!other) {
    const home = new URL(ENGINES[store.settings.engine] ?? ENGINES.bing).origin;
    other = createTab(home, { activate: false }).id;
    active = keep; // the extensions layer selects every new tab; the current one stays on the left
    extensions?.selectTab(tabs.get(keep).view.webContents);
  }
  if (fullscreen) setFullscreen(false);
  split = { left: active, right: other, ratio: split?.ratio ?? 0.5 };
  layout();
  sendState();
}
function unsplit() {
  if (!split) return;
  split = null;
  layout();
  sendState();
  tabs.get(active)?.view.webContents.focus();
}

const pageWebPreferences = () => ({
  partition: PARTITION,
  preload: PAGE_PRELOAD,
  sandbox: true,
  contextIsolation: true,
  nodeIntegration: false,
  nodeIntegrationInSubFrames: false,
  webviewTag: false,
  safeDialogs: true, // pages can't trap you in endless alert() loops
  spellcheck: true,
  plugins: true, // the built-in PDF viewer
});

/** Shared protections for any page view (tabs, sidebar panels, sign-in pop-ups). */
function guardPage(wc, t) {
  // a pop-up is only allowed right after a click or key press in the page (like Chrome's blocker)
  wc.on('input-event', (_e, ev) => {
    if (/^(mouseDown|mouseUp|keyDown|rawKeyDown|char|touchStart|touchEnd|gestureTap)$/.test(ev.type)) wc.__gestureAt = Date.now();
  });
  wc.setWindowOpenHandler(({ url: u, disposition, features }) => {
    const origin = originOf(wc.getURL());
    const allowed = perm(origin, 'popups');
    const gesture = Date.now() - (wc.__gestureAt ?? 0) < 5000;
    if (allowed === 'block' || (!gesture && allowed !== 'allow')) {
      if (t) {
        t.popups.push({ url: u, disposition, features });
        sendState();
      }
      return { action: 'deny' };
    }
    // sign-in pop-ups need a real window with an opener; everything else opens as a tab
    if (disposition === 'new-window' && /^https?:/.test(u)) return { action: 'allow', overrideBrowserWindowOptions: { width: 520, height: 700, autoHideMenuBar: true, backgroundColor: '#ffffff', webPreferences: { preload: PAGE_PRELOAD, sandbox: true, contextIsolation: true, nodeIntegration: false, webviewTag: false, safeDialogs: true } } };
    if (/^https?:/.test(u)) createTab(u, { activate: disposition !== 'background-tab' });
    return { action: 'deny' };
  });
  // pop-up windows show which site they belong to in their title bar, so a fake sign-in page can't hide its address
  wc.on('did-create-window', (child) => {
    const cw = child.webContents;
    const title = () => !child.isDestroyed() && child.setTitle(`${hostOf(cw.getURL()) || 'Pop-up'} · ${cw.getTitle() || 'Weber'}`);
    cw.on('page-title-updated', (e) => {
      e.preventDefault();
      title();
    });
    cw.on('did-navigate', title);
    guardPage(cw, null);
  });
}

function createTab(url = '', { activate = true, group = null } = {}) {
  if (process.env.WEBER_DEBUG) console.log('createTab', JSON.stringify(url), new Error().stack.split(String.fromCharCode(10)).slice(2, 5).join(' / '));
  const id = nextId++;
  const view = new WebContentsView({ webPreferences: pageWebPreferences() });
  view.setBackgroundColor('#ffffff');
  view.setVisible(false);
  view.setBorderRadius?.(12);
  const t = { id, view, title: 'New tab', url: '', favicon: null, loading: false, error: null, blocked: 0, trackers: new Set(), popups: [], group, facts: null, reader: null };
  tabs.set(id, t);
  const at = active ? order.indexOf(active) + 1 : order.length;
  order.splice(at, 0, id);
  win.contentView.addChildView(view);
  if (dock) win.contentView.addChildView(dock); // re-adding keeps the island on top of the new page
  extensions?.addTab(view.webContents, win);
  const wc = view.webContents;
  guardPage(wc, t);

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
      t.trackers = new Set();
      t.popups = [];
      t.favicon = null;
      t.facts = null;
      t.reader = null;
      layout();
    }
  });
  const navigated = () => {
    t.url = wc.getURL();
    if (t.url.startsWith('https:')) t.upgraded = null;
    addHistory(t.url, wc.getTitle());
    // zoom is remembered per site
    const z = store.zoom[hostOf(t.url)];
    if (z && Math.abs(wc.getZoomFactor() - z) > 0.01) wc.setZoomFactor(z);
    t.zoom = z ?? 1;
    layout();
    sendState();
  };
  wc.on('did-navigate', navigated);
  wc.on('did-navigate-in-page', (_e, _u, isMain) => isMain && navigated());
  wc.on('did-fail-load', (_e, code, desc, failedUrl, isMain) => {
    if (!isMain || code === -3) return; // -3 is an aborted load, not an error
    if (code === -20 && t.error?.kind) return; // Weber blocked it on purpose and is already showing why
    const host = hostOf(failedUrl);
    if (t.upgraded?.host === host && failedUrl.startsWith('https:')) t.error = { kind: 'https', code, desc, url: t.upgraded.from };
    else if (code <= -200 && code > -300) t.error = { kind: 'cert', code, desc, url: failedUrl, cert: t.certError };
    else t.error = { code, desc, url: failedUrl };
    t.url = t.error.url;
    t.title = host || failedUrl;
    layout();
    sendState();
  });
  wc.on('dom-ready', async () => {
    const url = wc.getURL();
    const shieldOn = store.settings.adblock && perm(originOf(url), 'shield') !== 'off';
    if (shieldOn) {
      wc.insertCSS(AD_CSS, { cssOrigin: 'user' }).catch(() => {});
      const css = shieldLib.cosmeticCss(url);
      if (css) wc.insertCSS(css, { cssOrigin: 'user' }).catch(() => {});
      wc.executeJavaScriptInIsolatedWorld(1001, [{ code: COLLAPSE_JS }]).catch(() => {});
    }
    try {
      t.facts = await wc.executeJavaScriptInIsolatedWorld(1003, [{ code: `${READERABLE}
;${PAGE_FACTS_JS}` }]);
      if (shieldOn && t.facts) {
        const css = shieldLib.cosmeticCss(url, { ids: t.facts.ids, classes: t.facts.classes });
        if (css) wc.insertCSS(css, { cssOrigin: 'user' }).catch(() => {});
      }
      if (t.facts) delete t.facts.ids, delete t.facts.classes;
      sendState();
    } catch {}
  });
  // videos often appear after the page is ready
  wc.on('media-started-playing', () => {
    if (t.facts && !t.facts.video) {
      t.facts.video = true;
      sendState();
    }
  });
  wc.on('audio-state-changed', sendState);
  wc.on('found-in-page', (_e, r) => win.webContents.send('found', r));
  wc.on('enter-html-full-screen', () => setFullscreen(true));
  wc.on('leave-html-full-screen', () => setFullscreen(false));
  wc.on('before-input-event', (e, input) => shortcut(input) && e.preventDefault());
  wc.on('context-menu', (_e, p) => contextMenu(t, p));
  wc.on('zoom-changed', (_e, dir) => zoom(t, dir === 'in' ? 0.1 : -0.1));
  // in split view, clicking into a side makes it the active one (address bar, back, reload follow it)
  wc.on('focus', () => {
    if (!split || active === id || (id !== split.left && id !== split.right)) return;
    previous = active;
    active = id;
    extensions?.selectTab(wc);
    sendState();
  });

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
  t.reader = null;
  t.view.webContents.loadURL(url).catch(() => {});
  layout();
  sendState();
}

function activateTab(id) {
  if (!tabs.has(id)) return;
  // in split view, picking a tab that isn't showing puts it on the side that has focus
  if (split && id !== split.left && id !== split.right) {
    if (active === split.right) split.right = id;
    else split.left = id;
  }
  if (id !== active) previous = active;
  active = id;
  const g = groups.get(tabs.get(id).group);
  if (g?.collapsed) g.collapsed = false; // opening a tab opens its group
  extensions?.selectTab(tabs.get(id).view.webContents);
  layout();
  sendState();
  const t = tabs.get(id);
  if (t.url && !t.error && !t.reader) t.view.webContents.focus();
  else if (!t.url) win.webContents.send('focus-address');
}

function closeTab(id) {
  const t = tabs.get(id);
  if (!t) return;
  const i = order.indexOf(id);
  // closing one side of a split leaves the other side on its own
  if (split && (id === split.left || id === split.right)) {
    const keep = id === split.left ? split.right : split.left;
    split = null;
    if (active === id) active = keep;
  }
  order = order.filter((x) => x !== id);
  tabs.delete(id);
  win.contentView.removeChildView(t.view);
  t.view.webContents.close();
  if (t.url) closed.push({ url: t.url, title: t.title, at: Date.now() });
  if (closed.length > 25) closed.shift();
  // a group with no tabs left goes away
  if (t.group && ![...tabs.values()].some((x) => x.group === t.group)) groups.delete(t.group);
  if (!order.length) return createTab();
  if (active === id) {
    const next = order[Math.min(i, order.length - 1)];
    activateTab(next);
  } else sendState();
}
const closed = [];

function zoom(t, delta) {
  t.zoom = delta === 0 ? 1 : Math.min(3, Math.max(0.3, Math.round(((t.zoom ?? 1) + delta) * 10) / 10));
  t.view.webContents.setZoomFactor(t.zoom);
  const h = hostOf(t.url);
  if (h) {
    if (t.zoom === 1) delete store.zoom[h];
    else store.zoom[h] = t.zoom;
    save();
  }
  sendState();
}

function setFullscreen(on) {
  fullscreen = on;
  win.setFullScreen(on);
  layout();
  sendState();
}

// ---------- tab groups ----------

function groupTabs(ids, groupId) {
  let g = groups.get(groupId);
  if (!g) {
    const used = new Set([...groups.values()].map((x) => x.color));
    g = { id: nextGroup++, name: '', color: GROUP_COLORS.find((c) => !used.has(c)) ?? GROUP_COLORS[groups.size % GROUP_COLORS.length], collapsed: false };
    groups.set(g.id, g);
  }
  for (const id of ids) if (tabs.has(id)) tabs.get(id).group = g.id;
  // keep a group's tabs next to each other, where its first tab is
  const members = order.filter((id) => tabs.get(id).group === g.id);
  const first = order.findIndex((id) => tabs.get(id).group === g.id);
  const rest = order.filter((id) => tabs.get(id).group !== g.id);
  const before = order.slice(0, first).filter((id) => tabs.get(id).group !== g.id).length;
  order = [...rest.slice(0, before), ...members, ...rest.slice(before)];
  sendState();
  return g;
}
function ungroupTab(id) {
  const t = tabs.get(id);
  if (!t?.group) return;
  const gid = t.group;
  t.group = null;
  if (![...tabs.values()].some((x) => x.group === gid)) groups.delete(gid);
  sendState();
}
function tabMenu(id) {
  if (!tabs.has(id)) return;
  const t = tabs.get(id);
  const inSplit = split && (id === split.left || id === split.right);
  const others = [...groups.values()].filter((g) => g.id !== t.group);
  const label = (g) => g.name || `Unnamed group (${[...tabs.values()].filter((x) => x.group === g.id).length} tabs)`;
  const items = [
    { label: 'New tab to the right', click: () => (active = id, createTab('', { group: t.group })) },
    { type: 'separator' },
    { label: 'Add tab to new group', click: () => { const g = groupTabs([id]); win.webContents.send('command', 'group-edit:' + g.id); } },
    ...(others.length ? [{ label: 'Add tab to group', submenu: others.map((g) => ({ label: label(g), click: () => groupTabs([id], g.id) })) }] : []),
    ...(t.group ? [{ label: 'Remove from group', click: () => ungroupTab(id) }] : []),
    { type: 'separator' },
    inSplit ? { label: 'Close split view', accelerator: 'Ctrl+Shift+S', click: () => unsplit() }
      : id === active ? { label: 'Split view with another tab', accelerator: 'Ctrl+Shift+S', click: () => splitWith() }
      : { label: 'Open in split view', click: () => splitWith(id) },
    { label: 'Duplicate', click: () => t.url && createTab(t.url) },
    { label: t.view.webContents.isAudioMuted() ? 'Unmute site' : 'Mute tab', click: () => (t.view.webContents.setAudioMuted(!t.view.webContents.isAudioMuted()), sendState()) },
    ...(!PRIVATE && t.url ? [{ label: 'Open in private window', click: () => openPrivate(t.url) }] : []),
    { type: 'separator' },
    { label: 'Close tab', accelerator: 'Ctrl+W', click: () => closeTab(id) },
    { label: 'Close other tabs', enabled: order.length > 1, click: () => order.filter((x) => x !== id).forEach(closeTab) },
  ];
  Menu.buildFromTemplate(items).popup({ window: win });
}
function groupMenu(gid) {
  const g = groups.get(gid);
  if (!g) return;
  const members = order.filter((id) => tabs.get(id).group === gid);
  Menu.buildFromTemplate([
    { label: 'Rename and recolor…', click: () => win.webContents.send('command', 'group-edit:' + gid) },
    { label: g.collapsed ? 'Expand group' : 'Collapse group', click: () => ((g.collapsed = !g.collapsed), sendState()) },
    { label: 'New tab in group', click: () => ((active = members.at(-1)), createTab('', { group: gid })) },
    { type: 'separator' },
    { label: 'Ungroup', click: () => members.forEach(ungroupTab) },
    { label: 'Close group', click: () => members.forEach(closeTab) },
  ]).popup({ window: win });
}

// ---------- reader mode, picture-in-picture, translate ----------

async function openReader(t) {
  if (!t?.url || t.error) return null;
  if (t.reader) {
    t.reader = null;
    layout();
    sendState();
    t.view.webContents.focus();
    return null;
  }
  try {
    const a = await t.view.webContents.executeJavaScriptInIsolatedWorld(1003, [{ code: `${READABILITY}
;${READER_JS}` }]);
    if (!a?.content) return { error: 'Weber couldn’t find an article on this page.' };
    t.reader = a;
    layout();
    sendState();
    return a;
  } catch (e) {
    return { error: e.message };
  }
}
async function pictureInPicture(t) {
  if (!t?.url) return 'none';
  try {
    return await t.view.webContents.executeJavaScriptInIsolatedWorld(1004, [{ code: PIP_JS }], true);
  } catch {
    return 'none';
  }
}
function translateUrl(url, to) {
  return `https://translate.google.com/translate?sl=auto&tl=${encodeURIComponent(to)}&hl=${encodeURIComponent(to)}&u=${encodeURIComponent(url)}`;
}

// ---------- keyboard shortcuts (work both in the UI and inside pages) ----------

function shortcut(input) {
  if (input.type !== 'keyDown') return false;
  const ctrl = input.control || input.meta;
  const k = input.key.toLowerCase();
  const t = tabs.get(active);
  const ui = (cmd) => win.webContents.send('command', cmd);
  if (ctrl && input.shift && k === 't') {
    const c = closed.pop();
    return c && createTab(c.url), true;
  }
  if (ctrl && input.shift && k === 'n') return openPrivate(), true;
  if (ctrl && input.shift && k === 'a') return win.webContents.focus(), ui('tab-search'), true;
  if (ctrl && input.shift && k === 'delete') return ui('clear-data'), true;
  if (ctrl && input.shift && k === 'o') return ui('panel:bookmarks'), true;
  if (ctrl && input.shift && k === 'b') return ui('toggle-bookmarks-bar'), true;
  if (ctrl && input.shift && k === 'e') return ui('toggle-sidebar'), true;
  if (ctrl && input.shift && k === 'v') return ui('toggle-vertical'), true;
  if (ctrl && input.shift && k === 's') return split ? unsplit() : splitWith(), true;
  if (ctrl && k === 't') return createTab(), true;
  if (ctrl && k === 'w') return closeTab(active), true;
  if (ctrl && k === 'n') return createTab(), true;
  if (ctrl && (k === 'l' || k === 'e')) return win.webContents.focus(), ui('focus-address'), true;
  if (ctrl && k === 'f') return win.webContents.focus(), ui('find'), true;
  if (ctrl && k === 'd') return ui('bookmark'), true;
  if (ctrl && k === 'h') return ui('panel:history'), true;
  if (ctrl && k === 'j') return ui('panel:downloads'), true;
  if (ctrl && k === 'tab') {
    const i = order.indexOf(active) + (input.shift ? -1 : 1);
    return activateTab(order[(i + order.length) % order.length]), true;
  }
  if (ctrl && /^[1-9]$/.test(k)) return activateTab(k === '9' ? order.at(-1) : order[Number(k) - 1] ?? active), true;
  if (!t) return false;
  const wc = t.view.webContents;
  if (k === 'f9') return openReader(t).then((a) => win.webContents.send('reader', a)), true;
  if ((ctrl && k === 'r') || k === 'f5') return input.shift ? wc.reloadIgnoringCache() : wc.reload(), true;
  if (input.alt && k === 'arrowleft') return wc.navigationHistory.goBack(), true;
  if (input.alt && k === 'arrowright') return wc.navigationHistory.goForward(), true;
  if (ctrl && (k === '=' || k === '+')) return zoom(t, 0.1), true;
  if (ctrl && k === '-') return zoom(t, -0.1), true;
  if (ctrl && k === '0') return zoom(t, 0), true;
  if (ctrl && k === 'p') return wc.print(), true;
  if (k === 'f12' || (ctrl && input.shift && k === 'i')) return wc.toggleDevTools(), true;
  if (k === 'f11') return setFullscreen(!fullscreen), true;
  if (k === 'escape' && fullscreen) return setFullscreen(false), true;
  return false;
}

function contextMenu(t, p) {
  const wc = t.view.webContents;
  const items = [];
  if (p.linkURL) {
    items.push({ label: 'Open link in new tab', click: () => createTab(p.linkURL, { activate: false, group: t.group }) });
    items.push({ label: 'Open link in split view', click: () => splitWith(createTab(p.linkURL, { activate: false }).id) });
    if (!PRIVATE) items.push({ label: 'Open link in private window', click: () => openPrivate(p.linkURL) });
    items.push({ label: 'Copy link address', click: () => clipboard.writeText(p.linkURL) });
    items.push({ type: 'separator' });
  }
  if (p.hasImageContents) {
    items.push({ label: 'Open image in new tab', click: () => createTab(p.srcURL) });
    items.push({ label: 'Save image', click: () => wc.downloadURL(p.srcURL) });
    items.push({ label: 'Copy image', click: () => wc.copyImageAt(p.x, p.y) });
    items.push({ type: 'separator' });
  }
  if (p.mediaType === 'video') {
    items.push({ label: 'Picture in picture', click: () => pictureInPicture(t) });
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
    { label: 'Translate page', click: () => navigate(t, translateUrl(t.url, store.settings.translateTo || 'en')) },
    { label: 'Reading mode', enabled: !!t.facts?.readerable, click: () => openReader(t).then((a) => win.webContents.send('reader', a)) },
    { label: 'Print…', click: () => wc.print() },
    { type: 'separator' },
    { label: 'Inspect', click: () => wc.inspectElement(p.x, p.y) },
  );
  const extItems = extensions?.getContextMenuItems(wc, p) ?? [];
  if (extItems.length) items.splice(items.length - 2, 0, ...extItems, { type: 'separator' });
  Menu.buildFromTemplate(items).popup({ window: win });
}

// ---------- sidebar web panels ----------

function sideView(url) {
  let v = sideViews.get(url);
  if (v) return v;
  v = new WebContentsView({ webPreferences: pageWebPreferences() });
  v.setBackgroundColor('#ffffff');
  v.setBorderRadius?.(12);
  v.setVisible(false);
  guardPage(v.webContents, null);
  // links in a panel open as normal tabs
  v.webContents.setWindowOpenHandler(({ url: u }) => {
    if (/^https?:/.test(u)) createTab(u);
    return { action: 'deny' };
  });
  win.contentView.addChildView(v);
  v.webContents.loadURL(url).catch(() => {});
  sideViews.set(url, v);
  return v;
}
function closeSideView(url) {
  const v = sideViews.get(url);
  if (!v) return;
  sideViews.delete(url);
  win.contentView.removeChildView(v);
  v.webContents.close();
  if (sideOpen === url) sideOpen = null;
}

// ---------- the protection layer: requests, cookies, permissions, downloads ----------

const pendingPerms = new Map();
const pendingDownloads = new Map(); // id -> DownloadItem waiting for "keep" or "discard"
const httpAllowed = new Set(); // hosts you chose to visit over HTTP this session
const dangerBypass = new Set(); // hosts you chose to visit despite the warning, this session
const certAllowed = new Set(); // host|fingerprint you accepted despite a certificate error, this session
const pendingCaptures = new Map(); // password-save offers waiting for an answer
const pendingScreens = new Map();
// permissions a page has to ask for, each remembered per site
const ASK = new Set(['media', 'geolocation', 'notifications', 'midi', 'midiSysex', 'openExternal', 'clipboard-read', 'idle-detection', 'hid', 'serial', 'usb', 'window-management', 'local-fonts']);
// harmless permissions sites use quietly in Chrome (Docs and Gmail use several of these)
const ALLOW = new Set(['fullscreen', 'clipboard-sanitized-write', 'pointerLock', 'keyboardLock', 'persistent-storage', 'storage-access', 'top-level-storage-access', 'fileSystem', 'mediaKeySystem', 'speaker-selection', 'background-sync', 'accessibility-events', 'sensors']);
const permKind = (permission, mediaTypes) => (permission === 'media' ? (mediaTypes?.includes('video') ? 'camera' : 'microphone') : permission);

function wireRequests(ses) {
  ses.setUserAgent(USER_AGENT, acceptLanguages());

  ses.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] }, (d, cb) => {
    const t = d.webContents && tabOf(d.webContents);
    let u;
    try {
      u = new URL(d.url);
    } catch {
      return cb({});
    }
    const main = d.resourceType === 'mainFrame';
    // 1. known phishing and malware sites
    if (store.settings.safeBrowsing && !dangerBypass.has(u.hostname)) {
      const threat = shieldLib.dangerOf(d.url);
      if (threat) {
        if (main && t) {
          t.error = { kind: 'danger', threat, url: d.url };
          t.url = d.url;
          t.title = 'Dangerous site blocked';
          setTimeout(() => (layout(), sendState()), 0);
        }
        return cb({ cancel: true });
      }
    }
    // 2. HTTPS-only: pages load over a secure connection, or you're told before they don't
    if (main && u.protocol === 'http:' && store.settings.httpsOnly && !shieldLib.isLocalHost(u.hostname) && !httpAllowed.has(u.hostname)) {
      const wc = d.webContents;
      const up = wc?.__upgraded;
      if (up && up.host === u.hostname && Date.now() - up.at < 8000 && up.done) {
        // the secure address sent us straight back to HTTP: it has no working HTTPS
        if (t) {
          t.error = { kind: 'https', url: d.url };
          t.url = d.url;
          t.title = u.hostname;
          setTimeout(() => (layout(), sendState()), 0);
        }
        return cb({ cancel: true });
      }
      u.protocol = 'https:';
      if (wc) wc.__upgraded = { host: u.hostname, at: Date.now(), from: d.url };
      if (t) t.upgraded = { host: u.hostname, from: d.url };
      return cb({ redirectURL: u.href });
    }
    if (main && u.protocol === 'https:' && d.webContents?.__upgraded?.host === u.hostname) d.webContents.__upgraded.done = true;
    // 3. ads and trackers
    if (main || !store.settings.adblock) return cb({});
    const top = d.webContents?.getURL?.() || d.referrer || '';
    if (perm(originOf(top), 'shield') === 'off') return cb({});
    let frameUrl = '';
    try {
      frameUrl = d.frame?.url ?? '';
    } catch {}
    if (!shieldLib.isAdOrTracker(d.url, frameUrl || top, d.resourceType)) return cb({});
    if (t) {
      t.blocked++;
      t.trackers.add(u.hostname);
      sendState();
    }
    cb({ cancel: true });
  });

  const cookieBlocked = (url, top) => {
    const topOrigin = originOf(top);
    const reqOrigin = originOf(url);
    if (perm(reqOrigin, 'cookies') === 'block' || perm(topOrigin, 'cookies') === 'block') return true;
    if (!shieldLib.isThirdParty(url, top)) return false;
    if (perm(topOrigin, 'thirdPartyCookies') === 'allow') return false;
    return store.settings.thirdPartyCookies === 'block' || PRIVATE;
  };
  ses.webRequest.onBeforeSendHeaders({ urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] }, (d, cb) => {
    const h = addClientHints(d.url, d.requestHeaders);
    if (store.settings.gpc) h['Sec-GPC'] = '1';
    if (d.resourceType !== 'mainFrame') {
      const top = d.webContents?.getURL?.() || '';
      if (top && cookieBlocked(d.url, top)) for (const k of Object.keys(h)) if (k.toLowerCase() === 'cookie') delete h[k];
    }
    cb({ requestHeaders: h });
  });
  ses.webRequest.onHeadersReceived({ urls: ['http://*/*', 'https://*/*'] }, (d, cb) => {
    if (d.resourceType === 'mainFrame' || d.resourceType === 'subFrame') noteAcceptCH(d.url, d.responseHeaders);
    if (d.resourceType === 'mainFrame') return cb({});
    const top = d.webContents?.getURL?.() || '';
    if (!top || !cookieBlocked(d.url, top)) return cb({});
    const headers = { ...d.responseHeaders };
    for (const k of Object.keys(headers)) if (k.toLowerCase() === 'set-cookie') delete headers[k];
    cb({ responseHeaders: headers });
  });

  ses.setPermissionCheckHandler((_wc, permission, origin, details) => {
    if (ALLOW.has(permission)) return true;
    try {
      return perm(new URL(origin).origin, permKind(permission, details?.mediaType ? [details.mediaType] : null)) === 'allow';
    } catch {
      return false;
    }
  });
  ses.setPermissionRequestHandler((wc, permission, cb, details) => {
    if (ALLOW.has(permission)) return cb(true);
    if (!ASK.has(permission)) return cb(false);
    let origin;
    try {
      origin = new URL(details.requestingUrl || wc.getURL()).origin;
    } catch {
      return cb(false);
    }
    const kind = permKind(permission, details.mediaTypes);
    // camera and microphone together: both must be allowed
    const kinds = permission === 'media' && details.mediaTypes?.length > 1 ? ['camera', 'microphone'] : [kind];
    const saved = kinds.map((k) => perm(origin, k));
    if (saved.every((s) => s === 'allow')) return cb(true);
    if (saved.some((s) => s === 'block')) return cb(false);
    const t = tabOf(wc);
    if (!t) return cb(false);
    const reqId = crypto.randomUUID();
    pendingPerms.set(reqId, { cb, origin, kinds });
    win.webContents.send('permission', { reqId, tabId: t.id, origin, kind: kinds.length > 1 ? 'camera-microphone' : kind, externalURL: details.externalURL });
  });

  // screen sharing (Meet, Teams, Zoom…): Weber's own picker
  ses.setDisplayMediaRequestHandler(async (req, cb) => {
    try {
      const sources = await desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: { width: 320, height: 180 }, fetchWindowIcons: true });
      const reqId = crypto.randomUUID();
      pendingScreens.set(reqId, { cb, sources });
      win.webContents.send('screen-pick', {
        reqId,
        origin: originOf(req.frame?.url ?? ''),
        sources: sources.filter((s) => !/^Weber/.test(s.name) || s.id.startsWith('screen')).map((s) => ({ id: s.id, name: s.name, screen: s.id.startsWith('screen'), thumb: s.thumbnail.toDataURL(), icon: s.appIcon?.toDataURL() ?? null })),
      });
    } catch {
      cb({});
    }
  });

  ses.on('will-download', (_e, item, wc) => {
    const dir = app.getPath('downloads');
    const ext = path.extname(item.getFilename());
    const stem = path.basename(item.getFilename(), ext);
    let file = path.join(dir, item.getFilename());
    for (let n = 1; fs.existsSync(file); n++) file = path.join(dir, `${stem} (${n})${ext}`);
    item.setSavePath(file);
    const referrer = wc?.getURL?.() ?? '';
    const d = { id: crypto.randomUUID(), name: path.basename(file), file, url: item.getURL(), total: item.getTotalBytes(), received: 0, state: 'progressing', at: Date.now() };
    const risk = shieldLib.downloadRisk({ filename: d.name, url: d.url, referrer });
    const push = () => {
      win.webContents.send('downloads', store.downloads);
      dock?.webContents.send('downloads', store.downloads);
    };
    store.downloads.unshift(d);
    store.downloads.length = Math.min(store.downloads.length, 100);
    if (risk?.level === 'blocked') {
      item.cancel();
      Object.assign(d, { state: 'blocked', danger: risk.reason });
      save();
      push();
      win.webContents.send('command', 'panel-open:downloads');
      return;
    }
    downloadItems.set(d.id, item);
    if (risk?.level === 'warn') {
      item.pause();
      Object.assign(d, { state: 'warning', danger: risk.reason });
      pendingDownloads.set(d.id, item);
    }
    item.on('updated', (_ev, s) => {
      d.received = item.getReceivedBytes();
      d.total = item.getTotalBytes();
      if (d.state !== 'warning') d.state = s === 'interrupted' ? 'interrupted' : item.isPaused() ? 'paused' : 'progressing';
      push();
    });
    item.once('done', (_ev, s) => {
      d.state = s;
      d.received = item.getReceivedBytes();
      downloadItems.delete(d.id);
      pendingDownloads.delete(d.id);
      if (s === 'completed') shieldLib.markOfTheWeb(d.file, d.url, referrer);
      save();
      push();
    });
    push();
    win.webContents.send('command', risk ? 'panel-open:downloads' : 'download-started');
  });
}

async function setupSession() {
  const ses = session.fromPartition(PARTITION);
  // Chrome extensions: the chrome.* APIs for tabs, plus installing from the Chrome Web Store.
  // (Private windows run without extensions, as in Chrome.)
  if (!PRIVATE) {
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
    // Velvet: Weber's own look for YouTube (a built-in extension; private windows run without extensions)
    await (ses.extensions || ses).loadExtension(path.join(__dirname, 'extensions', 'velvet')).catch((e) => console.error('Velvet did not load:', e.message));
  }
  wireRequests(ses);
}
const downloadItems = new Map();
let ElectronChromeExtensions, installChromeWebStore, uninstallExtension;

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

// ---------- secure DNS ----------

const DNS = {
  cloudflare: 'https://cloudflare-dns.com/dns-query',
  google: 'https://dns.google/dns-query',
  quad9: 'https://dns.quad9.net/dns-query',
  nextdns: 'https://dns.nextdns.io/dns-query',
};
function applyDns() {
  const mode = store.settings.dns;
  try {
    if (mode === 'off') app.configureHostResolver({ secureDnsMode: 'off' });
    else if (mode === 'automatic' || !mode) app.configureHostResolver({ secureDnsMode: 'automatic' });
    else {
      const server = mode === 'custom' ? store.settings.dnsCustom : DNS[mode];
      if (!/^https:\/\/[^\s]+$/.test(server ?? '')) return app.configureHostResolver({ secureDnsMode: 'automatic' });
      app.configureHostResolver({ enableBuiltInResolver: true, secureDnsMode: 'secure', secureDnsServers: [server] });
    }
  } catch (e) {
    console.error('Secure DNS:', e.message);
  }
}

// ---------- clear browsing data ----------

async function clearBrowsingData(o) {
  const ses = session.fromPartition(PARTITION);
  const since = { hour: 36e5, day: 864e5, week: 7 * 864e5, month: 30 * 864e5 }[o.range] ? Date.now() - { hour: 36e5, day: 864e5, week: 7 * 864e5, month: 30 * 864e5 }[o.range] : 0;
  const done = [];
  if (o.history) {
    store.history = since ? store.history.filter((h) => h.at < since) : [];
    closed.length = 0;
    done.push('history');
  }
  if (o.downloads) {
    store.downloads = store.downloads.filter((d) => d.state === 'progressing' || (since && d.at < since));
    done.push('downloads list');
  }
  if (o.cookies) {
    await ses.clearStorageData({ storages: ['cookies', 'filesystem', 'indexdb', 'localstorage', 'shadercache', 'websql', 'serviceworkers', 'cachestorage'] });
    await ses.clearAuthCache();
    done.push('cookies and site data');
  }
  if (o.cache) {
    await ses.clearCache();
    await ses.clearCodeCaches({}).catch(() => {});
    await ses.clearHostResolverCache();
    done.push('cached files');
  }
  if (o.perms) {
    store.sitePerms = {};
    store.zoom = {};
    done.push('site settings');
  }
  if (o.passwords && vault) {
    for (const i of [...vault.items]) await vault.remove(i.id);
    done.push('saved passwords');
  }
  save();
  return done;
}

// ---------- window ----------

function createWindow() {
  const prof = currentProfile();
  win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 640,
    minHeight: 420,
    title: PRIVATE ? 'Weber · Private' : PROFILE ? `Weber · ${prof.name}` : 'Weber',
    icon: path.join(__dirname, '..', 'build', 'icon.ico'),
    backgroundColor: PRIVATE ? '#0c0814' : '#07080c',
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#00000000', symbolColor: '#ffffff', height: 44 },
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: false }, // our own UI only; pages stay sandboxed
  });
  if (PRIVATE || PROFILE) win.setAppDetails?.({ appId: `com.weber.browser.${PRIVATE ? 'private' : PROFILE}`, relaunchDisplayName: win.getTitle() });
  win.loadURL('weber://app/index.html');
  win.on('resize', layout);
  win.webContents.on('before-input-event', (e, input) => shortcut(input) && e.preventDefault());
  // the browser's own page never navigates anywhere else
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  dock = new WebContentsView({ webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: false } });
  dock.setBackgroundColor('#00000000');
  win.contentView.addChildView(dock);
  dock.webContents.loadURL('weber://app/dock.html');
  dock.webContents.on('will-navigate', (e) => e.preventDefault());
  dock.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  dock.webContents.on('before-input-event', (e, input) => shortcut(input) && e.preventDefault());
  layout();
  win.webContents.once('did-finish-load', () => {
    learnFromRenderer(win.webContents);
    createTab(launchTarget(process.argv.slice(app.isPackaged ? 1 : 2)) ?? '');
  });
}

// ---------- IPC from the browser UI ----------

function registerIpc() {
  const fromUi = (e) => e.sender === win?.webContents || e.sender === dock?.webContents;
  const on = (name, fn) => ipcMain.handle(name, (e, ...a) => (fromUi(e) ? fn(...a) : null));
  const cur = () => tabs.get(active);

  on('state', () => state());
  on('store', () => ({ bookmarks: store.bookmarks, settings: store.settings, downloads: store.downloads, private: PRIVATE, profile: currentProfile() }));
  on('layout', (b) => {
    const n = (v) => Math.max(0, Number(v) || 0);
    bounds = { left: n(b.left), top: n(b.top), right: n(b.right), bottom: n(b.bottom) };
    sideRect = b.side ? { x: Math.round(n(b.side.x)), y: Math.round(n(b.side.y)), width: Math.round(n(b.side.width)), height: Math.round(n(b.side.height)) } : null;
    layout();
  });
  // the island sizes itself, opens panels in the main UI, and lights up the open panel's button
  on('dock-size', (s) => {
    dockSize = { width: Math.max(80, Math.min(4000, Number(s?.width) || 420)), height: Math.max(40, Math.min(160, Number(s?.height) || 84)) };
    layout();
  });
  on('ui-command', (cmd) => void (typeof cmd === 'string' && /^(panel:(bookmarks|history|downloads|settings|passwords)|tab-search|menu)$/.test(cmd) && win.webContents.send('command', cmd)));
  on('panel-state', (p) => void dock?.webContents.send('panel', typeof p === 'string' ? p : ''));
  on('new-tab', (url) => void createTab(typeof url === 'string' ? url : ''));
  on('close-tab', (id) => void closeTab(id));
  on('split', (id) => void splitWith(Number(id) || null));
  on('unsplit', () => void unsplit());
  on('split-swap', () => {
    if (!split) return;
    split = { ...split, left: split.right, right: split.left, ratio: 1 - split.ratio };
    layout();
    sendState();
  });
  on('split-ratio', (r) => {
    if (!split) return;
    split.ratio = Math.min(0.8, Math.max(0.2, Number(r) || 0.5));
    layout();
    sendState();
  });
  on('tab-menu', (id) => tabMenu(id));
  on('group-menu', (id) => groupMenu(id));
  on('group-update', (id, patch) => {
    const g = groups.get(id);
    if (!g) return;
    if (typeof patch?.name === 'string') g.name = patch.name.slice(0, 40);
    if (typeof patch?.color === 'string' && GROUP_COLORS.includes(patch.color)) g.color = patch.color;
    if (typeof patch?.collapsed === 'boolean') g.collapsed = patch.collapsed;
    sendState();
  });
  on('group-colors', () => GROUP_COLORS);
  on('activate', (id) => activateTab(id));
  on('move-tab', (id, to) => {
    order = order.filter((x) => x !== id);
    order.splice(Math.max(0, Math.min(order.length, to)), 0, id);
    sendState();
  });
  on('closed-tabs', () => [...closed].reverse());
  on('reopen', (url) => {
    const i = closed.findLastIndex((c) => c.url === url);
    if (i >= 0) closed.splice(i, 1);
    createTab(String(url));
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
    if (on && t?.url && !t.error && !t.reader) shot = (await t.view.webContents.capturePage()).toDataURL();
    frozen = !!on;
    layout();
    return shot;
  });
  on('focus-page', () => cur()?.url && !cur().reader && cur().view.webContents.focus());
  on('print', () => cur()?.view.webContents.print());
  on('devtools', () => cur()?.view.webContents.toggleDevTools());

  // reader, picture-in-picture, translate
  on('reader', () => openReader(cur()));
  on('reader-current', () => cur()?.reader ?? null);
  on('pip', () => pictureInPicture(cur()));
  on('translate', (to) => {
    const t = cur();
    if (!t?.url || !/^https?:/.test(t.url)) return;
    const lang = /^[a-z]{2,3}(-[A-Za-z]{2,4})?$/.test(to ?? '') ? to : store.settings.translateTo || 'en';
    navigate(t, translateUrl(t.url, lang));
  });

  // warnings: carry on anyway
  on('proceed', (kind) => {
    const t = cur();
    if (!t?.error) return;
    const h = hostOf(t.error.url);
    if (kind === 'https') httpAllowed.add(h);
    if (kind === 'danger') dangerBypass.add(h);
    if (kind === 'cert' && t.error.cert?.fingerprint) certAllowed.add(h + '|' + t.error.cert.fingerprint);
    const url = t.error.url;
    t.error = null;
    navigate(t, url);
  });
  on('go-back-safely', () => {
    const t = cur();
    if (!t) return;
    t.error = null;
    if (t.view.webContents.navigationHistory.canGoBack()) t.view.webContents.navigationHistory.goBack();
    else {
      t.url = '';
      t.title = 'New tab';
    }
    layout();
    sendState();
  });

  // pop-ups that were blocked
  on('popups', () => cur()?.popups ?? []);
  on('popup-open', (i, always) => {
    const t = cur();
    const p = t?.popups[i];
    if (!p) return;
    if (always) {
      const o = originOf(t.url);
      store.sitePerms[o] = { ...store.sitePerms[o], popups: 'allow' };
      save();
    }
    t.popups.splice(i, 1);
    createTab(p.url);
  });

  // bookmarks
  on('bookmark-toggle', (url, title, favicon) => {
    const i = store.bookmarks.findIndex((b) => b.url === url);
    if (i >= 0) store.bookmarks.splice(i, 1);
    else if (/^https?:/.test(url)) store.bookmarks.push({ url, title: title || url, favicon: favicon || null, folder: '', at: Date.now() });
    save();
    return store.bookmarks;
  });
  on('bookmark-remove', (url) => {
    store.bookmarks = store.bookmarks.filter((b) => b.url !== url);
    save();
    return store.bookmarks;
  });
  on('bookmark-update', (url, patch) => {
    const b = store.bookmarks.find((x) => x.url === url);
    if (b) {
      if (typeof patch?.title === 'string' && patch.title.trim()) b.title = patch.title.trim().slice(0, 300);
      if (typeof patch?.folder === 'string') b.folder = patch.folder.replace(/^\/+|\/+$/g, '').slice(0, 200);
      if (typeof patch?.url === 'string' && /^https?:\/\//.test(patch.url)) b.url = patch.url;
    }
    save();
    return store.bookmarks;
  });
  on('bookmark-move', (url, to) => {
    const i = store.bookmarks.findIndex((x) => x.url === url);
    if (i < 0) return store.bookmarks;
    const [b] = store.bookmarks.splice(i, 1);
    store.bookmarks.splice(Math.max(0, Math.min(store.bookmarks.length, Number(to) || 0)), 0, b);
    save();
    return store.bookmarks;
  });
  on('bookmark-folder-menu', (folder) => {
    const items = store.bookmarks.filter((b) => (b.folder || '') === folder || (b.folder || '').startsWith(folder + '/'));
    const sub = new Map();
    const direct = [];
    for (const b of items) {
      const rest = (b.folder || '').slice(folder.length).replace(/^\//, '');
      if (!rest) direct.push(b);
      else sub.set(rest.split('/')[0], true);
    }
    const tmpl = [
      ...[...sub.keys()].map((name) => ({ label: `📁  ${name}`, click: () => win.webContents.send('command', 'bm-folder:' + folder + '/' + name) })),
      ...(sub.size && direct.length ? [{ type: 'separator' }] : []),
      ...direct.slice(0, 60).map((b) => ({ label: b.title.slice(0, 60), click: () => cur() && navigate(cur(), b.url) })),
      { type: 'separator' },
      { label: 'Open all in new tabs', enabled: direct.length > 0, click: () => direct.slice(0, 20).forEach((b) => createTab(b.url, { activate: false })) },
    ];
    Menu.buildFromTemplate(tmpl).popup({ window: win });
  });
  on('import-sources', () => (PRIVATE ? [] : importSources()));
  on('import-run', async (sourceId) => {
    const src = importSources().find((s) => s.id === sourceId);
    if (!src) return { error: 'That browser profile was not found.' };
    const r = await dialog.showMessageBox(win, {
      type: 'question',
      buttons: ['Import bookmarks', 'Cancel'],
      defaultId: 0,
      cancelId: 1,
      title: 'Import bookmarks',
      message: `Import bookmarks from ${src.browser} (${src.profile})?`,
      detail: 'Weber copies the bookmarks from that browser’s file on this PC into your Weber favorites. Nothing is synced or sent anywhere, and passwords and cookies are not touched.',
    });
    if (r.response !== 0) return { cancelled: true };
    const rows = await readBookmarks(sourceId);
    const have = new Set(store.bookmarks.map((b) => b.url));
    let added = 0;
    for (const b of rows) {
      if (have.has(b.url)) continue;
      have.add(b.url);
      store.bookmarks.push({ url: b.url, title: b.title, favicon: null, folder: b.folder, at: Date.now() });
      added++;
    }
    save();
    return { added, skipped: rows.length - added, bookmarks: store.bookmarks };
  });

  // history
  on('history', (q) => {
    const s = String(q ?? '').toLowerCase().trim();
    const words = s.split(/\s+/).filter(Boolean);
    return (words.length ? store.history.filter((h) => words.every((w) => h.url.toLowerCase().includes(w) || h.title.toLowerCase().includes(w))) : store.history).slice(0, 400);
  });
  on('history-remove', (url, at) => {
    store.history = store.history.filter((h) => !(h.url === url && (!at || h.at === at)));
    save();
  });
  on('history-clear', () => clearBrowsingData({ range: 'all', history: true, cache: true }));
  on('clear-data', (o) => clearBrowsingData(o ?? {}));
  on('queries', (q) => searchQueries(q));
  on('suggest', (q) => {
    const s = String(q ?? '').toLowerCase();
    if (!s) return [];
    const seen = new Set();
    const pick = [];
    // open tabs first: "switch to tab"
    for (const id of order) {
      const t = tabs.get(id);
      if (id === active || !t.url || !(t.url.toLowerCase().includes(s) || t.title.toLowerCase().includes(s))) continue;
      seen.add(t.url);
      pick.push({ url: t.url, title: t.title, tab: id });
      if (pick.length >= 2) break;
    }
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
    return { weather: w, news: news ?? [], rate, video: PRIVATE ? null : lastVideo() };
  });
  on('recent', () => {
    const seen = new Set();
    const out = [];
    for (const h of store.history) {
      const k = (h.title || '').trim().toLowerCase();
      if (seen.has(h.url) || (k && seen.has(k)) || /[?&](q|query|search_query)=/.test(h.url)) continue;
      seen.add(h.url);
      if (k) seen.add(k);
      out.push(h);
      if (out.length >= 4) break;
    }
    return out;
  });
  const SETTING_KEYS = ['engine', 'adblock', 'theme', 'bgMode', 'bgColor', 'bgWallpaper', 'bgScene', 'bgFile', 'bgDim', 'weatherCity', 'rateTo', 'httpsOnly', 'safeBrowsing', 'thirdPartyCookies', 'gpc', 'dns', 'dnsCustom', 'passwords', 'tabLayout', 'bookmarksBar', 'sidebar', 'sidebarSites', 'readerFont', 'readerSize', 'readerTheme', 'translateTo'];
  on('settings', (patch) => {
    for (const k of SETTING_KEYS) if (k in patch) store.settings[k] = patch[k];
    if (Array.isArray(store.settings.sidebarSites)) store.settings.sidebarSites = store.settings.sidebarSites.filter((u) => /^https:\/\//.test(u)).slice(0, 12);
    if ('dns' in patch || 'dnsCustom' in patch) applyDns();
    if ('sidebarSites' in patch) for (const u of [...sideViews.keys()]) if (!store.settings.sidebarSites.includes(u)) closeSideView(u);
    save();
    layout();
    sendState();
    return store.settings;
  });
  on('shield-info', () => ({ adblock: shieldLib.adblockInfo(), danger: shieldLib.dangerListInfo() }));
  on('shield-update', async () => {
    const dir = app.getPath('userData');
    const [adblock, danger] = await Promise.all([shieldLib.loadAdblock(dir, { force: true }), shieldLib.loadDangerLists(dir, { force: true })]);
    return { adblock, danger };
  });

  // site settings
  on('site-info', async (url) => {
    const origin = originOf(url);
    if (!origin || origin === 'null') return null;
    const ses = session.fromPartition(PARTITION);
    const domain = shieldLib.domainOf(url);
    const cookies = domain ? (await ses.cookies.get({ domain })).length : 0;
    const t = cur();
    return { origin, secure: url.startsWith('https:'), local: shieldLib.isLocalHost(hostOf(url)), perms: store.sitePerms[origin] ?? {}, cookies, blocked: t?.url === url ? t.blocked : 0, trackers: t?.url === url ? [...t.trackers] : [] };
  });
  on('site-perm', (origin, kind, value) => {
    if (!/^https?:\/\//.test(origin ?? '') || typeof kind !== 'string') return;
    const p = { ...store.sitePerms[origin] };
    if (value === 'allow' || value === 'block' || value === 'off') p[kind] = value;
    else delete p[kind];
    if (Object.keys(p).length) store.sitePerms[origin] = p;
    else delete store.sitePerms[origin];
    save();
    return store.sitePerms[origin] ?? {};
  });
  on('site-reset', (origin) => {
    delete store.sitePerms[origin];
    save();
  });
  on('site-clear', async (origin) => {
    const ses = session.fromPartition(PARTITION);
    const domain = shieldLib.domainOf(origin);
    await ses.clearStorageData({ origin });
    for (const c of await ses.cookies.get({ domain })) await ses.cookies.remove(`http${c.secure ? 's' : ''}://${c.domain.replace(/^\./, '')}${c.path}`, c.name).catch(() => {});
    return true;
  });
  on('site-list', () => Object.entries(store.sitePerms).map(([origin, perms]) => ({ origin, perms })));

  on('permission-answer', (reqId, allow, remember) => {
    const p = pendingPerms.get(reqId);
    if (!p) return;
    pendingPerms.delete(reqId);
    if (remember) {
      const o = { ...store.sitePerms[p.origin] };
      for (const k of p.kinds) o[k] = allow ? 'allow' : 'block';
      store.sitePerms[p.origin] = o;
      save();
    }
    p.cb(!!allow);
  });
  on('screen-answer', (reqId, sourceId, audio) => {
    const p = pendingScreens.get(reqId);
    if (!p) return;
    pendingScreens.delete(reqId);
    const src = p.sources.find((s) => s.id === sourceId);
    if (!src) return p.cb({});
    p.cb({ video: src, ...(audio && src.id.startsWith('screen') ? { audio: 'loopback' } : {}) });
  });

  // downloads
  on('download-open', (id) => {
    const d = store.downloads.find((x) => x.id === id);
    if (d?.state === 'completed') shell.openPath(d.file);
  });
  on('download-show', (id) => {
    const d = store.downloads.find((x) => x.id === id);
    if (d) shell.showItemInFolder(d.file);
  });
  on('download-cancel', (id) => downloadItems.get(id)?.cancel());
  on('download-pause', (id) => {
    const item = downloadItems.get(id);
    if (!item || pendingDownloads.has(id)) return;
    if (item.isPaused()) item.resume();
    else item.pause();
  });
  on('download-keep', (id) => {
    const item = pendingDownloads.get(id);
    const d = store.downloads.find((x) => x.id === id);
    if (!item || !d) return;
    pendingDownloads.delete(id);
    d.state = 'progressing';
    d.kept = true;
    item.resume();
  });
  on('download-discard', (id) => {
    const item = pendingDownloads.get(id);
    pendingDownloads.delete(id);
    item?.cancel();
  });
  on('downloads-clear', () => {
    store.downloads = store.downloads.filter((d) => d.state === 'progressing' || d.state === 'warning');
    save();
    return store.downloads;
  });
  on('open-downloads-folder', () => shell.openPath(app.getPath('downloads')));

  // passwords (the UI only ever sees usernames; revealing goes through Windows Hello)
  on('pw-manager', () => ({ available: vault.available, items: vault.list(), never: vault.never }));
  on('pw-reveal', async (id) => {
    const item = vault.items.find((i) => i.id === id);
    if (!item) return null;
    const ok = await confirmIdentity(`Weber wants to show your saved password for ${hostOf(item.origin)}.`);
    return ok ? vault.reveal(id) : null;
  });
  on('pw-copy', async (id) => {
    const item = vault.items.find((i) => i.id === id);
    if (!item) return false;
    if (!(await confirmIdentity(`Weber wants to copy your saved password for ${hostOf(item.origin)}.`))) return false;
    const pw = vault.reveal(id);
    clipboard.writeText(pw ?? '');
    // clear it from the clipboard again after 30 seconds, if it's still there
    setTimeout(() => clipboard.readText() === pw && clipboard.clear(), 30000);
    return true;
  });
  on('pw-remove', async (id) => {
    await vault.remove(id);
    return vault.list();
  });
  on('pw-forget-never', async (origin) => {
    await vault.forgetNever(origin);
    return vault.never;
  });
  on('pw-answer', async (reqId, action) => {
    const c = pendingCaptures.get(reqId);
    pendingCaptures.delete(reqId);
    if (!c) return;
    if (action === 'save') await vault.save(c.origin, c.username, c.password).catch((e) => win.webContents.send('toast', e.message));
    if (action === 'never') await vault.neverFor(c.origin);
  });

  // profiles and private windows
  on('profiles', () => ({ current: currentProfile(), list: profiles(), private: PRIVATE }));
  on('profile-create', (name, color) => {
    const list = profiles();
    const clean = String(name ?? '').trim().slice(0, 30) || 'Profile';
    const id = clean.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 20) + '-' + crypto.randomBytes(2).toString('hex');
    list.push({ id, name: clean, color: /^#[0-9a-f]{6}$/i.test(color ?? '') ? color : '#7ee2a8' });
    fs.writeFileSync(profilesFile(), JSON.stringify(list));
    return list;
  });
  on('profile-open', (id) => {
    if (!profiles().some((p) => p.id === id)) return;
    launchWeber(id === 'default' ? [] : [`--weber-profile=${id}`]);
  });
  on('profile-rename', (id, name, color) => {
    const list = profiles();
    const p = list.find((x) => x.id === id);
    if (p) {
      if (typeof name === 'string' && name.trim()) p.name = name.trim().slice(0, 30);
      if (/^#[0-9a-f]{6}$/i.test(color ?? '')) p.color = color;
      fs.writeFileSync(profilesFile(), JSON.stringify(list));
    }
    return list;
  });
  on('private-window', () => openPrivate());

  // sidebar web panels
  on('side-open', (url) => {
    if (!store.settings.sidebarSites.includes(url)) return;
    sideOpen = sideOpen === url ? null : url;
    if (sideOpen) sideView(url);
    layout();
    sendState();
  });
  on('side-close', () => {
    sideOpen = null;
    layout();
    sendState();
  });
  on('side-reload', () => sideOpen && sideViews.get(sideOpen)?.webContents.reload());
  on('side-home', () => sideOpen && sideViews.get(sideOpen)?.webContents.loadURL(sideOpen));

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
    PRIVATE
      ? []
      : session
          .fromPartition(PARTITION)
          .extensions.getAllExtensions()
          .map((e) => ({ id: e.id, name: e.name, version: e.version, description: e.manifest?.description ?? '' })),
  );
  on('extension-remove', async (id) => {
    await uninstallExtension(String(id), { session: session.fromPartition(PARTITION) });
    return true;
  });

  // ----- messages from web pages (the page preload): passwords -----
  const pageOrigin = (e) => {
    const wc = e.sender;
    if (!tabOf(wc) && ![...sideViews.values()].some((v) => v.webContents === wc) && !BrowserWindow.fromWebContents(wc)) return null;
    const o = e.senderFrame?.origin;
    return o && /^https?:\/\//.test(o) ? o : null;
  };
  ipcMain.handle('pw:list', (e) => {
    const o = pageOrigin(e);
    return o && store.settings.passwords ? vault.list(o).map(({ id, username }) => ({ id, username })) : [];
  });
  ipcMain.handle('pw:fill', (e, id) => {
    const o = pageOrigin(e);
    const item = vault.items.find((i) => i.id === id);
    if (!o || !item || item.origin !== o) return null; // a password only ever fills on the site it was saved for
    vault.touch(id);
    return { username: item.username, password: vault.reveal(id) };
  });
  ipcMain.handle('pw:generate', (e) => (pageOrigin(e) ? generatePassword() : null));
  ipcMain.on('pw:submitted', (e, c) => {
    const o = pageOrigin(e);
    if (!o || PRIVATE || !store.settings.passwords || typeof c?.password !== 'string' || !c.password || c.password.length > 500) return;
    const username = String(c.username ?? '').slice(0, 200);
    const status = vault.status(o, username, c.password);
    if (status === 'same' || status === 'never') return;
    const reqId = crypto.randomUUID();
    pendingCaptures.set(reqId, { origin: o, username, password: c.password });
    setTimeout(() => pendingCaptures.delete(reqId), 10 * 60e3);
    const t = tabOf(e.sender);
    win.webContents.send('pw-offer', { reqId, origin: o, username, update: status === 'update', tabId: t?.id ?? null });
  });
}

/** Windows Hello first; if this PC has no Hello set up, a plain confirmation. */
async function confirmIdentity(message) {
  const r = await verifyUser(message);
  if (r === 'verified') return true;
  if (r === 'denied') return false;
  const d = await dialog.showMessageBox(win, { type: 'warning', buttons: ['Show', 'Cancel'], defaultId: 1, cancelId: 1, title: 'Saved password', message, detail: 'Windows Hello isn’t set up on this PC, so Weber can’t check it’s you. Make sure nobody is looking at your screen.' });
  return d.response === 0;
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
  const dir = path.join(PROFILE_ROOT, 'backgrounds');
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

// hardening for everything that renders: no <webview>, and certificate errors only pass when you accepted that exact certificate
app.on('web-contents-created', (_e, contents) => contents.on('will-attach-webview', (ev) => ev.preventDefault()));
app.on('certificate-error', (event, wc, url, error, cert, cb) => {
  const host = hostOf(url);
  if (certAllowed.has(host + '|' + cert.fingerprint)) {
    event.preventDefault();
    return cb(true);
  }
  const t = tabOf(wc);
  if (t) t.certError = { error, issuer: cert.issuerName, subject: cert.subjectName, fingerprint: cert.fingerprint, expiry: cert.validExpiry * 1000 };
  cb(false);
});

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', (_e, argv) => {
    const url = launchTarget(argv.slice(1));
    if (url) createTab(url);
    // J.A.R.V.I.S. may have started Weber hidden; opening it again should always bring the window up
    if (!win.isVisible()) win.show();
    if (win.isMinimized()) win.restore();
    win.focus();
  });
  app.whenReady().then(async () => {
    nativeTheme.themeSource = 'dark';
    app.setAppUserModelId('com.weber.browser'); // matches the installed shortcut, so the taskbar groups and pins correctly
    ({ ElectronChromeExtensions } = await import('electron-chrome-extensions'));
    ({ installChromeWebStore, uninstallExtension } = await import('electron-chrome-web-store'));
    await session.defaultSession.clearCache(); // the UI is served fresh from disk
    await loadStore();
    vault = new Vault(path.join(PROFILE_ROOT, 'vault.json'));
    await vault.load();
    applyDns();
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
    // filter lists: from cache right away, refreshed from the internet in the background
    const listDir = PROFILE_ROOT;
    shieldLib.loadAdblock(listDir).then(() => sendState());
    shieldLib.loadDangerLists(listDir);
    setInterval(() => (shieldLib.loadAdblock(listDir), shieldLib.loadDangerLists(listDir)), 6 * 3600e3);
    await setupSession();
    registerIpc();
    createWindow();
    if (!PRIVATE) {
      startControl();
      sweepPrivateLeftovers();
    }
  });
}

app.on('will-quit', () => {
  if (!PRIVATE) fs.rmSync(controlFile(), { force: true });
});
app.on('window-all-closed', () => app.quit());
// a private window leaves nothing behind
if (PRIVATE) app.on('quit', () => fs.rm(app.getPath('userData'), { recursive: true, force: true }, () => {}));
