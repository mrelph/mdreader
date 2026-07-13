export type Note = {
  // For workspace files this is `f:${absolutePath}` so navigating back to
  // the same file always lands on the same id; for unsaved drafts it's a
  // random `u…` string until the file gets named.
  id: string;
  title: string;
  // '' = workspace root ("Inbox"); otherwise the subdirectory name.
  // 'Opened' = ad-hoc file outside the workspace.
  folder: string;
  date: string;
  preview: string;
  starred: boolean;
  body: string;
  // Absolute path on disk. Undefined for unsaved drafts.
  path?: string;
  mtime?: number;
};

export type TocEntry = {
  level: number;
  text: string;
  id: string;
};

export type Tab = {
  id: string;
  title: string;
};

export type Workspace = {
  dir: string;
  // Subdirectory names directly under `dir`. The implicit "Inbox" folder
  // (workspace root) is not in this list.
  folders: string[];
};

export type SortMode = 'modified' | 'alpha' | 'created' | 'words';
