import type { Note } from './types';

// [[Target]] or [[Target|display label]]
const WIKILINK_RE = /\[\[([^[\]|]+)(?:\|([^[\]]+))?\]\]/g;

export type Wikilink = { target: string; label: string };

// Normalise a wikilink target / note title for matching: case-insensitive,
// whitespace-collapsed.
export function normaliseTarget(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

// Extract wikilinks from a markdown body, skipping fenced code blocks and
// inline code spans so `[[not a link]]` in code samples doesn't count.
export function extractWikilinks(src: string): Wikilink[] {
  const out: Wikilink[] = [];
  for (const segment of proseSegments(src)) {
    let m;
    WIKILINK_RE.lastIndex = 0;
    while ((m = WIKILINK_RE.exec(segment)) !== null) {
      const target = m[1].trim();
      if (!target) continue;
      out.push({ target, label: (m[2] ?? m[1]).trim() });
    }
  }
  return out;
}

// Build a lookup from normalised title AND filename stem → note id, so
// [[My Note]] resolves whether the note is titled by H1 or by filename.
export function buildResolver(notes: Note[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const n of notes) {
    // Filename stem entries first so an explicit H1 title wins on collision.
    if (n.path) {
      const base = n.path.split(/[\\/]/).pop() ?? '';
      const stem = base.replace(/\.[^.]+$/, '');
      if (stem) map.set(normaliseTarget(stem), n.id);
    }
  }
  for (const n of notes) {
    map.set(normaliseTarget(n.title), n.id);
  }
  return map;
}

// Rewrite [[wikilinks]] into markdown links the reader can render:
// resolved  → [label](#wikilink=<encoded target>)
// unresolved → [label](#wikilink-missing=<encoded target>)
// Fenced code blocks and inline code spans are passed through untouched.
export function replaceWikilinks(src: string, resolver: Map<string, string>): string {
  return mapProseSegments(src, (segment) =>
    segment.replace(WIKILINK_RE, (whole, target: string, label?: string) => {
      const t = target.trim();
      if (!t) return whole;
      const text = (label ?? target).trim();
      const resolved = resolver.has(normaliseTarget(t));
      // encodeURIComponent leaves ( ) alone, which would break the markdown
      // link syntax — encode them explicitly.
      const enc = encodeURIComponent(t).replace(/\(/g, '%28').replace(/\)/g, '%29');
      return resolved
        ? `[${text}](#wikilink=${enc})`
        : `[${text}](#wikilink-missing=${enc})`;
    })
  );
}

// ── Code-aware segmentation ─────────────────────────────────────────────────
// Split source into prose / code pieces. Fenced blocks (``` / ~~~) and inline
// backtick spans are treated as code. This is a line-based approximation that
// matches how the reader renders; it doesn't try to handle nested fences.

function mapProseSegments(src: string, fn: (prose: string) => string): string {
  const pieces: string[] = [];
  for (const { text, isCode } of segments(src)) {
    pieces.push(isCode ? text : fn(text));
  }
  return pieces.join('');
}

function proseSegments(src: string): string[] {
  const out: string[] = [];
  for (const { text, isCode } of segments(src)) {
    if (!isCode) out.push(text);
  }
  return out;
}

function segments(src: string): { text: string; isCode: boolean }[] {
  const out: { text: string; isCode: boolean }[] = [];
  const lines = src.split('\n');
  let buf: string[] = [];
  let inFence = false;
  let fenceToken = '';

  const flush = (isCode: boolean) => {
    if (buf.length) {
      out.push({ text: buf.join('\n') + (out.length || buf.length ? '' : ''), isCode });
      buf = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fence = line.match(/^\s*(```|~~~)/);
    if (fence && !inFence) {
      flush(false);
      inFence = true;
      fenceToken = fence[1];
      buf.push(line);
    } else if (inFence) {
      buf.push(line);
      if (fence && fence[1] === fenceToken) {
        inFence = false;
        flush(true);
      }
    } else {
      buf.push(line);
    }
  }
  flush(inFence);

  // Re-join with newlines between segments (split('\n') removed them at
  // segment boundaries). Simpler: rebuild by tracking that each segment came
  // from whole lines — join pieces with '\n'.
  const rejoined: { text: string; isCode: boolean }[] = [];
  for (let i = 0; i < out.length; i++) {
    rejoined.push({ text: (i > 0 ? '\n' : '') + out[i].text, isCode: out[i].isCode });
  }

  // Now split prose pieces further around inline code spans.
  const final: { text: string; isCode: boolean }[] = [];
  for (const seg of rejoined) {
    if (seg.isCode) {
      final.push(seg);
      continue;
    }
    // Split on inline code spans (single or double backticks).
    const parts = seg.text.split(/(``[^`]*``|`[^`\n]*`)/);
    for (const p of parts) {
      if (!p) continue;
      final.push({ text: p, isCode: p.startsWith('`') });
    }
  }
  return final;
}
