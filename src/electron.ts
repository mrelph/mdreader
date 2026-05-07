// Renderer-side wrapper for window.electron. Returns null when the app is
// running in a normal browser tab so the caller can fall back gracefully.

export type ElectronFile = {
  path: string;
  name: string;
  text: string;
};

export type ElectronFolder = {
  dir: string;
  files: (ElectronFile & { mtime: number })[];
};

export type ElectronAPI = {
  platform: NodeJS.Platform;
  openFile: () => Promise<ElectronFile | null>;
  openFolder: () => Promise<ElectronFolder | null>;
  readFile: (path: string) => Promise<ElectronFile | null>;
  getLaunchFiles: () => Promise<ElectronFile[]>;
  window: {
    minimize: () => void;
    toggleMaximize: () => void;
    close: () => void;
    isMaximized: () => Promise<boolean>;
    onMaximizedChange: (cb: (value: boolean) => void) => () => void;
  };
  onOpenFilePath: (cb: (path: string) => void) => () => void;
};

declare global {
  interface Window {
    electron?: ElectronAPI;
  }
}

export function getElectron(): ElectronAPI | null {
  return typeof window !== 'undefined' && window.electron ? window.electron : null;
}

export const isElectron = (): boolean => getElectron() !== null;
