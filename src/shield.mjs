// Weber Shield: the protection layer.
//  - ad and tracker blocking with the EasyList and EasyPrivacy filter lists (network
//    rules plus element hiding), cached on disk and refreshed every few days
//  - dangerous-site blocking (phishing and malware) from public, key-free host lists
//  - helpers for HTTPS-only mode, third-party cookies and risky downloads
import { FiltersEngine, Request } from '@ghostery/adblocker';
import { getDomain, getHostname } from 'tldts';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

const DAY = 864e5;

// ---------- ads and trackers ----------

const FILTER_LISTS = ['https://easylist.to/easylist/easylist.txt', 'https://easylist.to/easylist/easyprivacy.txt'];
// used until the full lists have loaded (first run, or offline with no cache)
const FALLBACK_HOSTS = [
  'doubleclick.net', 'googlesyndication.com', 'googleadservices.com', 'adservice.google.com', 'google-analytics.com', 'googletagservices.com',
  'adnxs.com', 'advertising.com', 'taboola.com', 'outbrain.com', 'criteo.com', 'criteo.net', 'rubiconproject.com', 'pubmatic.com', 'openx.net',
  'scorecardresearch.com', 'quantserve.com', 'moatads.com', 'amazon-adsystem.com', 'adsrvr.org', 'casalemedia.com', 'smartadserver.com',
  'yieldmo.com', 'sharethrough.com', 'teads.tv', '3lift.com', 'hotjar.com', 'media.net', 'bidswitch.net', 'indexww.com', 'zemanta.com',
];
let engine = null;
let engineInfo = { rules: 0, updated: 0, source: 'built-in' };

const TYPES = { mainFrame: 'main_frame', subFrame: 'sub_frame', stylesheet: 'stylesheet', script: 'script', image: 'image', font: 'font', object: 'object', xhr: 'xmlhttprequest', ping: 'ping', cspReport: 'csp_report', media: 'media', webSocket: 'websocket' };

async function fetchText(url, ms = 30000) {
  const r = await fetch(url, { signal: AbortSignal.timeout(ms) });
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.text();
}

export async function loadAdblock(dir, { force = false } = {}) {
  const file = path.join(dir, 'adblock-engine.bin');
  try {
    const st = await fsp.stat(file);
    if (!force && Date.now() - st.mtimeMs < 4 * DAY) {
      engine = FiltersEngine.deserialize(new Uint8Array(await fsp.readFile(file)));
      engineInfo = { rules: engineInfoCount(), updated: st.mtimeMs, source: 'EasyList + EasyPrivacy' };
      return engineInfo;
    }
  } catch {}
  try {
    const texts = await Promise.all(FILTER_LISTS.map((u) => fetchText(u)));
    const fresh = FiltersEngine.parse(texts.join('\n'), { loadCosmeticFilters: true, loadNetworkFilters: true, enableCompression: true });
    engine = fresh;
    await fsp.writeFile(file, engine.serialize());
    engineInfo = { rules: engineInfoCount(), updated: Date.now(), source: 'EasyList + EasyPrivacy' };
  } catch (e) {
    // offline: keep an old cache if there is one
    if (!engine && fs.existsSync(file)) {
      try {
        engine = FiltersEngine.deserialize(new Uint8Array(await fsp.readFile(file)));
        engineInfo = { rules: engineInfoCount(), updated: fs.statSync(file).mtimeMs, source: 'EasyList + EasyPrivacy (offline copy)' };
      } catch {}
    }
    console.error('Filter lists not updated:', e.message);
  }
  return engineInfo;
}
function engineInfoCount() {
  try {
    return engine.getFilters().networkFilters.length + engine.getFilters().cosmeticFilters.length;
  } catch {
    return 0;
  }
}
export const adblockInfo = () => engineInfo;

/** Should this request be blocked as an ad or tracker? */
export function isAdOrTracker(url, sourceUrl, resourceType) {
  let host;
  try {
    host = new URL(url).hostname;
  } catch {
    return false;
  }
  if (!engine) return FALLBACK_HOSTS.some((d) => host === d || host.endsWith('.' + d));
  const { match } = engine.match(Request.fromRawDetails({ url, sourceUrl: sourceUrl || url, type: TYPES[resourceType] ?? 'other' }));
  return match;
}

/** CSS that hides ad slots on this page: the generic rules plus the site's own. */
export function cosmeticCss(url, dom) {
  if (!engine) return '';
  const hostname = getHostname(url) ?? '';
  const domain = getDomain(url) ?? '';
  try {
    const base = engine.getCosmeticsFilters({ url, hostname, domain, getBaseRules: !dom, getInjectionRules: false, getExtendedRules: false, getRulesFromHostname: !dom, getRulesFromDOM: !!dom, ...(dom ?? {}) });
    return base.styles || '';
  } catch {
    return '';
  }
}

// ---------- dangerous sites ----------

const DANGER_LISTS = [
  { kind: 'phishing', url: 'https://malware-filter.gitlab.io/malware-filter/phishing-filter-hosts.txt' },
  { kind: 'malware', url: 'https://malware-filter.gitlab.io/malware-filter/urlhaus-filter-hosts.txt' },
];
// Google's public test pages for safe-browsing warnings, so the warning can be tried safely
const BUILT_IN_DANGER = new Map([['testsafebrowsing.appspot.com', 'phishing']]);
let danger = new Map(BUILT_IN_DANGER);
let dangerInfo = { hosts: danger.size, updated: 0 };

function parseHosts(text, kind, into) {
  for (const line of text.split('\n')) {
    if (!line || line[0] === '#') continue;
    const h = line.split(/\s+/)[1]?.trim().toLowerCase();
    if (h && h !== '0.0.0.0' && h !== 'localhost') into.set(h, kind);
  }
}
export async function loadDangerLists(dir, { force = false } = {}) {
  const file = path.join(dir, 'dangerous-sites.json');
  let cached = null;
  try {
    cached = JSON.parse(await fsp.readFile(file, 'utf8'));
  } catch {}
  if (cached && !force && Date.now() - cached.at < DAY / 2) {
    danger = new Map([...BUILT_IN_DANGER, ...cached.hosts]);
    dangerInfo = { hosts: danger.size, updated: cached.at };
    return dangerInfo;
  }
  try {
    const next = new Map(BUILT_IN_DANGER);
    for (const l of DANGER_LISTS) parseHosts(await fetchText(l.url), l.kind, next);
    danger = next;
    dangerInfo = { hosts: danger.size, updated: Date.now() };
    await fsp.writeFile(file, JSON.stringify({ at: dangerInfo.updated, hosts: [...danger] }));
  } catch (e) {
    if (cached) {
      danger = new Map([...BUILT_IN_DANGER, ...cached.hosts]);
      dangerInfo = { hosts: danger.size, updated: cached.at };
    }
    console.error('Dangerous-site lists not updated:', e.message);
  }
  return dangerInfo;
}
export const dangerListInfo = () => dangerInfo;

/** 'phishing' | 'malware' | null for this address (the host or any parent domain is listed). */
export function dangerOf(url) {
  let host;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
  for (let h = host; h.includes('.'); h = h.slice(h.indexOf('.') + 1)) {
    const k = danger.get(h);
    if (k) return k;
  }
  return null;
}

// ---------- secure connections ----------

const PRIVATE_HOST = /^(localhost|127\.\d+\.\d+\.\d+|\[::1\]|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|169\.254\.\d+\.\d+)$|\.(localhost|local|test|internal|lan|home\.arpa)$/i;
/** HTTP addresses that are fine as they are: this PC and the home network. */
export const isLocalHost = (host) => PRIVATE_HOST.test(host) || !host.includes('.');

// ---------- cookies ----------

// Sites run by one company across several domains (like Chrome's Related Website Sets),
// so blocking third-party cookies doesn't break signing in across them.
const RELATED = [
  ['google.com', 'youtube.com', 'googleusercontent.com', 'gstatic.com', 'googleapis.com', 'ggpht.com', 'gmail.com', 'blogger.com', 'googlevideo.com', 'withgoogle.com', 'google.co.uk', 'google.ca', 'google.co.in', 'google.de', 'google.fr', 'google.com.au'],
  ['microsoft.com', 'live.com', 'office.com', 'microsoftonline.com', 'sharepoint.com', 'bing.com', 'outlook.com', 'office.net', 'msn.com', 'xbox.com', 'skype.com', 'onedrive.com', 'microsoft365.com', 'cloud.microsoft'],
  ['facebook.com', 'instagram.com', 'fbcdn.net', 'messenger.com', 'whatsapp.com', 'threads.net'],
  ['apple.com', 'icloud.com', 'cdn-apple.com', 'mzstatic.com'],
  ['amazon.com', 'amazon.co.uk', 'primevideo.com', 'media-amazon.com', 'ssl-images-amazon.com'],
];
const PARTY = new Map();
RELATED.forEach((set, i) => set.forEach((d) => PARTY.set(d, 'set' + i)));
export const siteOf = (url) => {
  const d = getDomain(url) ?? getHostname(url) ?? '';
  return PARTY.get(d) ?? d;
};
/** Is `url` a different site from the page it's loaded into? */
export function isThirdParty(url, topUrl) {
  if (!topUrl) return false;
  const a = siteOf(url), b = siteOf(topUrl);
  return !!a && !!b && a !== b;
}
export const domainOf = (url) => getDomain(url) ?? getHostname(url) ?? '';

// ---------- downloads ----------

// file types that can run code or change Windows (Chrome and Edge warn on the same kinds)
const RUNNABLE = new Set(['exe', 'msi', 'msix', 'msixbundle', 'appx', 'appxbundle', 'bat', 'cmd', 'com', 'scr', 'pif', 'cpl', 'hta', 'jar', 'js', 'jse', 'vbs', 'vbe', 'wsf', 'wsh', 'ps1', 'psm1', 'psd1', 'reg', 'lnk', 'url', 'dll', 'sys', 'drv', 'inf', 'msc', 'msp', 'mst', 'application', 'appref-ms', 'gadget', 'scf', 'iso', 'img', 'vhd', 'vhdx', 'apk', 'xll', 'xlam', 'docm', 'xlsm', 'pptm', 'chm', 'settingcontent-ms', 'library-ms', 'search-ms']);
export function downloadRisk({ filename, url, referrer }) {
  const ext = path.extname(filename).slice(1).toLowerCase();
  const kind = dangerOf(url) || (referrer && dangerOf(referrer));
  if (kind) return { level: 'blocked', reason: `Blocked: this file comes from a site known for ${kind === 'phishing' ? 'phishing' : 'malware'}.` };
  if (url.startsWith('http:') && !isLocalHost(new URL(url).hostname)) return { level: 'warn', reason: 'This file was sent over an insecure connection, so it could have been changed on the way.' };
  if (RUNNABLE.has(ext)) return { level: 'warn', reason: `.${ext} files can run programs or change your PC. Only keep it if you trust ${hostOf(url)}.` };
  return null;
}
const hostOf = (u) => {
  try {
    return new URL(u).hostname.replace(/^www\./, '');
  } catch {
    return 'this site';
  }
};

/** Mark a download as coming from the internet, as Chrome and Edge do, so Windows SmartScreen checks it before it runs. */
export function markOfTheWeb(file, url, referrer) {
  const safe = (u) => (/^https?:/.test(u ?? '') ? u.split('#')[0] : '');
  const body = `[ZoneTransfer]\r\nZoneId=3\r\n${safe(referrer) ? `ReferrerUrl=${safe(referrer)}\r\n` : ''}${safe(url) ? `HostUrl=${safe(url)}\r\n` : ''}`;
  fsp.writeFile(file + ':Zone.Identifier', body).catch(() => {});
}
