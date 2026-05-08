import { useEffect, useRef } from 'react';

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  // Reset signal — when noteId changes the editor scrolls back to the top
  // so a freshly switched-to file doesn't inherit the previous file's
  // scroll position.
  resetKey: string;
};

export function Editor({ value, onChange, onSave, resetKey }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollTop = 0;
    el.focus();
  }, [resetKey]);

  // Tab inserts two spaces — most users expect this in a markdown editor and
  // the default tab-out-of-textarea behaviour breaks code-block formatting.
  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      onSave();
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      const el = e.currentTarget;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const inserted = '  ';
      const next = value.slice(0, start) + inserted + value.slice(end);
      onChange(next);
      // Restore caret position after React re-renders.
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = start + inserted.length;
      });
    }
  };

  return (
    <textarea
      ref={ref}
      className="rd-editor"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      spellCheck
      placeholder="Start writing in markdown…"
    />
  );
}
