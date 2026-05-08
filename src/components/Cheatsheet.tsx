type Row = { keys: string; label: string };

// Two columns: editing shortcuts (only relevant in edit mode) and global
// shortcuts (work everywhere). Keys render as <kbd>-styled chips so the
// sheet reads at a glance without needing a heading hierarchy.
const EDIT_SHORTCUTS: Row[] = [
  { keys: 'Ctrl+B', label: 'Bold' },
  { keys: 'Ctrl+I', label: 'Italic' },
  { keys: 'Ctrl+`', label: 'Inline code' },
  { keys: 'Ctrl+1 / 2 / 3', label: 'Heading level' },
  { keys: 'Enter', label: 'Continue list / exit on empty' },
  { keys: 'Tab', label: 'Indent' },
  { keys: 'Ctrl+S', label: 'Save now' },
];

const APP_SHORTCUTS: Row[] = [
  { keys: 'Ctrl+N', label: 'New note' },
  { keys: 'Ctrl+Shift+N', label: 'New folder' },
  { keys: 'Ctrl+O', label: 'Open .md file' },
  { keys: 'Ctrl+Shift+O', label: 'Open notes folder' },
  { keys: 'Ctrl+E', label: 'Toggle edit / read' },
  { keys: 'Ctrl+F', label: 'Find in note' },
  { keys: 'Ctrl+K', label: 'Focus search' },
  { keys: 'Ctrl+.  /  F11', label: 'Focus mode' },
  { keys: 'Ctrl+/', label: 'Toggle this help' },
];

type Props = { open: boolean; onClose: () => void };

export function Cheatsheet({ open, onClose }: Props) {
  if (!open) return null;
  return (
    <div className="rd-cheatsheet-scrim" onClick={onClose}>
      <div className="rd-cheatsheet" onClick={(e) => e.stopPropagation()}>
        <div className="rd-cheatsheet-head">
          <div className="rd-cheatsheet-title">Keyboard shortcuts</div>
          <button className="rd-cheatsheet-close" onClick={onClose} aria-label="Close help">
            <svg width="11" height="11" viewBox="0 0 10 10" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round">
              <path d="M1.5 1.5l7 7M8.5 1.5l-7 7" />
            </svg>
          </button>
        </div>
        <div className="rd-cheatsheet-grid">
          <ShortcutColumn label="Editing" rows={EDIT_SHORTCUTS} />
          <ShortcutColumn label="App" rows={APP_SHORTCUTS} />
        </div>
      </div>
    </div>
  );
}

function ShortcutColumn({ label, rows }: { label: string; rows: Row[] }) {
  return (
    <div className="rd-cheatsheet-col">
      <div className="rd-cheatsheet-col-label">{label}</div>
      {rows.map((r) => (
        <div className="rd-cheatsheet-row" key={r.keys + r.label}>
          <span className="rd-cheatsheet-keys">
            {r.keys.split(/\s/).map((part, i) =>
              part === '/' || part === '' ? (
                <span key={i} className="rd-cheatsheet-keys-sep">{part}</span>
              ) : (
                <kbd key={i}>{part}</kbd>
              )
            )}
          </span>
          <span className="rd-cheatsheet-label">{r.label}</span>
        </div>
      ))}
    </div>
  );
}
