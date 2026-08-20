import { useMemo } from 'react';
import type { Note, SortMode } from '../types';
import {
  FilePlusIcon,
  FolderIcon,
  FolderPlusIcon,
  InboxIcon,
  OutlineIcon,
  PencilIcon,
  SearchIcon,
  StarIcon,
  TabCloseIcon,
  TrashIcon,
} from '../icons';
import { readingMinutes, wordCount } from '../notes';
import { extractTags } from '../tags';

export type FolderEntry = {
  name: string;          // '' = Inbox
  count: number;
  // Real folder on disk (subdirectory under workspace).
  diskFolder: boolean;
};

type Props = {
  notes: Note[];
  folders: FolderEntry[];
  totalCount: number;
  activeId: string | null;
  onSelect: (id: string) => void;
  query: string;
  onQuery: (q: string) => void;
  folder: string;        // 'All' | '' (Inbox) | <subdir name> | 'Opened'
  onFolder: (f: string) => void;
  hasWorkspace: boolean;
  inElectron: boolean;

  onNewFile: () => void;
  onNewFolder: () => void;
  onCloseNote: (id: string) => void;
  onDeleteNote: (note: Note) => void;
  onRenameNote: (note: Note) => void;
  onDeleteFolder: (folderName: string) => void;
  onToggleStar: (id: string) => void;
  sortMode: SortMode;
  onSortMode: (mode: SortMode) => void;
  activeTag: string | null;
  onTag: (tag: string | null) => void;
};

// Pull a short context snippet around the first body match so full-text hits
// show *why* they matched, not just the note title. Returns null when the
// query only matched the title/preview (which are already visible).
function bodySnippet(body: string, q: string): string | null {
  const idx = body.toLowerCase().indexOf(q);
  if (idx === -1) return null;
  const start = Math.max(0, idx - 30);
  const raw = body.slice(start, idx + q.length + 40).replace(/\s+/g, ' ').trim();
  return (start > 0 ? '…' : '') + raw + '…';
}

const ALL = 'All';
const INBOX = '';
const STARRED = '__starred__';

export function Sidebar({
  notes,
  folders,
  totalCount,
  activeId,
  onSelect,
  query,
  onQuery,
  folder,
  onFolder,
  hasWorkspace,
  inElectron,
  onNewFile,
  onNewFolder,
  onCloseNote,
  onDeleteNote,
  onRenameNote,
  onDeleteFolder,
  onToggleStar,
  sortMode,
  onSortMode,
  activeTag,
  onTag,
}: Props) {
  const q = query.trim().toLowerCase();

  // Build a tag index across all notes for the tag bar.
  const tagIndex = useMemo(() => {
    const counts = new Map<string, number>();
    for (const n of notes) {
      for (const tag of extractTags(n.body)) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }
    return counts;
  }, [notes]);

  const filtered = useMemo(() => {
    const list = notes.filter((n) => {
      if (folder === ALL) {
        // include everything
      } else if (folder === STARRED) {
        if (!n.starred) return false;
      } else if (folder === INBOX) {
        // workspace-root files only — anything with a subfolder or 'Opened' is filtered out
        if (n.folder !== '') return false;
      } else if (n.folder !== folder) return false;
      // Tag filter
      if (activeTag && !extractTags(n.body).includes(activeTag)) return false;
      if (q === '') return true;
      // Full-text: title, preview, and the note body.
      return (
        n.title.toLowerCase().includes(q) ||
        n.preview.toLowerCase().includes(q) ||
        n.body.toLowerCase().includes(q)
      );
    });
    // Sort
    switch (sortMode) {
      case 'alpha':
        list.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'created':
        // Use mtime as proxy — notes without mtime fall to the end.
        list.sort((a, b) => (a.mtime ?? 0) - (b.mtime ?? 0));
        break;
      case 'words':
        list.sort((a, b) => wordCount(b.body) - wordCount(a.body));
        break;
      case 'modified':
      default:
        list.sort((a, b) => (b.mtime ?? 0) - (a.mtime ?? 0));
        break;
    }
    return list;
  }, [notes, folder, q, activeTag, sortMode]);

  const folderRow = (key: string, label: string, count: number, icon: React.ReactNode, deletable: boolean) => (
    <div key={key} className="rd-folder-row" data-active={folder === key ? '1' : '0'}>
      <button className="rd-folder" onClick={() => onFolder(key)}>
        {icon}
        <span>{label}</span>
        <span className="rd-folder-count">{count}</span>
      </button>
      {deletable && (
        <button
          className="rd-folder-action"
          title={`Delete folder "${label}"`}
          onClick={(e) => {
            e.stopPropagation();
            onDeleteFolder(key);
          }}
        >
          <TrashIcon />
        </button>
      )}
    </div>
  );

  return (
    <aside className="rd-side">
      <div className="rd-side-actions">
        <button
          className="rd-side-action rd-side-action-primary"
          onClick={onNewFile}
          disabled={!hasWorkspace}
          title={hasWorkspace ? 'Create a new note (Ctrl+N)' : inElectron ? 'Open a notes folder first' : 'New note requires the desktop app'}
        >
          <FilePlusIcon />
          <span>New note</span>
        </button>
        <button
          className="rd-side-action rd-side-action-icon"
          onClick={onNewFolder}
          disabled={!hasWorkspace}
          title={hasWorkspace ? 'Create a new folder (Ctrl+Shift+N)' : inElectron ? 'Open a notes folder first' : 'New folder requires the desktop app'}
        >
          <FolderPlusIcon />
          <span className="rd-sr-only">New folder</span>
        </button>
      </div>

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
      </div>

      <div className="rd-folders">
        {folderRow(ALL, 'All', totalCount, <OutlineIcon />, false)}
        {(() => {
          const starredCount = notes.filter((n) => n.starred).length;
          return starredCount > 0
            ? folderRow(STARRED, 'Starred', starredCount, <StarIcon filled />, false)
            : null;
        })()}
        {folders.map((f) =>
          f.name === INBOX
            ? folderRow(INBOX, 'Inbox', f.count, <InboxIcon />, false)
            : f.name === 'Opened'
              ? folderRow('Opened', 'Opened', f.count, <FolderIcon />, false)
              : folderRow(f.name, f.name, f.count, <FolderIcon />, f.diskFolder)
        )}
      </div>

      {tagIndex.size > 0 && (
        <div className="rd-tags">
          {[...tagIndex.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 20)
            .map(([tag, count]) => (
              <button
                key={tag}
                className="rd-tag"
                data-active={activeTag === tag ? '1' : '0'}
                onClick={() => onTag(activeTag === tag ? null : tag)}
                title={`Filter by #${tag}`}
              >
                #{tag}
                <span className="rd-tag-count">{count}</span>
              </button>
            ))}
          {activeTag && (
            <button className="rd-tag" onClick={() => onTag(null)} title="Clear tag filter">
              ✕
            </button>
          )}
        </div>
      )}

      <div className="rd-sort">
        <span>Sort:</span>
        <select
          value={sortMode}
          onChange={(e) => onSortMode(e.target.value as SortMode)}
        >
          <option value="modified">Modified</option>
          <option value="alpha">A → Z</option>
          <option value="created">Oldest first</option>
          <option value="words">Word count</option>
        </select>
      </div>

      <div className="rd-side-head">
        <span>
          {filtered.length} note{filtered.length === 1 ? '' : 's'}
          {activeTag && <> tagged <strong>#{activeTag}</strong></>}
        </span>
      </div>

      <div className="rd-notelist">
        {filtered.map((n) => {
          // Show a body snippet only when the query matched the body but not
          // the already-visible title/preview.
          const snippet =
            q &&
            !n.title.toLowerCase().includes(q) &&
            !n.preview.toLowerCase().includes(q)
              ? bodySnippet(n.body, q)
              : null;
          return (
          <div
            key={n.id}
            className="rd-noteitem"
            data-active={activeId === n.id ? '1' : '0'}
          >
            <button className="rd-noteitem-main" onClick={() => onSelect(n.id)}>
              <div className="rd-noteitem-row">
                <span className="rd-noteitem-title">{n.title}</span>
                {n.starred && (
                  <span className="rd-noteitem-star">
                    <StarIcon filled />
                  </span>
                )}
              </div>
              <div className="rd-noteitem-preview">{snippet ?? n.preview}</div>
              <div className="rd-noteitem-meta">
                <span>{n.date}</span>
                <span className="rd-noteitem-dot">·</span>
                <span>{readingMinutes(n.body)} min</span>
              </div>
            </button>
            <div className="rd-noteitem-actions">
              <button
                className="rd-noteitem-action"
                title={n.starred ? 'Unstar' : 'Star'}
                data-starred={n.starred ? '1' : '0'}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleStar(n.id);
                }}
              >
                <StarIcon filled={n.starred} />
              </button>
              {n.path && (
                <button
                  className="rd-noteitem-action"
                  title="Rename file"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRenameNote(n);
                  }}
                >
                  <PencilIcon />
                </button>
              )}
              <button
                className="rd-noteitem-action"
                title="Close note"
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseNote(n.id);
                }}
              >
                <TabCloseIcon />
              </button>
              {n.path && (
                <button
                  className="rd-noteitem-action rd-noteitem-action-danger"
                  title="Delete file"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteNote(n);
                  }}
                >
                  <TrashIcon />
                </button>
              )}
            </div>
          </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="rd-notelist-empty">
            {query
              ? 'No notes match your search.'
              : folder === STARRED
                ? 'No starred notes — click the star on any note to pin it here.'
                : !hasWorkspace && !inElectron
                  ? 'No notes here yet. Press Ctrl+O to open a markdown file.'
                  : !hasWorkspace
                    ? 'No notes here yet. Open a notes folder to get started.'
                    : folder === ALL
                      ? 'No notes yet — create one with the button above.'
                      : 'This folder is empty.'}
          </div>
        )}
      </div>
    </aside>
  );
}
