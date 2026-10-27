const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('toolbox', {
  isApp: true,
  // 'win32', 'darwin' (Mac) or 'linux', for the app's own wording
  platform: process.platform,
  saveDialog: (name) => ipcRenderer.invoke('save-dialog', name),
  openDialog: () => ipcRenderer.invoke('open-dialog'),
  readFile: (p) => ipcRenderer.invoke('read-file', p),
  writeFile: (p, text) => ipcRenderer.invoke('write-file', p, text),
  openFolder: (kind) => ipcRenderer.invoke('open-folder', kind),
  chooseFolder: (kind) => ipcRenderer.invoke('choose-folder', kind),
  saveRecording: (files, sub) => ipcRenderer.invoke('save-recording', files, sub),
  toggleFullScreen: () => ipcRenderer.invoke('toggle-fullscreen'),
  isFullScreen: () => ipcRenderer.invoke('is-fullscreen'),
  onFullScreen: (cb) => ipcRenderer.on('fullscreen', (_e, on) => cb(!!on)),
  keepAwake: (on) => ipcRenderer.send('keep-awake', !!on),
  quit: () => ipcRenderer.send('quit-now'),
  closeNow: () => ipcRenderer.send('close-now'),
  onClosing: (cb) => ipcRenderer.on('app-closing', () => cb()),
  // a tool window (the mixers): 'min', 'close', or 'top' with on (stay on top); returns whether it is on top
  popWin: (name, act, on) => ipcRenderer.invoke('pop-win', name, act, on),
  // the page's colours, for the title bar and the window behind the page
  setChrome: (c) => ipcRenderer.send('chrome', c),
  // a Mac's menu bar: the app's menus, and the one chosen
  setMacMenu: (menus) => ipcRenderer.send('mac-menu', menus),
  onMenuCmd: (cb) => ipcRenderer.on('menu-cmd', (_e, id) => cb(id))
});
