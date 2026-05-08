import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDownIcon, ChevronUpIcon, CloseIcon, SearchIcon } from '../icons';

type Props = {
  open: boolean;
  onClose: () => void;
  // The current note's text. Match positions are computed against this.
  source: string;
  // True in edit mode — match navigation drives the textarea selection
  // rather than scrolling the rendered article into view.
  editing: boolean;
  // Callback to focus a specific [start, end] range in the textarea.
  onFocusRange: (start: number, end: number) => void;
  // Callback that scrolls the rendered view to the source character offset.
  onScrollToOffset: (offset: number) => void;
};

// Case-insensitive search by default — for a simple note-taker this matches
// what users expect from Ctrl+F. Add a "Aa" toggle later if anyone asks.
function findMatches(source: string, query: string): [number, number][] {
  if (!query) return [];
  const q = query.toLowerCase();
  const lower = source.toLowerCase();
  const out: [number, number][] = [];
  let from = 0;
  while (true) {
    const idx = lower.indexOf(q, from);
    if (idx === -1) break;
    out.push([idx, idx + q.length]);
    from = idx + Math.max(1, q.length);
  }
  return out;
}

export function FindBar({ open, onClose, source, editing, onFocusRange, onScrollToOffset }: Props) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const matches = useMemo(() => findMatches(source, query), [source, query]);

  useEffect(() => {
    if (open) {
      setActive(0);
      const t = setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 0);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Whenever the active match changes, drive the corresponding side-effect
  // (textarea selection in edit mode, scroll-into-view in read mode).
  useEffect(() => {
    if (!open || matches.length === 0) return;
    const [start, end] = matches[active];
    if (editing) onFocusRange(start, end);
    else onScrollToOffset(start);
  }, [active, matches, editing, onFocusRange, onScrollToOffset, open]);

  if (!open) return null;

  const advance = (delta: number) => {
    if (matches.length === 0) return;
    setActive((i) => (i + delta + matches.length) % matches.length);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      advance(e.shiftKey ? -1 : 1);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  const status = matches.length === 0
    ? (query ? 'No matches' : '')
    : `${active + 1} of ${matches.length}`;

  return (
    <div className="rd-find" onKeyDown={onKey}>
      <span className="rd-find-icon">
        <SearchIcon />
      </span>
      <input
        ref={inputRef}
        className="rd-find-input"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
        }}
        placeholder="Find in note"
        spellCheck={false}
      />
      <span className="rd-find-status">{status}</span>
      <button className="rd-find-btn" title="Previous match (Shift+Enter)" onClick={() => advance(-1)} disabled={matches.length === 0}>
        <ChevronUpIcon />
      </button>
      <button className="rd-find-btn" title="Next match (Enter)" onClick={() => advance(1)} disabled={matches.length === 0}>
        <ChevronDownIcon />
      </button>
      <button className="rd-find-btn" title="Close (Esc)" onClick={onClose}>
        <CloseIcon />
      </button>
    </div>
  );
}
