// Preload bridge. With contextIsolation on, the renderer never touches
// Electron internals — it only sees the narrow API exposed via contextBridge.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  platform: process.platform,

  openFile: () => ipcRenderer.invoke('dialog:open-file'),
  openFolder: () => ipcRenderer.invoke('dialog:open-folder'),
  readFile: (path) => ipcRenderer.invoke('fs:read-file', path),
  getLaunchFiles: () => ipcRenderer.invoke('app:get-launch-files'),

  // Workspace operations — these all act on the user's chosen notes folder
  // (and its immediate subdirectories). Paths come from listWorkspace and
  // are passed back to the main process unchanged so the renderer never
  // computes filesystem paths itself.
  workspace: {
    list: (dir) => ipcRenderer.invoke('fs:list-workspace', dir),
    writeFile: (path, content, baseMtime) => ipcRenderer.invoke('fs:write-file', path, content, baseMtime),
    createFile: (dir, filename, content) => ipcRenderer.invoke('fs:create-file', dir, filename, content),
    createFolder: (parentDir, folderName) => ipcRenderer.invoke('fs:create-folder', parentDir, folderName),
    deleteFile: (path) => ipcRenderer.invoke('fs:delete-file', path),
    deleteFolder: (path) => ipcRenderer.invoke('fs:delete-folder', path),
    rename: (oldPath, newPath) => ipcRenderer.invoke('fs:rename', oldPath, newPath),
    // Fires when a markdown file under the active workspace changes on disk
    // outside the app. Returns an unsubscribe function.
    onChanged: (cb) => {
      const handler = () => cb();
      ipcRenderer.on('workspace:changed', handler);
      return () => ipcRenderer.removeListener('workspace:changed', handler);
    },
  },

  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    toggleMaximize: () => ipcRenderer.send('window:toggle-maximize'),
    close: () => ipcRenderer.send('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
    onMaximizedChange: (cb) => {
      const handler = (_evt, value) => cb(value);
      ipcRenderer.on('window:maximized', handler);
      return () => ipcRenderer.removeListener('window:maximized', handler);
    },
  },

  // Files arriving from "Open With" / file-association launches after the
  // app is already running.
  onOpenFilePath: (cb) => {
    const handler = (_evt, p) => cb(p);
    ipcRenderer.on('app:open-file-path', handler);
    return () => ipcRenderer.removeListener('app:open-file-path', handler);
  },

  // Export current note to PDF or HTML.
  export: {
    pdf: (html, title) => ipcRenderer.invoke('export:pdf', html, title),
    html: (html, title) => ipcRenderer.invoke('export:html', html, title),
  },

  // Auto-updater surface.
  updater: {
    check: () => ipcRenderer.invoke('updater:check'),
    download: () => ipcRenderer.invoke('updater:download'),
    install: () => ipcRenderer.send('updater:install'),
    onStatus: (cb) => {
      const handler = (_evt, data) => cb(data);
      ipcRenderer.on('updater:status', handler);
      return () => ipcRenderer.removeListener('updater:status', handler);
    },
  },
});
