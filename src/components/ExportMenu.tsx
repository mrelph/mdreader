import { useEffect, useRef, useState } from 'react';
import { getElectron } from '../electron';
import { ExportIcon } from '../icons';

type Props = {
  getHtml: () => string;
  title: string;
  disabled: boolean;
};

export function ExportMenu({ getHtml, title, disabled }: Props) {
  const electron = getElectron();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  if (!electron) return null;

  const handlePdf = () => {
    setOpen(false);
    electron.export.pdf(getHtml(), title);
  };

  const handleHtml = () => {
    setOpen(false);
    electron.export.html(getHtml(), title);
  };

  return (
    <div className="rd-export-wrap" ref={wrapRef}>
      <button
        className="rd-tb-icon"
        title="Export note"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        data-active={open ? '1' : '0'}
      >
        <ExportIcon />
      </button>
      {open && (
        <div className="rd-export-menu">
          <button className="rd-export-item" onClick={handlePdf}>
            Export as PDF
          </button>
          <button className="rd-export-item" onClick={handleHtml}>
            Export as HTML
          </button>
        </div>
      )}
    </div>
  );
}
