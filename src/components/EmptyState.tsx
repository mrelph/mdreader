import { FilePlusIcon, FolderIcon, OpenIcon } from '../icons';

type Props = {
  hasWorkspace: boolean;
  inElectron: boolean;
  onOpenWorkspace: () => void;
  onNewFile: () => void;
  onOpenFile: () => void;
};

export function EmptyState({ hasWorkspace, inElectron, onOpenWorkspace, onNewFile, onOpenFile }: Props) {
  if (!hasWorkspace && inElectron) {
    return (
      <div className="rd-empty">
        <div className="rd-empty-title">Pick a folder for your notes</div>
        <div className="rd-empty-hint">
          Inkwell treats the folder you choose as your workspace. Subfolders become
          tags in the sidebar; new notes save as <code>.md</code> files inside.
        </div>
        <div className="rd-empty-actions">
          <button className="rd-empty-btn rd-empty-btn-primary" onClick={onOpenWorkspace}>
            <FolderIcon />
            <span>Open notes folder…</span>
          </button>
          <button className="rd-empty-btn" onClick={onOpenFile}>
            <OpenIcon />
            <span>Open a single .md file</span>
          </button>
        </div>
      </div>
    );
  }

  if (hasWorkspace) {
    return (
      <div className="rd-empty">
        <div className="rd-empty-title">No note open</div>
        <div className="rd-empty-hint">
          Create a new note or open an existing one from the sidebar.
        </div>
        <div className="rd-empty-actions">
          <button className="rd-empty-btn rd-empty-btn-primary" onClick={onNewFile}>
            <FilePlusIcon />
            <span>New note</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rd-empty">
      <div className="rd-empty-title">No note open</div>
      <div className="rd-empty-hint">
        Press Ctrl+O to open a markdown file.
      </div>
      <div className="rd-empty-actions">
        <button className="rd-empty-btn rd-empty-btn-primary" onClick={onOpenFile}>
          <OpenIcon />
          <span>Open .md file</span>
        </button>
      </div>
    </div>
  );
}
