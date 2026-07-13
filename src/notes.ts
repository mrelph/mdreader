import type { Note } from './types';

// Strip a leading YAML frontmatter block (`--- … ---` or `--- … ...`) so it
// never leaks into titles, previews, word counts, or the rendered view. Only
// a block at the very top of the file counts as frontmatter.
export function stripFrontmatter(src: string): string {
  if (!/^---[ \t]*\r?\n/.test(src)) return src;
  // Find the closing fence: a line that is exactly `---` or `...`.
  const close = src.match(/\r?\n(---|\.\.\.)[ \t]*(\r?\n|$)/);
  if (!close || close.index === undefined) return src;
  return src.slice(close.index + close[0].length);
}

// Turn heading text into a URL-safe anchor slug. GitHub-style: lowercase,
// spaces → hyphens, drop anything that isn't a word char or hyphen.
export function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// A stateful slug generator that disambiguates repeats (`foo`, `foo-1`, …).
// The reader and the TOC each build one and walk headings in document order,
// so the ids they produce line up for every heading both of them recognise.
export function makeSlugger() {
  const seen = new Map<string, number>();
  return (text: string): string => {
    const base = slugify(text) || 'section';
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return n === 0 ? base : `${base}-${n}`;
  };
}

// Strip inline/block markdown syntax down to readable prose. Used for word
// counts and sidebar previews so markers like `**`, `#`, and list bullets
// don't inflate counts or clutter previews.
function plainText(src: string): string {
  return src
    // Fenced code blocks — drop entirely.
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/~~~[\s\S]*?~~~/g, ' ')
    // Inline images — drop alt-text + url.
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    // Inline links — keep the visible text only.
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\[[^\]]*\]/g, '$1')
    // Leading heading / blockquote / list markers.
    .replace(/^[ \t]*#{1,6}[ \t]+/gm, '')
    .replace(/^[ \t]*>[ \t]?/gm, '')
    .replace(/^[ \t]*([-*+]|\d+\.)[ \t]+/gm, '')
    // Emphasis / inline code wrappers.
    .replace(/[*_`~]/g, '');
}

// Build a TOC from heading lines in the markdown body, used by the right-rail
// outline. Entries beyond level 3 are ignored to keep the rail readable;
// fenced code blocks are skipped so `# comment` lines inside them don't show
// up as headings. Ids are content-derived slugs (see makeSlugger) so they
// match the ids the reader stamps onto rendered headings.
export function buildToc(src: string) {
  const slug = makeSlugger();
  const out: { level: number; text: string; id: string }[] = [];
  let inFence = false;
  let fenceToken = '';
  for (const rawLine of stripFrontmatter(src).split('\n')) {
    const line = rawLine.trimEnd();
    const fence = line.match(/^\s*(```|~~~)/);
    if (fence) {
      if (!inFence) {
        inFence = true;
        fenceToken = fence[1];
      } else if (line.trimStart().startsWith(fenceToken)) {
        inFence = false;
      }
      continue;
    }
    if (inFence) continue;
    // Allow headings nested in blockquotes (`> ## foo`) so the outline stays
    // in step with what react-markdown actually renders.
    const heading = line.replace(/^\s*(>\s?)*/, '').match(/^(#{1,3})\s+(.*)$/);
    if (!heading) continue;
    const level = heading[1].length;
    const text = heading[2].replace(/\*\*?/g, '').trim();
    out.push({ level, text, id: slug(text) });
  }
  return out;
}

export function wordCount(src: string) {
  return plainText(stripFrontmatter(src)).trim().split(/\s+/).filter(Boolean).length;
}

export function readingMinutes(src: string) {
  return Math.max(1, Math.round(wordCount(src) / 220));
}

// Best-effort title extraction from a markdown blob — first H1, falling back
// to the filename. Used when the user opens their own .md files.
export function deriveTitle(src: string, fallback: string) {
  const m = stripFrontmatter(src).match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : fallback;
}

// First non-heading paragraph, trimmed for the sidebar preview. Strips
// inline markdown so the preview reads as plain prose.
export function derivePreview(src: string) {
  for (const line of stripFrontmatter(src).split('\n')) {
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
