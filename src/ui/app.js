// Weber browser UI: the address bar on top, tabs in a floating island (or a vertical
// list), a sidebar of web panels, side panels, menus and the new-tab page. Pages live
// in native views that main lays out exactly over #stage (and #side for web panels).
import { SCENES, startScene, stopScene } from './scenes.js';
import { WALLPAPERS } from './wallpapers.js';

const A = window.weber;
const $ = (s) => document.querySelector(s);

const ICONS = {
  back: '<path d="M15 5l-7 7 7 7"/>',
  forward: '<path d="M9 5l7 7-7 7"/>',
  reload: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
  stop: '<path d="M6 6l12 12M18 6L6 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  x: '<path d="M7 7l10 10M17 7L7 17"/>',
  star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.5 9.7l5.9-.8z"/>',
  shield: '<path d="M12 3l7 3v6c0 4.5-3 7.7-7 9-4-1.3-7-4.5-7-9V6z"/>',
  shieldOk: '<path d="M12 3l7 3v6c0 4.5-3 7.7-7 9-4-1.3-7-4.5-7-9V6z"/><path d="M9 12l2 2 4-4"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  history: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',
  bookmarks: '<path d="M7 4h10v16l-5-3.5L7 20z"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"/>',
  lock: '<rect x="6" y="11" width="12" height="9" rx="2"/><path d="M8.5 11V8a3.5 3.5 0 0 1 7 0v3"/>',
  unlock: '<rect x="6" y="11" width="12" height="9" rx="2"/><path d="M8.5 11V8a3.5 3.5 0 0 1 6.8-1.2"/>',
  alert: '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17v.5"/>',
  globe: '<circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4c2.5 2.5 2.5 13.5 0 16M12 4c-2.5 2.5-2.5 13.5 0 16"/>',
  search: '<circle cx="11" cy="11" r="6"/><path d="M16 16l4 4"/>',
  up: '<path d="M6 15l6-6 6 6"/>',
  down: '<path d="M6 9l6 6 6-6"/>',
  right: '<path d="M9 6l6 6-6 6"/>',
  sound: '<path d="M5 10v4h3l4 4V6L8 10z"/><path d="M16 9a4 4 0 0 1 0 6"/>',
  mute: '<path d="M5 10v4h3l4 4V6L8 10z"/><path d="M16 10l4 4M20 10l-4 4"/>',
  folder: '<path d="M4 7a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/>',
  trash: '<path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  image: '<rect x="4" y="5" width="16" height="14" rx="3"/><circle cx="9" cy="10" r="1.6"/><path d="M20 16l-5-5-8 8"/>',
  play: '<rect x="4" y="5" width="16" height="14" rx="3"/><path d="M10.5 9.5v5l4-2.5z"/>',
  news: '<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M8 9h8M8 12.5h8M8 16h5"/>',
  spark: '<path d="M12 3.5l1.9 5.6 5.6 1.9-5.6 1.9L12 18.5l-1.9-5.6L4.5 11l5.6-1.9z"/>',
  pin: '<path d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11z"/><circle cx="12" cy="10" r="2.2"/>',
  book: '<path d="M4 5.5C6.5 4.5 9.5 4.5 12 6c2.5-1.5 5.5-1.5 8-.5v13c-2.5-1-5.5-1-8 .5-2.5-1.5-5.5-1.5-8-.5z"/><path d="M12 6v13"/>',
  translate: '<path d="M4 6h9M8.5 4v2M6 6c.5 3 2.5 5.5 5.5 7M11 6c-.6 3.6-3 6.6-7 8"/><path d="M13 20l4-9 4 9M14.5 17h5"/>',
  pip: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><rect x="12" y="11" width="7" height="6" rx="1.2" fill="currentColor" stroke="none"/>',
  popup: '<rect x="3" y="7" width="13" height="13" rx="2"/><path d="M9 3h12v12"/><path d="M4 19L15 8"/>',
  dots: '<circle cx="12" cy="5.5" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="18.5" r="1.4" fill="currentColor"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M10.8 12.2 20 3M16 7l3 3M14 9l2 2"/>',
  user: '<circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20c1.2-3.8 4-5.5 7.5-5.5s6.3 1.7 7.5 5.5"/>',
  mask: '<path d="M3 9c3-1.5 15-1.5 18 0 0 5-2.5 8-5 8-1.8 0-2.6-2-4-2s-2.2 2-4 2c-2.5 0-5-3-5-8z"/><circle cx="8.3" cy="11.3" r="1.4"/><circle cx="15.7" cy="11.3" r="1.4"/>',
  columns: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="M9 4.5v15"/>',
  split: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="M12 4.5v15"/>',
  sidebar: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="M8 4.5v15M5.5 8h0M5.5 11h0"/>',
  layers: '<path d="M12 4l8 4-8 4-8-4z"/><path d="M4 12l8 4 8-4M4 16l8 4 8-4"/>',
  tabs: '<rect x="3.5" y="7" width="17" height="12.5" rx="2.5"/><path d="M3.5 10.5h17M7 7V5h6v2"/>',
  edit: '<path d="M5 19h4L19 9l-4-4L5 15z"/><path d="M13.5 6.5l4 4"/>',
  copy: '<rect x="8" y="8" width="11" height="12" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h8"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  open: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/>',
  home: '<path d="M4 11l8-6.5 8 6.5"/><path d="M6 10v9h12v-9"/>',
  broom: '<path d="M14 4l-4 8M7 12h8l2 8H5z"/><path d="M9 16v4M13 16v4"/>',
  puzzle: '<path d="M9 4h3a2 2 0 1 1 4 0h0v4a2 2 0 1 1 0 4v6H4v-5a2 2 0 1 0 0-4V4z"/>',
  print: '<path d="M7 9V4h10v5"/><rect x="4" y="9" width="16" height="8" rx="2"/><path d="M7 14h10v6H7z"/>',
  code: '<path d="M8 8l-4 4 4 4M16 8l4 4-4 4M14 5l-4 14"/>',
  import: '<path d="M12 3v11M8 10l4 4 4-4"/><path d="M5 15v4h14v-4"/>',
  pause: '<path d="M9 6v12M15 6v12"/>',
  resume: '<path d="M8 6l10 6-10 6z"/>',
  cookie: '<path d="M20 12.5A8 8 0 1 1 11.5 4a3 3 0 0 0 3.5 3.5 3 3 0 0 0 5 5z"/><circle cx="9" cy="10" r=".9" fill="currentColor"/><circle cx="14" cy="15" r=".9" fill="currentColor"/><circle cx="9" cy="15.5" r=".9" fill="currentColor"/>',
  camera: '<rect x="3" y="7" width="13" height="10" rx="2"/><path d="M16 10.5l5-3v9l-5-3"/>',
  mic: '<rect x="9" y="3.5" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  screen: '<rect x="3" y="4.5" width="18" height="12" rx="2"/><path d="M8 20h8M12 16.5V20"/>',
  dns: '<rect x="4" y="4" width="16" height="6" rx="1.5"/><rect x="4" y="14" width="16" height="6" rx="1.5"/><path d="M7.5 7h0M7.5 17h0"/>',
};
const icon = (n, s = 18) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[n] ?? ''}</svg>`;
const esc = (s = '') => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const host = (u) => {
  try {
    return new URL(u).hostname.replace(/^www\./, '');
  } catch {
    return u;
  }
};
const origin = (u) => {
  try {
    return new URL(u).origin;
  } catch {
    return '';
  }
};
// favicons fall back to a dot, or to a letter when data-fb has one (no inline handlers: the page CSP forbids them)
const favImg = (url, fav, letter = '') => (fav || /^https?:/.test(url) ? `<img src="${esc(fav || origin(url) + '/favicon.ico')}" alt="" data-fb="${esc(letter)}">` : '<span class="dot"></span>');
document.addEventListener(
  'error',
  (e) => {
    const img = e.target;
    if (img.tagName !== 'IMG' || img.dataset.fb === undefined) return;
    const fb = document.createElement('span');
    if (img.dataset.fb) {
      fb.textContent = img.dataset.fb;
      fb.className = 'letter';
    } else fb.className = 'dot';
    img.replaceWith(fb);
  },
  true,
);

let S = { tabs: [], active: null, groups: [] };
let store = { bookmarks: [], settings: {}, downloads: [] };
let panel = null; // 'bookmarks' | 'history' | 'downloads' | 'passwords' | 'settings'
const cur = () => S.tabs.find((t) => t.id === S.active);
const groupOf = (id) => S.groups.find((g) => g.id === id);

// ---------- static buttons ----------
for (const [id, n, size] of [
  ['back', 'back'], ['forward', 'forward'], ['reload', 'reload'], ['star', 'star', 16], ['shield', 'shieldOk', 18], ['dl-top', 'download', 18], ['menu-btn', 'dots', 18],
  ['reader-btn', 'book', 16], ['translate-btn', 'translate', 16], ['pip-btn', 'pip', 16], ['popup-btn', 'popup', 16],
  ['new-tab', 'plus', 20], ['bm-btn', 'bookmarks', 19], ['hist-btn', 'history', 19], ['dl-btn', 'download', 19], ['set-btn', 'settings', 19],
  ['find-prev', 'up', 16], ['find-next', 'down', 16], ['find-close', 'x', 16],
])
  $('#' + id).insertAdjacentHTML('afterbegin', icon(n, size ?? 18));
$('.cmd-icon').innerHTML = icon('search', 20);
$('#back').onclick = () => A.back();
$('#forward').onclick = () => A.forward();
$('#reload').onclick = () => (cur()?.loading ? A.stop() : A.reload());
$('#new-tab').onclick = () => A.newTab();
$('#pill').onclick = () => openCommand();
$('#star').onclick = () => toggleBookmark();
$('#shield').onclick = () => siteSheet('shield');
$('#site-icon').onclick = () => siteSheet('site');
$('#dl-top').onclick = () => togglePanel('downloads');
$('#menu-btn').onclick = () => openMenu();
$('#profile-chip').onclick = () => openProfiles();
$('#bm-btn').onclick = () => togglePanel('bookmarks');
$('#hist-btn').onclick = () => togglePanel('history');
$('#dl-btn').onclick = () => togglePanel('downloads');
$('#set-btn').onclick = () => togglePanel('settings');
$('#zoom-pill').onclick = () => A.zoom(0);
$('#reader-btn').onclick = async () => showReaderResult(await A.reader());
$('#pip-btn').onclick = async () => {
  const r = await A.pip();
  if (r === 'none') toast('No video is playing on this page');
};
$('#translate-btn').onclick = () => A.translate(store.settings.translateTo || 'en');
$('#popup-btn').onclick = () => openPopups();

// ---------- layout: tell main where the page (and any web panel) sits ----------
const vertical = () => store.settings.tabLayout === 'vertical';
function syncLayout() {
  const s = store.settings;
  const root = document.documentElement.style;
  const bar = !!s.bookmarksBar && !S.fullscreen;
  const railW = s.sidebar && !S.fullscreen ? 58 : 0;
  const vtW = vertical() && !S.fullscreen ? 244 : 0;
  const sideW = S.side && s.sidebar && !S.fullscreen ? 408 : 0;
  root.setProperty('--stage-top', `${48 + (bar ? 36 : 0)}px`);
  root.setProperty('--rail-w', `${railW}px`);
  root.setProperty('--vt-w', `${vtW}px`);
  root.setProperty('--side-w', `${sideW}px`);
  root.setProperty('--stage-left', `${8 + railW + vtW + sideW}px`);
  root.setProperty('--stage-bottom', `${vertical() ? 8 : 84}px`);
  document.body.classList.toggle('panel', !!panel);
  document.body.classList.toggle('vertical', vertical());
  document.body.classList.toggle('has-rail', !!railW);
  document.body.classList.toggle('has-bar', bar);
  $('#bmbar').hidden = !bar;
  $('#rail').hidden = !railW;
  $('#vtabs').hidden = !vtW;
  $('#side').hidden = !sideW;
  A.panelState(panel || '');
  for (const [id, p] of [['bm-btn', 'bookmarks'], ['hist-btn', 'history'], ['dl-btn', 'downloads'], ['set-btn', 'settings'], ['dl-top', 'downloads']]) $('#' + id).classList.toggle('on', panel === p);
  const r = $('#stage').getBoundingClientRect();
  const sb = sideW ? $('#side .side-body').getBoundingClientRect() : null;
  A.layout({ left: r.left, top: r.top, right: innerWidth - r.right, bottom: innerHeight - r.bottom, side: sb ? { x: sb.left, y: sb.top, width: sb.width, height: sb.height } : null });
}
addEventListener('resize', syncLayout);

// ---------- tabs: the hidden fallback strip, and the vertical list ----------
const WAVE = '<span class="wave"><i></i><i></i><i></i><i></i></span>';
function renderTabs() {
  // the island lives in its own view (dock.js); this copy only exists under it
  $('#tabs').replaceChildren();
}
function renderVTabs() {
  const box = $('#vtabs');
  if (!vertical()) return box.replaceChildren();
  const rows = [];
  let lastGroup = null;
  S.tabs.forEach((t, i) => {
    const g = t.group ? groupOf(t.group) : null;
    if (g && g.id !== lastGroup) {
      const n = S.tabs.filter((x) => x.group === g.id).length;
      rows.push(`<div class="vg${g.collapsed ? ' closed' : ''}" data-g="${g.id}" style="--g:${g.color}"><span class="gdot"></span><b>${esc(g.name || 'Group')}</b><small>${n}</small>${icon(g.collapsed ? 'right' : 'down', 14)}</div>`);
    }
    lastGroup = g?.id ?? null;
    if (g?.collapsed) return;
    const fav = t.loading ? '<span class="spin"></span>' : t.favicon ? `<img src="${esc(t.favicon)}" alt="" data-fb="${esc((host(t.url)[0] || '').toUpperCase())}">` : icon(t.url ? 'globe' : 'spark', 16);
    const inSplit = S.split && (t.id === S.split.left || t.id === S.split.right);
    rows.push(`<div class="vt${t.id === S.active ? ' on' : ''}${g ? ' grouped' : ''}${inSplit ? ' split' : ''}" data-id="${t.id}" data-i="${i}" draggable="true" style="${g ? `--g:${g.color}` : ''}" title="${esc(t.url ? `${t.title}\n${host(t.url)}` : 'New tab')}">
      <span class="fav">${fav}</span><span class="title">${esc(t.url ? t.title : 'New tab')}</span>
      ${t.audible || t.muted ? `<button class="audio" data-a="mute" title="${t.muted ? 'Unmute' : 'Mute'}">${t.muted ? icon('mute', 13) : WAVE}</button>` : ''}
      <button class="x" data-a="close" title="Close (Ctrl+W)">${icon('x', 13)}</button></div>`);
  });
  box.innerHTML = `<div class="vt-head"><button class="vt-search" id="vt-search">${icon('search', 15)}<span>Search tabs</span><kbd>Ctrl Shift A</kbd></button></div>
    <div class="vt-list">${rows.join('')}</div>
    <button class="vt-new" id="vt-new">${icon('plus', 16)}<span>New tab</span></button>`;
  $('#vt-search').onclick = () => openTabSearch();
  $('#vt-new').onclick = () => A.newTab();
  for (const el of box.querySelectorAll('.vg')) {
    el.onclick = () => A.groupUpdate(Number(el.dataset.g), { collapsed: !el.classList.contains('closed') });
    el.oncontextmenu = (e) => (e.preventDefault(), A.groupMenu(Number(el.dataset.g)));
  }
  for (const el of box.querySelectorAll('.vt')) {
    const id = Number(el.dataset.id);
    el.onmousedown = (e) => {
      if (e.button === 1) e.preventDefault();
      else if (e.button === 0 && !e.target.closest('button')) A.activate(id);
    };
    el.onauxclick = (e) => e.button === 1 && A.closeTab(id);
    el.oncontextmenu = (e) => (e.preventDefault(), A.tabMenu(id));
    el.onclick = (e) => {
      const a = e.target.closest('button')?.dataset.a;
      if (a === 'close') A.closeTab(id);
      if (a === 'mute') A.mute(id);
    };
    el.ondragstart = (e) => (e.dataTransfer.setData('text/tab', String(id)), el.classList.add('dragging'));
    el.ondragend = () => el.classList.remove('dragging');
    el.ondragover = (e) => e.preventDefault();
    el.ondrop = (e) => {
      const from = Number(e.dataTransfer.getData('text/tab'));
      if (from && from !== id) A.moveTab(from, Number(el.dataset.i));
    };
  }
  box.querySelector('.vt.on')?.scrollIntoView({ block: 'nearest' });
}

// ---------- top strip ----------
function renderToolbar() {
  const t = cur();
  const prof = S.profile ?? store.profile;
  document.body.classList.toggle('private', !!S.private);
  if (prof) {
    $('#profile-chip').innerHTML = S.private ? `${icon('mask', 16)}<span>Private</span>` : `<i style="--p:${esc(prof.color)}">${esc((prof.name || 'P')[0].toUpperCase())}</i>`;
    $('#profile-chip').title = S.private ? 'Private window: nothing you do here is saved' : `Profile: ${prof.name}`;
    $('#profile-chip').classList.toggle('wide', !!S.private);
  }
  if (!t) return;
  $('#back').disabled = !t.canBack;
  $('#forward').disabled = !t.canForward;
  $('#reload').innerHTML = icon(t.loading ? 'stop' : 'reload');
  $('#reload').title = t.loading ? 'Stop' : 'Reload (Ctrl+R)';
  const web = /^https?:/.test(t.url);
  const secure = t.url.startsWith('https:');
  const danger = t.error?.kind === 'danger';
  const insecure = web && !secure && !/^http:\/\/(localhost|127\.|\[::1\])/.test(t.url);
  $('#site-icon').innerHTML = icon(!t.url ? 'search' : danger || insecure ? 'alert' : secure ? 'lock' : 'globe', 14);
  $('#site-icon').className = danger ? 'bad' : insecure ? 'warn' : '';
  $('#site-icon').title = !t.url ? '' : danger ? 'Dangerous site' : insecure ? 'Not secure: view site information' : 'View site information';
  $('#secure-tag').hidden = !insecure && !danger;
  $('#secure-tag').textContent = danger ? 'Dangerous' : 'Not secure';
  $('#secure-tag').className = danger ? 'bad' : '';
  $('#url-text').innerHTML = t.url ? prettyUrl(t.url) : '<small>Search or enter address</small>';
  $('#pill').title = t.url ? `${t.title}\n${t.url}` : 'Search or enter address (Ctrl+L)';
  $('#star').classList.toggle('on', store.bookmarks.some((b) => b.url === t.url));
  $('#star').hidden = !web || !!t.error;
  $('#reader-btn').hidden = !(t.readerable || t.reader) || !!t.error;
  $('#reader-btn').classList.toggle('on', !!t.reader);
  const ui = (store.settings.translateTo || 'en').split('-')[0];
  $('#translate-btn').hidden = !web || !t.lang || t.lang.split('-')[0] === ui || /translate\.goog|translate\.google/.test(t.url);
  $('#translate-btn').title = `This page is in ${langName(t.lang)}. Translate to ${langName(ui)}`;
  $('#pip-btn').hidden = !t.video;
  $('#popup-btn').hidden = !t.popups;
  $('#popup-btn').title = `${t.popups} pop-up${t.popups === 1 ? '' : 's'} blocked`;
  $('#zoom-pill').hidden = t.zoom === 1;
  $('#zoom-pill').textContent = Math.round(t.zoom * 100) + '%';
  $('#zoom-pill').title = 'Reset zoom (Ctrl+0)';
  $('#blocked').textContent = store.settings.adblock && t.blocked ? (t.blocked > 99 ? '99+' : t.blocked) : '';
  $('#shield').classList.toggle('off', !store.settings.adblock);
  $('#shield').title = store.settings.adblock ? `Weber Shield: ${t.blocked} ads and trackers blocked on this page` : 'Weber Shield: ad and tracker blocking is off';
  document.title = t.url && t.title ? `${t.title} - Weber${S.private ? ' (Private)' : ''}` : S.private ? 'Weber · Private' : 'Weber';
}
// the address bar shows the site boldly and the rest of the address dimmed
function prettyUrl(u) {
  try {
    const x = new URL(u);
    if (!/^https?:/.test(x.protocol)) return esc(u);
    const rest = (x.pathname === '/' ? '' : x.pathname) + x.search;
    return `<b>${esc(x.hostname.replace(/^www\./, ''))}</b><span class="rest">${esc(rest)}</span>`;
  } catch {
    return esc(u);
  }
}
const LANGS = { en: 'English', es: 'Spanish', fr: 'French', de: 'German', it: 'Italian', pt: 'Portuguese', nl: 'Dutch', ru: 'Russian', ja: 'Japanese', ko: 'Korean', zh: 'Chinese', ar: 'Arabic', hi: 'Hindi', te: 'Telugu', ta: 'Tamil', tr: 'Turkish', pl: 'Polish', uk: 'Ukrainian', sv: 'Swedish', vi: 'Vietnamese', id: 'Indonesian', th: 'Thai', he: 'Hebrew', el: 'Greek', cs: 'Czech', fa: 'Persian', bn: 'Bengali', ur: 'Urdu', mr: 'Marathi', kn: 'Kannada', ml: 'Malayalam', gu: 'Gujarati' };
const langName = (l) => LANGS[(l || '').split('-')[0]] ?? (l || 'another language');

async function toggleBookmark() {
  const t = cur();
  if (!t || !/^https?:/.test(t.url)) return;
  const had = store.bookmarks.some((b) => b.url === t.url);
  store.bookmarks = await A.bookmarkToggle(t.url, t.title, t.favicon);
  toast(had ? 'Removed from favorites' : 'Added to favorites');
  renderToolbar();
  renderBookmarksBar();
  if (panel === 'bookmarks') renderPanel();
}

// ---------- bookmarks bar ----------
function renderBookmarksBar() {
  const bar = $('#bmbar');
  if (!store.settings.bookmarksBar) return;
  const top = store.bookmarks.filter((b) => !b.folder);
  const folders = [...new Set(store.bookmarks.filter((b) => b.folder).map((b) => b.folder.split('/')[0]))];
  bar.innerHTML =
    folders.map((f) => `<button class="bm folder" data-folder="${esc(f)}" title="${esc(f)}">${icon('folder', 15)}<span>${esc(f)}</span></button>`).join('') +
    top.map((b) => `<button class="bm" data-url="${esc(b.url)}" title="${esc(b.title)}\n${esc(b.url)}">${favImg(b.url, b.favicon, (b.title || host(b.url))[0]?.toUpperCase())}<span>${esc(b.title || host(b.url))}</span></button>`).join('') +
    (store.bookmarks.length ? '' : '<span class="bm-empty">Press Ctrl+D to keep a page here. Import from Chrome or Edge in Favorites.</span>') +
    `<button class="bm manage" id="bm-manage" title="Manage favorites (Ctrl+Shift+O)">${icon('bookmarks', 15)}</button>`;
  for (const el of bar.querySelectorAll('[data-url]')) {
    el.onclick = (e) => (e.ctrlKey ? A.newTab(el.dataset.url) : A.navigate(el.dataset.url));
    el.onauxclick = (e) => e.button === 1 && A.newTab(el.dataset.url);
  }
  for (const el of bar.querySelectorAll('[data-folder]')) el.onclick = () => A.bookmarkFolderMenu(el.dataset.folder);
  $('#bm-manage').onclick = () => openPanel('bookmarks');
}

// ---------- sidebar: web panels like Opera and Edge ----------
const SIDE_NAMES = { 'web.whatsapp.com': 'WhatsApp', 'www.messenger.com': 'Messenger', 'web.telegram.org': 'Telegram', 'open.spotify.com': 'Spotify', 'discord.com': 'Discord', 'x.com': 'X', 'music.youtube.com': 'YouTube Music', 'chatgpt.com': 'ChatGPT', 'claude.ai': 'Claude', 'outlook.live.com': 'Outlook', 'mail.google.com': 'Gmail', 'calendar.google.com': 'Calendar' };
const sideName = (u) => SIDE_NAMES[new URL(u).hostname] ?? host(u).split('.').slice(-2, -1)[0]?.replace(/^./, (c) => c.toUpperCase()) ?? host(u);
function renderRail() {
  const rail = $('#rail');
  if (!store.settings.sidebar) return;
  const sites = store.settings.sidebarSites ?? [];
  rail.innerHTML =
    `<div class="rail-list">${sites
      .map((u) => `<button class="rail-btn${S.side === u ? ' on' : ''}" data-url="${esc(u)}" title="${esc(sideName(u))}">${favImg(u, null, sideName(u)[0])}</button>`)
      .join('')}</div>
    <button class="rail-btn add" id="rail-add-site" title="Add this site to the sidebar">${icon('plus', 18)}</button>
    <span class="rail-sep"></span>
    <button class="rail-btn tool" data-p="bookmarks" title="Favorites">${icon('bookmarks', 18)}</button>
    <button class="rail-btn tool" data-p="history" title="History">${icon('history', 18)}</button>
    <button class="rail-btn tool" data-p="passwords" title="Passwords">${icon('key', 18)}</button>`;
  for (const el of rail.querySelectorAll('[data-url]')) {
    el.onclick = () => A.sideOpen(el.dataset.url);
    el.oncontextmenu = async (e) => {
      e.preventDefault();
      if (confirm(`Remove ${sideName(el.dataset.url)} from the sidebar?`)) setSetting({ sidebarSites: sites.filter((u) => u !== el.dataset.url) });
    };
  }
  for (const el of rail.querySelectorAll('[data-p]')) el.onclick = () => togglePanel(el.dataset.p);
  $('#rail-add-site').onclick = () => {
    const t = cur();
    if (!t?.url?.startsWith('https:')) return toast('Open a secure (https) site first, then add it here');
    const u = origin(t.url) + '/';
    if (sites.includes(u)) return toast('Already in the sidebar');
    setSetting({ sidebarSites: [...sites, u] });
    toast(`Added ${sideName(u)} to the sidebar`);
  };
  // the panel's own header
  const head = $('#side .side-head');
  if (S.side) {
    head.innerHTML = `${favImg(S.side, null, sideName(S.side)[0])}<b>${esc(sideName(S.side))}</b>
      <button class="icon small" data-s="home" title="Back to start">${icon('home', 15)}</button>
      <button class="icon small" data-s="reload" title="Reload">${icon('reload', 15)}</button>
      <button class="icon small" data-s="tab" title="Open in a tab">${icon('open', 15)}</button>
      <button class="icon small" data-s="close" title="Close panel">${icon('x', 15)}</button>`;
    head.onclick = (e) => {
      const a = e.target.closest('button')?.dataset.s;
      if (a === 'home') A.sideHome();
      if (a === 'reload') A.sideReload();
      if (a === 'tab') (A.newTab(S.side), A.sideClose());
      if (a === 'close') A.sideClose();
    };
  }
}

// ---------- command bar: the address pill grows into it ----------
// The page is swapped for a screenshot while it's open, so it can draw on top.
const address = $('#address');
let suggestions = [];
let pick = -1;
async function openCommand() {
  const t = cur();
  address.value = t?.url ?? '';
  suggestions = [];
  renderSuggest();
  showShot(await A.freeze(true));
  $('#cmd').hidden = false;
  address.focus();
  address.select();
}
function closeCommand(focusPage = true) {
  if ($('#cmd').hidden) return;
  $('#cmd').hidden = true;
  A.freeze(false).then(() => showShot(null));
  if (focusPage) A.focusPage();
}
$('#cmd').onmousedown = (e) => e.target.id === 'cmd' && closeCommand();
// History and bookmarks show at once; what people search for drops in underneath when the engine answers.
let asked = 0;
address.addEventListener('input', async () => {
  const q = address.value, n = ++asked;
  const found = await A.suggest(q);
  if (n !== asked) return;
  suggestions = q.trim() ? [{ search: q.trim() }, ...found.slice(0, 4)] : [];
  pick = 0;
  renderSuggest();
  if (!q.trim()) return;
  const queries = await A.queries(q);
  if (n !== asked || !queries.length) return;
  suggestions = [{ search: q.trim() }, ...queries.map((x) => ({ search: x, query: true })), ...found.slice(0, 4)];
  renderSuggest();
});
address.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    if (!suggestions.length) return;
    e.preventDefault();
    pick = (pick + (e.key === 'ArrowDown' ? 1 : -1) + suggestions.length) % suggestions.length;
    renderSuggest();
  } else if (e.key === 'Enter') {
    const s = suggestions[pick];
    if (s?.tab) return closeCommand(false), A.activate(s.tab);
    go(s && !s.search ? s.url : address.value, e.altKey);
  } else if (e.key === 'Escape') closeCommand();
});
function go(target, newTab) {
  if (!String(target).trim()) return;
  closeCommand(false);
  if (newTab) A.newTab(target);
  else A.navigate(target);
  A.focusPage();
}
// Rows that were already showing stay put; new ones drop in one after another, and the box eases to its new height.
function renderSuggest() {
  const box = $('#suggest');
  const before = new Set([...box.children].map((el) => el.dataset.k));
  const from = box.getBoundingClientRect().height;
  let fresh = 0;
  box.innerHTML = suggestions
    .map((s, i) => {
      const k = s.search ? `s:${s.search.toLowerCase()}` : `u:${s.url}`;
      const drop = before.has(k) ? '' : ` drop" style="--d:${fresh++ * 35}ms`;
      if (s.search) return `<div class="sg${i === pick ? ' on' : ''}${drop}" data-i="${i}" data-k="${esc(k)}">${icon('search', 16)}<span class="t">${esc(s.search)}</span><span class="u">${s.query ? '' : 'Search the web'}</span></div>`;
      if (s.tab) return `<div class="sg${i === pick ? ' on' : ''}${drop}" data-i="${i}" data-k="${esc(k)}">${icon('tabs', 16)}<span class="t">${esc(s.title)}</span><span class="u">${esc(host(s.url))}</span><span class="sw">Switch to tab ${icon('arrow', 13)}</span></div>`;
      return `<div class="sg${i === pick ? ' on' : ''}${drop}" data-i="${i}" data-k="${esc(k)}">${icon(s.bookmark ? 'star' : 'history', 16)}<span class="t">${esc(s.title)}</span><span class="u">${esc(s.url)}</span></div>`;
    })
    .join('');
  const to = box.getBoundingClientRect().height;
  if (from !== to && !$('#cmd').hidden) box.animate([{ height: `${from}px` }, { height: `${to}px` }], { duration: 220, easing: 'cubic-bezier(.2, .9, .3, 1)' });
  for (const el of box.children)
    el.onmousedown = (e) => {
      e.preventDefault();
      const s = suggestions[Number(el.dataset.i)];
      if (s.tab) return closeCommand(false), A.activate(s.tab);
      go(s.search ?? s.url, e.ctrlKey);
    };
}

// ---------- split view: the divider in the gap between the two pages, and a ring around the focused one ----------
function splitPanes() {
  const r = $('#stage').getBoundingClientRect(), gap = S.splitGap || 14;
  const lw = Math.round((r.width - gap) * S.split.ratio);
  return { r, gap, left: { x: r.left, w: lw }, right: { x: r.left + lw + gap, w: r.width - lw - gap } };
}
function renderSplit() {
  const on = !!S.split && !S.fullscreen;
  document.body.classList.toggle('split', on);
  $('#split-bar').hidden = $('#split-ring').hidden = !on;
  if (!on) return;
  const p = splitPanes(), side = S.active === S.split.right ? p.right : p.left;
  Object.assign($('#split-bar').style, { left: `${p.left.x + p.left.w}px`, top: `${p.r.top}px`, width: `${p.gap}px`, height: `${p.r.height}px` });
  Object.assign($('#split-ring').style, { left: `${side.x - 2}px`, top: `${p.r.top - 2}px`, width: `${side.w + 4}px`, height: `${p.r.height + 4}px` });
}
addEventListener('resize', () => S.split && renderSplit());
$('#split-bar').innerHTML = `<button data-s="wider" title="Make the left side bigger">›</button><button data-s="swap" title="Swap sides">⇄</button><button data-s="close" title="Close split view (Ctrl+Shift+S)">✕</button><button data-s="narrower" title="Make the right side bigger">‹</button>`;
$('#split-bar').onclick = (e) => {
  const a = e.target.closest('button')?.dataset.s;
  if (a === 'close') A.unsplit();
  else if (a === 'swap') A.splitSwap();
  else if (a === 'wider' || a === 'narrower') A.splitRatio(Math.round(((S.split?.ratio ?? 0.5) + (a === 'wider' ? 0.1 : -0.1)) * 10) / 10);
};
$('#split-bar').ondblclick = (e) => !e.target.closest('button') && A.splitRatio(0.5);

let shotOn = false;
function showShot(dataUrl) {
  shotOn = !!dataUrl;
  const stage = $('#stage');
  stage.classList.toggle('shot', shotOn);
  stage.style.backgroundImage = dataUrl ? `url(${dataUrl})` : '';
  // in split view the snapshot is only the focused side, so it goes back over that side
  if (dataUrl && S.split && !S.fullscreen) {
    const p = splitPanes(), side = S.active === S.split.right ? p.right : p.left;
    stage.style.backgroundSize = `${side.w}px 100%`;
    stage.style.backgroundPosition = `${side.x - p.r.left}px 0`;
  } else stage.style.backgroundSize = stage.style.backgroundPosition = '';
  if (shotOn) {
    stage.replaceChildren();
    stageKey = 'shot';
  } else renderStage(true);
}

// ---------- warning pages: dangerous sites, no secure connection, bad certificates, failed loads ----------
function renderWarning(stage, t) {
  const e = t.error;
  const h = esc(host(e.url));
  let html;
  if (e.kind === 'danger') {
    const phishing = e.threat === 'phishing';
    html = `<div class="warnpage danger"><div class="wp-card">
      <div class="wp-badge">${icon('alert', 34)}</div>
      <h1>${phishing ? 'Deceptive site ahead' : 'This site may harm your computer'}</h1>
      <p>Weber blocked <b>${h}</b> because it is on a public list of ${phishing ? 'phishing sites' : 'sites that spread malware'}.
      ${phishing ? 'Pages like this pretend to be a bank, an email provider or a shop to trick you into giving away passwords or card numbers.' : 'It may try to install programs that steal your information or damage your PC.'}</p>
      <div class="wp-actions"><button class="btn primary big" id="wp-back">Back to safety</button></div>
      <details><summary>Details</summary><p>Weber checks every address against the free <i>malware-filter</i> phishing and URLhaus lists, kept on this PC and refreshed twice a day. Your browsing is never sent anywhere to be checked.</p>
      <button class="link" id="wp-go">I understand the risk. Visit this unsafe site</button></details></div></div>`;
  } else if (e.kind === 'https') {
    html = `<div class="warnpage caution"><div class="wp-card">
      <div class="wp-badge">${icon('unlock', 34)}</div>
      <h1>No secure connection to ${h}</h1>
      <p>Weber tried to open this site over HTTPS, but it doesn’t offer a secure version. If you continue, anyone on your network could see or change what you send and receive here, including passwords.</p>
      <div class="wp-actions"><button class="btn primary big" id="wp-back">Go back</button><button class="btn big" id="wp-go">Continue to the HTTP site</button></div>
      <p class="fine">Weber always upgrades sites to HTTPS. You can turn this off in Settings › Privacy and security.</p></div></div>`;
  } else if (e.kind === 'cert') {
    const c = e.cert;
    html = `<div class="warnpage danger"><div class="wp-card">
      <div class="wp-badge">${icon('alert', 34)}</div>
      <h1>Your connection isn’t private</h1>
      <p>Someone may be trying to steal your information from <b>${h}</b> (for example passwords, messages or credit cards). The site’s security certificate couldn’t be trusted.</p>
      <div class="wp-actions"><button class="btn primary big" id="wp-back">Back to safety</button></div>
      <details><summary>Advanced</summary><p><code>${esc(c?.error || e.desc || '')}</code>${c ? `<br>Issued by ${esc(c.issuer)} to ${esc(c.subject)}` : ''}</p>
      ${c?.fingerprint ? `<button class="link" id="wp-go">Proceed to ${h} (unsafe)</button>` : ''}</details></div></div>`;
  } else {
    html = `<div class="error"><div><div class="big">${icon('globe', 56)}</div><h1>This page couldn’t load</h1><p>${h} didn’t respond. Check the address or your connection.</p><button class="btn primary" id="wp-retry">Try again</button><p></p><code>${esc(e.desc ?? '')} (${esc(e.code ?? '')})</code></div></div>`;
  }
  stage.innerHTML = html;
  $('#wp-back')?.addEventListener('click', () => A.goBackSafely());
  $('#wp-go')?.addEventListener('click', () => A.proceed(e.kind));
  $('#wp-retry')?.addEventListener('click', () => A.navigate(e.url));
}

// ---------- reading mode ----------
const SAFE_TAGS = new Set(['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'PRE', 'CODE', 'EM', 'STRONG', 'B', 'I', 'U', 'S', 'SUB', 'SUP', 'A', 'IMG', 'FIGURE', 'FIGCAPTION', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TD', 'TH', 'BR', 'HR', 'SPAN', 'DIV', 'SECTION', 'ARTICLE', 'PICTURE', 'DL', 'DT', 'DD', 'MARK', 'SMALL', 'TIME', 'ABBR', 'CITE', 'Q']);
/** Only plain article markup survives: no scripts, styles, frames, forms or event handlers. */
function sanitize(html, base) {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const walk = (el) => {
    for (const c of [...el.children]) {
      if (!SAFE_TAGS.has(c.tagName)) {
        if (['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'FORM', 'INPUT', 'BUTTON', 'SVG', 'MATH', 'TEMPLATE', 'NOSCRIPT', 'LINK', 'META'].includes(c.tagName)) c.remove();
        else {
          walk(c);
          c.replaceWith(...c.childNodes);
        }
        continue;
      }
      for (const a of [...c.attributes]) {
        const keep = (a.name === 'href' && c.tagName === 'A') || ((a.name === 'src' || a.name === 'alt') && c.tagName === 'IMG') || a.name === 'title' || ((a.name === 'colspan' || a.name === 'rowspan') && /^T[DH]$/.test(c.tagName));
        if (!keep) c.removeAttribute(a.name);
      }
      if (c.tagName === 'A') {
        try {
          const u = new URL(c.getAttribute('href') ?? '', base);
          if (/^https?:$/.test(u.protocol)) c.setAttribute('href', u.href);
          else c.removeAttribute('href');
        } catch {
          c.removeAttribute('href');
        }
      }
      if (c.tagName === 'IMG') {
        try {
          const u = new URL(c.getAttribute('src') ?? '', base);
          if (/^https?:$/.test(u.protocol)) c.setAttribute('src', u.href);
          else c.remove();
        } catch {
          c.remove();
        }
      }
      walk(c);
    }
  };
  const root = doc.body.firstElementChild;
  walk(root);
  return root.innerHTML;
}
async function renderReader(stage, t, key) {
  const a = await A.readerCurrent();
  if (stageKey !== key || !a) return;
  const s = store.settings;
  const mins = Math.max(1, Math.round((a.length || 0) / 1100));
  stage.innerHTML = `<div class="reader" data-rtheme="${esc(s.readerTheme || 'dark')}" data-rfont="${esc(s.readerFont || 'serif')}" style="--rsize:${Number(s.readerSize) || 20}px">
    <div class="r-tools">
      <div class="seg mini">${['serif', 'sans'].map((f) => `<button data-rf="${f}" class="${(s.readerFont || 'serif') === f ? 'on' : ''}">${f === 'serif' ? 'Serif' : 'Sans'}</button>`).join('')}</div>
      <div class="seg mini"><button data-rs="-1" title="Smaller">A−</button><button data-rs="1" title="Bigger">A+</button></div>
      <div class="seg mini themes">${['light', 'sepia', 'dark'].map((th) => `<button data-rt="${th}" class="sw-${th}${(s.readerTheme || 'dark') === th ? ' on' : ''}" title="${th}"></button>`).join('')}</div>
      <button class="btn" id="r-close">${icon('x', 14)} Close reading mode</button>
    </div>
    <article>
      <p class="r-site">${esc(a.siteName || host(a.url))} · ${mins} min read</p>
      <h1>${esc(a.title || t.title)}</h1>
      ${a.byline ? `<p class="r-by">${esc(a.byline)}</p>` : ''}
      <div class="r-body">${sanitize(a.content, a.url)}</div>
    </article></div>`;
  stage.scrollTop = 0;
  stage.querySelectorAll('[data-rf]').forEach((b) => (b.onclick = () => setSetting({ readerFont: b.dataset.rf })));
  stage.querySelectorAll('[data-rt]').forEach((b) => (b.onclick = () => setSetting({ readerTheme: b.dataset.rt })));
  stage.querySelectorAll('[data-rs]').forEach((b) => (b.onclick = () => setSetting({ readerSize: Math.min(30, Math.max(15, (Number(s.readerSize) || 20) + Number(b.dataset.rs) * 2)) })));
  $('#r-close').onclick = async () => showReaderResult(await A.reader());
  stage.querySelectorAll('.r-body a[href]').forEach((el) =>
    el.addEventListener('click', (e) => {
      e.preventDefault();
      if (e.ctrlKey) A.newTab(el.href);
      else A.navigate(el.href);
    }),
  );
}
function showReaderResult(a) {
  if (a?.error) toast(a.error);
}

let stageKey = '';
const ENGINE_NAMES = { bing: 'Bing', google: 'Google', duckduckgo: 'DuckDuckGo', brave: 'Brave' };
const SCOPES = [['web', 'Web', 'globe'], ['images', 'Images', 'image'], ['videos', 'Videos', 'play'], ['news', 'News', 'news'], ['maps', 'Maps', 'pin']];
let scope = 'web';
const q = encodeURIComponent;
const SCOPE_URLS = {
  bing: { images: (v) => `https://www.bing.com/images/search?q=${q(v)}`, videos: (v) => `https://www.bing.com/videos/search?q=${q(v)}`, news: (v) => `https://www.bing.com/news/search?q=${q(v)}`, maps: (v) => `https://www.bing.com/maps?q=${q(v)}` },
  google: { images: (v) => `https://www.google.com/search?tbm=isch&q=${q(v)}`, videos: (v) => `https://www.google.com/search?tbm=vid&q=${q(v)}`, news: (v) => `https://www.google.com/search?tbm=nws&q=${q(v)}`, maps: (v) => `https://www.google.com/maps/search/${q(v)}` },
  duckduckgo: { images: (v) => `https://duckduckgo.com/?ia=images&iax=images&q=${q(v)}`, videos: (v) => `https://duckduckgo.com/?ia=videos&iax=videos&q=${q(v)}`, news: (v) => `https://duckduckgo.com/?ia=news&iar=news&q=${q(v)}`, maps: (v) => `https://duckduckgo.com/?iaxm=maps&q=${q(v)}` },
  brave: { images: (v) => `https://search.brave.com/images?q=${q(v)}`, videos: (v) => `https://search.brave.com/videos?q=${q(v)}`, news: (v) => `https://search.brave.com/news?q=${q(v)}`, maps: (v) => `https://www.bing.com/maps?q=${q(v)}` },
};
/** Addresses always open directly; words go to the chosen engine and scope. */
function searchScoped(v) {
  const looksLikeAddress = !/\s/.test(v) && (/^https?:\/\//i.test(v) || /^[\w-]+(\.[\w-]+)+(:\d+)?([/?#]\S*)?$/.test(v) || /^localhost/i.test(v));
  const build = SCOPE_URLS[store.settings.engine ?? 'bing']?.[scope];
  A.navigate(looksLikeAddress || scope === 'web' || !build ? v : build(v));
}

async function renderStage(force) {
  if (shotOn) return;
  const t = cur();
  const stage = $('#stage');
  const key = !t ? '' : t.error ? 'err:' + t.id + (t.error.kind ?? '') + t.error.url : t.reader ? 'reader:' + t.id + t.url : !t.url ? 'ntp:' + t.id : 'page';
  if (key === stageKey && !force) return;
  stageKey = key;
  stage.classList.toggle('reading', key.startsWith('reader:'));
  if (key === 'page' || !t) return stage.replaceChildren();
  if (t.error) return renderWarning(stage, t);
  if (t.reader) return renderReader(stage, t, key);
  const [top, data, recent] = await Promise.all([A.topSites(), A.ntpData().catch(() => ({ news: [] })), A.recent().catch(() => [])]);
  if (stageKey !== key) return; // switched tabs while loading
  // favorites first, then the sites you visit most, one tile per site
  const apps = [];
  const seen = new Set();
  const site = (u) => host(u).split('.').slice(-2).join('.');
  for (const s of [...store.bookmarks.map((b) => ({ url: b.url, title: b.title, favicon: b.favicon })), ...top]) {
    if (seen.has(site(s.url))) continue;
    seen.add(site(s.url));
    apps.push(s);
    if (apps.length >= 7) break;
  }
  const label = (s) => {
    const name = site(s.url).split('.')[0];
    const t = (s.title || '').split(/\s[-|·:–—]\s/)[0].trim();
    if (t && t.length <= 18 && t.replace(/\s/g, '').toLowerCase() === name) return t;
    return name.charAt(0).toUpperCase() + name.slice(1);
  };
  const stories = data.news ?? [];
  const w = data.weather;
  const rate = data.rate;
  const video = data.video;
  const ago = (t) => {
    if (!t) return '';
    const m = Math.round((Date.now() - t) / 60000);
    return m < 2 ? 'Just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} hr ago` : `${Math.round(m / 1440)} days ago`;
  };
  const TOPIC_COLOR = { Movies: '#ff6b8b', Games: '#9b85ff', Science: '#3fe0b0', Tech: '#5cbcff' };
  const topic = (n) => `<span class="h-topic" style="--t:${TOPIC_COLOR[n.topic] ?? '#aaa'}">${esc(n.topic)}</span>`;
  const img = (src, cls) => (src ? `<span class="${cls}" style="background-image:url('${esc(src)}')"></span>` : `<span class="${cls} none">${icon('news', 22)}</span>`);

  // lead story, a column of headlines beside it, the rest as cards below
  const lead = stories[0];
  const side = stories.slice(1, 5);
  const rest = stories.slice(5, 14);

  // exchange-rate sparkline
  let spark = '';
  if (rate?.series?.length > 2) {
    const vs = rate.series.map((p) => p.v);
    const lo = Math.min(...vs), hi = Math.max(...vs), W = 300, H = 90;
    const pts = vs.map((v, i) => [(i / (vs.length - 1)) * W, H - 6 - ((v - lo) / (hi - lo || 1)) * (H - 12)]);
    const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
    spark = `<svg class="h-spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><defs><linearGradient id="hsf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity=".3"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs><path d="${d} L${W},${H} L0,${H} Z" fill="url(#hsf)"/><path d="${d}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>`;
  }
  const change = rate?.first ? ((rate.latest / rate.first - 1) * 100).toFixed(2) : null;
  const wKind = (code, day = true) => (code === 0 ? (day ? 'sun' : 'moon') : code <= 3 ? 'cloudsun' : code >= 95 ? 'storm' : code >= 51 ? 'rain' : 'cloud');
  const days = (w?.days ?? []).slice(1, 6);
  const dayName = (d) => new Date(d + 'T12:00').toLocaleDateString([], { weekday: 'short' });
  const c = clockParts(new Date());

  stage.innerHTML = `<div class="ntp4">
      <div class="h-main">
        <header class="h-hero">
          <p class="h-greet" id="ntp-greet">${c.greet}</p>
          <h1 class="h-clock" id="ntp-clock">${c.time}<small>${c.ampm}</small></h1>
          <p class="h-date" id="ntp-date">${c.date}</p>
        </header>
        <form class="h-search" id="ntp-form">
          <div class="h-field">
            <span class="h-s-ico">${icon('search', 20)}</span>
            <input id="ntp-search" placeholder="Search the web or type an address" spellcheck="false" autocomplete="off" />
            <button type="button" class="h-engine" id="engine" title="Change search engine"><i class="e-dot e-${esc(store.settings.engine ?? 'bing')}"></i>${ENGINE_NAMES[store.settings.engine] ?? 'Bing'}</button>
            <button type="submit" class="h-go" title="Search">${icon('arrow', 18)}</button>
          </div>
          <div class="h-scopes">${SCOPES.map(([k, l, ic]) => `<button type="button" class="h-scope${k === scope ? ' on' : ''}" data-scope="${k}">${icon(ic, 14)}${l}</button>`).join('')}</div>
        </form>

        <section class="h-sec">
          <h2 class="h-h">Quick access</h2>
          <nav class="h-quick" aria-label="Quick access">
            ${apps.map((s) => `<button class="h-tile" data-url="${esc(s.url)}" title="${esc(s.url)}"><span class="h-tile-ico">${favImg(s.url, s.favicon, label(s)[0])}</span><span class="h-tile-lbl">${esc(label(s))}</span></button>`).join('')}
            <button class="h-tile add" id="rail-add" title="Manage favorites"><span class="h-tile-ico">${icon('plus', 20)}</span><span class="h-tile-lbl">Add site</span></button>
          </nav>
        </section>

        ${recent.length ? `<section class="h-sec">
          <h2 class="h-h">Jump back in</h2>
          <div class="h-recent">${recent.map((r) => `<button class="h-rc" data-url="${esc(r.url)}" title="${esc(r.url)}"><span class="h-rc-top"><span class="h-rc-ico">${favImg(r.url, r.favicon, (host(r.url)[0] ?? '').toUpperCase())}</span><small>${esc(host(r.url).replace(/^www\./, ''))}</small></span><b>${esc(r.title || r.url)}</b><small class="h-rc-ago">${icon('history', 13)}${ago(r.at)}</small></button>`).join('')}</div>
        </section>` : ''}

        <section class="h-sec">
          <h2 class="h-h">Today</h2>
          ${lead ? `<div class="h-today">
            <button class="h-lead" data-url="${esc(lead.url)}" title="${esc(lead.title)}">${img(lead.image, 'h-lead-img')}<span class="h-lead-body">${topic(lead)}<b>${esc(lead.title)}</b><small>${esc(lead.source)} · ${ago(lead.at)}</small></span></button>
            <div class="h-list">${side.map((n) => `<button class="h-li" data-url="${esc(n.url)}" title="${esc(n.title)}">${img(n.image, 'h-li-img')}<span>${topic(n)}<b>${esc(n.title)}</b><small>${esc(n.source)} · ${ago(n.at)}</small></span></button>`).join('')}</div>
          </div>` : `<div class="h-empty">${icon('news', 22)}<b>Stories will appear here</b><small>Check your connection</small></div>`}
        </section>

        ${rest.length ? `<section class="h-sec">
          <h2 class="h-h">More to read</h2>
          <div class="h-cards">${rest.map((n) => `<button class="h-card" data-url="${esc(n.url)}" title="${esc(n.title)}">${img(n.image, 'h-card-img')}<span class="h-card-body">${topic(n)}<b>${esc(n.title)}</b><small>${esc(n.source)} · ${ago(n.at)}</small></span></button>`).join('')}</div>
        </section>` : ''}
      </div>

      <aside class="h-aside">
        <button class="h-w h-wx" id="w-weather" title="Weather for ${esc(w?.city ?? 'your city')} (change the city in Settings)">
          <span class="h-w-head"><span>${icon('pin', 13)}${esc(w?.city ?? 'Weather')}</span><small>${w ? `H ${w.high}° · L ${w.low}°` : ''}</small></span>
          <span class="h-wx-now"><b>${w ? `${w.temp}°` : '—'}</b><span class="h-wx-ico">${wicon(w ? wKind(w.code, w.day) : 'cloud')}</span></span>
          <span class="h-wx-text">${w ? esc(w.text) : 'Unavailable right now'}${w ? `<small>Humidity ${w.humidity}% · Wind ${w.wind} km/h</small>` : ''}</span>
          ${days.length ? `<span class="h-wx-days">${days.map((d) => `<span><small>${dayName(d.day)}</small>${wicon(wKind(d.code))}<b>${d.high}°</b><i>${d.low}°</i></span>`).join('')}</span>` : ''}
        </button>
        <div class="h-w h-rate" title="US dollar to ${esc(rate?.to ?? 'EUR')}, last month">
          <span class="h-w-head"><span>USD → ${esc(rate?.to ?? 'EUR')}</span><small class="${change && change < 0 ? 'down' : 'up'}">${change !== null ? (change > 0 ? '+' : '') + change + '%' : ''}</small></span>
          <b class="h-rate-val">${rate?.latest ? rate.latest.toFixed(4) : '—'}</b>
          <small class="h-rate-sub">Past 30 days</small>
          ${spark}
        </div>
        ${video ? `<button class="h-w h-video" data-url="${esc(video.url)}" title="${esc(video.title)}">
          <span class="h-w-head"><span>${icon('play', 13)}Continue watching</span><small>${ago(video.at)}</small></span>
          <span class="h-video-img" style="background-image:url('${esc(video.image)}')"><i>${icon('play', 20)}</i></span>
          <b>${esc(video.title)}</b>
        </button>` : ''}
      </aside>
    </div>`;

  $('#engine').onclick = () => {
    const order = ['bing', 'google', 'duckduckgo', 'brave'];
    setSetting({ engine: order[(order.indexOf(store.settings.engine) + 1) % order.length] });
  };
  stage.querySelectorAll('.h-scope').forEach(
    (b) =>
      (b.onclick = () => {
        scope = b.dataset.scope;
        stage.querySelectorAll('.h-scope').forEach((x) => x.classList.toggle('on', x.dataset.scope === scope));
        const v = $('#ntp-search').value.trim();
        if (v) searchScoped(v);
        else $('#ntp-search').focus();
      }),
  );
  $('#ntp-form').onsubmit = (e) => {
    e.preventDefault();
    const v = $('#ntp-search').value.trim();
    if (v) searchScoped(v);
  };
  $('#rail-add').onclick = () => openPanel('bookmarks');
  $('#w-weather').onclick = () => openPanel('settings');
  for (const el of stage.querySelectorAll('[data-url]')) {
    el.onclick = (e) => (e.ctrlKey ? A.newTab(el.dataset.url) : A.navigate(el.dataset.url));
    el.onauxclick = (e) => e.button === 1 && A.newTab(el.dataset.url);
  }
  if ($('#cmd').hidden) $('#ntp-search').focus();
}

function clockParts(d) {
  const h = d.getHours();
  const parts = new Intl.DateTimeFormat([], { hour: 'numeric', minute: '2-digit' }).formatToParts(d);
  const time = parts.filter((p) => p.type !== 'dayPeriod').map((p) => p.value).join('').trim();
  const ampm = parts.find((p) => p.type === 'dayPeriod')?.value ?? '';
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone.split('/').pop().replace(/_/g, ' ');
  return {
    greet: h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening',
    time,
    ampm,
    date: `${d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })} · ${zone}`,
  };
}
function wicon(kind) {
  const p = {
    sun: '<circle cx="12" cy="12" r="4.5"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
    moon: '<path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z"/>',
    cloud: '<path d="M7 18h10a4 4 0 0 0 .5-8A5.5 5.5 0 0 0 7 9a4.5 4.5 0 0 0 0 9z"/>',
    cloudsun: '<path d="M8 7.5V6M4.5 9H3M5.4 5.4l1 1M11.6 5.4l-1 1"/><path d="M5.6 11.5A3 3 0 0 1 11 9.6"/><path d="M9 19h8a3.5 3.5 0 0 0 .5-7 4.5 4.5 0 0 0-8.6 1A3 3 0 0 0 9 19z"/>',
    rain: '<path d="M7 15h10a4 4 0 0 0 .5-8A5.5 5.5 0 0 0 7 6a4.5 4.5 0 0 0 0 9z"/><path d="M9 18l-1 2.5M13 18l-1 2.5M17 18l-1 2.5"/>',
    storm: '<path d="M7 14h10a4 4 0 0 0 .5-8A5.5 5.5 0 0 0 7 5a4.5 4.5 0 0 0 0 9z"/><path d="M12.5 15l-2 3.5h3l-2 3.5"/>',
  }[kind];
  return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
}
function tick() {
  const clock = document.getElementById('ntp-clock');
  if (!clock) return;
  const c = clockParts(new Date());
  clock.innerHTML = `${c.time}<small>${c.ampm}</small>`;
  $('#ntp-date').textContent = c.date;
  $('#ntp-greet').textContent = c.greet;
}
setInterval(tick, 10_000);

// ---------- background: theme, colour, wallpaper, animated scene or your own file ----------
const BG_MODES = [['theme', 'Theme'], ['color', 'Color'], ['wallpaper', 'Wallpaper'], ['scene', 'Animated'], ['custom', 'Your own']];
// colours the animated scenes are tinted with, per theme
const SCENE_TINTS = {
  aurora: ['#7b6cf6', '#2f7de0', '#c084fc', '#22d3ee'],
  ocean: ['#2aa7c9', '#1b5fa8', '#5eead4', '#60a5fa'],
  ember: ['#f08a4b', '#c2410c', '#fbbf24', '#f43f5e'],
  forest: ['#5cb07a', '#2f6b3f', '#a3e635', '#34d399'],
  rose: ['#f07aa8', '#7c4ad6', '#fda4af', '#c084fc'],
  black: ['#6366f1', '#14b8a6', '#ec4899', '#f59e0b'],
};
let bgKey = '';
function applyBackground() {
  const s = store.settings;
  const mode = s.bgMode ?? 'theme';
  const wall = $('#wall');
  document.body.dataset.bg = mode;
  (SCENE_TINTS[s.theme] ?? SCENE_TINTS.aurora).forEach((c, i) => document.documentElement.style.setProperty(`--art-${i + 1}`, c));
  wall.style.setProperty('--dim', mode === 'theme' ? 0 : (s.bgDim ?? 25) / 100);
  const key = [mode, s.theme, s.bgColor, s.bgWallpaper, s.bgScene, s.bgFile?.url].join('|');
  if (key === bgKey) return;
  bgKey = key;
  wall.querySelectorAll('.bg-media, .bg-dim').forEach((e) => e.remove());
  stopScene();
  wall.style.background = mode === 'color' ? s.bgColor ?? '#14151c' : mode === 'theme' ? '' : '#000';
  let media = null;
  if (mode === 'wallpaper') {
    media = document.createElement('img');
    media.src = (WALLPAPERS.find((w) => w.id === s.bgWallpaper) ?? WALLPAPERS[0]).url;
  } else if (mode === 'custom' && s.bgFile?.url) {
    media = document.createElement(s.bgFile.video ? 'video' : 'img');
    media.src = s.bgFile.url;
    if (s.bgFile.video) Object.assign(media, { muted: true, loop: true, autoplay: true, playsInline: true });
  } else if (mode === 'scene') startScene(s.bgScene ?? 'aurora');
  if (media) {
    media.className = 'bg-media';
    wall.prepend(media);
  }
  wall.append(Object.assign(document.createElement('div'), { className: 'bg-dim' }));
}
function bgOptions(s) {
  const mode = s.bgMode ?? 'theme';
  if (mode === 'theme') return `<div class="bg-grid">${THEMES.map(([k, l]) => `<button class="bg-opt${s.theme === k ? ' on' : ''}" data-theme-pick="${k}"><span>${l}</span></button>`).join('')}</div>`;
  if (mode === 'color')
    return `<div class="color-row"><input type="color" id="bg-color" value="${esc(s.bgColor ?? '#14151c')}"><div class="swatches">${['#000000', '#14151c', '#1e1b4b', '#0c2a3a', '#2a0f1f', '#1f2a1a', '#3a2a12'].map((c) => `<button data-color="${c}" style="background:${c}" title="${c}"></button>`).join('')}</div></div>`;
  if (mode === 'wallpaper') return `<div class="bg-grid">${WALLPAPERS.map((w) => `<button class="bg-opt${s.bgWallpaper === w.id ? ' on' : ''}" data-wallpaper="${w.id}" style="background-image:url(&quot;${w.url}&quot;)"><span>${esc(w.name)}</span></button>`).join('')}</div>`;
  if (mode === 'scene') return `<div class="bg-grid">${Object.entries(SCENES).map(([k, sc]) => `<button class="bg-opt${s.bgScene === k ? ' on' : ''}" data-scene="${k}" style="background:${sc.preview}"><span>${esc(sc.name)}</span></button>`).join('')}</div>`;
  return `<div class="color-row"><button class="btn" id="bg-pick">${s.bgFile ? 'Choose a different file' : 'Choose image, GIF or video'}</button></div><p style="margin-top:8px">Your file is copied into Weber, so you can move or delete the original.</p>`;
}
function wireBackground(body, s) {
  body.querySelectorAll('[data-bgmode]').forEach((b) => (b.onclick = () => setSetting({ bgMode: b.dataset.bgmode })));
  body.querySelectorAll('[data-theme-pick]').forEach((b) => {
    document.body.dataset.theme = b.dataset.themePick;
    b.style.background = getComputedStyle(document.body).getPropertyValue('--wall');
    b.onclick = () => setSetting({ theme: b.dataset.themePick });
  });
  document.body.dataset.theme = s.theme ?? 'aurora';
  body.querySelectorAll('[data-wallpaper]').forEach((b) => (b.onclick = () => setSetting({ bgWallpaper: b.dataset.wallpaper })));
  body.querySelectorAll('[data-scene]').forEach((b) => (b.onclick = () => setSetting({ bgScene: b.dataset.scene })));
  body.querySelectorAll('[data-color]').forEach((b) => (b.onclick = () => setSetting({ bgColor: b.dataset.color })));
  const color = body.querySelector('#bg-color');
  if (color) color.onchange = () => setSetting({ bgColor: color.value });
  const dim = body.querySelector('#bg-dim');
  if (dim) {
    dim.oninput = () => $('#wall').style.setProperty('--dim', dim.value / 100);
    dim.onchange = () => A.settings({ bgDim: Number(dim.value) }).then((st) => (store.settings = st));
  }
  const pick = body.querySelector('#bg-pick');
  if (pick)
    pick.onclick = async () => {
      const f = await A.pickBackground();
      if (f) setSetting({ bgFile: f, bgMode: 'custom' });
    };
}

// ---------- side panel ----------
function togglePanel(name) {
  openPanel(panel === name ? null : name);
}
function openPanel(name) {
  panel = name;
  $('#panel').hidden = !panel;
  syncLayout();
  if (panel) renderPanel();
  if (name === 'downloads') $('#dl-dot').hidden = $('#dl-top-dot').hidden = true;
}
const PANELS = [['bookmarks', 'Favorites'], ['history', 'History'], ['downloads', 'Downloads'], ['passwords', 'Passwords'], ['settings', 'Settings']];
const THEMES = [['aurora', 'Aurora'], ['ocean', 'Ocean'], ['ember', 'Ember'], ['forest', 'Forest'], ['rose', 'Rose'], ['black', 'Black']];
const row = (url, title, sub, fav, actions = '') => `<div class="row" data-url="${esc(url)}">${favImg(url, fav)}<div class="txt"><b>${esc(title)}</b><small>${esc(sub)}</small></div>${actions}</div>`;
function wireRows(body) {
  body.querySelectorAll('.row[data-url]').forEach((r) => {
    r.onclick = (e) => !e.target.closest('button, input') && (e.ctrlKey ? A.newTab(r.dataset.url) : A.navigate(r.dataset.url));
    r.onauxclick = (e) => e.button === 1 && A.newTab(r.dataset.url);
  });
}
async function renderPanel() {
  const el = $('#panel');
  el.innerHTML = `<div class="ptabs">${PANELS.map(([k, l]) => `<button data-p="${k}" class="${k === panel ? 'on' : ''}">${l}</button>`).join('')}</div><div class="pbody"></div>`;
  for (const b of el.querySelectorAll('.ptabs button')) b.onclick = () => openPanel(b.dataset.p);
  const body = el.querySelector('.pbody');
  if (panel === 'bookmarks') renderFavorites(el, body);
  else if (panel === 'history') renderHistory(el, body);
  else if (panel === 'downloads') {
    renderDownloads(body);
    el.insertAdjacentHTML('beforeend', `<div class="pfoot"><button class="btn" id="dl-folder">${icon('folder', 14)} Open folder</button><button class="btn" id="clear-dl">Clear list</button></div>`);
    $('#dl-folder').onclick = () => A.openDownloadsFolder();
    $('#clear-dl').onclick = async () => {
      store.downloads = await A.downloadsClear();
      renderPanel();
    };
  } else if (panel === 'passwords') renderPasswords(body);
  else if (panel === 'settings') renderSettings(body);
}

// ----- favorites manager: folders, search, edit, import -----
let bmFilter = '';
let bmEditing = null;
async function renderFavorites(el, body) {
  const s = bmFilter.toLowerCase();
  const list = store.bookmarks.filter((b) => !s || b.title.toLowerCase().includes(s) || b.url.toLowerCase().includes(s) || (b.folder || '').toLowerCase().includes(s));
  const folders = [...new Set(store.bookmarks.map((b) => b.folder || ''))].sort((a, b) => (a === '' ? -1 : b === '' ? 1 : a.localeCompare(b)));
  const byFolder = new Map();
  for (const b of list) (byFolder.get(b.folder || '') ?? byFolder.set(b.folder || '', []).get(b.folder || '')).push(b);
  const item = (b) =>
    bmEditing === b.url
      ? `<div class="row editing" data-edit="${esc(b.url)}"><div class="txt"><input class="field" data-f="title" value="${esc(b.title)}" placeholder="Name"><input class="field" data-f="url" value="${esc(b.url)}" placeholder="Address"><input class="field" data-f="folder" list="bm-folders" value="${esc(b.folder || '')}" placeholder="Folder (empty = favorites bar)"><div class="row-actions"><button class="btn" data-a="cancel">Cancel</button><button class="btn primary" data-a="save">Save</button></div></div></div>`
      : row(b.url, b.title, host(b.url), b.favicon, `<button class="icon" data-a="edit" title="Edit">${icon('edit', 15)}</button><button class="icon" data-a="del" title="Delete">${icon('trash', 15)}</button>`);
  body.innerHTML = `<input class="filter" id="bm-filter" placeholder="Search favorites" spellcheck="false" value="${esc(bmFilter)}">
    <datalist id="bm-folders">${folders.filter(Boolean).map((f) => `<option value="${esc(f)}">`).join('')}</datalist>
    ${
      list.length
        ? [...byFolder.keys()]
            .sort((a, b) => (a === '' ? -1 : b === '' ? 1 : a.localeCompare(b)))
            .map((f) => `<div class="day">${icon(f ? 'folder' : 'star', 13)} ${esc(f || 'Favorites bar')} <span>${byFolder.get(f).length}</span></div>${byFolder.get(f).map(item).join('')}`)
            .join('')
        : `<div class="empty">${store.bookmarks.length ? 'No favorites match.' : 'No favorites yet.<br>Press Ctrl+D or the star on any page.'}</div>`
    }`;
  const f = $('#bm-filter');
  f.oninput = () => {
    bmFilter = f.value;
    renderFavorites(el, body).then(() => {
      const nf = $('#bm-filter');
      nf.focus();
      nf.setSelectionRange(nf.value.length, nf.value.length);
    });
  };
  body.querySelectorAll('.row [data-a]').forEach((btn) => {
    btn.onclick = async () => {
      const r = btn.closest('.row');
      const url = r.dataset.url ?? r.dataset.edit;
      const a = btn.dataset.a;
      if (a === 'del') store.bookmarks = await A.bookmarkRemove(url);
      if (a === 'edit') bmEditing = url;
      if (a === 'cancel') bmEditing = null;
      if (a === 'save') {
        const v = (k) => r.querySelector(`[data-f="${k}"]`).value;
        store.bookmarks = await A.bookmarkUpdate(url, { title: v('title'), url: v('url'), folder: v('folder') });
        bmEditing = null;
      }
      renderToolbar();
      renderBookmarksBar();
      renderFavorites(el, body);
    };
  });
  wireRows(body);
  if (!el.querySelector('.pfoot')) {
    el.insertAdjacentHTML('beforeend', `<div class="pfoot"><button class="btn" id="bm-import">${icon('import', 14)} Import from another browser</button></div>`);
    $('#bm-import').onclick = () => openImport();
  }
}
async function openImport() {
  const sources = await A.importSources();
  openSheet(
    `<h3>Import favorites</h3><p class="sub">Copies bookmarks from another browser on this PC. Nothing is synced or sent anywhere, and passwords and cookies aren’t touched.</p>
    ${sources.length ? `<div class="pick-list">${sources.map((s) => `<button class="pick" data-src="${esc(s.id)}"><b>${esc(s.browser)}</b><small>${esc(s.profile)}</small>${icon('arrow', 15)}</button>`).join('')}</div>` : '<div class="empty">No Chrome, Edge or Brave bookmarks were found on this PC.</div>'}
    <div class="sheet-foot"><button class="btn" data-close>Close</button></div>`,
    (box) => {
      box.querySelectorAll('[data-src]').forEach(
        (b) =>
          (b.onclick = async () => {
            closeSheet();
            const r = await A.importRun(b.dataset.src);
            if (r?.error) return toast(r.error);
            if (r?.cancelled) return;
            store.bookmarks = r.bookmarks;
            toast(`Imported ${r.added} favorites${r.skipped ? ` (${r.skipped} already here)` : ''}`);
            renderBookmarksBar();
            openPanel('bookmarks');
          }),
      );
    },
  );
}

// ----- history -----
let histFilter = '';
function renderHistory(el, body) {
  body.innerHTML = `<input class="filter" placeholder="Search history" spellcheck="false" value="${esc(histFilter)}"><div class="list"></div>`;
  const input = body.querySelector('.filter');
  const draw = async () => {
    histFilter = input.value;
    const items = await A.history(input.value);
    let day = '';
    body.querySelector('.list').innerHTML = items.length
      ? items
          .map((h) => {
            const d = new Date(h.at).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
            const head = d !== day ? `<div class="day">${(day = d)}</div>` : '';
            return head + row(h.url, h.title, `${new Date(h.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · ${host(h.url)}`, null, `<button class="icon" data-at="${h.at}" title="Remove from history">${icon('x', 15)}</button>`);
          })
          .join('')
      : `<div class="empty">${S.private ? 'Private windows don’t keep history.' : 'Nothing here.'}</div>`;
    body.querySelectorAll('[data-at]').forEach(
      (b) =>
        (b.onclick = async () => {
          await A.historyRemove(b.closest('.row').dataset.url, Number(b.dataset.at));
          draw();
        }),
    );
    wireRows(body);
  };
  input.oninput = draw;
  draw();
  el.insertAdjacentHTML('beforeend', `<div class="pfoot"><button class="btn danger" id="clear-history">${icon('broom', 14)} Clear browsing data…</button></div>`);
  $('#clear-history').onclick = () => openClearData();
}

// ----- downloads -----
const size = (n) => (n > 1e9 ? (n / 1e9).toFixed(2) + ' GB' : n > 1e6 ? (n / 1e6).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1e3)) + ' KB');
function renderDownloads(body) {
  if (!store.downloads.length) return (body.innerHTML = '<div class="empty">No downloads yet.</div>');
  body.innerHTML = store.downloads
    .map((d) => {
      const pct = d.total ? Math.round((d.received / d.total) * 100) : 0;
      const sub =
        d.state === 'warning' ? d.danger : d.state === 'blocked' ? d.danger : d.state === 'progressing' ? `${size(d.received)}${d.total ? ' of ' + size(d.total) : ''}` : d.state === 'paused' ? `Paused · ${size(d.received)}${d.total ? ' of ' + size(d.total) : ''}` : d.state === 'completed' ? `${size(d.received)} · ${host(d.url)}` : d.state === 'cancelled' ? 'Cancelled' : 'Failed';
      const cls = d.state === 'warning' ? ' warn' : d.state === 'blocked' ? ' bad' : '';
      const actions =
        d.state === 'warning'
          ? `<div class="row-actions"><button class="btn" data-a="discard">Delete</button><button class="btn subtle" data-a="keep">Keep anyway</button></div>`
          : d.state === 'progressing' || d.state === 'paused'
            ? `<button class="icon" data-a="pause" title="${d.state === 'paused' ? 'Resume' : 'Pause'}">${icon(d.state === 'paused' ? 'resume' : 'pause', 15)}</button><button class="icon" data-a="cancel" title="Cancel">${icon('x', 15)}</button>`
            : d.state === 'completed'
              ? `<button class="icon" data-a="show" title="Show in folder">${icon('folder', 15)}</button>`
              : '';
      return `<div class="row dl${cls}" data-id="${d.id}"><span class="dl-ico">${icon(cls ? 'alert' : 'download', 16)}</span><div class="txt"><b>${esc(d.name)}</b><small class="${cls ? 'wrap' : ''}">${esc(sub)}</small>${d.state === 'progressing' || d.state === 'paused' ? `<div class="meter"><i style="width:${pct}%"></i></div>` : ''}${d.state === 'warning' ? actions : ''}</div>${d.state === 'warning' ? '' : actions}</div>`;
    })
    .join('');
  body.querySelectorAll('.row').forEach((r) => {
    r.onclick = (e) => {
      const a = e.target.closest('button')?.dataset.a;
      const id = r.dataset.id;
      if (a === 'cancel') A.downloadCancel(id);
      else if (a === 'pause') A.downloadPause(id);
      else if (a === 'show') A.downloadShow(id);
      else if (a === 'keep') A.downloadKeep(id);
      else if (a === 'discard') A.downloadDiscard(id);
      else if (!a) A.downloadOpen(id);
    };
  });
}

// ----- passwords -----
let pwFilter = '';
async function renderPasswords(body) {
  const m = await A.pwManager();
  const s = pwFilter.toLowerCase();
  const items = m.items.filter((i) => !s || i.origin.toLowerCase().includes(s) || i.username.toLowerCase().includes(s)).sort((a, b) => host(a.origin).localeCompare(host(b.origin)));
  body.innerHTML = `
    <div class="note">${icon('lock', 16)}<span>${m.available ? 'Passwords are encrypted by Windows for your account and never stored as plain text. Showing or copying one asks Windows Hello first.' : 'Windows encryption isn’t available, so Weber won’t save passwords.'}</span></div>
    <input class="filter" id="pw-filter" placeholder="Search passwords" spellcheck="false" value="${esc(pwFilter)}">
    ${items.length ? items.map((i) => `<div class="row pw" data-id="${i.id}">${favImg(i.origin, null, host(i.origin)[0]?.toUpperCase())}<div class="txt"><b>${esc(host(i.origin))}</b><small class="pw-user">${esc(i.username || '(no username)')}</small><small class="pw-secret" hidden></small></div><button class="icon" data-a="show" title="Show password">${icon('eye', 15)}</button><button class="icon" data-a="copy" title="Copy password">${icon('copy', 15)}</button><button class="icon" data-a="del" title="Delete">${icon('trash', 15)}</button></div>`).join('') : `<div class="empty">${m.items.length ? 'No passwords match.' : 'No saved passwords yet.<br>Weber offers to save one when you sign in to a site.'}</div>`}
    ${m.never.length ? `<div class="day">Never saved for</div>${m.never.map((o) => `<div class="row"><span class="dot"></span><div class="txt"><b>${esc(host(o))}</b></div><button class="icon" data-never="${esc(o)}" title="Remove">${icon('x', 15)}</button></div>`).join('')}` : ''}`;
  const f = $('#pw-filter');
  f.oninput = () => {
    pwFilter = f.value;
    renderPasswords(body).then(() => {
      $('#pw-filter').focus();
    });
  };
  body.querySelectorAll('.row.pw').forEach((r) => {
    r.onclick = async (e) => {
      const a = e.target.closest('button')?.dataset.a;
      const id = r.dataset.id;
      if (a === 'del') {
        if (!confirm(`Delete the saved password for ${r.querySelector('b').textContent}?`)) return;
        await A.pwRemove(id);
        renderPasswords(body);
      } else if (a === 'copy') {
        if (await A.pwCopy(id)) toast('Password copied. It clears from the clipboard in 30 seconds');
      } else if (a === 'show') {
        const el = r.querySelector('.pw-secret');
        if (!el.hidden) return (el.hidden = true), (el.textContent = '');
        const pw = await A.pwReveal(id);
        if (pw == null) return;
        el.textContent = pw;
        el.hidden = false;
        setTimeout(() => ((el.hidden = true), (el.textContent = '')), 20000);
      }
    };
  });
  body.querySelectorAll('[data-never]').forEach((b) => (b.onclick = async () => (await A.pwForgetNever(b.dataset.never), renderPasswords(body))));
}

// ----- settings -----
const seg = (key, opts, val) => `<div class="seg">${opts.map(([k, l]) => `<button data-seg="${key}" data-v="${esc(k)}" class="${val === k ? 'on' : ''}">${l}</button>`).join('')}</div>`;
const sw = (key, on, title, sub) => `<div class="set switch"><div><h4>${title}</h4><p>${sub}</p></div><button class="toggle ${on ? 'on' : ''}" data-set="${key}" role="switch" aria-checked="${!!on}"></button></div>`;
async function renderSettings(body) {
  const s = store.settings;
  const [info, prof, sites, sources] = await Promise.all([A.shieldInfo(), A.profiles(), A.siteList(), A.importSources()]);
  const when = (t) => (t ? new Date(t).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'not yet');
  body.innerHTML = `
    <nav class="set-nav">${['Look', 'Tabs', 'Privacy', 'Sites', 'Profiles', 'More'].map((x) => `<button data-jump="${x}">${x}</button>`).join('')}</nav>
    <h3 class="set-h" id="sec-Look">Appearance</h3>
    <div class="set"><h4>Background</h4><p>Shows around your pages and behind new tabs.</p>
      <div class="seg">${BG_MODES.map(([k, l]) => `<button data-bgmode="${k}" class="${(s.bgMode ?? 'theme') === k ? 'on' : ''}">${l}</button>`).join('')}</div>
      ${bgOptions(s)}
      ${(s.bgMode ?? 'theme') !== 'theme' ? `<label class="range">Dim <input type="range" id="bg-dim" min="0" max="80" step="1" value="${s.bgDim ?? 25}"></label>` : ''}
    </div>
    <div class="set"><h4>Search engine</h4><p>Used for anything you type that isn’t an address.</p>${seg('engine', ['bing', 'google', 'duckduckgo', 'brave'].map((e) => [e, ENGINE_NAMES[e]]), s.engine)}</div>

    <h3 class="set-h" id="sec-Tabs">Tabs and layout</h3>
    <div class="set"><h4>Tabs</h4><p>The floating island, or a list down the left side (Ctrl+Shift+V).</p>${seg('tabLayout', [['dock', 'Island'], ['vertical', 'Vertical']], s.tabLayout ?? 'dock')}</div>
    ${sw('bookmarksBar', s.bookmarksBar, 'Favorites bar', 'Your favorites under the address bar (Ctrl+Shift+B).')}
    ${sw('sidebar', s.sidebar, 'Sidebar', 'Chats and music in a panel beside your page (Ctrl+Shift+E). Right-click an icon to remove it.')}
    <div class="set"><h4>Sidebar sites</h4><div class="chips">${(s.sidebarSites ?? []).map((u) => `<span class="chipx">${esc(sideName(u))}<button data-rmside="${esc(u)}" title="Remove">${icon('x', 12)}</button></span>`).join('')}</div>
      <div class="inline"><input class="field" id="side-add" placeholder="https://… to add a site"><button class="btn" id="side-add-btn">Add</button></div></div>

    <h3 class="set-h" id="sec-Privacy">Privacy and security</h3>
    ${sw('safeBrowsing', s.safeBrowsing, 'Dangerous-site protection', `Blocks known phishing and malware sites, checked on this PC. ${info.danger.hosts.toLocaleString()} sites listed, updated ${when(info.danger.updated)}.`)}
    ${sw('httpsOnly', s.httpsOnly, 'Always use secure connections', 'Upgrades every site to HTTPS and warns you before opening one that has no secure version.')}
    ${sw('adblock', s.adblock, 'Block ads and trackers', `${info.adblock.source}: ${info.adblock.rules.toLocaleString()} rules, updated ${when(info.adblock.updated)}.`)}
    <div class="set"><h4>Third-party cookies</h4><p>Cookies set by other sites inside the page you’re on, mostly used to follow you across the web. Always blocked in private windows.</p>${seg('thirdPartyCookies', [['block', 'Block'], ['allow', 'Allow']], s.thirdPartyCookies)}</div>
    ${sw('gpc', s.gpc, 'Ask sites not to sell or share my data', 'Sends the Global Privacy Control signal, which sites in several US states must respect.')}
    <div class="set"><h4>Secure DNS</h4><p>Looks up site addresses over an encrypted connection, so your network can’t see or change them.</p>
      ${seg('dns', [['automatic', 'Automatic'], ['cloudflare', 'Cloudflare'], ['google', 'Google'], ['quad9', 'Quad9'], ['custom', 'Custom'], ['off', 'Off']], s.dns ?? 'automatic')}
      ${s.dns === 'custom' ? `<div class="inline"><input class="field" id="dns-custom" placeholder="https://dns.example/dns-query" value="${esc(s.dnsCustom ?? '')}"><button class="btn" id="dns-save">Save</button></div>` : ''}</div>
    ${sw('passwords', s.passwords, 'Offer to save passwords', 'Encrypted by Windows. Manage them in the Passwords tab.')}
    <div class="set"><div class="inline"><button class="btn" id="open-clear">${icon('broom', 14)} Clear browsing data…</button><button class="btn" id="shield-update">${icon('reload', 14)} Update protection lists</button></div></div>

    <h3 class="set-h" id="sec-Sites">Site settings</h3>
    <div class="set"><p>Sites you’ve allowed or blocked from using your camera, microphone, location, notifications or pop-ups. Click the lock in the address bar to change a site.</p>
      ${sites.length ? sites.map((x) => `<div class="row site"><span class="dot"></span><div class="txt"><b>${esc(host(x.origin))}</b><small>${esc(Object.entries(x.perms).map(([k, v]) => `${PERM_LABEL[k] ?? k}: ${v === 'off' ? 'shield off' : v}`).join(' · '))}</small></div><button class="icon" data-reset="${esc(x.origin)}" title="Reset">${icon('trash', 15)}</button></div>`).join('') : '<p class="muted">No exceptions yet.</p>'}</div>

    <h3 class="set-h" id="sec-Profiles">Profiles</h3>
    <div class="set"><p>Each profile has its own favorites, history, passwords and sign-ins, and opens in its own window.</p>
      ${prof.list.map((p) => `<div class="row prof"><i class="avatar" style="--p:${esc(p.color)}">${esc(p.name[0]?.toUpperCase() ?? 'P')}</i><div class="txt"><b>${esc(p.name)}</b><small>${p.id === prof.current.id ? 'This window' : 'Separate profile'}</small></div>${p.id === prof.current.id ? '' : `<button class="btn" data-prof="${esc(p.id)}">Open</button>`}</div>`).join('')}
      <div class="inline"><input class="field" id="prof-name" placeholder="New profile name"><button class="btn" id="prof-add">Add</button></div>
      <div class="inline"><button class="btn" id="open-private">${icon('mask', 14)} New private window</button></div></div>

    <h3 class="set-h" id="sec-More">More</h3>
    <div class="set"><h4>Translate into</h4><p>Pages in other languages get a translate button (uses Google Translate).</p>
      <select class="field" id="translate-to">${Object.entries(LANGS).map(([k, v]) => `<option value="${k}" ${(s.translateTo || 'en') === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
    <div class="set"><h4>Import favorites</h4><p>${sources.length ? 'From Chrome, Edge or Brave on this PC, only when you choose.' : 'No other browsers found on this PC.'}</p>${sources.length ? `<button class="btn" id="open-import">${icon('import', 14)} Import…</button>` : ''}</div>
    <div class="set"><h4>Extensions</h4><p>Add extensions from the Chrome Web Store. Their icons show in the top bar.</p>
      <div id="ext-list"></div>
      <button class="btn primary" id="get-ext">Open Chrome Web Store</button></div>
    <div class="set"><h4>Shortcuts</h4><div class="keys">
      <kbd>Ctrl+L</kbd><span>Search or enter address</span><kbd>Ctrl+T</kbd><span>New tab</span><kbd>Ctrl+Shift+T</kbd><span>Reopen closed tab</span>
      <kbd>Ctrl+Shift+N</kbd><span>Private window</span><kbd>Ctrl+Shift+A</kbd><span>Search tabs</span><kbd>Ctrl+Shift+S</kbd><span>Split view</span>
      <kbd>Ctrl+W</kbd><span>Close tab</span><kbd>Ctrl+F</kbd><span>Find in page</span><kbd>Ctrl+D</kbd><span>Add to favorites</span>
      <kbd>F9</kbd><span>Reading mode</span><kbd>Ctrl+Shift+B</kbd><span>Favorites bar</span><kbd>Ctrl+Shift+E</kbd><span>Sidebar</span>
      <kbd>Ctrl+H</kbd><span>History</span><kbd>Ctrl+J</kbd><span>Downloads</span><kbd>Ctrl+Shift+Del</kbd><span>Clear browsing data</span>
      <kbd>Ctrl + / −</kbd><span>Zoom</span><kbd>F11</kbd><span>Full screen</span><kbd>F12</kbd><span>Developer tools</span>
    </div></div>
    <div class="set"><h4>J.A.R.V.I.S.</h4><p>Jarvis can open sites, list and switch your tabs, and read the current page for you. Try “open YouTube in Weber” or “summarize this page”. Private windows are never shared with Jarvis.</p></div>`;
  wireBackground(body, s);
  body.querySelectorAll('[data-jump]').forEach((b) => (b.onclick = () => body.querySelector('#sec-' + b.dataset.jump)?.scrollIntoView({ behavior: 'smooth', block: 'start' })));
  body.querySelectorAll('[data-seg]').forEach((b) => (b.onclick = () => setSetting({ [b.dataset.seg]: b.dataset.v })));
  body.querySelectorAll('[data-set]').forEach((b) => (b.onclick = () => setSetting({ [b.dataset.set]: !s[b.dataset.set] })));
  body.querySelectorAll('[data-rmside]').forEach((b) => (b.onclick = () => setSetting({ sidebarSites: s.sidebarSites.filter((u) => u !== b.dataset.rmside) })));
  $('#side-add-btn').onclick = () => {
    let v = $('#side-add').value.trim();
    if (!/^https?:\/\//.test(v)) v = 'https://' + v;
    try {
      const u = new URL(v);
      if (u.protocol !== 'https:') throw 0;
      setSetting({ sidebarSites: [...new Set([...(s.sidebarSites ?? []), u.origin + '/'])] });
    } catch {
      toast('Enter a secure (https) address');
    }
  };
  $('#dns-save')?.addEventListener('click', () => {
    const v = $('#dns-custom').value.trim();
    if (!/^https:\/\/\S+$/.test(v)) return toast('A DNS-over-HTTPS address starts with https://');
    setSetting({ dnsCustom: v });
    toast('Secure DNS server saved');
  });
  $('#open-clear').onclick = () => openClearData();
  $('#shield-update').onclick = async () => {
    toast('Updating protection lists…');
    await A.shieldUpdate();
    toast('Protection lists are up to date');
    renderPanel();
  };
  body.querySelectorAll('[data-reset]').forEach((b) => (b.onclick = async () => (await A.siteReset(b.dataset.reset), renderPanel())));
  body.querySelectorAll('[data-prof]').forEach((b) => (b.onclick = () => (A.profileOpen(b.dataset.prof), toast('Opening profile…'))));
  $('#prof-add').onclick = async () => {
    const name = $('#prof-name').value.trim();
    if (!name) return $('#prof-name').focus();
    await A.profileCreate(name, PROFILE_COLORS[Math.floor(Math.random() * PROFILE_COLORS.length)]);
    toast(`Profile “${name}” added`);
    renderPanel();
  };
  $('#open-private').onclick = () => A.privateWindow();
  $('#translate-to').onchange = (e) => setSetting({ translateTo: e.target.value });
  $('#open-import')?.addEventListener('click', () => openImport());
  $('#get-ext').onclick = () => A.newTab('https://chromewebstore.google.com/');
  renderExtensions();
}
const PROFILE_COLORS = ['#7ee2a8', '#ffb36b', '#ff9ed2', '#6fe0e6', '#c3a6ff', '#ffd166', '#ff8a80'];
async function setSetting(patch) {
  store.settings = await A.settings(patch);
  applySettings();
  renderStage(true);
  if (panel === 'settings') renderPanel();
}
function applySettings() {
  document.body.dataset.theme = store.settings.theme ?? 'aurora';
  applyBackground();
  syncLayout();
  renderToolbar();
  renderBookmarksBar();
  renderRail();
  renderVTabs();
}

// ---------- extensions list (settings) ----------
async function renderExtensions() {
  const box = $('#ext-list');
  if (!box) return;
  const list = await A.extensions();
  box.innerHTML = list.length
    ? list.map((e) => `<div class="row ext-row"><span class="dot"></span><div class="txt"><b>${esc(e.name)}</b><small>${esc(e.description || 'Version ' + e.version)}</small></div><button class="icon" data-ext="${esc(e.id)}" title="Remove">${icon('trash', 15)}</button></div>`).join('')
    : `<p style="margin:0 0 10px">${S.private ? 'Extensions are off in private windows.' : 'No extensions yet.'}</p>`;
  box.querySelectorAll('[data-ext]').forEach(
    (b) =>
      (b.onclick = async () => {
        await A.removeExtension(b.dataset.ext);
        toast('Extension removed');
        renderExtensions();
      }),
  );
}

// ---------- sheets: menus and dialogs that float over the page ----------
// The page is swapped for a screenshot while one is open, so it can draw on top.
let sheetOpen = false;
async function openSheet(html, wire, { anchor, cls = '' } = {}) {
  if (!sheetOpen) showShot(await A.freeze(true));
  sheetOpen = true;
  const o = $('#overlay');
  o.hidden = false;
  o.innerHTML = `<div class="sheet ${cls}" role="dialog">${html}</div>`;
  const box = o.firstElementChild;
  if (anchor) {
    const r = anchor.getBoundingClientRect();
    box.classList.add('anchored');
    const left = Math.min(Math.max(8, r.right - box.offsetWidth), innerWidth - box.offsetWidth - 8);
    Object.assign(box.style, { left: `${cls.includes('left') ? Math.max(8, r.left) : left}px`, top: `${r.bottom + 8}px` });
  }
  box.querySelectorAll('[data-close]').forEach((b) => (b.onclick = closeSheet));
  wire?.(box);
  return box;
}
function closeSheet() {
  if (!sheetOpen) return;
  sheetOpen = false;
  const o = $('#overlay');
  o.hidden = true;
  o.innerHTML = '';
  A.freeze(false).then(() => showShot(null));
  A.focusPage();
}
$('#overlay').onmousedown = (e) => e.target.id === 'overlay' && closeSheet();

// ----- the ⋯ menu -----
async function openMenu() {
  const t = cur();
  const s = store.settings;
  const prof = await A.profiles();
  const item = (id, ic, label, key = '') => `<button class="mi" data-m="${id}">${icon(ic, 17)}<span>${label}</span>${key ? `<kbd>${key}</kbd>` : ''}</button>`;
  const others = prof.list.filter((p) => p.id !== prof.current.id);
  openSheet(
    `<div class="menu">
      ${item('new-tab', 'plus', 'New tab', 'Ctrl+T')}
      ${S.private ? '' : item('private', 'mask', 'New private window', 'Ctrl+Shift+N')}
      ${others.map((p) => `<button class="mi" data-prof="${esc(p.id)}"><i class="avatar sm" style="--p:${esc(p.color)}">${esc(p.name[0]?.toUpperCase())}</i><span>Open ${esc(p.name)}</span></button>`).join('')}
      <hr>
      ${item('tab-search', 'search', 'Search tabs', 'Ctrl+Shift+A')}
      ${item('split', 'split', S.split ? 'Close split view' : 'Split view', 'Ctrl+Shift+S')}
      ${item('vertical', 'columns', vertical() ? 'Island tabs' : 'Vertical tabs', 'Ctrl+Shift+V')}
      ${item('sidebar', 'sidebar', s.sidebar ? 'Hide sidebar' : 'Show sidebar', 'Ctrl+Shift+E')}
      ${item('bar', 'bookmarks', s.bookmarksBar ? 'Hide favorites bar' : 'Show favorites bar', 'Ctrl+Shift+B')}
      <hr>
      ${item('bookmarks', 'star', 'Favorites', 'Ctrl+Shift+O')}
      ${item('history', 'history', 'History', 'Ctrl+H')}
      ${item('downloads', 'download', 'Downloads', 'Ctrl+J')}
      ${item('passwords', 'key', 'Passwords')}
      <hr>
      <div class="mi zoom"><span class="zl">${icon('search', 17)}<span>Zoom</span></span><button data-m="zoom-out">${icon('minus', 15)}</button><b>${Math.round((t?.zoom ?? 1) * 100)}%</b><button data-m="zoom-in">${icon('plus', 15)}</button></div>
      ${item('find', 'search', 'Find in page', 'Ctrl+F')}
      ${item('reader', 'book', 'Reading mode', 'F9')}
      ${item('translate', 'translate', 'Translate page')}
      ${item('pip', 'pip', 'Picture in picture')}
      ${item('print', 'print', 'Print…', 'Ctrl+P')}
      <hr>
      ${item('clear', 'broom', 'Clear browsing data…', 'Ctrl+Shift+Del')}
      ${item('settings', 'settings', 'Settings')}
      ${item('devtools', 'code', 'Developer tools', 'F12')}
    </div>`,
    (box) => {
      box.querySelectorAll('[data-prof]').forEach((b) => (b.onclick = () => (closeSheet(), A.profileOpen(b.dataset.prof))));
      box.querySelectorAll('[data-m]').forEach(
        (b) =>
          (b.onclick = async () => {
            const m = b.dataset.m;
            if (m === 'zoom-in' || m === 'zoom-out') {
              await A.zoom(m === 'zoom-in' ? 0.1 : -0.1);
              const st = await A.state();
              box.querySelector('.zoom b').textContent = Math.round((st.tabs.find((x) => x.id === st.active)?.zoom ?? 1) * 100) + '%';
              return;
            }
            closeSheet();
            const run = {
              'new-tab': () => A.newTab(), private: () => A.privateWindow(), 'tab-search': () => setTimeout(openTabSearch, 60), split: () => (S.split ? A.unsplit() : A.split()),
              vertical: () => setSetting({ tabLayout: vertical() ? 'dock' : 'vertical' }), sidebar: () => setSetting({ sidebar: !s.sidebar }), bar: () => setSetting({ bookmarksBar: !s.bookmarksBar }),
              bookmarks: () => openPanel('bookmarks'), history: () => openPanel('history'), downloads: () => openPanel('downloads'), passwords: () => openPanel('passwords'),
              find: () => openFind(), reader: async () => showReaderResult(await A.reader()), translate: () => A.translate(s.translateTo || 'en'),
              pip: async () => (await A.pip()) === 'none' && toast('No video is playing on this page'), print: () => A.print(),
              clear: () => setTimeout(openClearData, 60), settings: () => openPanel('settings'), devtools: () => A.devtools(),
            };
            run[m]?.();
          }),
      );
    },
    { anchor: $('#menu-btn'), cls: 'menu-sheet' },
  );
}

// ----- profiles -----
async function openProfiles() {
  const prof = await A.profiles();
  openSheet(
    `<div class="menu">
      <div class="prof-head">${S.private ? `<i class="avatar priv">${icon('mask', 18)}</i><div><b>Private window</b><small>History, cookies and site data are deleted when you close it.</small></div>` : `<i class="avatar" style="--p:${esc(prof.current.color)}">${esc(prof.current.name[0]?.toUpperCase())}</i><div><b>${esc(prof.current.name)}</b><small>This window’s profile</small></div>`}</div>
      <hr>
      ${prof.list.filter((p) => p.id !== prof.current.id).map((p) => `<button class="mi" data-prof="${esc(p.id)}"><i class="avatar sm" style="--p:${esc(p.color)}">${esc(p.name[0]?.toUpperCase())}</i><span>${esc(p.name)}</span><kbd>Open</kbd></button>`).join('')}
      ${S.private ? '' : `<button class="mi" data-m="private">${icon('mask', 17)}<span>New private window</span><kbd>Ctrl+Shift+N</kbd></button>`}
      <button class="mi" data-m="manage">${icon('user', 17)}<span>Add or manage profiles</span></button>
    </div>`,
    (box) => {
      box.querySelectorAll('[data-prof]').forEach((b) => (b.onclick = () => (closeSheet(), A.profileOpen(b.dataset.prof))));
      box.querySelector('[data-m="private"]')?.addEventListener('click', () => (closeSheet(), A.privateWindow()));
      box.querySelector('[data-m="manage"]').onclick = () => {
        closeSheet();
        openPanel('settings');
        setTimeout(() => $('#sec-Profiles')?.scrollIntoView({ block: 'start' }), 150);
      };
    },
    { anchor: $('#profile-chip'), cls: 'menu-sheet left' },
  );
}

// ----- site information, permissions and the shield -----
const PERM_LABEL = { camera: 'Camera', microphone: 'Microphone', geolocation: 'Location', notifications: 'Notifications', popups: 'Pop-ups and redirects', thirdPartyCookies: 'Third-party cookies', cookies: 'All cookies', shield: 'Ad and tracker blocking', 'clipboard-read': 'Clipboard', midi: 'MIDI devices', 'window-management': 'Window management', 'local-fonts': 'Fonts', openExternal: 'Open apps', hid: 'HID devices', usb: 'USB devices', serial: 'Serial ports', 'idle-detection': 'Idle detection' };
const PERM_ICON = { camera: 'camera', microphone: 'mic', geolocation: 'pin', notifications: 'bell', popups: 'popup', thirdPartyCookies: 'cookie', cookies: 'cookie' };
async function siteSheet(focus) {
  const t = cur();
  if (!t?.url || !/^https?:/.test(t.url)) return focus === 'shield' ? openPanel('settings') : null;
  const info = await A.siteInfo(t.url);
  if (!info) return;
  const p = info.perms;
  const defaults = { popups: 'Block', thirdPartyCookies: store.settings.thirdPartyCookies === 'allow' ? 'Allow' : 'Block', cookies: 'Allow' };
  const select = (k) => {
    const v = p[k] ?? '';
    const opts = ['camera', 'microphone', 'geolocation', 'notifications'].includes(k) ? [['', 'Ask (default)'], ['allow', 'Allow'], ['block', 'Block']] : [['', `${defaults[k] ?? 'Ask'} (default)`], ['allow', 'Allow'], ['block', 'Block']];
    return `<div class="prow">${icon(PERM_ICON[k] ?? 'settings', 16)}<span>${PERM_LABEL[k]}</span><select data-perm="${k}">${opts.map(([ov, ol]) => `<option value="${ov}" ${v === ov ? 'selected' : ''}>${ol}</option>`).join('')}</select></div>`;
  };
  const extra = Object.keys(p).filter((k) => !['camera', 'microphone', 'geolocation', 'notifications', 'popups', 'thirdPartyCookies', 'cookies', 'shield'].includes(k));
  const shieldOn = store.settings.adblock && p.shield !== 'off';
  openSheet(
    `<div class="site-head ${info.secure ? 'ok' : info.local ? '' : 'bad'}"><span class="sh-ico">${icon(info.secure ? 'lock' : 'unlock', 18)}</span><div><b>${esc(host(t.url))}</b><small>${info.secure ? 'Connection is secure. What you send to this site is encrypted.' : info.local ? 'A site on this PC or your home network.' : 'Not secure. Don’t enter passwords or card details here.'}</small></div></div>
    <div class="shield-box ${shieldOn ? 'on' : ''}">
      <div class="sb-top">${icon('shieldOk', 20)}<div><b>Weber Shield</b><small>${shieldOn ? `${info.blocked} ad${info.blocked === 1 ? '' : 's'} and tracker${info.blocked === 1 ? '' : 's'} blocked on this page` : store.settings.adblock ? 'Off for this site' : 'Blocking is off in Settings'}</small></div>
      ${store.settings.adblock ? `<button class="toggle ${shieldOn ? 'on' : ''}" id="site-shield" title="Block ads and trackers on this site"></button>` : ''}</div>
      ${shieldOn && info.trackers.length ? `<div class="tracker-list">${info.trackers.slice(0, 12).map((h) => `<span>${esc(h)}</span>`).join('')}${info.trackers.length > 12 ? `<span>+${info.trackers.length - 12} more</span>` : ''}</div>` : ''}
    </div>
    <h4 class="sheet-h">Permissions</h4>
    ${['camera', 'microphone', 'geolocation', 'notifications', 'popups', 'thirdPartyCookies'].map(select).join('')}
    ${extra.map((k) => `<div class="prow">${icon('settings', 16)}<span>${esc(PERM_LABEL[k] ?? k)}</span><select data-perm="${esc(k)}"><option value="">Ask (default)</option><option value="allow" ${p[k] === 'allow' ? 'selected' : ''}>Allow</option><option value="block" ${p[k] === 'block' ? 'selected' : ''}>Block</option></select></div>`).join('')}
    <div class="prow">${icon('cookie', 16)}<span>Cookies and site data<small>${info.cookies} cookie${info.cookies === 1 ? '' : 's'} stored</small></span><button class="btn" id="site-clear">Delete</button></div>
    <div class="sheet-foot"><button class="btn" id="site-reset">Reset permissions</button><button class="btn primary" data-close>Done</button></div>`,
    (box) => {
      box.querySelectorAll('[data-perm]').forEach((s) => (s.onchange = () => A.sitePerm(info.origin, s.dataset.perm, s.value).then(() => toast('Reload the page to apply'))));
      box.querySelector('#site-shield')?.addEventListener('click', async () => {
        await A.sitePerm(info.origin, 'shield', shieldOn ? 'off' : '');
        closeSheet();
        A.reload();
        toast(shieldOn ? `Shield off for ${host(t.url)}` : `Shield on for ${host(t.url)}`);
      });
      box.querySelector('#site-clear').onclick = async () => {
        if (!confirm(`Delete all cookies and site data for ${host(t.url)}? You may be signed out.`)) return;
        await A.siteClear(info.origin);
        closeSheet();
        toast('Site data deleted');
      };
      box.querySelector('#site-reset').onclick = async () => {
        await A.siteReset(info.origin);
        closeSheet();
        toast('Permissions reset');
      };
    },
    { anchor: focus === 'shield' ? $('#shield') : $('#site-icon'), cls: focus === 'shield' ? 'site-sheet' : 'site-sheet left' },
  );
}

// ----- blocked pop-ups -----
async function openPopups() {
  const t = cur();
  const list = await A.popups();
  if (!list.length) return;
  openSheet(
    `<h3>Pop-ups blocked</h3><p class="sub">${esc(host(t.url))} tried to open ${list.length === 1 ? 'a window' : `${list.length} windows`} without you clicking anything.</p>
    <div class="pick-list">${list.map((p, i) => `<button class="pick" data-i="${i}"><b>${esc(host(p.url))}</b><small>${esc(p.url.slice(0, 80))}</small>${icon('open', 15)}</button>`).join('')}</div>
    <div class="sheet-foot"><button class="btn" id="pop-always">Always allow on ${esc(host(t.url))}</button><button class="btn primary" data-close>Done</button></div>`,
    (box) => {
      box.querySelectorAll('[data-i]').forEach((b) => (b.onclick = () => (closeSheet(), A.popupOpen(Number(b.dataset.i), false))));
      box.querySelector('#pop-always').onclick = () => (closeSheet(), A.popupOpen(0, true));
    },
    { anchor: $('#popup-btn'), cls: 'small-sheet' },
  );
}

// ----- clear browsing data -----
function openClearData() {
  openSheet(
    `<h3>Clear browsing data</h3><p class="sub">${S.private ? 'This private window forgets everything anyway when you close it.' : 'From this profile only.'}</p>
    <div class="prow"><span>Time range</span><select id="cd-range"><option value="hour">Last hour</option><option value="day">Last 24 hours</option><option value="week">Last 7 days</option><option value="month">Last 4 weeks</option><option value="all" selected>All time</option></select></div>
    ${[['history', 'Browsing history', 'Pages you visited and closed tabs', true], ['cookies', 'Cookies and site data', 'Signs you out of most sites (all time)', true], ['cache', 'Cached images and files', 'Frees up space; some sites load slower next time (all time)', true], ['downloads', 'Download list', 'The list only; files stay on your PC', false], ['perms', 'Site settings', 'Permissions and zoom levels you set', false], ['passwords', 'Saved passwords', 'Can’t be undone', false]]
      .map(([k, l, sub, on]) => `<label class="check"><input type="checkbox" data-cd="${k}" ${on ? 'checked' : ''}><span><b>${l}</b><small>${sub}</small></span></label>`)
      .join('')}
    <div class="sheet-foot"><button class="btn" data-close>Cancel</button><button class="btn primary" id="cd-go">Clear data</button></div>`,
    (box) => {
      box.querySelector('#cd-go').onclick = async () => {
        const o = { range: box.querySelector('#cd-range').value };
        box.querySelectorAll('[data-cd]').forEach((c) => (o[c.dataset.cd] = c.checked));
        if (o.passwords && !confirm('Delete all saved passwords? This can’t be undone.')) return;
        const done = await A.clearData(o);
        closeSheet();
        toast(done.length ? `Cleared ${done.join(', ')}` : 'Nothing selected');
        if (panel) renderPanel();
      };
    },
    { cls: 'dialog' },
  );
}

// ----- tab search -----
async function openTabSearch() {
  const closedTabs = await A.closedTabs();
  let sel = 0;
  const box = await openSheet(`<div class="ts"><div class="ts-in">${icon('search', 18)}<input id="ts-q" placeholder="Search open and recently closed tabs" spellcheck="false" autocomplete="off"></div><div class="ts-list"></div></div>`, null, { cls: 'palette' });
  const input = box.querySelector('#ts-q');
  const draw = () => {
    const s = input.value.toLowerCase().trim();
    const match = (t) => !s || (t.title || '').toLowerCase().includes(s) || (t.url || '').toLowerCase().includes(s);
    const open = S.tabs.filter(match);
    const gone = closedTabs.filter(match).slice(0, 8);
    const rows = [...open.map((t) => ({ t, open: true })), ...gone.map((t) => ({ t, open: false }))];
    sel = Math.min(sel, Math.max(0, rows.length - 1));
    box.querySelector('.ts-list').innerHTML =
      (open.length ? `<div class="ts-h">Open tabs <span>${open.length}</span></div>` : '') +
      rows
        .map(({ t, open: o }, i) => {
          const g = o && t.group ? groupOf(t.group) : null;
          const head = !o && i === open.length ? `<div class="ts-h">Recently closed</div>` : '';
          return `${head}<div class="ts-row${i === sel ? ' on' : ''}" data-i="${i}">${favImg(t.url, t.favicon, (host(t.url)[0] || '').toUpperCase())}<div class="txt"><b>${esc(t.url ? t.title : 'New tab')}</b><small>${esc(host(t.url))}${g ? ` · <i class="gtag" style="--g:${g.color}">${esc(g.name || 'Group')}</i>` : ''}</small></div>${o && t.id === S.active ? '<span class="here">Current</span>' : ''}${o ? `<button class="icon small" data-x="${t.id}" title="Close tab">${icon('x', 14)}</button>` : ''}</div>`;
        })
        .join('') || '<div class="empty">No tabs match.</div>';
    box.querySelectorAll('.ts-row').forEach((r) => {
      r.onmousedown = (e) => {
        e.preventDefault();
        const x = e.target.closest('[data-x]');
        if (x) return A.closeTab(Number(x.dataset.x)).then(() => setTimeout(draw, 60));
        pickRow(rows[Number(r.dataset.i)]);
      };
    });
    box.__rows = rows;
  };
  const pickRow = (r) => {
    if (!r) return;
    closeSheet();
    if (r.open) A.activate(r.t.id);
    else A.reopen(r.t.url);
  };
  input.oninput = () => ((sel = 0), draw());
  input.onkeydown = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + box.__rows.length) % Math.max(1, box.__rows.length);
      draw();
      box.querySelector('.ts-row.on')?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') pickRow(box.__rows[sel]);
  };
  draw();
  input.focus();
}

// ----- tab group editor -----
async function editGroup(id) {
  const g = groupOf(id) ?? (await A.state()).groups.find((x) => x.id === id);
  if (!g) return;
  const colors = await A.groupColors();
  openSheet(
    `<h3>Tab group</h3>
    <input class="field big" id="g-name" placeholder="Name this group" value="${esc(g.name)}" maxlength="40">
    <div class="swatches g">${colors.map((c) => `<button data-c="${c}" class="${c === g.color ? 'on' : ''}" style="background:${c}" title="${c}"></button>`).join('')}</div>
    <div class="sheet-foot"><button class="btn primary" id="g-done">Done</button></div>`,
    (box) => {
      let color = g.color;
      box.querySelectorAll('[data-c]').forEach(
        (b) =>
          (b.onclick = () => {
            color = b.dataset.c;
            box.querySelectorAll('[data-c]').forEach((x) => x.classList.toggle('on', x === b));
          }),
      );
      const done = () => (A.groupUpdate(id, { name: box.querySelector('#g-name').value.trim(), color }), closeSheet());
      box.querySelector('#g-done').onclick = done;
      box.querySelector('#g-name').onkeydown = (e) => e.key === 'Enter' && done();
      box.querySelector('#g-name').focus();
    },
    { cls: 'small-sheet center' },
  );
}

// ----- screen sharing picker -----
A.onScreenPick(async (p) => {
  let kind = 'screen';
  let chosen = p.sources.find((s) => s.screen)?.id ?? p.sources[0]?.id;
  const draw = (box) => {
    const list = p.sources.filter((s) => (kind === 'screen' ? s.screen : !s.screen));
    box.querySelector('.scr-grid').innerHTML = list.map((s) => `<button class="scr${s.id === chosen ? ' on' : ''}" data-id="${esc(s.id)}"><img src="${s.thumb}" alt=""><span>${s.icon ? `<img class="ai" src="${s.icon}" alt="">` : ''}${esc(s.name)}</span></button>`).join('') || '<div class="empty">Nothing to share here.</div>';
    box.querySelectorAll('.scr').forEach((b) => (b.onclick = () => ((chosen = b.dataset.id), draw(box))));
    box.querySelectorAll('[data-k]').forEach((b) => b.classList.toggle('on', b.dataset.k === kind));
    box.querySelector('#scr-audio').closest('label').hidden = kind !== 'screen';
  };
  let answered = false;
  const answer = (id) => {
    if (answered) return;
    answered = true;
    A.screenAnswer(p.reqId, id, !!$('#scr-audio')?.checked);
    closeSheet();
  };
  const box = await openSheet(
    `<h3>Share your screen with ${esc(host(p.origin) || 'this site')}</h3><p class="sub">Choose what the site can see. It sees it until you stop sharing.</p>
    <div class="seg"><button data-k="screen">Entire screen</button><button data-k="window">Window</button></div>
    <div class="scr-grid"></div>
    <div class="sheet-foot"><label class="check inline"><input type="checkbox" id="scr-audio"><span>Also share system audio</span></label><button class="btn" id="scr-cancel">Cancel</button><button class="btn primary" id="scr-go">Share</button></div>`,
    (b) => {
      b.querySelectorAll('[data-k]').forEach((x) => (x.onclick = () => ((kind = x.dataset.k), (chosen = p.sources.find((s) => (kind === 'screen' ? s.screen : !s.screen)))?.id, draw(b))));
      b.querySelector('#scr-cancel').onclick = () => answer(null);
      b.querySelector('#scr-go').onclick = () => answer(chosen);
    },
    { cls: 'dialog wide' },
  );
  draw(box);
  // closing the sheet any other way means "don't share"
  const obs = new MutationObserver(() => {
    if ($('#overlay').hidden) {
      obs.disconnect();
      if (!answered) {
        answered = true;
        A.screenAnswer(p.reqId, null, false);
      }
    }
  });
  obs.observe($('#overlay'), { attributes: true });
});

// ---------- find in page and prompts take the pill's place ----------
const syncCenter = () => ($('#pill-wrap').hidden = !$('#findbar').hidden || !$('#permbar').hidden);
const findInput = $('#find-input');
function openFind() {
  $('#permbar').hidden = true;
  $('#findbar').hidden = false;
  syncCenter();
  findInput.focus();
  findInput.select();
  if (findInput.value) A.find(findInput.value, { next: false });
}
function closeFind() {
  $('#findbar').hidden = true;
  if (promptQueue.length) showPrompt();
  syncCenter();
  $('#find-count').textContent = '';
  A.findStop();
  A.focusPage();
}
findInput.oninput = () => A.find(findInput.value, { next: false });
findInput.onkeydown = (e) => {
  if (e.key === 'Enter') A.find(findInput.value, { next: true, forward: !e.shiftKey });
  if (e.key === 'Escape') closeFind();
};
$('#find-next').onclick = () => A.find(findInput.value, { next: true });
$('#find-prev').onclick = () => A.find(findInput.value, { next: true, forward: false });
$('#find-close').onclick = closeFind;
A.onFound((r) => {
  if (r.finalUpdate) $('#find-count').textContent = findInput.value ? (r.matches ? `${r.activeMatchOrdinal} of ${r.matches}` : 'No matches') : '';
});

const PERM_TEXT = {
  camera: 'use your camera',
  microphone: 'use your microphone',
  'camera-microphone': 'use your camera and microphone',
  geolocation: 'know your location',
  notifications: 'show notifications',
  openExternal: 'open an app on your PC',
  'clipboard-read': 'see text and images you copy',
  midi: 'use MIDI devices',
  midiSysex: 'control MIDI devices',
  hid: 'use a connected device',
  serial: 'use a serial port',
  usb: 'use a USB device',
  'idle-detection': 'know when you’re away',
  'window-management': 'manage windows on all your displays',
  'local-fonts': 'use the fonts on your PC',
};
// permission requests and "save password?" offers share one slot under the address bar
const promptQueue = [];
A.onPermission((p) => {
  promptQueue.push({ type: 'perm', ...p });
  if (promptQueue.length === 1) showPrompt();
});
A.onPwOffer((p) => {
  promptQueue.push({ type: 'pw', ...p });
  if (promptQueue.length === 1) showPrompt();
});
function nextPrompt() {
  promptQueue.shift();
  showPrompt();
}
function showPrompt() {
  const p = promptQueue[0];
  const bar = $('#permbar');
  if (!p || !$('#findbar').hidden) {
    bar.hidden = true;
    return syncCenter();
  }
  if (p.tabId && p.tabId !== S.active) A.activate(p.tabId);
  bar.hidden = false;
  syncCenter();
  if (p.type === 'pw') {
    bar.className = 'pw';
    bar.innerHTML = `<span class="pico">${icon('key', 15)}</span><span class="msg">${p.update ? 'Update' : 'Save'} password for <b>${esc(host(p.origin))}</b>${p.username ? ` · ${esc(p.username)}` : ''}?</span><button class="btn" data-a="never" title="Never for this site">Never</button><button class="btn" data-a="later">Not now</button><button class="btn primary" data-a="save">${p.update ? 'Update' : 'Save'}</button>`;
    bar.querySelectorAll('button').forEach(
      (b) =>
        (b.onclick = () => {
          if (b.dataset.a !== 'later') A.pwAnswer(p.reqId, b.dataset.a);
          if (b.dataset.a === 'save') toast('Password saved, encrypted by Windows');
          nextPrompt();
        }),
    );
    return;
  }
  bar.className = '';
  const what = p.kind === 'openExternal' && p.externalURL ? `open ${esc(p.externalURL.split(':')[0])} links` : PERM_TEXT[p.kind] ?? esc(p.kind);
  bar.innerHTML = `<span class="pico">${icon(PERM_ICON[p.kind] ?? (p.kind === 'camera-microphone' ? 'camera' : 'settings'), 15)}</span><span class="msg"><b>${esc(host(p.origin))}</b> wants to ${what}</span><label><input type="checkbox" id="perm-remember" checked> Remember</label><button class="btn" data-a="0">Block</button><button class="btn primary" data-a="1">Allow</button>`;
  bar.querySelectorAll('button').forEach(
    (b) =>
      (b.onclick = () => {
        A.answerPermission(p.reqId, b.dataset.a === '1', $('#perm-remember').checked);
        nextPrompt();
      }),
  );
}

// ---------- messages from main ----------
let lastLayoutKey = '';
A.onState((s) => {
  const switched = s.active !== S.active;
  S = s;
  document.body.classList.toggle('fullscreen', s.fullscreen);
  const lk = [s.side, s.fullscreen].join('|');
  if (lk !== lastLayoutKey) {
    lastLayoutKey = lk;
    syncLayout();
  }
  renderSplit();
  renderTabs();
  renderVTabs();
  renderRail();
  renderToolbar();
  if (switched && !$('#findbar').hidden) closeFind();
  renderStage();
});
A.onDownloads((d) => {
  store.downloads = d;
  if (panel === 'downloads') renderDownloads($('#panel .pbody'));
  else if (d.some((x) => x.state === 'progressing')) $('#dl-top-dot').hidden = false;
});
A.onReader((a) => showReaderResult(a));
A.onToast((m) => toast(m));
A.onCommand((cmd) => {
  if (cmd === 'focus-address') {
    if (cur()?.url) openCommand();
    else $('#ntp-search')?.focus();
  } else if (cmd === 'find') openFind();
  else if (cmd === 'bookmark') toggleBookmark();
  else if (cmd === 'tab-search') openTabSearch();
  else if (cmd === 'clear-data') openClearData();
  else if (cmd === 'menu') openMenu();
  else if (cmd === 'toggle-bookmarks-bar') setSetting({ bookmarksBar: !store.settings.bookmarksBar });
  else if (cmd === 'toggle-sidebar') setSetting({ sidebar: !store.settings.sidebar });
  else if (cmd === 'toggle-vertical') setSetting({ tabLayout: vertical() ? 'dock' : 'vertical' });
  else if (cmd.startsWith('group-edit:')) editGroup(Number(cmd.slice(11)));
  else if (cmd.startsWith('bm-folder:')) A.bookmarkFolderMenu(cmd.slice(10));
  else if (cmd.startsWith('panel-open:')) openPanel(cmd.slice(11));
  else if (cmd.startsWith('panel:')) togglePanel(cmd.slice(6));
  else if (cmd === 'download-started') {
    if (panel !== 'downloads') $('#dl-dot').hidden = $('#dl-top-dot').hidden = false;
    A.panelState(panel || ''); // the island shows its own download dot
    toast('Download started');
  }
});
addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (sheetOpen) closeSheet();
  else closeCommand();
});

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 2400);
}

// ---------- start ----------
store = await A.store();
const first = await A.state();
S = first;
applySettings();
if (first.tabs.length) {
  renderVTabs();
  renderToolbar();
  renderStage();
}
