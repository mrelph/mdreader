// Preload bridge. With contextIsolation on, the renderer never touches
// Electron internals — it only sees the narrow API exposed via contextBridge.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  platform: process.platform,

  openFile: () => ipcRenderer.invoke('dialog:open-file'),
  openFolder: () => ipcRenderer.invoke('dialog:open-folder'),
  readFile: (path) => ipcRenderer.invoke('fs:read-file', path),
  getLaunchFiles: () => ipcRenderer.invoke('app:get-launch-files'),

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
});
