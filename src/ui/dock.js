// Weber's island: tabs and tools in a floating glass dock. It lives in its own
// transparent view above the web page, so it floats over whatever is open.
const A = window.weber;
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };

const ICONS = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M7 7l10 10M17 7L7 17"/>',
  spark: '<path d="M12 3.5l1.9 5.6 5.6 1.9-5.6 1.9L12 18.5l-1.9-5.6L4.5 11l5.6-1.9z"/>',
  globe: '<circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4c2.5 2.5 2.5 13.5 0 16M12 4c-2.5 2.5-2.5 13.5 0 16"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  history: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',
  bookmarks: '<path d="M7 4h10v16l-5-3.5L7 20z"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"/>',
  sound: '<path d="M5 10v4h3l4 4V6L8 10z"/><path d="M16 9a4 4 0 0 1 0 6"/>',
  mute: '<path d="M5 10v4h3l4 4V6L8 10z"/><path d="M16 10l4 4M20 10l-4 4"/>',
};
const icon = (name, size = 20) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`;

for (const [id, name] of [['new-tab', 'plus'], ['bm-btn', 'bookmarks'], ['hist-btn', 'history'], ['dl-btn', 'download'], ['set-btn', 'settings']]) $('#' + id).insertAdjacentHTML('afterbegin', icon(name));
$('#new-tab').onclick = () => A.newTab();
for (const [id, p] of [['bm-btn', 'bookmarks'], ['hist-btn', 'history'], ['dl-btn', 'downloads'], ['set-btn', 'settings']]) $('#' + id).onclick = () => A.uiCommand('panel:' + p);

// a broken favicon falls back to the site's first letter
document.addEventListener('error', (e) => {
  const img = e.target;
  if (img.tagName !== 'IMG') return;
  const fb = document.createElement('span');
  fb.className = 'letter';
  fb.textContent = img.dataset.fb || '';
  img.replaceWith(fb);
}, true);

let S = { tabs: [], active: null };
function render() {
  const box = $('#tabs');
  box.replaceChildren(
    ...S.tabs.map((t, i) => {
      const el = document.createElement('div');
      el.className = 'tab' + (t.id === S.active ? ' on' : '');
      el.title = t.url ? `${t.title}\n${host(t.url)}` : 'New tab';
      el.draggable = true;
      const letter = esc((host(t.url)[0] || '').toUpperCase());
      const fav = t.loading ? '<span class="spin"></span>' : t.favicon ? `<img src="${esc(t.favicon)}" alt="" data-fb="${letter}">` : icon(t.url ? 'globe' : 'spark', 20);
      el.innerHTML = `<span class="fav">${fav}</span>${t.audible || t.muted ? `<button class="audio" title="${t.muted ? 'Unmute' : 'Mute'} tab">${icon(t.muted ? 'mute' : 'sound', 11)}</button>` : ''}<button class="x" title="Close (Ctrl+W)">${icon('x', 11)}</button>`;
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
  box.querySelector('.tab.on')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

let panel = '';
A.onPanel((p) => {
  panel = p;
  for (const [id, name] of [['bm-btn', 'bookmarks'], ['hist-btn', 'history'], ['dl-btn', 'downloads'], ['set-btn', 'settings']]) $('#' + id).classList.toggle('on', p === name);
  if (p === 'downloads') $('#dl-dot').hidden = true;
});
A.onDownloads((list) => {
  if (panel !== 'downloads' && list.some((d) => d.state === 'progressing')) $('#dl-dot').hidden = false;
});
A.onState((s) => {
  S = s;
  render();
});

// tell main how wide the island wants to be (all tabs showing, plus room for the lift and
// shadow); main caps it at the window width and the tabs scroll past that
let sent = 0;
function sizeUp() {
  const dock = $('#dock'), tabs = $('#tabs');
  const want = Math.ceil(tabs.scrollWidth + (dock.offsetWidth - tabs.clientWidth)) + 48;
  if (want !== sent) A.dockSize({ width: (sent = want), height: 84 });
}
new ResizeObserver(sizeUp).observe($('#dock'));
new MutationObserver(sizeUp).observe($('#tabs'), { childList: true });

S = await A.state();
render();
