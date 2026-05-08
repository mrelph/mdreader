import { useEffect, useRef } from 'react';
import { applyEdit, continueList, toggleHeading, toggleWrap } from '../editorOps';

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

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    const mod = e.metaKey || e.ctrlKey;
    const state = { value: el.value, start: el.selectionStart, end: el.selectionEnd };

    if (mod && e.key.toLowerCase() === 's') {
      e.preventDefault();
      onSave();
      return;
    }

    // Bold / italic / inline code. Use shift-detection so Ctrl+B doesn't
    // mistakenly fire when the user holds extra modifiers for some other
    // shortcut (e.g. browser bookmark bar).
    if (mod && !e.shiftKey && !e.altKey) {
      const k = e.key.toLowerCase();
      if (k === 'b') {
        e.preventDefault();
        applyEdit(el, toggleWrap(state, '**'), onChange);
        return;
      }
      if (k === 'i') {
        e.preventDefault();
        applyEdit(el, toggleWrap(state, '*'), onChange);
        return;
      }
      if (k === '`') {
        e.preventDefault();
        applyEdit(el, toggleWrap(state, '`'), onChange);
        return;
      }
      if (k === '1' || k === '2' || k === '3') {
        e.preventDefault();
        applyEdit(el, toggleHeading(state, Number(k) as 1 | 2 | 3), onChange);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey && !mod) {
      const result = continueList(state);
      if (result) {
        e.preventDefault();
        applyEdit(el, result, onChange);
        return;
      }
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const inserted = '  ';
      const next = value.slice(0, start) + inserted + value.slice(end);
      onChange(next);
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
      placeholder="Start writing in markdown… (Ctrl+B bold, Ctrl+I italic, Ctrl+/ for help)"
    />
  );
}
