// Open a markdown file from disk. In Electron we hit the main process for a
// real OS dialog and full filesystem access; in a normal browser we use the
// File System Access API where supported, with a hidden <input type="file">
// fallback for everything else.

import { getElectron } from './electron';

export type Picked = { name: string; text: string; path?: string };

declare global {
  interface Window {
    showOpenFilePicker?: (opts: {
      multiple?: boolean;
      types?: { description: string; accept: Record<string, string[]> }[];
      excludeAcceptAllOption?: boolean;
    }) => Promise<FileSystemFileHandle[]>;
  }
}

export async function openMarkdownFile(): Promise<Picked | null> {
  const electron = getElectron();
  if (electron) {
    const result = await electron.openFile();
    return result ? { name: result.name, text: result.text, path: result.path } : null;
  }

  if (typeof window.showOpenFilePicker === 'function') {
    try {
      const [handle] = await window.showOpenFilePicker({
        multiple: false,
        types: [
          {
            description: 'Markdown',
            accept: { 'text/markdown': ['.md', '.markdown', '.mdx', '.txt'] },
          },
        ],
      });
      const file = await handle.getFile();
      const text = await file.text();
      return { name: file.name, text };
    } catch (err) {
      if ((err as DOMException).name === 'AbortError') return null;
    }
  }
  return openMarkdownFileViaInput();
}

function openMarkdownFileViaInput(): Promise<Picked | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.md,.markdown,.mdx,.txt,text/markdown,text/plain';
    input.style.display = 'none';
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      document.body.removeChild(input);
      if (!file) return resolve(null);
      const text = await file.text();
      resolve({ name: file.name, text });
    });
    input.addEventListener('cancel', () => {
      document.body.removeChild(input);
      resolve(null);
    });
    document.body.appendChild(input);
    input.click();
  });
}
