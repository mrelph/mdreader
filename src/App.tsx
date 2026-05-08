import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Titlebar } from './components/Titlebar';
import { Sidebar, type FolderEntry } from './components/Sidebar';
import { Tabs } from './components/Tabs';
import { Reader } from './components/Reader';
import { EmptyState } from './components/EmptyState';
import { Prompt, type PromptKind } from './components/Prompt';
import { fileToNote } from './notes';
import { openMarkdownFile } from './openFile';
import { getElectron } from './electron';
import type { Note, Tab, Workspace } from './types';

const ACCENT_LIGHT = '#3a5fc8';
const ACCENT_DARK = '#6a8fdf';
const THEME_KEY = 'mdreader.theme';
const WORKSPACE_KEY = 'mdreader.workspaceDir';

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
    const targetDir = inSubfolder ? `${workspace.dir}\\${folder}` : workspace.dir;
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
        await electron.workspace.deleteFolder(`${workspace.dir}\\${folderName}`);
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

  // ── Edit-mode draft state ───────────────────────────────────────────────
  const note = useMemo(() => notes.find((n) => n.id === activeId) ?? null, [notes, activeId]);

  // Whenever the user switches notes or toggles edit mode on, sync the draft
  // from the on-disk body so we don't show stale text from the previous file.
  useEffect(() => {
    if (note && editing) setDraft(note.body);
    setSaveStatus('idle');
  }, [note?.id, editing]);

  // Auto-save draft after 600ms of inactivity. Manual Ctrl+S in the editor
  // still calls saveDraft directly for an immediate write.
  const saveDraft = useCallback(async () => {
    if (!note || !note.path || !electron) return;
    setSaveStatus('saving');
    try {
      const written = await electron.workspace.writeFile(note.path, draft);
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
      setTabs((prev) => prev.map((t) => (t.id === note.id ? { ...t, title: updated.title } : t)));
      setSaveStatus('saved');
    } catch {
      setSaveStatus('error');
    }
  }, [note, draft, electron, upsertNote]);

  useEffect(() => {
    if (!editing || !note?.path) return;
    if (draft === note.body) return;
    setSaveStatus('saving');
    const t = setTimeout(saveDraft, 600);
    return () => clearTimeout(t);
  }, [draft, editing, note?.path, note?.body, saveDraft]);

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
      } else if (e.key === 'Escape' && focused) {
        setFocused(false);
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
    note?.path,
    inElectron,
  ]);

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

  const titleText = note?.title ?? (workspace ? 'mdreader' : 'mdreader');
  const canEdit = !!note?.path && inElectron;

  const reader = (
    <div className="rd rd-mica" data-theme={theme} data-focused={focused ? '1' : '0'}>
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
      />
      <div className="rd-body">
        {!focused && (
          <Sidebar
            notes={notes}
            folders={folderEntries}
            totalCount={notes.length}
            activeId={activeId}
            onSelect={handleSelect}
            query={query}
            onQuery={setQuery}
            folder={folder}
            onFolder={setFolder}
            hasWorkspace={!!workspace}
            onNewFile={handleNewFile}
            onNewFolder={handleNewFolder}
            onCloseNote={handleCloseNote}
            onDeleteNote={handleDeleteNote}
            onDeleteFolder={handleDeleteFolder}
          />
        )}
        <div className="rd-content">
          {!focused && (
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
