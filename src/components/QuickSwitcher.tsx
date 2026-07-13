import { useEffect, useMemo, useRef, useState } from 'react';
import type { Note } from '../types';

type Props = {
  open: boolean;
  onClose: () => void;
  notes: Note[];
  onSelect: (id: string) => void;
};

// Simple fuzzy scoring: characters must appear in order, consecutive runs score
// higher. Returns -1 for no match, positive otherwise (higher = better).
function fuzzyScore(query: string, target: string): number {
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  let qi = 0;
  let score = 0;
  let consecutive = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      qi++;
      consecutive++;
      score += consecutive * 2;
      if (ti === 0 || t[ti - 1] === ' ' || t[ti - 1] === '-' || t[ti - 1] === '/') {
        score += 5;
      }
    } else {
      consecutive = 0;
    }
  }
  return qi === q.length ? score : -1;
}

export function QuickSwitcher({ open, notes, onClose, onSelect }: Props) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const results = useMemo(() => {
    if (!query.trim()) {
      // Show recently modified notes when no query typed.
      return [...notes]
        .sort((a, b) => (b.mtime ?? 0) - (a.mtime ?? 0))
        .slice(0, 20);
    }
    const scored = notes
      .map((n) => ({ note: n, score: fuzzyScore(query, n.title) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score);
    return scored.slice(0, 20).map((x) => x.note);
  }, [notes, query]);

  // Keep active index in bounds.
  useEffect(() => {
    setActive((a) => Math.min(a, Math.max(0, results.length - 1)));
  }, [results.length]);

  // Scroll active item into view.
  useEffect(() => {
    const el = listRef.current?.children[active] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  if (!open) return null;

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[active]) {
        onSelect(results[active].id);
        onClose();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div className="rd-qs-scrim" onClick={onClose}>
      <div className="rd-qs" onClick={(e) => e.stopPropagation()} onKeyDown={handleKey}>
        <input
          ref={inputRef}
          className="rd-qs-input"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setActive(0); }}
          placeholder="Jump to note…"
          spellCheck={false}
          autoComplete="off"
        />
        <div className="rd-qs-list" ref={listRef}>
          {results.map((n, i) => (
            <button
              key={n.id}
              className="rd-qs-item"
              data-active={i === active ? '1' : '0'}
              onClick={() => { onSelect(n.id); onClose(); }}
              onMouseEnter={() => setActive(i)}
            >
              <span className="rd-qs-title">{n.title}</span>
              <span className="rd-qs-folder">{n.folder || 'Inbox'}</span>
            </button>
          ))}
          {results.length === 0 && query && (
            <div className="rd-qs-empty">No matching notes</div>
          )}
        </div>
      </div>
    </div>
  );
}
