const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('toolbox', {
  isApp: true,
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
  onClosing: (cb) => ipcRenderer.on('app-closing', () => cb())
});
