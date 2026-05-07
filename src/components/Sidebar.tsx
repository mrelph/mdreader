import { useMemo } from 'react';
import type { Note } from '../types';
import { FolderIcon, OutlineIcon, PlusIcon, SearchIcon, StarIcon } from '../icons';
import { readingMinutes } from '../notes';

type Props = {
  notes: Note[];
  activeId: string;
  onSelect: (id: string) => void;
  query: string;
  onQuery: (q: string) => void;
  folder: string;
  onFolder: (f: string) => void;
  onNew: () => void;
};

export function Sidebar({ notes, activeId, onSelect, query, onQuery, folder, onFolder, onNew }: Props) {
  const folders = useMemo(() => ['All', ...Array.from(new Set(notes.map((n) => n.folder)))], [notes]);
  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return notes.filter(
      (n) =>
        (folder === 'All' || n.folder === folder) &&
        (q === '' || n.title.toLowerCase().includes(q) || n.preview.toLowerCase().includes(q))
    );
  }, [notes, folder, query]);

  return (
    <aside className="rd-side">
      <div className="rd-search">
        <span className="rd-search-icon">
          <SearchIcon />
        </span>
        <input
          className="rd-search-input"
          placeholder="Search notes"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
        />
        <span className="rd-search-kbd">⌘K</span>
      </div>

      <div className="rd-folders">
        {folders.map((f) => (
          <button
            key={f}
            className="rd-folder"
            data-active={folder === f ? '1' : '0'}
            onClick={() => onFolder(f)}
          >
            {f === 'All' ? <OutlineIcon /> : <FolderIcon />}
            <span>{f}</span>
            <span className="rd-folder-count">
              {f === 'All' ? notes.length : notes.filter((n) => n.folder === f).length}
            </span>
          </button>
        ))}
      </div>

      <div className="rd-side-head">
        <span>
          {filtered.length} note{filtered.length === 1 ? '' : 's'}
        </span>
        <button className="rd-side-new" title="Open .md file" onClick={onNew}>
          <PlusIcon />
        </button>
      </div>

      <div className="rd-notelist">
        {filtered.map((n) => (
          <button
            key={n.id}
            className="rd-noteitem"
            data-active={activeId === n.id ? '1' : '0'}
            onClick={() => onSelect(n.id)}
          >
            <div className="rd-noteitem-row">
              <span className="rd-noteitem-title">{n.title}</span>
              {n.starred && (
                <span className="rd-noteitem-star">
                  <StarIcon filled />
                </span>
              )}
            </div>
            <div className="rd-noteitem-preview">{n.preview}</div>
            <div className="rd-noteitem-meta">
              <span>{n.date}</span>
              <span className="rd-noteitem-dot">·</span>
              <span>{readingMinutes(n.body)} min</span>
            </div>
          </button>
        ))}
      </div>
    </aside>
  );
}
