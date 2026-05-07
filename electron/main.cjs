// Electron main process. Owns the BrowserWindow, the application menu (none —
// custom titlebar replaces it), and the IPC surface the renderer talks to for
// file dialogs and window controls.

const { app, BrowserWindow, ipcMain, dialog, shell, nativeTheme } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');

const isDev = !app.isPackaged;
const RENDERER_URL = process.env.ELECTRON_RENDERER_URL;
const PRELOAD_PATH = path.join(__dirname, 'preload.cjs');

// Pending file path from a "Open With…" / file association launch. The
// renderer hasn't loaded yet when these are seen, so we stash them and ship
// them on `app:get-launch-files` once the page asks.
const launchFiles = [];

function collectFilesFromArgv(argv) {
  // First arg is the executable; in dev there are also vite-related args.
  // Filter to .md/.markdown/.mdx/.txt that exist on disk.
  for (const a of argv.slice(1)) {
    if (!a || a.startsWith('-')) continue;
    if (!/\.(md|markdown|mdx|txt)$/i.test(a)) continue;
    launchFiles.push(path.resolve(a));
  }
}

collectFilesFromArgv(process.argv);

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 640,
    minHeight: 420,
    show: false,
    frame: false,
    titleBarStyle: 'hidden',
    // Windows 11 Mica — translucent window backdrop that blends with the
    // user's wallpaper. Falls back gracefully on older Windows / non-Win11.
    backgroundMaterial: 'mica',
    backgroundColor: '#00000000',
    webPreferences: {
      preload: PRELOAD_PATH,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Match the OS theme so Mica's subtle tint reads correctly. The renderer
  // can override this through its theme toggle.
  nativeTheme.themeSource = 'system';

  if (isDev && RENDERER_URL) {
    win.loadURL(RENDERER_URL);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  win.once('ready-to-show', () => win.show());

  // Forward maximize/restore state so the renderer can toggle the maximize
  // button glyph if we ever want to.
  const sendMaxState = () => {
    win.webContents.send('window:maximized', win.isMaximized());
  };
  win.on('maximize', sendMaxState);
  win.on('unmaximize', sendMaxState);

  // Open external links in the default browser instead of replacing our app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  return win;
}

// Single-instance lock: a second launch (e.g. opening a .md from Explorer)
// passes its argv to the original instance, which loads the file.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (_evt, argv) => {
    const wins = BrowserWindow.getAllWindows();
    const win = wins[0];
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
    // Find any .md path in the new argv and ship it to the renderer.
    for (const a of argv.slice(1)) {
      if (!a || a.startsWith('-')) continue;
      if (!/\.(md|markdown|mdx|txt)$/i.test(a)) continue;
      const abs = path.resolve(a);
      win.webContents.send('app:open-file-path', abs);
    }
  });

  app.whenReady().then(createWindow);

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}

// macOS file-association — `open-file` fires before the window exists on a
// cold launch, so we stash the path in launchFiles and let the renderer pull
// it via the IPC below.
app.on('open-file', (event, p) => {
  event.preventDefault();
  launchFiles.push(p);
  const win = BrowserWindow.getAllWindows()[0];
  if (win) win.webContents.send('app:open-file-path', p);
});

// ── IPC surface ────────────────────────────────────────────────────────────

ipcMain.handle('dialog:open-file', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showOpenDialog(win, {
    title: 'Open markdown file',
    properties: ['openFile'],
    filters: [
      { name: 'Markdown', extensions: ['md', 'markdown', 'mdx', 'txt'] },
      { name: 'All files', extensions: ['*'] },
    ],
  });
  if (result.canceled || !result.filePaths.length) return null;
  const filePath = result.filePaths[0];
  const text = await fs.readFile(filePath, 'utf8');
  return { path: filePath, name: path.basename(filePath), text };
});

ipcMain.handle('dialog:open-folder', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showOpenDialog(win, {
    title: 'Open folder of markdown files',
    properties: ['openDirectory'],
  });
  if (result.canceled || !result.filePaths.length) return null;
  const dir = result.filePaths[0];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    if (!e.isFile()) continue;
    if (!/\.(md|markdown|mdx)$/i.test(e.name)) continue;
    const filePath = path.join(dir, e.name);
    const stat = await fs.stat(filePath);
    const text = await fs.readFile(filePath, 'utf8');
    files.push({ path: filePath, name: e.name, text, mtime: stat.mtimeMs });
  }
  // Newest first — feels right for a notes app.
  files.sort((a, b) => b.mtime - a.mtime);
  return { dir, files };
});

ipcMain.handle('fs:read-file', async (_event, filePath) => {
  if (typeof filePath !== 'string' || !filePath) return null;
  try {
    const text = await fs.readFile(filePath, 'utf8');
    return { path: filePath, name: path.basename(filePath), text };
  } catch {
    return null;
  }
});

ipcMain.handle('app:get-launch-files', async () => {
  // Drain the queue — renderer takes ownership.
  const out = launchFiles.splice(0, launchFiles.length);
  const results = [];
  for (const p of out) {
    try {
      const text = await fs.readFile(p, 'utf8');
      results.push({ path: p, name: path.basename(p), text });
    } catch {
      /* skip files that don't exist anymore */
    }
  }
  return results;
});

ipcMain.on('window:minimize', (event) => {
  BrowserWindow.fromWebContents(event.sender)?.minimize();
});

ipcMain.on('window:toggle-maximize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;
  if (win.isMaximized()) win.unmaximize();
  else win.maximize();
});

ipcMain.on('window:close', (event) => {
  BrowserWindow.fromWebContents(event.sender)?.close();
});

ipcMain.handle('window:is-maximized', (event) => {
  return BrowserWindow.fromWebContents(event.sender)?.isMaximized() ?? false;
});
