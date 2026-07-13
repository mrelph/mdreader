import { useMemo } from 'react';
import type { Note } from '../types';
import { extractWikilinks, normaliseTarget } from '../wikilinks';

type Props = {
  note: Note;
  allNotes: Note[];
  onSelect: (id: string) => void;
};

type Backlink = {
  id: string;
  title: string;
  context: string;
};

export function Backlinks({ note, allNotes, onSelect }: Props) {
  const backlinks: Backlink[] = useMemo(() => {
    const target = normaliseTarget(note.title);
    // Also match by filename stem so [[filename]] links count.
    const stem = note.path
      ? normaliseTarget((note.path.split(/[\\/]/).pop() ?? '').replace(/\.[^.]+$/, ''))
      : null;

    const out: Backlink[] = [];
    for (const other of allNotes) {
      if (other.id === note.id) continue;
      const links = extractWikilinks(other.body);
      const hit = links.find(
        (l) => normaliseTarget(l.target) === target || (stem && normaliseTarget(l.target) === stem)
      );
      if (hit) {
        // Pull a short snippet around the wikilink for context.
        const idx = other.body.indexOf(`[[${hit.target}`);
        const start = Math.max(0, idx - 40);
        const raw = other.body.slice(start, idx + hit.target.length + 50).replace(/\s+/g, ' ').trim();
        const context = (start > 0 ? '…' : '') + raw + '…';
        out.push({ id: other.id, title: other.title, context });
      }
    }
    return out;
  }, [note, allNotes]);

  if (!backlinks.length) return null;

  return (
    <div className="rd-backlinks">
      <div className="rd-backlinks-head">
        {backlinks.length} backlink{backlinks.length === 1 ? '' : 's'}
      </div>
      <div className="rd-backlinks-list">
        {backlinks.map((bl) => (
          <button
            key={bl.id}
            className="rd-backlinks-item"
            onClick={() => onSelect(bl.id)}
          >
            {bl.title}
            <span className="rd-backlinks-context">{bl.context}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
