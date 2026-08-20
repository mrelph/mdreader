import { useEffect, useRef, useState } from 'react';
import type { Theme } from '../types';
import { PaletteIcon } from '../icons';

const OPTIONS: { value: Theme; label: string }[] = [
  { value: 'paper', label: 'Paper' },
  { value: 'light', label: 'Light' },
  { value: 'sage', label: 'Sage' },
  { value: 'rose', label: 'Rose' },
  { value: 'dark', label: 'Dark' },
  { value: 'midnight', label: 'Midnight' },
];

type Props = {
  theme: Theme;
  onTheme: (theme: Theme) => void;
};

export function ThemeMenu({ theme, onTheme }: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div className="rd-theme-wrap" ref={wrapRef}>
      <button
        type="button"
        className="rd-tb-icon"
        title="Theme"
        aria-haspopup="menu"
        aria-expanded={open}
        data-active={open ? '1' : '0'}
        onClick={() => setOpen((value) => !value)}
      >
        <PaletteIcon />
      </button>
      {open && (
        <div className="rd-theme-menu" role="menu" aria-label="Theme">
          {OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="menuitemradio"
              aria-checked={theme === option.value}
              data-active={theme === option.value ? '1' : '0'}
              onClick={() => {
                onTheme(option.value);
                setOpen(false);
              }}
            >
              <span className="rd-theme-swatch" data-theme-swatch={option.value}>
                <i /><i /><i />
              </span>
              <span>{option.label}</span>
              <span className="rd-theme-check" aria-hidden="true">{theme === option.value ? '✓' : ''}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
