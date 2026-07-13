import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Titlebar } from './components/Titlebar';
import { Sidebar, type FolderEntry } from './components/Sidebar';
import { Tabs } from './components/Tabs';
import { Reader } from './components/Reader';
import { EmptyState } from './components/EmptyState';
import { Prompt, type PromptKind } from './components/Prompt';
import { Cheatsheet } from './components/Cheatsheet';
import { UpdateBanner } from './components/UpdateBanner';
import { fileToNote } from './notes';
import { openMarkdownFile } from './openFile';
import { getElectron } from './electron';
import type { Note, Tab, Workspace } from './types';

const ACCENT_LIGHT = '#3a5fc8';
const ACCENT_DARK = '#6a8fdf';
const THEME_KEY = 'mdreader.theme';
const WORKSPACE_KEY = 'mdreader.workspaceDir';
const STARRED_KEY = 'mdreader.starredIds';

function readStarredIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STARRED_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed) : new Set();
  } catch {
    return new Set();
  }
}

type Theme = 'light' | 'dark';
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

function readInitialTheme(): Theme {
  try {
    const v = localStorage.getItem(THEME_KEY);
    if (v === 'light' || v === 'dark') return v;
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

function App() {
  const electron = getElectron();
  const inElectron = !!electron;

  const [theme, setTheme] = useState<Theme>(readInitialTheme);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [folder, setFolder] = useState<string>('All');
  const [query, setQuery] = useState<string>('');
  const [focused, setFocused] = useState<boolean>(false);
  const [tabs, setTabs] = useState<Tab[]>([]);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>('');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');

  const [helpOpen, setHelpOpen] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [starredIds, setStarredIds] = useState<Set<string>>(() => readStarredIds());

  const handleToggleStar = useCallback((id: string) => {
    setStarredIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try { localStorage.setItem(STARRED_KEY, JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const [prompt, setPrompt] = useState<PromptKind | null>(null);
  // The pending action a Prompt resolves to. Modal-based UI doesn't compose
  // naturally with await, so we stash a one-shot callback that the next
  // submit/cancel will invoke.
  const promptResolverRef = useRef<((value: string | null) => void) | null>(null);

  // ── Theme persistence + body data attributes ────────────────────────────
  useEffect(() => {
    document.body.dataset.bg = theme;
    document.body.dataset.electron = inElectron ? '1' : '0';
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme, inElectron]);

  // ── Track the native maximize state so the titlebar can show a restore
  //    glyph. The main process emits 'window:maximized' on every toggle. ────
  useEffect(() => {
    if (!electron) return;
    void electron.window.isMaximized().then(setMaximized);
    return electron.window.onMaximizedChange(setMaximized);
  }, [electron]);

  // Mirror `editing` into a ref so the workspace-change listener can read the
  // latest value without re-subscribing (and clobbering the debounce) on
  // every keystroke.
  const editingRef = useRef(editing);
  editingRef.current = editing;

  // Live draft text, mirrored into a ref so the flush-on-switch cleanup can
  // read the latest keystrokes without depending on `draft` (which would make
  // the effect re-run — and flush — on every character).
  const draftRef = useRef(draft);
  draftRef.current = draft;

  // Last successfully-persisted state for the active note, keyed by path.
  // The flush-on-switch cleanup reads mtime/body from here (not from the
  // note captured when the effect ran) so a write triggered by switching
  // away uses the freshest base mtime and never false-conflicts.
  const savedRef = useRef<{ path: string; mtime?: number; body: string } | null>(null);

  // ── Promise-style prompt helper ─────────────────────────────────────────
  const askPrompt = useCallback((kind: PromptKind): Promise<string | null> => {
    return new Promise((resolve) => {
      promptResolverRef.current = resolve;
      setPrompt(kind);
    });
  }, []);

  const resolvePrompt = useCallback((value: string | null) => {
    const fn = promptResolverRef.current;
    promptResolverRef.current = null;
    setPrompt(null);
    if (fn) fn(value);
  }, []);

  // ── Notes / workspace replay helpers ────────────────────────────────────

  const replaceWorkspaceNotes = useCallback(
    (workspaceFiles: { path: string; name: string; folder: string; text: string; mtime: number }[]) => {
      // Keep ad-hoc "Opened" notes that didn't come from this workspace; they
      // still belong in the sidebar even after a workspace refresh.
      setNotes((prev) => {
        const opened = prev.filter((n) => n.folder === 'Opened');
        const fresh = workspaceFiles.map((f) => fileToNote(f));
        return [...fresh, ...opened];
      });
    },
    []
  );

  const upsertNote = useCallback((note: Note) => {
    setNotes((prev) => {
      const i = prev.findIndex((n) => n.id === note.id);
      if (i >= 0) {
        const next = prev.slice();
        next[i] = note;
        return next;
      }
      return [note, ...prev];
    });
  }, []);

  const adoptOpenedFile = useCallback(
    (file: { name: string; text: string; path?: string; mtime?: number }) => {
      const note = fileToNote({ ...file, folder: 'Opened' });
      upsertNote(note);
      setTabs((prev) => (prev.find((t) => t.id === note.id) ? prev : [...prev, { id: note.id, title: note.title }]));
      setActiveId(note.id);
      setEditing(false);
      return note;
    },
    [upsertNote]
  );

  // ── Workspace lifecycle ─────────────────────────────────────────────────

  const loadWorkspace = useCallback(
    async (dir: string) => {
      if (!electron) return;
      const result = await electron.workspace.list(dir);
      if (!result) {
        // Stale path — clear it so we don't keep trying.
        try { localStorage.removeItem(WORKSPACE_KEY); } catch { /* ignore */ }
        setWorkspace(null);
        return;
      }
      setWorkspace({ dir: result.dir, folders: result.folders });
      replaceWorkspaceNotes(result.files);
      try { localStorage.setItem(WORKSPACE_KEY, result.dir); } catch { /* ignore */ }
    },
    [electron, replaceWorkspaceNotes]
  );

  const refreshWorkspace = useCallback(async () => {
    if (!electron || !workspace) return;
    await loadWorkspace(workspace.dir);
  }, [electron, workspace, loadWorkspace]);

  const handleOpenWorkspace = useCallback(async () => {
    if (!electron) return;
    const result = await electron.openFolder();
    if (!result) return;
    setWorkspace({ dir: result.dir, folders: result.folders });
    replaceWorkspaceNotes(result.files);
    setFolder('All');
    setActiveId(result.files[0] ? `f:${result.files[0].path}` : null);
    setTabs(result.files[0] ? [{ id: `f:${result.files[0].path}`, title: result.files[0].name.replace(/\.[^.]+$/, '') }] : []);
    try { localStorage.setItem(WORKSPACE_KEY, result.dir); } catch { /* ignore */ }
  }, [electron, replaceWorkspaceNotes]);

  // Restore last-used workspace on launch.
  useEffect(() => {
    if (!electron) return;
    let cancelled = false;
    (async () => {
      let dir: string | null = null;
      try { dir = localStorage.getItem(WORKSPACE_KEY); } catch { /* ignore */ }
      if (dir && !cancelled) await loadWorkspace(dir);
    })();
    return () => { cancelled = true; };
  }, [electron, loadWorkspace]);

  // ── External change refresh ─────────────────────────────────────────────
  // When the workspace changes on disk (external editor, git, sync), re-read
  // it — but skip while the user is mid-edit so a debounced watcher event
  // can't yank the draft out from under them.
  useEffect(() => {
    if (!electron || !workspace) return;
    return electron.workspace.onChanged(() => {
      if (editingRef.current) return;
      void refreshWorkspace();
    });
  }, [electron, workspace, refreshWorkspace]);

  // ── Single-file open (Ctrl+O) ───────────────────────────────────────────
  const handleOpenFile = useCallback(async () => {
    const picked = await openMarkdownFile();
    if (!picked) return;
    adoptOpenedFile({ name: picked.name, text: picked.text, path: picked.path });
  }, [adoptOpenedFile]);

  // ── Launch-time file paths from file association ────────────────────────
  useEffect(() => {
    if (!electron) return;
    let cancelled = false;
    (async () => {
      const launch = await electron.getLaunchFiles();
      if (cancelled) return;
      for (const f of launch) adoptOpenedFile(f);
    })();
    const off = electron.onOpenFilePath(async (p) => {
      const f = await electron.readFile(p);
      if (f) adoptOpenedFile(f);
    });
    return () => { cancelled = true; off(); };
  }, [electron, adoptOpenedFile]);

  // ── New file ────────────────────────────────────────────────────────────
  const handleNewFile = useCallback(async () => {
    if (!electron || !workspace) return;
    const filename = await askPrompt({
      kind: 'input',
      title: 'New note',
      placeholder: 'note-title',
      submitLabel: 'Create',
    });
    if (!filename) return;
    // Place the new file in the currently-filtered folder when one is
    // selected; otherwise drop it in the workspace root (Inbox).
    const inSubfolder = folder !== 'All' && folder !== '' && folder !== 'Opened' && workspace.folders.includes(folder);
    const sep = workspace.dir.includes('\\') ? '\\' : '/';
    const targetDir = inSubfolder ? `${workspace.dir}${sep}${folder}` : workspace.dir;
    try {
      const created = await electron.workspace.createFile(targetDir, filename, '');
      const note = fileToNote({ ...created, folder: inSubfolder ? folder : '' });
      upsertNote(note);
      setTabs((prev) => (prev.find((t) => t.id === note.id) ? prev : [...prev, { id: note.id, title: note.title }]));
      setActiveId(note.id);
      setEditing(true);
      setDraft('');
    } catch (err) {
      await askPrompt({
        kind: 'confirm',
        title: 'Could not create note',
        body: (err as Error).message,
        submitLabel: 'OK',
      });
    }
  }, [electron, workspace, folder, askPrompt, upsertNote]);

  // ── New folder ──────────────────────────────────────────────────────────
  const handleNewFolder = useCallback(async () => {
    if (!electron || !workspace) return;
    const name = await askPrompt({
      kind: 'input',
      title: 'New folder',
      placeholder: 'folder name',
      submitLabel: 'Create',
    });
    if (!name) return;
    try {
      await electron.workspace.createFolder(workspace.dir, name);
      await refreshWorkspace();
      setFolder(name);
    } catch (err) {
      await askPrompt({
        kind: 'confirm',
        title: 'Could not create folder',
        body: (err as Error).message,
        submitLabel: 'OK',
      });
    }
  }, [electron, workspace, askPrompt, refreshWorkspace]);

  // ── Delete folder ───────────────────────────────────────────────────────
  const handleDeleteFolder = useCallback(
    async (folderName: string) => {
      if (!electron || !workspace) return;
      const noteCount = notes.filter((n) => n.folder === folderName).length;
      const body = noteCount
        ? `"${folderName}" contains ${noteCount} note${noteCount === 1 ? '' : 's'}. Delete the folder and everything inside?`
        : `Delete the empty folder "${folderName}"?`;
      const ok = await askPrompt({
        kind: 'confirm',
        title: 'Delete folder',
        body,
        submitLabel: 'Delete',
        danger: true,
      });
      if (ok === null) return;
      try {
        const sep = workspace.dir.includes('\\') ? '\\' : '/';
        await electron.workspace.deleteFolder(`${workspace.dir}${sep}${folderName}`);
        // Drop any open tabs / active id that referenced files in this folder.
        const removedIds = new Set(notes.filter((n) => n.folder === folderName).map((n) => n.id));
        if (removedIds.size) {
          setTabs((prev) => prev.filter((t) => !removedIds.has(t.id)));
          if (activeId && removedIds.has(activeId)) setActiveId(null);
        }
        if (folder === folderName) setFolder('All');
        await refreshWorkspace();
      } catch (err) {
        await askPrompt({
          kind: 'confirm',
          title: 'Could not delete folder',
          body: (err as Error).message,
          submitLabel: 'OK',
        });
      }
    },
    [electron, workspace, notes, askPrompt, activeId, folder, refreshWorkspace]
  );

  // ── Close / delete note ─────────────────────────────────────────────────
  const handleCloseNote = useCallback(
    (id: string) => {
      setTabs((prev) => prev.filter((t) => t.id !== id));
      setNotes((prev) => prev.filter((n) => n.id !== id));
      if (activeId === id) {
        // Pick the next available note, or null if none.
        const remaining = notes.filter((n) => n.id !== id);
        setActiveId(remaining[0]?.id ?? null);
        setEditing(false);
      }
    },
    [activeId, notes]
  );

  const handleDeleteNote = useCallback(
    async (note: Note) => {
      if (!note.path) return;
      const ok = await askPrompt({
        kind: 'confirm',
        title: 'Delete note',
        body: `Delete "${note.title}" from disk? This cannot be undone.`,
        submitLabel: 'Delete',
        danger: true,
      });
      if (ok === null) return;
      try {
        if (electron) await electron.workspace.deleteFile(note.path);
        handleCloseNote(note.id);
      } catch (err) {
        await askPrompt({
          kind: 'confirm',
          title: 'Could not delete note',
          body: (err as Error).message,
          submitLabel: 'OK',
        });
      }
    },
    [askPrompt, electron, handleCloseNote]
  );

  // ── Rename note ─────────────────────────────────────────────────────────
  const handleRenameNote = useCallback(
    async (target: Note) => {
      if (!electron || !target.path) return;
      const sep = target.path.includes('\\') ? '\\' : '/';
      const dir = target.path.slice(0, target.path.lastIndexOf(sep));
      const oldName = target.path.slice(target.path.lastIndexOf(sep) + 1);
      const dotIdx = oldName.lastIndexOf('.');
      const stem = dotIdx > 0 ? oldName.slice(0, dotIdx) : oldName;
      const ext = dotIdx > 0 ? oldName.slice(dotIdx) : '.md';
      const input = await askPrompt({
        kind: 'input',
        title: 'Rename note',
        initial: stem,
        placeholder: 'note-title',
        submitLabel: 'Rename',
      });
      if (!input) return;
      // Keep the original extension unless the user typed their own.
      const safe = input.replace(/[\\/:*?"<>|]/g, '_').trim();
      if (!safe) return;
      const newName = /\.(md|markdown|mdx|txt)$/i.test(safe) ? safe : `${safe}${ext}`;
      const newPath = `${dir}${sep}${newName}`;
      if (newPath === target.path) return;
      try {
        await electron.workspace.rename(target.path, newPath);
        // The id is derived from the path, so renaming mints a new note. Read
        // the file back and swap it in, migrating any open tab / active id.
        const fresh = await electron.readFile(newPath);
        if (fresh) {
          const renamed = fileToNote({ ...fresh, folder: target.folder });
          setNotes((prev) => prev.map((n) => (n.id === target.id ? renamed : n)));
          setTabs((prev) => prev.map((t) => (t.id === target.id ? { id: renamed.id, title: renamed.title } : t)));
          setActiveId((cur) => (cur === target.id ? renamed.id : cur));
          // Carry the star over to the new id.
          setStarredIds((prev) => {
            if (!prev.has(target.id)) return prev;
            const next = new Set(prev);
            next.delete(target.id);
            next.add(renamed.id);
            try { localStorage.setItem(STARRED_KEY, JSON.stringify([...next])); } catch { /* ignore */ }
            return next;
          });
        }
      } catch (err) {
        await askPrompt({
          kind: 'confirm',
          title: 'Could not rename note',
          body: (err as Error).message,
          submitLabel: 'OK',
        });
      }
    },
    [electron, askPrompt]
  );

  // ── Edit-mode draft state ───────────────────────────────────────────────
  const note = useMemo(() => {
    const found = notes.find((n) => n.id === activeId) ?? null;
    if (!found) return null;
    return starredIds.has(found.id) ? { ...found, starred: true } : found;
  }, [notes, activeId, starredIds]);

  // Whenever the user switches notes or toggles edit mode on, sync the draft
  // from the on-disk body so we don't show stale text from the previous file,
  // and snapshot the freshly-loaded state as the flush baseline.
  useEffect(() => {
    if (note && editing) {
      setDraft(note.body);
      if (note.path) savedRef.current = { path: note.path, mtime: note.mtime, body: note.body };
    }
    setSaveStatus('idle');
  }, [note?.id, editing]);

  // Auto-save draft after 600ms of inactivity. Manual Ctrl+S in the editor
  // still calls saveDraft directly for an immediate write.
  const saveDraft = useCallback(async () => {
    if (!note || !note.path || !electron) return;
    setSaveStatus('saving');
    try {
      // Pass the mtime we loaded from so the main process can reject the write
      // if the file changed on disk underneath us.
      const written = await electron.workspace.writeFile(note.path, draft, note.mtime);
      const updated: Note = {
        ...note,
        body: written.text,
        mtime: written.mtime,
        // re-derive title/preview so edits to the H1 line bubble through
        // to sidebar + tab.
        title: fileToNote({ ...written, folder: note.folder }).title,
        preview: fileToNote({ ...written, folder: note.folder }).preview,
      };
      upsertNote(updated);
      savedRef.current = { path: note.path, mtime: written.mtime, body: written.text };
      setTabs((prev) => prev.map((t) => (t.id === note.id ? { ...t, title: updated.title } : t)));
      setSaveStatus('saved');
    } catch (err) {
      setSaveStatus('error');
      // A stale-write conflict is worth an explicit prompt: let the user
      // choose between overwriting on disk or reloading the newer version.
      if (/changed on disk/i.test((err as Error)?.message ?? '')) {
        const overwrite = await askPrompt({
          kind: 'confirm',
          title: 'File changed on disk',
          body: `"${note.title}" was modified by another program since you opened it. Overwrite those changes with your version, or discard yours and reload?`,
          submitLabel: 'Overwrite',
          cancelLabel: 'Reload',
          danger: true,
        });
        if (overwrite !== null) {
          // Overwrite: retry with no base mtime, which skips the guard.
          try {
            const written = await electron.workspace.writeFile(note.path, draft, undefined);
            upsertNote({ ...note, body: written.text, mtime: written.mtime });
            savedRef.current = { path: note.path, mtime: written.mtime, body: written.text };
            setSaveStatus('saved');
          } catch {
            setSaveStatus('error');
          }
        } else {
          // Reload: pull the on-disk version into the editor and reader.
          const fresh = await electron.readFile(note.path);
          if (fresh) {
            const reloaded = fileToNote({ ...fresh, folder: note.folder });
            upsertNote(reloaded);
            setDraft(reloaded.body);
            savedRef.current = { path: reloaded.path!, mtime: reloaded.mtime, body: reloaded.body };
            setSaveStatus('idle');
          }
        }
      }
    }
  }, [note, draft, electron, upsertNote, askPrompt]);

  useEffect(() => {
    if (!editing || !note?.path) return;
    if (draft === note.body) return;
    setSaveStatus('saving');
    const t = setTimeout(saveDraft, 600);
    return () => clearTimeout(t);
  }, [draft, editing, note?.path, note?.body, saveDraft]);

  // Flush any unsaved draft when the active note changes or edit mode ends, so
  // switching away mid-debounce can't drop the last keystrokes. Reads the
  // outgoing note's *latest persisted* state from savedRef (updated by every
  // successful autosave) so the write uses a fresh base mtime and won't
  // false-conflict, plus the live draft from draftRef. Runs only on note.id /
  // editing changes — not on every keystroke.
  useEffect(() => {
    if (!editing || !note?.path) return;
    const outgoingPath = note.path;
    return () => {
      const saved = savedRef.current;
      if (!saved || saved.path !== outgoingPath) return;
      const pending = draftRef.current;
      if (pending === saved.body) return; // nothing unsaved
      void electron?.workspace
        .writeFile(outgoingPath, pending, saved.mtime)
        .catch(() => { /* a conflict will resurface when the file is reopened */ });
    };
  }, [note?.id, editing, electron]);

  // Drop the "Saved" badge after a beat so the meta row stops looking
  // permanently mid-save. Errors stay visible until the next edit.
  useEffect(() => {
    if (saveStatus !== 'saved') return;
    const t = setTimeout(() => setSaveStatus('idle'), 1400);
    return () => clearTimeout(t);
  }, [saveStatus]);

  // ── Keyboard shortcuts ──────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.shiftKey && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        if (inElectron) void handleOpenWorkspace();
        else void handleOpenFile();
      } else if (mod && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        void handleOpenFile();
      } else if (mod && e.key.toLowerCase() === 'n' && !e.shiftKey) {
        e.preventDefault();
        if (workspace) void handleNewFile();
      } else if (mod && e.shiftKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        if (workspace) void handleNewFolder();
      } else if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        const input = document.querySelector<HTMLInputElement>('.rd-search-input');
        input?.focus();
      } else if (e.key === 'F11' || (mod && e.key === '.')) {
        e.preventDefault();
        setFocused((f) => !f);
      } else if (mod && e.key.toLowerCase() === 'e' && note?.path) {
        e.preventDefault();
        setEditing((v) => !v);
      } else if (mod && e.key === '/') {
        e.preventDefault();
        setHelpOpen((v) => !v);
      } else if (mod && e.key.toLowerCase() === 'f' && note) {
        e.preventDefault();
        setFindOpen(true);
      } else if (e.key === 'Escape') {
        if (helpOpen) {
          setHelpOpen(false);
        } else if (findOpen) {
          setFindOpen(false);
        } else if (focused) {
          setFocused(false);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    handleOpenFile,
    handleOpenWorkspace,
    handleNewFile,
    handleNewFolder,
    workspace,
    focused,
    note,
    note?.path,
    inElectron,
    helpOpen,
    findOpen,
  ]);

  // Project the star map onto notes so the Sidebar/Reader can read it as a
  // single field. Done lazily here to keep starredIds the source of truth.
  const decoratedNotes = useMemo(
    () => notes.map((n) => (starredIds.has(n.id) ? { ...n, starred: true } : n)),
    [notes, starredIds]
  );

  // ── Folder list for sidebar ─────────────────────────────────────────────
  const folderEntries: FolderEntry[] = useMemo(() => {
    const inboxCount = notes.filter((n) => n.folder === '').length;
    const openedCount = notes.filter((n) => n.folder === 'Opened').length;
    const subfolderCounts = new Map<string, number>();
    if (workspace) for (const f of workspace.folders) subfolderCounts.set(f, 0);
    for (const n of notes) {
      if (n.folder && n.folder !== 'Opened') {
        subfolderCounts.set(n.folder, (subfolderCounts.get(n.folder) ?? 0) + 1);
      }
    }
    const out: FolderEntry[] = [];
    if (inboxCount || workspace) out.push({ name: '', count: inboxCount, diskFolder: false });
    for (const [name, count] of subfolderCounts) {
      out.push({ name, count, diskFolder: true });
    }
    if (openedCount) out.push({ name: 'Opened', count: openedCount, diskFolder: false });
    return out;
  }, [notes, workspace]);

  // ── Render helpers ──────────────────────────────────────────────────────
  const accent = theme === 'dark' ? ACCENT_DARK : ACCENT_LIGHT;

  const handleSelect = (id: string) => {
    setActiveId(id);
    setEditing(false);
    if (!tabs.find((t) => t.id === id)) {
      const target = notes.find((n) => n.id === id);
      if (target) setTabs([...tabs, { id, title: target.title }]);
    }
  };

  const handleCloseTab = (id: string) => {
    const next = tabs.filter((t) => t.id !== id);
    setTabs(next);
    if (id === activeId && next.length) setActiveId(next[0].id);
    else if (id === activeId) setActiveId(null);
  };

  const titleText = note?.title ?? (workspace ? workspace.dir.split(/[\\/]/).filter(Boolean).pop() ?? 'mdreader' : 'No file open');
  const canEdit = !!note?.path && inElectron;

  const reader = (
    <div className="rd rd-mica" data-theme={theme} data-focused={focused ? '1' : '0'}>
      <UpdateBanner />
      <Titlebar
        theme={theme}
        onTheme={() => setTheme(theme === 'light' ? 'dark' : 'light')}
        title={titleText}
        accent={accent}
        focused={focused}
        onFocus={() => setFocused((f) => !f)}
        onOpenFile={handleOpenFile}
        editing={editing}
        canEdit={canEdit}
        onToggleEdit={() => setEditing((v) => !v)}
        onToggleHelp={() => setHelpOpen((v) => !v)}
        helpOpen={helpOpen}
        maximized={maximized}
      />
      <div className="rd-body">
        {!focused && (
          <Sidebar
            notes={decoratedNotes}
            folders={folderEntries}
            totalCount={notes.length}
            activeId={activeId}
            onSelect={handleSelect}
            query={query}
            onQuery={setQuery}
            folder={folder}
            onFolder={setFolder}
            hasWorkspace={!!workspace}
            inElectron={inElectron}
            onNewFile={handleNewFile}
            onNewFolder={handleNewFolder}
            onCloseNote={handleCloseNote}
            onDeleteNote={handleDeleteNote}
            onRenameNote={handleRenameNote}
            onDeleteFolder={handleDeleteFolder}
            onToggleStar={handleToggleStar}
          />
        )}
        <div className="rd-content">
          {!focused && tabs.length > 0 && (
            <Tabs
              tabs={tabs}
              activeId={activeId ?? ''}
              onSelect={(id) => {
                setActiveId(id);
                setEditing(false);
              }}
              onClose={handleCloseTab}
              onNew={workspace ? handleNewFile : handleOpenFile}
            />
          )}
          {note ? (
            <Reader
              note={note}
              focused={focused}
              editing={editing}
              draft={draft}
              onDraftChange={setDraft}
              onSave={saveDraft}
              saveStatus={saveStatus}
              findOpen={findOpen}
              onCloseFind={() => setFindOpen(false)}
              onToggleStar={() => handleToggleStar(note.id)}
            />
          ) : (
            <EmptyState
              hasWorkspace={!!workspace}
              inElectron={inElectron}
              onOpenWorkspace={handleOpenWorkspace}
              onNewFile={handleNewFile}
              onOpenFile={handleOpenFile}
            />
          )}
        </div>
      </div>
      <Prompt
        open={prompt}
        onSubmit={(v) => resolvePrompt(v)}
        onCancel={() => resolvePrompt(null)}
      />
      <Cheatsheet open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );

  if (inElectron) return reader;

  return (
    <div className="desktop">
      <div className="window-wrap">{reader}</div>
    </div>
  );
}

export default App;
