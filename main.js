const { app, BrowserWindow, session, ipcMain, dialog, shell, Menu, powerSaveBlocker } = require('electron');
const path = require('path');
const fs = require('fs');

let win = null;
let closing = false;

// Only one copy at a time (two copies would fight over the MIDI port).
if (!app.requestSingleInstanceLock()) { app.quit(); }
else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
}
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

function configPath() { return path.join(app.getPath('userData'), 'toolbox-folders.json'); }
function readCfg() { try { return JSON.parse(fs.readFileSync(configPath(), 'utf8')); } catch (e) { return {}; } }
function writeCfg(c) { try { fs.writeFileSync(configPath(), JSON.stringify(c)); } catch (e) {} }
function folderFor(kind) {
  const cfg = readCfg();
  const key = kind === 'recordings' ? 'recordings' : 'projects';
  const def = path.join(app.getPath('documents'), 'MC-707 Toolbox', key === 'recordings' ? 'Recordings' : 'Projects');
  const dir = cfg[key] || def;
  try { fs.mkdirSync(dir, { recursive: true }); } catch (e) {}
  return dir;
}

function createWindow() {
  win = new BrowserWindow({
    width: 1400, height: 900, minWidth: 700, minHeight: 500,
    title: 'MC-707 Toolbox',
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: { contextIsolation: true, nodeIntegration: false, backgroundThrottling: false, preload: path.join(__dirname, 'preload.js') }
  });
  win.loadFile(path.join(__dirname, 'index.html'));
  win.on('enter-full-screen', () => win.webContents.send('fullscreen', true));
  win.on('leave-full-screen', () => win.webContents.send('fullscreen', false));
  // Keep the window on the app: never navigate away or open pop-up windows.
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  // Let the app send "all notes off" to the MC-707 before the window closes.
  win.on('close', (e) => {
    if (closing) return;
    e.preventDefault();
    win.webContents.send('app-closing');
    setTimeout(() => { closing = true; if (win) win.close(); }, 900);
  });
}

let blocker = null;
ipcMain.on('keep-awake', (_e, on) => {
  if (on && blocker === null) blocker = powerSaveBlocker.start('prevent-display-sleep');
  if (!on && blocker !== null) { powerSaveBlocker.stop(blocker); blocker = null; }
});
ipcMain.handle('toggle-fullscreen', () => { if (!win) return false; win.setFullScreen(!win.isFullScreen()); return win.isFullScreen(); });
ipcMain.handle('is-fullscreen', () => !!(win && win.isFullScreen()));
ipcMain.on('close-now', () => { closing = true; if (win) win.close(); });
ipcMain.on('quit-now', () => { closing = true; app.quit(); });
ipcMain.handle('save-dialog', async (_e, name) => {
  const r = await dialog.showSaveDialog(win, { defaultPath: path.join(folderFor('projects'), name || 'project.json'), filters: [{ name: 'MC-707 Toolbox project', extensions: ['json'] }] });
  return r.canceled ? null : r.filePath;
});
ipcMain.handle('open-dialog', async () => {
  const r = await dialog.showOpenDialog(win, { defaultPath: folderFor('projects'), properties: ['openFile'], filters: [{ name: 'MC-707 Toolbox project', extensions: ['json'] }] });
  if (r.canceled || !r.filePaths[0]) return null;
  const p = r.filePaths[0];
  return { path: p, name: path.basename(p), text: fs.readFileSync(p, 'utf8') };
});
ipcMain.handle('read-file', async (_e, p) => ({ path: p, name: path.basename(p), text: fs.readFileSync(p, 'utf8') }));
ipcMain.handle('write-file', async (_e, p, text) => { fs.writeFileSync(p, text, 'utf8'); return true; });
ipcMain.handle('open-folder', async (_e, kind) => {
  const dir = folderFor(kind);
  const err = await shell.openPath(dir);
  if (err) throw new Error(err);
  return dir;
});
ipcMain.handle('choose-folder', async (_e, kind) => {
  const r = await dialog.showOpenDialog(win, { defaultPath: folderFor(kind), properties: ['openDirectory', 'createDirectory'] });
  if (r.canceled || !r.filePaths[0]) return null;
  const cfg = readCfg(); cfg[kind === 'recordings' ? 'recordings' : 'projects'] = r.filePaths[0]; writeCfg(cfg);
  return r.filePaths[0];
});
ipcMain.handle('save-recording', async (_e, files, sub) => {
  const base = folderFor('recordings');
  const dir = sub ? path.join(base, String(sub).replace(/[^\w.\- ]+/g, '-')) : base;
  fs.mkdirSync(dir, { recursive: true });
  for (const f of files) {
    const target = path.resolve(dir, f.name);
    if (!target.startsWith(path.resolve(dir))) continue;
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, Buffer.from(f.data));
  }
  return dir;
});

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  // Web MIDI (MC-707 over USB) and audio capture (recording from your interfaces).
  const ok = new Set(['midi', 'midiSysex', 'media', 'audioCapture']);
  session.defaultSession.setPermissionRequestHandler((wc, permission, cb) => cb(ok.has(permission)));
  session.defaultSession.setPermissionCheckHandler((wc, permission) => ok.has(permission));
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { app.quit(); });
