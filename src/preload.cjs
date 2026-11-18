const { contextBridge, ipcRenderer } = require('electron');
const { injectBrowserAction } = require('electron-chrome-extensions/browser-action');

// <browser-action-list>: the toolbar of extension icons and their pop-ups
injectBrowserAction();

const call = (name) => (...a) => ipcRenderer.invoke(name, ...a);
const listen = (name) => (cb) => ipcRenderer.on(name, (_e, v) => cb(v));

const CALLS = {
  state: 'state', store: 'store', layout: 'layout', newTab: 'new-tab', closeTab: 'close-tab', split: 'split', unsplit: 'unsplit', splitSwap: 'split-swap', splitRatio: 'split-ratio',
  tabMenu: 'tab-menu', groupMenu: 'group-menu', groupUpdate: 'group-update', groupColors: 'group-colors', activate: 'activate', moveTab: 'move-tab', closedTabs: 'closed-tabs', reopen: 'reopen',
  navigate: 'navigate', back: 'back', forward: 'forward', reload: 'reload', stop: 'stop', mute: 'mute', zoom: 'zoom', find: 'find', findStop: 'find-stop', focusPage: 'focus-page', freeze: 'freeze', print: 'print', devtools: 'devtools',
  reader: 'reader', readerCurrent: 'reader-current', pip: 'pip', translate: 'translate', proceed: 'proceed', goBackSafely: 'go-back-safely', popups: 'popups', popupOpen: 'popup-open',
  bookmarkToggle: 'bookmark-toggle', bookmarkRemove: 'bookmark-remove', bookmarkUpdate: 'bookmark-update', bookmarkMove: 'bookmark-move', bookmarkFolderMenu: 'bookmark-folder-menu', importSources: 'import-sources', importRun: 'import-run',
  history: 'history', historyRemove: 'history-remove', historyClear: 'history-clear', clearData: 'clear-data', suggest: 'suggest', queries: 'queries', topSites: 'top-sites', recent: 'recent', ntpData: 'ntp-data',
  settings: 'settings', shieldInfo: 'shield-info', shieldUpdate: 'shield-update', siteInfo: 'site-info', sitePerm: 'site-perm', siteReset: 'site-reset', siteClear: 'site-clear', siteList: 'site-list',
  answerPermission: 'permission-answer', screenAnswer: 'screen-answer',
  downloadOpen: 'download-open', downloadShow: 'download-show', downloadCancel: 'download-cancel', downloadPause: 'download-pause', downloadKeep: 'download-keep', downloadDiscard: 'download-discard', downloadsClear: 'downloads-clear', openDownloadsFolder: 'open-downloads-folder',
  pwManager: 'pw-manager', pwReveal: 'pw-reveal', pwCopy: 'pw-copy', pwRemove: 'pw-remove', pwForgetNever: 'pw-forget-never', pwAnswer: 'pw-answer',
  profiles: 'profiles', profileCreate: 'profile-create', profileOpen: 'profile-open', profileRename: 'profile-rename', privateWindow: 'private-window',
  sideOpen: 'side-open', sideClose: 'side-close', sideReload: 'side-reload', sideHome: 'side-home',
  pickBackground: 'bg-pick', extensions: 'extensions', removeExtension: 'extension-remove', dockSize: 'dock-size', uiCommand: 'ui-command', panelState: 'panel-state',
};
const LISTEN = { onPanel: 'panel', onState: 'state', onFound: 'found', onCommand: 'command', onPermission: 'permission', onDownloads: 'downloads', onReader: 'reader', onPwOffer: 'pw-offer', onScreenPick: 'screen-pick', onToast: 'toast' };

const api = {};
for (const [k, v] of Object.entries(CALLS)) api[k] = call(v);
for (const [k, v] of Object.entries(LISTEN)) api[k] = listen(v);
contextBridge.exposeInMainWorld('weber', api);
