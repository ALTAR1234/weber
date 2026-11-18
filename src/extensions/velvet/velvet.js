// Velvet for YouTube: its own interface over youtube.com.
// - a floating glass bar replaces YouTube's top bar and side menu on every page
// - Home is Velvet's own: a search pill, a mosaic of videos in mixed sizes, your channels in a rail down the
//   side, and more videos as big cards with the title on the art
// - on a video page, the video's own art glows behind everything (drawn by velvet.css)
// Videos and channels come from the same YouTube pages your browser already loads (your own signed-in
// session); nothing is sent anywhere else.
(() => {
  if (window.top !== window) return; // not in YouTube's embedded frames
  const root = document.documentElement;
  root.classList.add('velvet');
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const text = (t) => (t == null ? '' : typeof t === 'string' ? t : t.simpleText ?? t.content ?? (t.runs || []).map((r) => r.text).join('') ?? '');
  const thumb = (id, big) => `https://i.ytimg.com/vi/${id}/${big ? 'hq720' : 'mqdefault'}.jpg`; // both 16:9, no black bands
  const img = (sources) => { const s = (sources || []).slice().sort((a, b) => (b.width || 0) - (a.width || 0))[0]?.url || ''; return s.startsWith('//') ? `https:${s}` : s; };

  // ---------- reading YouTube's own page data ----------
  function channelOf(v) {
    // old layout
    const link = v.channelThumbnailSupportedRenderers?.channelThumbnailWithLinkRenderer;
    if (link) return { name: text(v.ownerText || v.shortBylineText || v.longBylineText), avatar: img(link.thumbnail?.thumbnails), url: link.navigationEndpoint?.browseEndpoint?.canonicalBaseUrl || '' };
    // new layout
    const av = v.metadata?.lockupMetadataViewModel?.image?.decoratedAvatarViewModel;
    if (av) {
      const ep = av.rendererContext?.commandContext?.onTap?.innertubeCommand;
      return { name: '', avatar: img(av.avatar?.avatarViewModel?.image?.sources), url: ep?.browseEndpoint?.canonicalBaseUrl || ep?.commandMetadata?.webCommandMetadata?.url || '' };
    }
    return null;
  }
  function videoFrom(key, v) {
    if (['videoRenderer', 'gridVideoRenderer', 'compactVideoRenderer'].includes(key)) {
      if (!v.videoId) return null;
      const overlays = v.thumbnailOverlays || [];
      const time = overlays.find((o) => o.thumbnailOverlayTimeStatusRenderer)?.thumbnailOverlayTimeStatusRenderer;
      if (time?.style === 'SHORTS') return null;
      const resume = overlays.find((o) => o.thumbnailOverlayResumePlaybackRenderer)?.thumbnailOverlayResumePlaybackRenderer;
      const ch = channelOf(v) || {};
      return { id: v.videoId, title: text(v.title), channel: text(v.ownerText || v.shortBylineText || v.longBylineText), avatar: ch.avatar, chUrl: ch.url,
        length: text(v.lengthText) || text(time?.text), views: text(v.shortViewCountText || v.viewCountText), when: text(v.publishedTimeText),
        progress: resume?.percentDurationWatched ?? 0, live: (v.badges || []).some((b) => /LIVE/.test(b.metadataBadgeRenderer?.style || '')) || time?.style === 'LIVE' };
    }
    if (key === 'lockupViewModel' && v.contentType === 'LOCKUP_CONTENT_TYPE_VIDEO' && v.contentId) {
      const meta = v.metadata?.lockupMetadataViewModel;
      const parts = (meta?.metadata?.contentMetadataViewModel?.metadataRows || []).flatMap((r) => (r.metadataParts || []).map((p) => text(p.text)));
      const overlays = v.contentImage?.thumbnailViewModel?.overlays || [];
      const badge = overlays.flatMap((o) => o.thumbnailOverlayBadgeViewModel?.thumbnailBadges || o.thumbnailBottomOverlayViewModel?.badges || []).map((b) => b.thumbnailBadgeViewModel?.text).find(Boolean) || '';
      const bar = overlays.map((o) => o.thumbnailBottomOverlayViewModel?.progressBar?.thumbnailOverlayProgressBarViewModel?.startPercent).find((n) => n != null);
      const ch = channelOf(v) || {};
      return { id: v.contentId, title: text(meta?.title), channel: parts.find((p) => p && !/view|ago|watching|streamed|scheduled|premiere/i.test(p)) || '', avatar: ch.avatar, chUrl: ch.url,
        length: /\d:\d/.test(badge) ? badge : '', views: parts.find((p) => /view|watching/i.test(p)) || '', when: parts.find((p) => /ago|streamed/i.test(p)) || '', progress: bar ?? 0, live: /live/i.test(badge) };
    }
    return null;
  }
  function videos(data, max = 40) {
    const out = []; const seen = new Set();
    const walk = (o, depth) => {
      if (!o || typeof o !== 'object' || depth > 40 || out.length >= max) return;
      if (Array.isArray(o)) { for (const x of o) walk(x, depth + 1); return; }
      for (const [k, v] of Object.entries(o)) {
        if (/^(reelShelfRenderer|richShelfRenderer|shortsLockupViewModel|reelItemRenderer|adSlotRenderer)$/.test(k)) continue; // Shorts and ads
        const vid = v && typeof v === 'object' ? videoFrom(k, v) : null;
        if (vid) { if (vid.title && !seen.has(vid.id)) { seen.add(vid.id); out.push(vid); } continue; }
        walk(v, depth + 1);
      }
    };
    walk(data, 0);
    return out;
  }
  function channelsFrom(data) {
    const out = []; const seen = new Set();
    const walk = (o, depth) => {
      if (!o || typeof o !== 'object' || depth > 40 || out.length >= 40) return;
      if (Array.isArray(o)) { for (const x of o) walk(x, depth + 1); return; }
      for (const [k, v] of Object.entries(o)) {
        if ((k === 'channelRenderer' || k === 'gridChannelRenderer') && v?.channelId && !seen.has(v.channelId)) {
          seen.add(v.channelId);
          out.push({ name: text(v.title), avatar: img(v.thumbnail?.thumbnails), url: v.navigationEndpoint?.browseEndpoint?.canonicalBaseUrl || `/channel/${v.channelId}` });
          continue;
        }
        walk(v, depth + 1);
      }
    };
    walk(data, 0);
    return out;
  }
  async function page(url) {
    const r = await fetch(url, { credentials: 'include', cache: 'no-store' });
    if (!r.ok) return null;
    const html = await r.text();
    const m = html.match(/var ytInitialData\s*=\s*(\{.+?\});\s*<\/script>/s) || html.match(/window\["ytInitialData"\]\s*=\s*(\{.+?\});/s);
    try { return m ? JSON.parse(m[1]) : null; } catch { return null; }
  }
  const signedIn = () => /(^|;\s*)(SAPISID|__Secure-3PAPISID|LOGIN_INFO)=/.test(document.cookie) || Boolean(document.querySelector('#avatar-btn, ytd-topbar-menu-button-renderer #avatar-btn'));

  // ---------- the bar ----------
  const icon = (name) => ({
    search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>',
    home: '<svg viewBox="0 0 24 24"><path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/></svg>',
    subs: '<svg viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="13" rx="3"/><path d="M7 3h10M10 11v5l4-2.5z"/></svg>',
    lib: '<svg viewBox="0 0 24 24"><path d="M5 4v16M10 4v16M15 4l4 16"/></svg>',
    play: '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>',
    more: '<svg viewBox="0 0 24 24"><path d="M5 12h14M12 5v14"/></svg>',
  }[name]);
  function where() { const p = location.pathname; return p === '/' ? 'home' : p.startsWith('/feed/subscriptions') ? 'subs' : p.startsWith('/feed/you') || p.startsWith('/feed/library') || p.startsWith('/feed/history') || p.startsWith('/playlist') ? 'lib' : ''; }
  function buildBar() {
    if (document.getElementById('velvet-bar') || !document.body) return;
    const bar = document.createElement('nav');
    bar.id = 'velvet-bar';
    bar.innerHTML = `<a class="vv-brand" href="/" title="Home"><span class="vv-mark"></span><b>Velvet</b></a>
      <a class="vv-tab" data-w="home" href="/">${icon('home')}<span>Home</span></a>
      <a class="vv-tab" data-w="subs" href="/feed/subscriptions">${icon('subs')}<span>Subscriptions</span></a>
      <a class="vv-tab" data-w="lib" href="/feed/you">${icon('lib')}<span>Library</span></a>
      <form class="vv-find" action="/results" autocomplete="off">${icon('search')}<input name="search_query" placeholder="Search videos and channels" spellcheck="false"></form>`;
    document.body.append(bar);
    const q = new URLSearchParams(location.search).get('search_query');
    if (q) bar.querySelector('input').value = q;
    paintBar();
  }
  function paintBar() {
    const w = where();
    document.querySelectorAll('#velvet-bar .vv-tab').forEach((a) => a.classList.toggle('on', a.dataset.w === w));
  }

  // ---------- Home ----------
  let homeData = null; let homeAt = 0; let loading = null;
  async function loadHome() {
    if (homeData && Date.now() - homeAt < 5 * 60000) return homeData;
    if (loading) return loading;
    loading = (async () => {
      const me = signedIn();
      const [home, subs, chans] = await Promise.all([
        page('/').catch(() => null),
        me ? page('/feed/subscriptions').catch(() => null) : null,
        me ? page('/feed/channels').catch(() => null) : null,
      ]);
      let feed = videos(home);
      if (feed.length < 6) feed = feed.concat(videos(await page('/results?search_query=popular+today').catch(() => null))).filter((v, i, a) => a.findIndex((x) => x.id === v.id) === i);
      const fromSubs = videos(subs);
      // the rail: your channels; ones with a video in the last day get a ring
      let rail = channelsFrom(chans);
      const fresh = new Set(fromSubs.filter((v) => /(second|minute|hour)s? ago/i.test(v.when)).map((v) => v.chUrl));
      if (!rail.length) { // signed out, or the channels page looked different: the channels in your feed
        const seen = new Set();
        for (const v of [...fromSubs, ...feed]) if (v.avatar && v.chUrl && !seen.has(v.chUrl)) { seen.add(v.chUrl); rail.push({ name: v.channel, avatar: v.avatar, url: v.chUrl }); }
      }
      rail = rail.map((c) => ({ ...c, fresh: fresh.has(c.url) })).sort((a, b) => b.fresh - a.fresh).slice(0, 14);
      homeData = { me, feed, fromSubs, rail }; homeAt = Date.now(); loading = null;
      return homeData;
    })();
    return loading;
  }
  const meta = (v) => [v.channel, v.live ? 'Live' : v.views, v.when].filter(Boolean).map(esc).join(' · ');
  function tile(v, cls = '') {
    return `<a class="vv-tile ${cls}" href="/watch?v=${esc(v.id)}" title="${esc(v.title)}">
      <img src="${thumb(v.id, true)}" alt="" loading="lazy" data-id="${esc(v.id)}">
      ${v.live ? '<span class="vv-badge live">Live</span>' : v.length ? `<span class="vv-badge">${esc(v.length)}</span>` : ''}
      <span class="vv-play">${icon('play')}</span>
      <span class="vv-cap"><b>${esc(v.title)}</b><small>${meta(v)}</small></span>
      ${v.progress > 2 ? `<span class="vv-prog"><i style="width:${Math.min(100, v.progress)}%"></i></span>` : ''}
    </a>`;
  }
  function renderHome(d) {
    const el = document.getElementById('velvet-home'); if (!el) return;
    const hour = new Date().getHours();
    const hi = hour < 5 ? 'Up late' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    const mosaic = d.feed.slice(0, 7);
    const more = d.feed.slice(7, 19);
    const subs = d.fromSubs.slice(0, 8);
    el.querySelector('.vv-main').innerHTML = `
      <header class="vv-hello"><h1>${hi}</h1><p>${d.me ? 'Here’s what’s new for you.' : 'Sign in to YouTube to see your own picks and channels.'}</p></header>
      <form class="vv-search" action="/results" autocomplete="off">${icon('search')}<input name="search_query" placeholder="Search videos and channels" spellcheck="false"><button aria-label="Search">${icon('search')}</button></form>
      ${mosaic.length ? `<section class="vv-mosaic">${mosaic.map((v, i) => tile(v, ['vv-big', '', '', 'vv-wide', '', '', ''][i] || '')).join('')}</section>` : '<div class="vv-empty">Nothing to show yet. Try a search.</div>'}
      ${subs.length ? `<h2>From your channels <a href="/feed/subscriptions">See all</a></h2><section class="vv-grid">${subs.map((v) => tile(v)).join('')}</section>` : ''}
      ${more.length ? `<h2>More for you</h2><section class="vv-grid">${more.map((v) => tile(v)).join('')}</section>` : ''}`;
    el.querySelector('.vv-rail').innerHTML = d.rail.map((c) => `<a class="vv-ch ${c.fresh ? 'fresh' : ''}" href="${esc(c.url)}" title="${esc(c.name || 'Channel')}">${c.avatar ? `<img src="${esc(c.avatar)}" alt="">` : `<span>${esc((c.name || '?').slice(0, 1))}</span>`}</a>`).join('')
      + (d.me ? `<a class="vv-ch vv-all" href="/feed/channels" title="All your channels">${icon('more')}</a>` : '');
    // big art: fall back to the smaller picture when a video has no large one
    el.querySelectorAll('img[data-id]').forEach((im) => { im.onerror = () => { if (!im.src.includes('mqdefault')) im.src = thumb(im.dataset.id, false); }; });
  }
  function showHome(on) {
    root.classList.toggle('velvet-home', on);
    let el = document.getElementById('velvet-home');
    if (!on) return;
    if (!el) {
      el = document.createElement('div'); el.id = 'velvet-home';
      el.innerHTML = '<aside class="vv-rail" aria-label="Your channels"></aside><main class="vv-main"><div class="vv-loading"><i></i><i></i><i></i></div></main>';
      document.body.append(el);
    }
    loadHome().then(renderHome).catch(() => {});
  }

  // ---------- the video page backdrop ----------
  let shown = '';
  function backdrop() {
    const id = new URL(location.href).searchParams.get('v');
    const onWatch = location.pathname === '/watch' && /^[\w-]{11}$/.test(id || '');
    root.classList.toggle('velvet-watch', onWatch);
    if (!onWatch || id === shown) return;
    shown = id;
    root.style.setProperty('--velvet-art', `url("https://i.ytimg.com/vi/${id}/hqdefault.jpg")`);
  }

  function route() {
    backdrop(); buildBar(); paintBar();
    showHome(location.pathname === '/');
  }
  function start() {
    if (!document.getElementById('velvet-bg')) { const d = document.createElement('div'); d.id = 'velvet-bg'; d.setAttribute('aria-hidden', 'true'); document.body.prepend(d); }
    route();
  }
  backdrop();
  if (document.body) start(); else addEventListener('DOMContentLoaded', start);
  // YouTube changes pages without reloading
  addEventListener('yt-navigate-finish', route);
  addEventListener('popstate', route);
  addEventListener('fullscreenchange', () => root.classList.toggle('velvet-full', Boolean(document.fullscreenElement)));
})();
