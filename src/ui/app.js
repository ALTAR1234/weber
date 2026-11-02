// Weber browser UI (Island): address pill on top, tabs in a floating dock,
// panels and the new-tab page. Pages live in native views that main lays out
// exactly over #stage.
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
  x: '<path d="M7 7l10 10M17 7L7 17"/>',
  star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.5 9.7l5.9-.8z"/>',
  shield: '<path d="M12 3l7 3v6c0 4.5-3 7.7-7 9-4-1.3-7-4.5-7-9V6z"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  history: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',
  bookmarks: '<path d="M7 4h10v16l-5-3.5L7 20z"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"/>',
  lock: '<rect x="6" y="11" width="12" height="9" rx="2"/><path d="M8.5 11V8a3.5 3.5 0 0 1 7 0v3"/>',
  globe: '<circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4c2.5 2.5 2.5 13.5 0 16M12 4c-2.5 2.5-2.5 13.5 0 16"/>',
  search: '<circle cx="11" cy="11" r="6"/><path d="M16 16l4 4"/>',
  up: '<path d="M6 15l6-6 6 6"/>',
  down: '<path d="M6 9l6 6 6-6"/>',
  sound: '<path d="M5 10v4h3l4 4V6L8 10z"/><path d="M16 9a4 4 0 0 1 0 6"/>',
  mute: '<path d="M5 10v4h3l4 4V6L8 10z"/><path d="M16 10l4 4M20 10l-4 4"/>',
  folder: '<path d="M4 7a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/>',
  trash: '<path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  image: '<rect x="4" y="5" width="16" height="14" rx="3"/><circle cx="9" cy="10" r="1.6"/><path d="M20 16l-5-5-8 8"/>',
  play: '<rect x="4" y="5" width="16" height="14" rx="3"/><path d="M10.5 9.5v5l4-2.5z"/>',
  news: '<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M8 9h8M8 12.5h8M8 16h5"/>',
  pin: '<path d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11z"/><circle cx="12" cy="10" r="2.2"/>',
};
const icon = (n, s = 18) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[n]}</svg>`;
const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
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
    if (img.dataset.fb) fb.textContent = img.dataset.fb;
    else fb.className = 'dot';
    img.replaceWith(fb);
  },
  true,
);

let S = { tabs: [], active: null };
let store = { bookmarks: [], settings: {}, downloads: [] };
let panel = null; // 'bookmarks' | 'history' | 'downloads' | 'settings'
const cur = () => S.tabs.find((t) => t.id === S.active);

// ---------- static buttons ----------
for (const [id, n, size] of [
  ['back', 'back'], ['forward', 'forward'], ['reload', 'reload'], ['star', 'star', 17], ['shield', 'shield', 17],
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
$('#shield').onclick = () => togglePanel('settings');
$('#bm-btn').onclick = () => togglePanel('bookmarks');
$('#hist-btn').onclick = () => togglePanel('history');
$('#dl-btn').onclick = () => togglePanel('downloads');
$('#set-btn').onclick = () => togglePanel('settings');
$('#zoom-pill').onclick = () => A.zoom(0);

// ---------- layout: tell main where the page sits ----------
function syncLayout() {
  document.body.classList.toggle('panel', !!panel);
  for (const [id, p] of [['bm-btn', 'bookmarks'], ['hist-btn', 'history'], ['dl-btn', 'downloads'], ['set-btn', 'settings']]) $('#' + id).classList.toggle('on', panel === p);
  const r = $('#stage').getBoundingClientRect();
  A.layout({ left: r.left, top: r.top, right: innerWidth - r.right, bottom: innerHeight - r.bottom });
}
addEventListener('resize', syncLayout);

// ---------- dock tabs: icons, with the active one opened up to show its title ----------
function renderTabs() {
  const box = $('#tabs');
  box.replaceChildren(
    ...S.tabs.map((t, i) => {
      const el = document.createElement('div');
      el.className = 'tab' + (t.id === S.active ? ' on' : '');
      el.title = (t.url ? t.title : 'New tab') + (t.url ? '\n' + host(t.url) : '');
      el.draggable = true;
      const fav = t.loading ? '<span class="spin"></span>' : t.favicon ? `<img src="${esc(t.favicon)}" alt="" data-fb="">` : icon(t.url ? 'globe' : 'plus', 17);
      el.innerHTML = `<span class="fav">${fav}</span><span class="title">${esc(t.url ? t.title : 'New tab')}</span>${t.audible || t.muted ? `<button class="audio" title="${t.muted ? 'Unmute' : 'Mute'} tab">${icon(t.muted ? 'mute' : 'sound', t.id === S.active ? 15 : 10)}</button>` : ''}<button class="x" title="Close (Ctrl+W)">${icon('x', 14)}</button>`;
      el.onmousedown = (e) => {
        if (e.button === 1) e.preventDefault();
        else if (e.button === 0 && !e.target.closest('button')) A.activate(t.id);
      };
      el.onauxclick = (e) => e.button === 1 && A.closeTab(t.id);
      el.querySelector('.x').onclick = () => A.closeTab(t.id);
      el.querySelector('.audio')?.addEventListener('click', () => A.mute(t.id));
      el.ondragstart = (e) => {
        e.dataTransfer.setData('text/tab', String(t.id));
        el.classList.add('dragging');
      };
      el.ondragend = () => el.classList.remove('dragging');
      el.ondragover = (e) => e.preventDefault();
      el.ondrop = (e) => {
        const id = Number(e.dataTransfer.getData('text/tab'));
        if (id && id !== t.id) A.moveTab(id, i);
      };
      return el;
    }),
  );
  box.querySelector('.tab.on')?.scrollIntoView({ inline: 'nearest' });
}

// ---------- top strip ----------
function renderToolbar() {
  const t = cur();
  if (!t) return;
  $('#back').disabled = !t.canBack;
  $('#forward').disabled = !t.canForward;
  $('#reload').innerHTML = icon(t.loading ? 'stop' : 'reload');
  $('#reload').title = t.loading ? 'Stop' : 'Reload (Ctrl+R)';
  const secure = t.url.startsWith('https:');
  $('#site-icon').innerHTML = icon(t.url ? (secure ? 'lock' : 'globe') : 'search', 13);
  $('#site-icon').title = t.url ? (secure ? 'Connection is secure' : 'Not secure') : '';
  $('#url-text').innerHTML = t.url ? esc(host(t.url)) : '<small>Search or enter address</small>';
  $('#pill').title = t.url ? `${t.title}\n${t.url}` : 'Search or enter address (Ctrl+L)';
  $('#star').classList.toggle('on', store.bookmarks.some((b) => b.url === t.url));
  $('#star').hidden = !/^https?:/.test(t.url);
  $('#zoom-pill').hidden = t.zoom === 1;
  $('#zoom-pill').textContent = Math.round(t.zoom * 100) + '%';
  $('#zoom-pill').title = 'Reset zoom (Ctrl+0)';
  $('#blocked').textContent = store.settings.adblock && t.blocked ? (t.blocked > 99 ? '99+' : t.blocked) : '';
  $('#shield').classList.toggle('off', !store.settings.adblock);
  $('#shield').title = store.settings.adblock ? `${t.blocked} ads and trackers blocked on this page` : 'Ad blocking is off';
  document.title = t.url && t.title ? `${t.title} - Weber` : 'Weber';
}

async function toggleBookmark() {
  const t = cur();
  if (!t || !/^https?:/.test(t.url)) return;
  const had = store.bookmarks.some((b) => b.url === t.url);
  store.bookmarks = await A.bookmarkToggle(t.url, t.title, t.favicon);
  toast(had ? 'Removed from favorites' : 'Added to favorites');
  renderToolbar();
  if (panel === 'bookmarks') renderPanel();
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
address.addEventListener('input', async () => {
  const q = address.value;
  const found = await A.suggest(q);
  suggestions = q.trim() ? [{ search: q.trim() }, ...found] : [];
  pick = 0;
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
function renderSuggest() {
  const box = $('#suggest');
  box.innerHTML = suggestions
    .map((s, i) =>
      s.search
        ? `<div class="sg${i === pick ? ' on' : ''}" data-i="${i}">${icon('search', 16)}<span class="t">${esc(s.search)}</span><span class="u">Search the web</span></div>`
        : `<div class="sg${i === pick ? ' on' : ''}" data-i="${i}">${icon(s.bookmark ? 'star' : 'globe', 16)}<span class="t">${esc(s.title)}</span><span class="u">${esc(s.url)}</span></div>`,
    )
    .join('');
  for (const el of box.children)
    el.onmousedown = (e) => {
      e.preventDefault();
      const s = suggestions[Number(el.dataset.i)];
      go(s.search ?? s.url, e.ctrlKey);
    };
}

let shotOn = false;
function showShot(dataUrl) {
  shotOn = !!dataUrl;
  const stage = $('#stage');
  stage.classList.toggle('shot', shotOn);
  stage.style.backgroundImage = dataUrl ? `url(${dataUrl})` : '';
  if (shotOn) {
    stage.replaceChildren();
    stageKey = 'shot';
  } else renderStage(true);
}

// ---------- stage: new tab and error pages ----------
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
  const key = !t ? '' : t.error ? 'err:' + t.id + t.error.url : !t.url ? 'ntp:' + t.id : 'page';
  if (key === stageKey && !force) return;
  stageKey = key;
  if (key === 'page' || !t) return stage.replaceChildren();
  if (t.error) {
    stage.innerHTML = `<div class="error"><div><div class="big">${icon('globe', 56)}</div><h1>This page couldn’t load</h1><p>${esc(host(t.error.url))} didn’t respond. Check the address or your connection.</p><button class="btn primary" id="retry">Try again</button><p></p><code>${esc(t.error.desc)} (${t.error.code})</code></div></div>`;
    $('#retry').onclick = () => A.navigate(t.error.url);
    return;
  }
  const [top, data] = await Promise.all([A.topSites(), A.ntpData().catch(() => ({ news: [] }))]);
  if (stageKey !== key) return; // switched tabs while loading
  // favorites first, then the sites you visit most, one circle per site
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
  const now = new Date();
  const stories = data.news ?? [];
  const w = data.weather;
  const rate = data.rate;
  const video = data.video;
  const ago = (t) => {
    if (!t) return '';
    const m = Math.round((Date.now() - t) / 60000);
    return m < 2 ? 'Just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} hr ago` : `${Math.round(m / 1440)} days ago`;
  };
  // one story per topic for the grid; the rest go under "Latest & hot"
  const used = new Set();
  const take = (topic) => {
    const s = stories.find((x) => x.topic === topic && !used.has(x.url));
    if (s) used.add(s.url);
    return s;
  };
  const TOPIC_COLOR = { Movies: '#ff4f7b', Games: '#7b5cff', Science: '#2fd6a3', Tech: '#4fb4ff' };
  const story = (n, cls) =>
    n
      ? `<button class="w story ${cls}" data-url="${esc(n.url)}" title="${esc(n.title)}">${n.image ? `<span class="nc-img" style="background-image:url('${esc(n.image)}')"></span>` : ''}<span class="topic" style="--t:${TOPIC_COLOR[n.topic] ?? '#888'}">${esc(n.topic)}</span><span class="nc-body"><b>${esc(n.title)}</b><small>${esc(n.source)} · ${ago(n.at)}</small></span></button>`
      : `<div class="w story ${cls} empty-card"><span class="nc-body"><b>Stories will appear here</b><small>Check your connection</small></span></div>`;
  const movies = take('Movies'), games = take('Games'), science = take('Science'), tech = take('Tech');
  const center = video
    ? `<button class="w story g-c3" data-url="${esc(video.url)}" title="${esc(video.title)}"><span class="nc-img" style="background-image:url('${esc(video.image)}')"></span><span class="topic" style="--t:#ff1f3d">Continue watching</span><span class="play">${icon('play', 22)}</span><span class="nc-body"><b>${esc(video.title)}</b><small>YouTube · ${ago(video.at)}</small></span></button>`
    : story(tech ?? take('Movies'), 'g-c3');

  // exchange-rate sparkline
  let spark = '';
  if (rate?.series?.length > 2) {
    const vs = rate.series.map((p) => p.v);
    const lo = Math.min(...vs), hi = Math.max(...vs), W = 240, H = 120;
    const pts = vs.map((v, i) => [(i / (vs.length - 1)) * W, H - 8 - ((v - lo) / (hi - lo || 1)) * (H - 16)]);
    const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
    const [ex, ey] = pts.at(-1);
    spark = `<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><defs><linearGradient id="sg" x1="0" x2="1"><stop offset="0" stop-color="#7b5cff"/><stop offset="1" stop-color="#ff4fb8"/></linearGradient><linearGradient id="sf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff4fb8" stop-opacity=".28"/><stop offset="1" stop-color="#ff4fb8" stop-opacity="0"/></linearGradient></defs><path d="${d} L${W},${H} L0,${H} Z" fill="url(#sf)"/><path d="${d}" fill="none" stroke="url(#sg)" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${ex}" cy="${ey}" r="4.5" fill="#fff" stroke="#ff4fb8" stroke-width="2.5"/></svg>`;
  }
  const change = rate?.first ? ((rate.latest / rate.first - 1) * 100).toFixed(2) : null;
  const wKind = (code, day = true) => (code === 0 ? (day ? 'sun' : 'moon') : code <= 3 ? 'cloudsun' : code >= 95 ? 'storm' : code >= 51 ? 'rain' : 'cloud');
  const days = (w?.days ?? []).slice(1, 5);

  stage.innerHTML = `<div class="ntp2">
      <nav class="rail" aria-label="Favorites">
        ${apps.map((s) => { const b = brand(s.url); return `<button class="fav-dot${b.mono ? ' mono' : ''}" style="--c:${b.color}" data-url="${esc(s.url)}" title="${esc(label(s))}">${favImg(s.url, s.favicon, label(s)[0])}</button>`; }).join('')}
        <button class="fav-dot add" id="rail-add" title="Favorites">${icon('plus', 18)}</button>
      </nav>
      <div class="grid3">
        ${story(movies, 'g-mv')}
        <button class="w pill weather g-wx" id="w-weather" title="Weather for ${esc(w?.city ?? 'your city')} (change the city in Settings)">
          <span class="pill-ico">${wicon(w ? wKind(w.code, w.day) : 'cloud')}</span>
          <span><b>${w ? esc(w.text) : 'Weather'}</b><small>${w ? `${w.temp}°F · ${esc(w.city)} · H ${w.high}° L ${w.low}°` : 'Unavailable right now'}</small></span>
        </button>
        ${story(games, 'g-gm')}
        <div class="w pill when g-dt">
          <span class="dial">${clockSvg(now)}</span>
          <span><b id="ntp-date">${now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'short' })}</b><small id="ntp-time">${now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · ${Intl.DateTimeFormat().resolvedOptions().timeZone.split('/').pop().replace(/_/g, ' ')}</small></span>
        </div>
        <form class="sq g-b2" id="ntp-form">
          <svg class="sq-shape" viewBox="0 0 300 300" aria-hidden="true"><defs>
            <radialGradient id="sqf" cx="50%" cy="0%" r="110%"><stop offset="0" stop-color="#7a46ff" stop-opacity=".75"/><stop offset=".55" stop-color="#4a22aa" stop-opacity=".55"/><stop offset="1" stop-color="#1c1634" stop-opacity=".92"/></radialGradient>
            <linearGradient id="sqs" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#c6a8ff"/><stop offset=".45" stop-color="#7b5cff"/><stop offset="1" stop-color="#ff4fb8"/></linearGradient>
          </defs><path d="${SQUIRCLE}" fill="url(#sqf)" stroke="url(#sqs)" stroke-width="2"/></svg>
          <span class="hero-mark">${icon('search', 26)}</span>
          <b class="hero-title">Search the web</b>
          <input class="search" id="ntp-search" placeholder="Type or paste anything" spellcheck="false" autocomplete="off" />
          <div class="hero-row">
            <button type="button" class="engine" id="engine" title="Change search engine"><i class="e-dot e-${esc(store.settings.engine ?? 'bing')}"></i>${ENGINE_NAMES[store.settings.engine] ?? 'Bing'}</button>
            ${SCOPES.slice(1, 4).map(([k, l, ic]) => `<button type="button" class="scope${k === scope ? ' on' : ''}" data-scope="${k}" title="${l}">${icon(ic, 15)}</button>`).join('')}
            <button type="submit" class="go" title="Search">${icon('arrow', 17)}</button>
          </div>
        </form>
        <div class="w chart g-ch" title="US dollar to ${esc(rate?.to ?? 'EUR')}, last month">
          <div class="chart-top"><b>USD to ${esc(rate?.to ?? 'EUR')}</b><span class="${change && change < 0 ? 'down' : 'up'}">${change !== null ? (change > 0 ? '+' : '') + change + '%' : ''}</span></div>
          <div class="chart-val">${rate?.latest ? rate.latest.toFixed(4) : '—'}</div>
          <small>Last 30 days</small>
          ${spark}
        </div>
        ${story(science, 'g-sc')}
        ${center}
      </div>
      <button class="latest" id="latest">Latest &amp; hot ${icon('down', 15)}</button>
      <section class="more" id="more">${stories.filter((n) => !used.has(n.url)).slice(0, 16).map((n) => story(n, '')).join('')}</section>
    </div>`;

  $('#engine').onclick = () => {
    const order = ['bing', 'google', 'duckduckgo', 'brave'];
    setSetting({ engine: order[(order.indexOf(store.settings.engine) + 1) % order.length] });
  };
  stage.querySelectorAll('.scope').forEach(
    (b) =>
      (b.onclick = () => {
        scope = scope === b.dataset.scope ? 'web' : b.dataset.scope;
        stage.querySelectorAll('.scope').forEach((x) => x.classList.toggle('on', x.dataset.scope === scope));
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
  $('#latest').onclick = () => $('#more').scrollIntoView({ behavior: 'smooth', block: 'start' });
  for (const el of stage.querySelectorAll('[data-url]')) {
    el.onclick = (e) => (e.ctrlKey ? A.newTab(el.dataset.url) : A.navigate(el.dataset.url));
    el.onauxclick = (e) => e.button === 1 && A.newTab(el.dataset.url);
  }
  if ($('#cmd').hidden) $('#ntp-search').focus();
}

// brand colours for the favorites rail; "mono" turns a dark site icon white on its colour
// (solid-shape logos like YouTube's keep their own colours, or they'd become a white blob)
const BRANDS = {
  'youtube.com': ['#ff1f3d', 0], 'facebook.com': ['#1877f2', 1], 'instagram.com': ['linear-gradient(45deg,#f9a03f,#e1306c,#833ab4)', 0], 'amazon.com': ['#ff9a1f', 1],
  'dribbble.com': ['#ea4c89', 1], 'reddit.com': ['#ff4500', 0], 'twitter.com': ['#111', 1], 'x.com': ['#111', 1], 'github.com': ['#24292f', 1], 'netflix.com': ['#e50914', 0],
  'twitch.tv': ['#9146ff', 1], 'spotify.com': ['#1db954', 1], 'linkedin.com': ['#0a66c2', 1], 'tiktok.com': ['#111', 1], 'pinterest.com': ['#e60023', 0], 'discord.com': ['#5865f2', 1],
  'theverge.com': ['#5200ff', 1], 'bing.com': ['#0c7ce6', 0], 'wikipedia.org': ['#f4f4f6', 0], 'google.com': ['#f4f4f6', 0], 'apple.com': ['#f4f4f6', 0],
};
function brand(url) {
  const h = host(url).split('.').slice(-2).join('.');
  const b = BRANDS[h];
  if (b) return { color: b[0], mono: !!b[1] };
  let n = 0;
  for (const ch of h) n = (n * 31 + ch.charCodeAt(0)) % 360;
  return { color: `hsl(${n} 70% 52%)`, mono: false };
}
// superellipse outline (n = 8: tighter corners than a classic squircle) for the search squircle, 300 x 300 with room for its stroke
const SQUIRCLE = (() => {
  const n = 8, r = 148, c = 150, pts = [];
  for (let i = 0; i < 160; i++) {
    const t = (i / 160) * Math.PI * 2, ct = Math.cos(t), st = Math.sin(t);
    pts.push([c + r * Math.sign(ct) * Math.abs(ct) ** (2 / n), c + r * Math.sign(st) * Math.abs(st) ** (2 / n)]);
  }
  return 'M' + pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' L') + ' Z';
})();
function clockSvg(d) {
  const h = (d.getHours() % 12) * 30 + d.getMinutes() / 2, m = d.getMinutes() * 6;
  const hand = (deg, len, w) => `<line x1="20" y1="20" x2="${20 + len * Math.sin((deg * Math.PI) / 180)}" y2="${20 - len * Math.cos((deg * Math.PI) / 180)}" stroke="currentColor" stroke-width="${w}" stroke-linecap="round"/>`;
  const ticks = [0, 90, 180, 270].map((a) => `<circle cx="${20 + 15.5 * Math.sin((a * Math.PI) / 180)}" cy="${20 - 15.5 * Math.cos((a * Math.PI) / 180)}" r="1.2" fill="currentColor" opacity=".6"/>`).join('');
  return `<svg viewBox="0 0 40 40" width="40" height="40">${ticks}${hand(h, 8.5, 2.6)}${hand(m, 13, 1.8)}<circle cx="20" cy="20" r="2" fill="#ff4fb8"/></svg>`;
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
  const dial = document.querySelector('.when .dial');
  if (!dial) return;
  const d = new Date();
  dial.innerHTML = clockSvg(d);
  $('#ntp-time').textContent = `${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · ${Intl.DateTimeFormat().resolvedOptions().timeZone.split('/').pop().replace(/_/g, ' ')}`;
}
setInterval(tick, 10_000);

// ---------- side panel ----------
function togglePanel(name) {
  openPanel(panel === name ? null : name);
}
function openPanel(name) {
  panel = name;
  $('#panel').hidden = !panel;
  syncLayout();
  if (panel) renderPanel();
  if (name === 'downloads') $('#dl-dot').hidden = true;
}
const PANELS = [['bookmarks', 'Favorites'], ['history', 'History'], ['downloads', 'Downloads'], ['settings', 'Settings']];
const THEMES = [['aurora', 'Aurora'], ['ocean', 'Ocean'], ['ember', 'Ember'], ['forest', 'Forest'], ['rose', 'Rose'], ['black', 'Black']];
async function renderPanel() {
  const el = $('#panel');
  el.innerHTML = `<div class="ptabs">${PANELS.map(([k, l]) => `<button data-p="${k}" class="${k === panel ? 'on' : ''}">${l}</button>`).join('')}</div><div class="pbody"></div>`;
  for (const b of el.querySelectorAll('.ptabs button')) b.onclick = () => openPanel(b.dataset.p);
  const body = el.querySelector('.pbody');
  const row = (url, title, sub, fav, actions = '') => `<div class="row" data-url="${esc(url)}">${favImg(url, fav)}<div class="txt"><b>${esc(title)}</b><small>${esc(sub)}</small></div>${actions}</div>`;
  const wire = () =>
    body.querySelectorAll('.row[data-url]').forEach((r) => {
      r.onclick = (e) => !e.target.closest('button') && (e.ctrlKey ? A.newTab(r.dataset.url) : A.navigate(r.dataset.url));
      r.onauxclick = (e) => e.button === 1 && A.newTab(r.dataset.url);
    });

  if (panel === 'bookmarks') {
    body.innerHTML = store.bookmarks.length ? store.bookmarks.map((b) => row(b.url, b.title, host(b.url), b.favicon, `<button class="icon" title="Remove">${icon('trash', 15)}</button>`)).join('') : '<div class="empty">No favorites yet.<br>Press Ctrl+D or the star on any page.</div>';
    body.querySelectorAll('.row .icon').forEach((btn) => {
      btn.onclick = async () => {
        store.bookmarks = await A.bookmarkRemove(btn.closest('.row').dataset.url);
        renderToolbar();
        renderPanel();
      };
    });
    wire();
  } else if (panel === 'history') {
    body.innerHTML = `<input class="filter" placeholder="Search history" spellcheck="false"><div class="list"></div>`;
    const input = body.querySelector('.filter');
    const draw = async () => {
      const items = await A.history(input.value);
      let day = '';
      body.querySelector('.list').innerHTML = items.length
        ? items
            .map((h) => {
              const d = new Date(h.at).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
              const head = d !== day ? `<div class="day">${(day = d)}</div>` : '';
              return head + row(h.url, h.title, `${new Date(h.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · ${host(h.url)}`);
            })
            .join('')
        : '<div class="empty">Nothing here.</div>';
      wire();
    };
    input.oninput = draw;
    draw();
    el.insertAdjacentHTML('beforeend', '<div class="pfoot"><button class="btn danger" id="clear-history">Clear browsing history</button></div>');
    $('#clear-history').onclick = async () => {
      await A.historyClear();
      toast('History cleared');
      renderPanel();
    };
  } else if (panel === 'downloads') {
    renderDownloads(body);
    el.insertAdjacentHTML('beforeend', '<div class="pfoot"><button class="btn" id="clear-dl">Clear list</button></div>');
    $('#clear-dl').onclick = async () => {
      store.downloads = await A.downloadsClear();
      renderPanel();
    };
  } else if (panel === 'settings') {
    const s = store.settings;
    body.innerHTML = `
      <div class="set"><h4>Background</h4><p>Shows around your pages and behind new tabs.</p>
        <div class="seg">${BG_MODES.map(([k, l]) => `<button data-bgmode="${k}" class="${(s.bgMode ?? 'theme') === k ? 'on' : ''}">${l}</button>`).join('')}</div>
        ${bgOptions(s)}
        ${(s.bgMode ?? 'theme') !== 'theme' ? `<label class="range">Dim <input type="range" id="bg-dim" min="0" max="80" step="1" value="${s.bgDim ?? 25}"></label>` : ''}
      </div>
      <div class="set"><h4>Search engine</h4><p>Used for anything you type that isn’t an address.</p>
        <div class="seg">${['bing', 'google', 'duckduckgo', 'brave'].map((e) => `<button data-engine="${e}" class="${s.engine === e ? 'on' : ''}">${ENGINE_NAMES[e]}</button>`).join('')}</div></div>
      <div class="set"><h4>Extensions</h4><p>Add extensions from the Chrome Web Store. Their icons show in the top bar.</p>
        <div id="ext-list"></div>
        <button class="btn primary" id="get-ext">Open Chrome Web Store</button></div>
      <div class="set switch"><div><h4>Block ads and trackers</h4><p>Stops requests to common ad and tracking networks.</p></div><button class="toggle ${s.adblock ? 'on' : ''}" data-set="adblock"></button></div>
      <div class="set"><h4>Shortcuts</h4><div class="keys">
        <kbd>Ctrl+L</kbd><span>Search or enter address</span><kbd>Ctrl+T</kbd><span>New tab</span><kbd>Ctrl+Shift+T</kbd><span>Reopen closed tab</span>
        <kbd>Ctrl+W</kbd><span>Close tab</span><kbd>Ctrl+F</kbd><span>Find in page</span><kbd>Ctrl+D</kbd><span>Add to favorites</span>
        <kbd>Ctrl+H</kbd><span>History</span><kbd>Ctrl+J</kbd><span>Downloads</span><kbd>Ctrl+Tab</kbd><span>Next tab</span>
        <kbd>Ctrl + / −</kbd><span>Zoom</span><kbd>F11</kbd><span>Full screen</span><kbd>F12</kbd><span>Developer tools</span>
      </div></div>
      <div class="set"><h4>J.A.R.V.I.S.</h4><p>Jarvis can open sites, list and switch your tabs, and read the current page for you. Try “open YouTube in Weber” or “summarize this page”.</p></div>`;
    wireBackground(body, s);
    $('#get-ext').onclick = () => A.newTab('https://chromewebstore.google.com/');
    renderExtensions();
    body.querySelectorAll('[data-engine]').forEach((b) => (b.onclick = () => setSetting({ engine: b.dataset.engine })));
    body.querySelectorAll('[data-set]').forEach((b) => (b.onclick = () => setSetting({ [b.dataset.set]: !s[b.dataset.set] })));
  }
}
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
}
const size = (n) => (n > 1e9 ? (n / 1e9).toFixed(2) + ' GB' : n > 1e6 ? (n / 1e6).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1e3)) + ' KB');
function renderDownloads(body) {
  if (!store.downloads.length) return (body.innerHTML = '<div class="empty">No downloads yet.</div>');
  body.innerHTML = store.downloads
    .map((d) => {
      const pct = d.total ? Math.round((d.received / d.total) * 100) : 0;
      const sub = d.state === 'progressing' ? `${size(d.received)}${d.total ? ' of ' + size(d.total) : ''}` : d.state === 'completed' ? `${size(d.received)} · ${host(d.url)}` : d.state === 'cancelled' ? 'Cancelled' : 'Failed';
      return `<div class="row" data-id="${d.id}">${icon('download', 16)}<div class="txt"><b>${esc(d.name)}</b><small>${esc(sub)}</small>${d.state === 'progressing' ? `<div class="meter"><i style="width:${pct}%"></i></div>` : ''}</div>
        ${d.state === 'progressing' ? `<button class="icon" data-a="cancel" title="Cancel">${icon('x', 15)}</button>` : `<button class="icon" data-a="show" title="Show in folder">${icon('folder', 15)}</button>`}</div>`;
    })
    .join('');
  body.querySelectorAll('.row').forEach((r) => {
    r.onclick = (e) => {
      const a = e.target.closest('button')?.dataset.a;
      if (a === 'cancel') A.downloadCancel(r.dataset.id);
      else if (a === 'show') A.downloadShow(r.dataset.id);
      else A.downloadOpen(r.dataset.id);
    };
  });
}

// ---------- extensions list (settings) ----------
async function renderExtensions() {
  const box = $('#ext-list');
  if (!box) return;
  const list = await A.extensions();
  box.innerHTML = list.length
    ? list.map((e) => `<div class="row ext-row"><span class="dot"></span><div class="txt"><b>${esc(e.name)}</b><small>${esc(e.description || 'Version ' + e.version)}</small></div><button class="icon" data-ext="${esc(e.id)}" title="Remove">${icon('trash', 15)}</button></div>`).join('')
    : '<p style="margin:0 0 10px">No extensions yet.</p>';
  box.querySelectorAll('[data-ext]').forEach(
    (b) =>
      (b.onclick = async () => {
        await A.removeExtension(b.dataset.ext);
        toast('Extension removed');
        renderExtensions();
      }),
  );
}

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

// ---------- find in page and permission prompts take the pill's place ----------
const syncCenter = () => ($('#pill').hidden = !$('#findbar').hidden || !$('#permbar').hidden);
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
  if (permQueue.length) showPerm();
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
  geolocation: 'know your location',
  notifications: 'show notifications',
  openExternal: 'open an app on your PC',
  'display-capture': 'see your screen',
  'clipboard-read': 'read your clipboard',
  midi: 'use MIDI devices',
  midiSysex: 'control MIDI devices',
  hid: 'use a connected device',
  serial: 'use a serial port',
  usb: 'use a USB device',
  'idle-detection': 'know when you’re away',
};
const permQueue = [];
A.onPermission((p) => {
  permQueue.push(p);
  if (permQueue.length === 1) showPerm();
});
function showPerm() {
  const p = permQueue[0];
  const bar = $('#permbar');
  if (!p || !$('#findbar').hidden) {
    bar.hidden = true;
    return syncCenter();
  }
  if (p.tabId !== S.active) A.activate(p.tabId);
  bar.hidden = false;
  syncCenter();
  const what = p.kind === 'openExternal' && p.externalURL ? `open ${esc(p.externalURL.split(':')[0])} links` : PERM_TEXT[p.kind] ?? esc(p.kind);
  bar.innerHTML = `<span class="msg"><b>${esc(host(p.origin))}</b> wants to ${what}</span><label><input type="checkbox" id="perm-remember" checked> Remember</label><button class="btn" data-a="0">Block</button><button class="btn primary" data-a="1">Allow</button>`;
  bar.querySelectorAll('button').forEach(
    (b) =>
      (b.onclick = () => {
        A.answerPermission(p.reqId, b.dataset.a === '1', $('#perm-remember').checked);
        permQueue.shift();
        showPerm();
      }),
  );
}

// ---------- messages from main ----------
A.onState((s) => {
  const switched = s.active !== S.active;
  S = s;
  document.body.classList.toggle('fullscreen', s.fullscreen);
  renderTabs();
  renderToolbar();
  if (switched && !$('#findbar').hidden) closeFind();
  renderStage();
});
A.onDownloads((d) => {
  store.downloads = d;
  if (panel === 'downloads') renderDownloads($('#panel .pbody'));
});
A.onCommand((cmd) => {
  if (cmd === 'focus-address') {
    if (cur()?.url) openCommand();
    else $('#ntp-search')?.focus();
  } else if (cmd === 'find') openFind();
  else if (cmd === 'bookmark') toggleBookmark();
  else if (cmd === 'panel:history') togglePanel('history');
  else if (cmd === 'panel:downloads') togglePanel('downloads');
  else if (cmd === 'download-started') {
    if (panel !== 'downloads') $('#dl-dot').hidden = false;
    toast('Download started');
  }
});
addEventListener('keydown', (e) => e.key === 'Escape' && closeCommand());

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 1800);
}

// ---------- start ----------
store = await A.store();
applySettings();
const first = await A.state();
if (first.tabs.length) {
  S = first;
  renderTabs();
  renderToolbar();
  renderStage();
}
