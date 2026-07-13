// Electron main process. Owns the BrowserWindow, the application menu (none —
// custom titlebar replaces it), and the IPC surface the renderer talks to for
// file dialogs and window controls.

const { app, BrowserWindow, ipcMain, dialog, shell, nativeTheme } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const fsSync = require('node:fs');
const { autoUpdater } = require('electron-updater');

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
  const isWin = process.platform === 'win32';
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 640,
    minHeight: 420,
    show: false,
    // Custom title bar. On Windows, `titleBarStyle: 'hidden'` alone hides the
    // bar while KEEPING the native resize borders, Aero Snap, and correct
    // maximize/restore geometry — `frame: false` would strip all of that and
    // break edge-resize + leave the window clipped/stuck after un-maximizing.
    // On macOS/Linux frameless windows stay resizable, and `frame: false` is
    // what hides the traffic-light buttons there, so keep it off-Windows.
    titleBarStyle: 'hidden',
    ...(isWin ? {} : { frame: false }),
    // Windows 11 Mica — translucent window backdrop that blends with the
    // user's wallpaper. Only set on Windows; on macOS/Linux this property
    // is silently dropped on most builds but has caused init crashes in
    // headless WSLg, so gate it.
    ...(isWin ? { backgroundMaterial: 'mica', backgroundColor: '#00000000' } : { backgroundColor: '#f3f5f8' }),
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

  app.whenReady().then(() => {
    createWindow();
    initAutoUpdater();
  });

  app.on('window-all-closed', () => {
    stopWatching();
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

// ── Auto-updater ─────────────────────────────────────────────────────────────
// Uses electron-updater backed by GitHub Releases. In dev mode the updater is
// disabled — it only runs in packaged builds where a valid `app-update.yml`
// (generated by electron-builder) exists alongside the executable.

function initAutoUpdater() {
  if (isDev) return;

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  const send = (channel, data) => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win && !win.isDestroyed()) win.webContents.send(channel, data);
  };

  autoUpdater.on('checking-for-update', () => {
    send('updater:status', { state: 'checking' });
  });

  autoUpdater.on('update-available', (info) => {
    send('updater:status', {
      state: 'available',
      version: info.version,
      releaseNotes: info.releaseNotes || null,
    });
  });

  autoUpdater.on('update-not-available', () => {
    send('updater:status', { state: 'up-to-date' });
  });

  autoUpdater.on('download-progress', (progress) => {
    send('updater:status', {
      state: 'downloading',
      percent: Math.round(progress.percent),
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    send('updater:status', { state: 'ready', version: info.version });
  });

  autoUpdater.on('error', (err) => {
    send('updater:status', { state: 'error', message: err?.message || 'Unknown error' });
  });

  // Check once on launch after a short delay (give the window time to load),
  // then every 4 hours.
  setTimeout(() => autoUpdater.checkForUpdates().catch(() => {}), 8000);
  setInterval(() => autoUpdater.checkForUpdates().catch(() => {}), 4 * 60 * 60 * 1000);
}

// Renderer can trigger a manual check or start the download/install.
ipcMain.handle('updater:check', async () => {
  if (isDev) return { state: 'dev' };
  try {
    const result = await autoUpdater.checkForUpdates();
    return result?.updateInfo ? { state: 'available', version: result.updateInfo.version } : { state: 'up-to-date' };
  } catch (err) {
    return { state: 'error', message: err?.message };
  }
});

ipcMain.handle('updater:download', async () => {
  if (isDev) return;
  await autoUpdater.downloadUpdate();
});

ipcMain.on('updater:install', () => {
  autoUpdater.quitAndInstall(false, true);
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
    title: 'Open notes folder',
    properties: ['openDirectory', 'createDirectory'],
  });
  if (result.canceled || !result.filePaths.length) return null;
  const workspace = await listWorkspace(result.filePaths[0]);
  watchWorkspace(result.filePaths[0], event.sender);
  return workspace;
});

// Re-read a workspace directory by path (used on app launch to restore the
// last-opened folder, and after create/delete operations to refresh).
ipcMain.handle('fs:list-workspace', async (event, dir) => {
  if (typeof dir !== 'string' || !dir) return null;
  try {
    const workspace = await listWorkspace(dir);
    watchWorkspace(dir, event.sender);
    return workspace;
  } catch {
    // Directory was moved or deleted while remembered — let the renderer
    // know so it can clear its persisted reference.
    return null;
  }
});

// ── Workspace watcher ────────────────────────────────────────────────────
// A single recursive watcher on the active workspace root. Fires a debounced
// 'workspace:changed' to the renderer whenever a markdown file appears, is
// edited, renamed, or removed externally, so the sidebar can refresh itself.
let activeWatcher = null;
let watchedDir = null;

function stopWatching() {
  if (activeWatcher) {
    activeWatcher.close();
    activeWatcher = null;
    watchedDir = null;
  }
}

function watchWorkspace(dir, sender) {
  if (watchedDir === dir && activeWatcher) return;
  stopWatching();
  let timer = null;
  try {
    // `recursive` is supported on Windows and macOS; on Linux it's ignored by
    // Node but the root-level watch still catches most edits. Good enough for
    // a notes folder, and we degrade gracefully if watch throws.
    activeWatcher = fsSync.watch(dir, { recursive: true }, (_type, filename) => {
      if (filename && !/\.(md|markdown|mdx)$/i.test(String(filename))) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        if (!sender.isDestroyed()) sender.send('workspace:changed');
      }, 250);
    });
    watchedDir = dir;
  } catch {
    // Filesystem doesn't support watching — the manual refresh still works.
    activeWatcher = null;
    watchedDir = null;
  }
}

// Walk one level of subdirectories — files at the workspace root belong to
// the implicit "Inbox", files in `${dir}/<name>/` belong to that folder.
async function listWorkspace(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const folders = [];
  const files = [];
  for (const e of entries) {
    if (e.isDirectory()) {
      if (e.name.startsWith('.')) continue;
      folders.push(e.name);
      const subEntries = await fs.readdir(path.join(dir, e.name), { withFileTypes: true });
      for (const sub of subEntries) {
        if (!sub.isFile() || !/\.(md|markdown|mdx)$/i.test(sub.name)) continue;
        await pushFile(files, path.join(dir, e.name, sub.name), e.name);
      }
    } else if (e.isFile() && /\.(md|markdown|mdx)$/i.test(e.name)) {
      await pushFile(files, path.join(dir, e.name), '');
    }
  }
  folders.sort((a, b) => a.localeCompare(b));
  files.sort((a, b) => b.mtime - a.mtime);
  return { dir, folders, files };
}

async function pushFile(files, filePath, folder) {
  const stat = await fs.stat(filePath);
  const text = await fs.readFile(filePath, 'utf8');
  files.push({ path: filePath, name: path.basename(filePath), folder, text, mtime: stat.mtimeMs });
}

ipcMain.handle('fs:write-file', async (_event, filePath, content, baseMtime) => {
  if (typeof filePath !== 'string' || !filePath) throw new Error('Invalid path');
  // Optimistic-concurrency guard: if the caller told us which on-disk version
  // it started from and the file has since changed underneath us (external
  // editor, git, sync), refuse the write so we don't clobber those edits.
  if (typeof baseMtime === 'number') {
    try {
      const current = await fs.stat(filePath);
      // Allow a 1ms slop for filesystems with coarse mtime resolution.
      if (current.mtimeMs - baseMtime > 1) {
        const err = new Error('This file changed on disk since you opened it.');
        err.code = 'STALE_WRITE';
        throw err;
      }
    } catch (e) {
      if (e.code === 'STALE_WRITE') throw e;
      // ENOENT etc. — fall through and let writeFile recreate it.
    }
  }
  await fs.writeFile(filePath, content ?? '', 'utf8');
  const stat = await fs.stat(filePath);
  return { path: filePath, name: path.basename(filePath), text: content ?? '', mtime: stat.mtimeMs };
});

// Sanitise a user-provided filename — strip path separators and reserved
// chars so the renderer can never break out of the target directory.
function sanitiseName(name) {
  return String(name).replace(/[\\/:*?"<>|]/g, '_').trim();
}

ipcMain.handle('fs:create-file', async (_event, dir, filename, content = '') => {
  if (typeof dir !== 'string' || typeof filename !== 'string') throw new Error('Invalid args');
  const safe = sanitiseName(filename);
  if (!safe) throw new Error('Empty filename');
  const ext = path.extname(safe).toLowerCase();
  const finalName = /\.(md|markdown|mdx|txt)$/i.test(ext) ? safe : `${safe}.md`;
  const filePath = path.join(dir, finalName);
  let exists = false;
  try { await fs.access(filePath); exists = true; } catch { /* expected */ }
  if (exists) throw new Error(`A file named "${finalName}" already exists.`);
  await fs.writeFile(filePath, content, 'utf8');
  const stat = await fs.stat(filePath);
  return { path: filePath, name: finalName, text: content, mtime: stat.mtimeMs };
});

ipcMain.handle('fs:create-folder', async (_event, parentDir, folderName) => {
  if (typeof parentDir !== 'string' || typeof folderName !== 'string') throw new Error('Invalid args');
  const safe = sanitiseName(folderName);
  if (!safe) throw new Error('Empty folder name');
  const folderPath = path.join(parentDir, safe);
  await fs.mkdir(folderPath, { recursive: false });
  return { path: folderPath, name: safe };
});

ipcMain.handle('fs:delete-file', async (_event, filePath) => {
  if (typeof filePath !== 'string' || !filePath) throw new Error('Invalid path');
  await fs.unlink(filePath);
  return true;
});

ipcMain.handle('fs:delete-folder', async (_event, folderPath) => {
  if (typeof folderPath !== 'string' || !folderPath) throw new Error('Invalid path');
  await fs.rm(folderPath, { recursive: true, force: false });
  return true;
});

ipcMain.handle('fs:rename', async (_event, oldPath, newPath) => {
  if (typeof oldPath !== 'string' || typeof newPath !== 'string') throw new Error('Invalid args');
  await fs.rename(oldPath, newPath);
  return true;
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
