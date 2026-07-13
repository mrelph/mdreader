import { useEffect, useRef, useState } from 'react';

export type PromptKind =
  | { kind: 'input'; title: string; placeholder?: string; initial?: string; submitLabel?: string; danger?: boolean }
  | { kind: 'confirm'; title: string; body?: string; submitLabel?: string; cancelLabel?: string; danger?: boolean };

type Props = {
  open: PromptKind | null;
  onSubmit: (value: string) => void;
  onCancel: () => void;
};

// Modal that doubles as a text-input prompt and a yes/no confirmation.
// The same styling is reused for both so the app has one consistent dialog
// surface; pickers are scoped to one open dialog at a time.
export function Prompt({ open, onSubmit, onCancel }: Props) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open?.kind === 'input') setValue(open.initial ?? '');
    else setValue('');
  }, [open]);

  useEffect(() => {
    if (open?.kind === 'input') {
      // Defer to ensure the modal is in the DOM before focus.
      const t = setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 0);
      return () => clearTimeout(t);
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (open.kind === 'input') {
      const v = value.trim();
      if (!v) return;
      onSubmit(v);
    } else {
      onSubmit('');
    }
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <div className="rd-modal-scrim" onClick={onCancel}>
      <form
        className="rd-modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        onKeyDown={onKey}
      >
        <div className="rd-modal-title">{open.title}</div>
        {open.kind === 'input' && (
          <input
            ref={inputRef}
            className="rd-modal-input"
            value={value}
            placeholder={open.placeholder ?? ''}
            onChange={(e) => setValue(e.target.value)}
            spellCheck={false}
            autoComplete="off"
          />
        )}
        {open.kind === 'confirm' && open.body && (
          <div className="rd-modal-body">{open.body}</div>
        )}
        <div className="rd-modal-actions">
          <button type="button" className="rd-modal-btn" onClick={onCancel}>
            {open.kind === 'confirm' ? open.cancelLabel ?? 'Cancel' : 'Cancel'}
          </button>
          <button
            type="submit"
            className={`rd-modal-btn rd-modal-btn-primary${open.danger ? ' rd-modal-btn-danger' : ''}`}
            disabled={open.kind === 'input' && !value.trim()}
          >
            {open.submitLabel ?? (open.kind === 'confirm' ? 'OK' : 'Create')}
          </button>
        </div>
      </form>
    </div>
  );
}
