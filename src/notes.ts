import type { Note } from './types';

// Build a TOC from heading lines in the markdown body. Used by the right-rail
// outline; entries beyond level 3 are ignored to keep the rail readable.
export function buildToc(src: string) {
  return src
    .split('\n')
    .filter((l) => /^#{1,3} /.test(l))
    .map((l, idx) => {
      const level = l.match(/^(#+)/)![1].length;
      const text = l.replace(/^#+\s/, '').replace(/\*\*?/g, '');
      return { level, text, id: `h${idx}` };
    });
}

export function wordCount(src: string) {
  return src.trim().split(/\s+/).filter(Boolean).length;
}

export function readingMinutes(src: string) {
  return Math.max(1, Math.round(wordCount(src) / 220));
}

// Best-effort title extraction from a markdown blob — first H1, falling back
// to the filename. Used when the user opens their own .md files.
export function deriveTitle(src: string, fallback: string) {
  const m = src.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : fallback;
}

// First non-heading paragraph, trimmed for the sidebar preview. Strips
// inline markdown so the preview reads as plain prose.
export function derivePreview(src: string) {
  for (const line of src.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    if (t.startsWith('#')) continue;
    if (t.startsWith('>')) continue;
    if (t.startsWith('```')) continue;
    return t
      // Inline image — drop the alt-text + url entirely.
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
      // Inline link — keep just the visible text.
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      // Reference-style link — keep visible text.
      .replace(/\[([^\]]+)\]\[[^\]]*\]/g, '$1')
      // Bold/italic/inline-code wrappers.
      .replace(/[*_`]/g, '')
      // Collapse whitespace runs.
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 160);
  }
  return '';
}

export function formatDate(mtime: number | undefined): string {
  const d = mtime ? new Date(mtime) : new Date();
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export type FileShape = { name: string; text: string; path?: string; folder?: string; mtime?: number };

export function fileToNote(file: FileShape): Note {
  const baseFolder = file.folder ?? (file.path ? 'Opened' : '');
  const id = file.path ? `f:${file.path}` : `u${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const stem = file.name.replace(/\.[^.]+$/, '');
  return {
    id,
    title: deriveTitle(file.text, stem),
    folder: baseFolder,
    date: formatDate(file.mtime),
    preview: derivePreview(file.text) || stem,
    starred: false,
    body: file.text,
    path: file.path,
    mtime: file.mtime,
  };
}
