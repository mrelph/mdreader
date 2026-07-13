import { CloseIcon, EyeIcon, FocusIcon, HelpIcon, MoonIcon, OpenIcon, PencilIcon, SunIcon } from '../icons';
import { getElectron } from '../electron';
import { ExportMenu } from './ExportMenu';

type Props = {
  theme: 'light' | 'dark';
  onTheme: () => void;
  title: string;
  accent: string;
  onFocus: () => void;
  focused: boolean;
  onOpenFile: () => void;
  editing: boolean;
  canEdit: boolean;
  onToggleEdit: () => void;
  onToggleHelp: () => void;
  helpOpen: boolean;
  maximized: boolean;
  getExportHtml: () => string;
  hasNote: boolean;
};

export function Titlebar({
  theme,
  onTheme,
  title,
  accent,
  onFocus,
  focused,
  onOpenFile,
  editing,
  canEdit,
  onToggleEdit,
  onToggleHelp,
  helpOpen,
  maximized,
  getExportHtml,
  hasNote,
}: Props) {
  const electron = getElectron();
  const onMin = electron ? () => electron.window.minimize() : undefined;
  const onMax = electron ? () => electron.window.toggleMaximize() : undefined;
  const onClose = electron ? () => electron.window.close() : undefined;

  return (
    <div className="rd-tb">
      <div className="rd-tb-left">
        <div className="rd-tb-dot" style={{ background: accent }} />
        <span className="rd-tb-app">mdreader</span>
        <span className="rd-tb-sep">·</span>
        <span className="rd-tb-title">{title}</span>
      </div>
      <div className="rd-tb-mid" />
      <div className="rd-tb-right">
        <button
          className="rd-tb-icon"
          title={editing ? 'Read mode' : 'Edit mode'}
          onClick={onToggleEdit}
          disabled={!canEdit}
          data-active={editing ? '1' : '0'}
        >
          {editing ? <EyeIcon /> : <PencilIcon />}
        </button>
        <button
          className="rd-tb-icon"
          title="Keyboard shortcuts (Ctrl+/)"
          onClick={onToggleHelp}
          data-active={helpOpen ? '1' : '0'}
        >
          <HelpIcon />
        </button>
        <ExportMenu getHtml={getExportHtml} title={title} disabled={!hasNote} />
        <button className="rd-tb-icon" title="Open .md file" onClick={onOpenFile}>
          <OpenIcon />
        </button>
        <button
          className="rd-tb-icon"
          title="Focus mode"
          onClick={onFocus}
          data-active={focused ? '1' : '0'}
        >
          <FocusIcon />
        </button>
        <button className="rd-tb-icon" title="Toggle theme" onClick={onTheme}>
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </button>
        <div className="rd-tb-gap" />
        <button className="rd-win rd-win-min" title="Minimize" onClick={onMin} disabled={!onMin}>
          <span />
        </button>
        <button
          className="rd-win rd-win-max"
          title={maximized ? 'Restore' : 'Maximize'}
          onClick={onMax}
          disabled={!onMax}
          data-maximized={maximized ? '1' : '0'}
        >
          <span />
        </button>
        <button className="rd-win rd-win-close" title="Close" onClick={onClose} disabled={!onClose}>
          <CloseIcon />
        </button>
      </div>
    </div>
  );
}
