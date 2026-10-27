const { app, BrowserWindow, session, ipcMain, dialog, shell, Menu, powerSaveBlocker, screen } = require('electron');
const path = require('path');
const fs = require('fs');

let win = null;
let closing = false;

// Only one copy at a time (two copies would fight over the MIDI port).
if (!app.requestSingleInstanceLock()) { app.quit(); }
else {
  /* opening it again brings the window forward, and shows it if it somehow never appeared */
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); } });
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

// The window as it was last time (size, place, maximised), if that place is still on a screen.
function lastBounds() {
  const def = { width: 1400, height: 900 };
  try {
    const w = readCfg().win;
    if (!w || !(w.width > 300) || !(w.height > 200)) return def;
    if (!Number.isFinite(w.x) || !Number.isFinite(w.y)) return { width: w.width, height: w.height, max: !!w.max };
    const area = screen.getDisplayMatching({ x: w.x, y: w.y, width: w.width, height: w.height }).workArea;
    const on = w.x < area.x + area.width - 80 && w.x + w.width > area.x + 80 && w.y >= area.y - 10 && w.y < area.y + area.height - 80;
    return on ? w : { width: w.width, height: w.height, max: !!w.max };
  } catch (e) {
    return def;
  }
}
let saveT = null;
function keepBounds() {
  if (!win || win.isDestroyed() || win.isFullScreen() || win.isMinimized()) return;
  const cfg = readCfg();
  cfg.win = { ...(win.isMaximized() ? (cfg.win || {}) : win.getBounds()), max: win.isMaximized() };
  writeCfg(cfg);
}
const keepSoon = () => { clearTimeout(saveT); saveT = setTimeout(keepBounds, 600); };

function createWindow() {
  const b = lastBounds(),
    cfg = readCfg(),
    hex = v => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v : null),
    bg = hex(cfg.chrome && cfg.chrome.bg) || '#16171a',
    ink = hex(cfg.chrome && cfg.chrome.ink) || '#ece9e2';
  /* the app's own top bar is the title bar: on Windows the system's buttons sit over its right end, on a
     Mac the traffic lights over its left end; Linux keeps its usual frame */
  const chrome =
    process.platform === 'win32'
      ? { titleBarStyle: 'hidden', titleBarOverlay: { color: bg, symbolColor: ink, height: 34 } }
      : process.platform === 'darwin'
        ? { titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 12, y: 11 } }
        : {};
  win = new BrowserWindow({
    x: b.x, y: b.y, width: b.width, height: b.height, minWidth: 700, minHeight: 500,
    title: 'MC-707 Toolbox',
    icon: path.join(__dirname, 'icon.png'),
    /* no white flash: the window shows once the page has drawn, in the app's own colour */
    show: false,
    backgroundColor: bg,
    ...chrome,
    webPreferences: { contextIsolation: true, nodeIntegration: false, backgroundThrottling: false, preload: path.join(__dirname, 'preload.js') }
  });
  /* the window appears once the page has drawn, or after a few seconds whatever happens: never stays
     hidden (a page waiting on the network, a slow machine) */
  let shown = false;
  const showNow = () => {
    if (shown || !win || win.isDestroyed()) return;
    shown = true;
    if (b.max) win.maximize();
    win.show();
  };
  win.once('ready-to-show', showNow);
  win.webContents.once('did-finish-load', () => setTimeout(showNow, 300));
  setTimeout(showNow, 3000);
  for (const ev of ['resize', 'move', 'maximize', 'unmaximize']) win.on(ev, keepSoon);
  win.loadFile(path.join(__dirname, 'index.html'));
  win.on('enter-full-screen', () => win.webContents.send('fullscreen', true));
  win.on('leave-full-screen', () => win.webContents.send('fullscreen', false));
  // Keep the window on the app: never navigate away or open other pages. The app's own tool windows (the
  // mixers, blank windows named mc707-…) open as windows of their own that can go on another screen.
  // Help links (the guide, releases, problem reports, Roland's driver page) open in the system browser.
  win.webContents.setWindowOpenHandler(({ url, frameName }) => {
    if ((url === 'about:blank' || url === '') && /^mc707-[a-z-]+$/.test(frameName || ''))
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          // borderless: the window's own header is where you drag it (and has pin, minimise, close)
          frame: false,
          minWidth: 380,
          minHeight: 280,
          autoHideMenuBar: true,
          backgroundColor: '#050906',
          icon: path.join(__dirname, 'icon.png'),
          webPreferences: { contextIsolation: true, nodeIntegration: false, backgroundThrottling: false }
        }
      };
    if (/^https:\/\/([a-z0-9-]+\.)*(github\.com|github\.io|roland\.com)\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  // a tool window never navigates away either, and closes with the app
  win.webContents.on('did-create-window', (child, details) => {
    const name = (details && details.frameName) || '';
    if (name) {
      tools.set(name, child);
      child.on('closed', () => tools.get(name) === child && tools.delete(name));
    }
    child.setMenu(null);
    child.webContents.on('will-navigate', (e) => e.preventDefault());
    child.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  });
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  // Let the app send "all notes off" to the MC-707 before the window closes.
  win.on('close', (e) => {
    keepBounds();
    if (closing) return;
    e.preventDefault();
    for (const w of BrowserWindow.getAllWindows()) if (w !== win) w.destroy();
    win.webContents.send('app-closing');
    setTimeout(() => { closing = true; if (win) win.close(); }, 900);
  });
}

// the tool windows by name (mc707-song-mixer…), for their own pin, minimise and close buttons
const tools = new Map();
ipcMain.handle('pop-win', (_e, name, act, on) => {
  const w = tools.get(name);
  if (!w || w.isDestroyed()) return false;
  if (act === 'min') w.minimize();
  else if (act === 'close') w.close();
  else if (act === 'top') w.setAlwaysOnTop(!!on, 'floating');
  return w.isAlwaysOnTop();
});

// The page's colours, for the title bar's buttons (Windows) and the window behind the page next time.
ipcMain.on('chrome', (_e, c) => {
  const ok = v => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
  if (!c || !ok(c.bg) || !ok(c.ink)) return;
  const cfg = readCfg();
  cfg.chrome = { bg: c.bg, ink: c.ink };
  writeCfg(cfg);
  try {
    if (win && process.platform === 'win32') win.setTitleBarOverlay({ color: c.bg, symbolColor: c.ink });
    if (win) win.setBackgroundColor(c.bg);
  } catch (e) {}
});
// A Mac's menu bar: the app's own menus, sent by the page as [{label, items:[{id, label, key, checked,
// sub:[…]} | '-']}]; choosing one tells the page (menu-cmd, id). Shortcuts are only shown: the page
// keeps handling its own keys, as everywhere else.
const accel = k => {
  const a = String(k || '').replace(/^Ctrl\+/, 'CmdOrCtrl+');
  return /^(CmdOrCtrl\+)?(Shift\+)?([A-Z0-9]|F\d{1,2}|Space)$/.test(a) ? a : undefined;
};
function macItems(items) {
  return items.map(it =>
    it === '-'
      ? { type: 'separator' }
      : it.sub
        ? { label: it.label, submenu: macItems(it.sub) }
        : {
            label: it.label,
            type: it.checked == null ? 'normal' : 'checkbox',
            checked: !!it.checked,
            accelerator: accel(it.key),
            registerAccelerator: false,
            click: () => win && win.webContents.send('menu-cmd', it.id)
          }
  );
}
ipcMain.on('mac-menu', (_e, menus) => {
  if (process.platform !== 'darwin' || !Array.isArray(menus)) return;
  try {
    Menu.setApplicationMenu(
      Menu.buildFromTemplate([
        { role: 'appMenu' },
        ...menus.map(m => ({ label: m.label, submenu: macItems(m.items) })),
        { label: 'Text', submenu: [{ role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
        { role: 'windowMenu' }
      ])
    );
  } catch (e) {}
});

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
  // The app draws its own menus. A Mac still needs its menu bar for the app name, Quit (⌘Q), and copy
  // and paste (⌘C, ⌘V) in text boxes; Windows and Linux need none.
  if (process.platform === 'darwin')
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      { role: 'appMenu' },
      { label: 'Edit', submenu: [{ role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
      { role: 'windowMenu' }
    ]));
  else Menu.setApplicationMenu(null);
  // Web MIDI (MC-707 over USB) and audio capture (recording from your interfaces).
  const ok = new Set(['midi', 'midiSysex', 'media', 'audioCapture']);
  session.defaultSession.setPermissionRequestHandler((wc, permission, cb) => cb(ok.has(permission)));
  session.defaultSession.setPermissionCheckHandler((wc, permission) => ok.has(permission));
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { app.quit(); });
