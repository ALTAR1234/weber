// How Weber introduces itself to websites.
//
// Out of the box Electron sends "…weber-browser/1.0.0 Chrome/x Electron/y…" and no
// User-Agent Client Hints at all. Google (sign-in, Search, Gmail, Docs, YouTube) treats
// that as an unknown, hint-less browser and serves its "lite" fallback pages; the
// sign-in flow for example switches to flowName=WebLiteSignIn, which has no step
// animations. Weber instead sends exactly what the Chromium engine it runs on would
// send: the reduced Chrome user agent and the matching Sec-CH-UA hints, with the same
// brand list that navigator.userAgentData reports to page scripts. It doesn't claim to
// be Google Chrome (no "Google Chrome" brand), just the engine it really is.
import { app } from 'electron';

const MAJOR = Number(process.versions.chrome.split('.')[0]);
const FULL = process.versions.chrome;

export const USER_AGENT = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${MAJOR}.0.0.0 Safari/537.36`;

// Chromium's "GREASE" brand for this version (user_agent_utils.cc), used until the
// real list has been read from a renderer.
function greaseBrand(seed) {
  const chars = [' ', '(', ':', '-', '.', '/', ')', ';', '=', '?', '_'];
  const versions = ['8', '99', '24'];
  return { brand: `Not${chars[seed % chars.length]}A${chars[(seed + 1) % chars.length]}Brand`, version: versions[seed % versions.length] };
}
const g = greaseBrand(MAJOR);
let meta = {
  brands: MAJOR % 2 === 0 ? [g, { brand: 'Chromium', version: String(MAJOR) }] : [{ brand: 'Chromium', version: String(MAJOR) }, g],
  fullVersionList: null,
  platform: 'Windows',
  platformVersion: '19.0.0',
  architecture: 'x86',
  bitness: '64',
  model: '',
  wow64: false,
  formFactors: ['Desktop'],
};

/** Read the engine's own userAgentData from a renderer, so headers and JS always agree. */
export async function learnFromRenderer(wc) {
  try {
    const v = await wc.executeJavaScript(
      `navigator.userAgentData ? navigator.userAgentData.getHighEntropyValues(['platformVersion','fullVersionList','architecture','bitness','model','wow64','formFactors']) : null`,
    );
    if (v?.brands?.length) meta = { ...meta, ...v };
  } catch {}
}

const list = (items) => items.map((b) => `"${b.brand}";v="${b.version}"`).join(', ');
const bool = (b) => (b ? '?1' : '?0');
const str = (s) => `"${s}"`;

// what each hint looks like on the wire
const HINTS = {
  'sec-ch-ua': () => list(meta.brands),
  'sec-ch-ua-mobile': () => '?0',
  'sec-ch-ua-platform': () => str(meta.platform),
  'sec-ch-ua-full-version-list': () => list(meta.fullVersionList ?? meta.brands.map((b) => ({ brand: b.brand, version: b.brand === 'Chromium' ? FULL : `${b.version}.0.0.0` }))),
  'sec-ch-ua-full-version': () => str(FULL),
  'sec-ch-ua-platform-version': () => str(meta.platformVersion),
  'sec-ch-ua-arch': () => str(meta.architecture),
  'sec-ch-ua-bitness': () => str(meta.bitness),
  'sec-ch-ua-model': () => str(meta.model),
  'sec-ch-ua-wow64': () => bool(meta.wow64),
  'sec-ch-ua-form-factors': () => meta.formFactors.map(str).join(', '),
};
const LOW = ['sec-ch-ua', 'sec-ch-ua-mobile', 'sec-ch-ua-platform'];

// High-entropy hints a site asked for with Accept-CH (per origin, for this run).
const asked = new Map();
export function noteAcceptCH(url, responseHeaders) {
  let origin;
  try {
    origin = new URL(url).origin;
  } catch {
    return;
  }
  for (const [k, v] of Object.entries(responseHeaders ?? {})) {
    if (k.toLowerCase() !== 'accept-ch') continue;
    const set = new Set();
    for (const h of [].concat(v).join(',').split(',')) {
      const name = h.trim().toLowerCase();
      if (HINTS[name]) set.add(name);
    }
    asked.set(origin, set);
  }
}

const secure = (u) => u.protocol === 'https:' || u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.hostname === '[::1]';

/** Add the client hints Chromium would send for this request (only to secure origins, like Chrome). */
export function addClientHints(url, headers) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return headers;
  }
  for (const k of Object.keys(headers)) if (k.toLowerCase().startsWith('sec-ch-ua')) delete headers[k];
  if (!secure(u)) return headers;
  for (const name of LOW) headers[name] = HINTS[name]();
  for (const name of asked.get(u.origin) ?? []) headers[name] = HINTS[name]();
  return headers;
}

/** Accept-Language from the user's Windows languages ("en-US,en"); Chromium adds the q-values. */
export function acceptLanguages() {
  const langs = [];
  for (const l of app.getPreferredSystemLanguages?.() ?? [app.getLocale()]) {
    if (!langs.includes(l)) langs.push(l);
    const base = l.split('-')[0];
    if (!langs.includes(base)) langs.push(base);
  }
  return (langs.length ? langs : ['en-US', 'en']).slice(0, 6).join(',');
}
