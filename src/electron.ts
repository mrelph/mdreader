// Renderer-side wrapper for window.electron. Returns null when the app is
// running in a normal browser tab so the caller can fall back gracefully.

export type ElectronFile = {
  path: string;
  name: string;
  text: string;
  mtime?: number;
  folder?: string;
};

export type ElectronWorkspace = {
  dir: string;
  folders: string[];
  files: (ElectronFile & { folder: string; mtime: number })[];
};

export type ElectronAPI = {
  platform: NodeJS.Platform;
  openFile: () => Promise<ElectronFile | null>;
  openFolder: () => Promise<ElectronWorkspace | null>;
  readFile: (path: string) => Promise<ElectronFile | null>;
  getLaunchFiles: () => Promise<ElectronFile[]>;

  workspace: {
    list: (dir: string) => Promise<ElectronWorkspace | null>;
    writeFile: (path: string, content: string, baseMtime?: number) => Promise<ElectronFile>;
    createFile: (dir: string, filename: string, content?: string) => Promise<ElectronFile>;
    createFolder: (parentDir: string, folderName: string) => Promise<{ path: string; name: string }>;
    deleteFile: (path: string) => Promise<true>;
    deleteFolder: (path: string) => Promise<true>;
    rename: (oldPath: string, newPath: string) => Promise<true>;
    onChanged: (cb: () => void) => () => void;
  };

  window: {
    minimize: () => void;
    toggleMaximize: () => void;
    close: () => void;
    isMaximized: () => Promise<boolean>;
    onMaximizedChange: (cb: (value: boolean) => void) => () => void;
  };

  onOpenFilePath: (cb: (path: string) => void) => () => void;

  export: {
    pdf: (html: string, title: string) => Promise<boolean>;
    html: (html: string, title: string) => Promise<boolean>;
  };

  updater: {
    check: () => Promise<UpdateStatus>;
    download: () => Promise<void>;
    install: () => void;
    onStatus: (cb: (status: UpdateStatus) => void) => () => void;
  };
};

export type UpdateStatus =
  | { state: 'checking' }
  | { state: 'available'; version: string; releaseNotes?: string | null }
  | { state: 'up-to-date' }
  | { state: 'downloading'; percent: number }
  | { state: 'ready'; version: string }
  | { state: 'error'; message: string }
  | { state: 'dev' };

declare global {
  interface Window {
    electron?: ElectronAPI;
  }
}

export function getElectron(): ElectronAPI | null {
  return typeof window !== 'undefined' && window.electron ? window.electron : null;
}

export const isElectron = (): boolean => getElectron() !== null;
