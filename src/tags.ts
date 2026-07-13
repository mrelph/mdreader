import { stripFrontmatter } from './notes';

// Extract #tags from note body text. Rules:
// - Must be preceded by whitespace or start-of-line (not inside words like "C#").
// - Must be followed by a word character (letters, digits, underscore, hyphen).
// - Excludes heading markers (# followed by space) and code fences.
// - Tags are normalized to lowercase.
const TAG_RE = /(?:^|[\s,;(])#([a-zA-Z][\w-]*)/g;

export function extractTags(body: string): string[] {
  const text = stripFrontmatter(body);
  const tags = new Set<string>();
  // Skip fenced code blocks.
  const stripped = text.replace(/```[\s\S]*?```/g, '').replace(/~~~[\s\S]*?~~~/g, '');
  let m;
  while ((m = TAG_RE.exec(stripped)) !== null) {
    tags.add(m[1].toLowerCase());
  }
  return [...tags].sort();
}

// Build a frequency map of all tags across all notes.
export function buildTagIndex(bodies: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const body of bodies) {
    for (const tag of extractTags(body)) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return counts;
}
