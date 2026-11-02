const { contextBridge, ipcRenderer } = require('electron');
const { injectBrowserAction } = require('electron-chrome-extensions/browser-action');

// <browser-action-list>: the toolbar of extension icons and their pop-ups
injectBrowserAction();

const call = (name) => (...a) => ipcRenderer.invoke(name, ...a);
const listen = (name) => (cb) => ipcRenderer.on(name, (_e, v) => cb(v));

contextBridge.exposeInMainWorld('weber', {
  state: call('state'),
  store: call('store'),
  layout: call('layout'),
  newTab: call('new-tab'),
  closeTab: call('close-tab'),
  activate: call('activate'),
  moveTab: call('move-tab'),
  navigate: call('navigate'),
  back: call('back'),
  forward: call('forward'),
  reload: call('reload'),
  stop: call('stop'),
  mute: call('mute'),
  zoom: call('zoom'),
  find: call('find'),
  findStop: call('find-stop'),
  focusPage: call('focus-page'),
  freeze: call('freeze'),
  bookmarkToggle: call('bookmark-toggle'),
  bookmarkRemove: call('bookmark-remove'),
  history: call('history'),
  historyClear: call('history-clear'),
  suggest: call('suggest'),
  topSites: call('top-sites'),
  recent: call('recent'),
  ntpData: call('ntp-data'),
  settings: call('settings'),
  answerPermission: call('permission-answer'),
  downloadOpen: call('download-open'),
  downloadShow: call('download-show'),
  downloadCancel: call('download-cancel'),
  downloadsClear: call('downloads-clear'),
  devtools: call('devtools'),
  pickBackground: call('bg-pick'),
  extensions: call('extensions'),
  removeExtension: call('extension-remove'),
  onState: listen('state'),
  onFound: listen('found'),
  onCommand: listen('command'),
  onPermission: listen('permission'),
  onDownloads: listen('downloads'),
});
