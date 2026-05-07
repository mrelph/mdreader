import { useCallback, useEffect, useMemo, useState } from 'react';
import { Titlebar } from './components/Titlebar';
import { Sidebar } from './components/Sidebar';
import { Tabs } from './components/Tabs';
import { Reader } from './components/Reader';
import { SAMPLE_NOTES, derivePreview, deriveTitle } from './notes';
import { openMarkdownFile } from './openFile';
import { getElectron } from './electron';
import type { Note, Tab } from './types';

const ACCENT_LIGHT = '#3a5fc8';
const ACCENT_DARK = '#6a8fdf';
const THEME_KEY = 'mdreader.theme';

type Theme = 'light' | 'dark';

function readInitialTheme(): Theme {
  try {
    const v = localStorage.getItem(THEME_KEY);
    if (v === 'light' || v === 'dark') return v;
  } catch {
    /* ignore — private mode etc. */
  }
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

function todayLabel(): string {
  return new Date().toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function makeNoteFromFile(name: string, text: string, filePath?: string): Note {
  const id = filePath ? `f:${filePath}` : `u${Date.now().toString(36)}`;
  const title = deriveTitle(text, name.replace(/\.[^.]+$/, ''));
  return {
    id,
    title,
    folder: 'Opened',
    date: todayLabel(),
    preview: derivePreview(text) || name,
    starred: false,
    body: text,
  };
}

function App() {
  const [theme, setTheme] = useState<Theme>(readInitialTheme);
  const [notes, setNotes] = useState<Note[]>(SAMPLE_NOTES);
  const [activeId, setActiveId] = useState<string>('n1');
  const [folder, setFolder] = useState<string>('All');
  const [query, setQuery] = useState<string>('');
  const [focused, setFocused] = useState<boolean>(false);
  const [tabs, setTabs] = useState<Tab[]>([
    { id: 'n1', title: 'On slow mornings' },
    { id: 'n2', title: 'Reading list — spring' },
    { id: 'n5', title: 'Letters I haven’t sent' },
  ]);

  const electron = getElectron();
  const inElectron = !!electron;

  // Wallpaper colour follows the current theme so the Mica window blends in.
  // Electron mode hides the faux desktop entirely (the OS desktop is the
  // backdrop), but we still set the attribute so any same-window styling can
  // key off it.
  useEffect(() => {
    document.body.dataset.bg = theme;
    document.body.dataset.electron = inElectron ? '1' : '0';
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme, inElectron]);

  // Add a freshly-opened markdown blob to the notes list, queue a tab for it,
  // and make it the active note. De-dupes by absolute path so opening the
  // same file twice doesn't pile up duplicates.
  const adoptNote = useCallback(
    (name: string, text: string, filePath?: string) => {
      const note = makeNoteFromFile(name, text, filePath);
      setNotes((prev) => {
        const existing = prev.findIndex((n) => n.id === note.id);
        if (existing >= 0) {
          const next = prev.slice();
          next[existing] = note;
          return next;
        }
        return [note, ...prev];
      });
      setTabs((prev) => (prev.find((t) => t.id === note.id) ? prev : [...prev, { id: note.id, title: note.title }]));
      setActiveId(note.id);
      setFolder('All');
    },
    []
  );

  const handleOpenFile = useCallback(async () => {
    const picked = await openMarkdownFile();
    if (!picked) return;
    adoptNote(picked.name, picked.text, picked.path);
  }, [adoptNote]);

  const handleOpenFolder = useCallback(async () => {
    if (!electron) return handleOpenFile();
    const result = await electron.openFolder();
    if (!result || !result.files.length) return;
    // Replace the seed sample notes with the folder's contents — opening a
    // folder is a "switch context" gesture, not "merge".
    const incoming: Note[] = result.files.map((f) =>
      makeNoteFromFile(f.name, f.text, f.path)
    );
    setNotes(incoming);
    setFolder('All');
    if (incoming[0]) {
      setActiveId(incoming[0].id);
      setTabs([{ id: incoming[0].id, title: incoming[0].title }]);
    }
  }, [electron, handleOpenFile]);

  // Pull any file paths passed on launch (file association / "Open With…").
  // Runs once on mount in Electron only.
  useEffect(() => {
    if (!electron) return;
    let cancelled = false;
    (async () => {
      const launch = await electron.getLaunchFiles();
      if (cancelled) return;
      for (const f of launch) adoptNote(f.name, f.text, f.path);
    })();
    const off = electron.onOpenFilePath(async (p) => {
      const f = await electron.readFile(p);
      if (f) adoptNote(f.name, f.text, f.path);
    });
    return () => {
      cancelled = true;
      off();
    };
  }, [electron, adoptNote]);

  // Keyboard shortcuts: ⌘/Ctrl+O opens a file, ⌘/Ctrl+Shift+O opens a folder
  // (Electron only), ⌘/Ctrl+K focuses the search, F11/⌘. toggles focus mode.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.shiftKey && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        void handleOpenFolder();
      } else if (mod && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        void handleOpenFile();
      } else if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        const input = document.querySelector<HTMLInputElement>('.rd-search-input');
        input?.focus();
      } else if (e.key === 'F11' || (mod && e.key === '.')) {
        e.preventDefault();
        setFocused((f) => !f);
      } else if (e.key === 'Escape' && focused) {
        setFocused(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleOpenFile, handleOpenFolder, focused]);

  const accent = theme === 'dark' ? ACCENT_DARK : ACCENT_LIGHT;
  const note = useMemo(() => notes.find((n) => n.id === activeId) ?? notes[0], [notes, activeId]);

  const handleSelect = (id: string) => {
    setActiveId(id);
    if (!tabs.find((t) => t.id === id)) {
      const target = notes.find((n) => n.id === id);
      if (target) setTabs([...tabs, { id, title: target.title }]);
    }
  };

  const handleClose = (id: string) => {
    const next = tabs.filter((t) => t.id !== id);
    setTabs(next);
    if (id === activeId && next.length) setActiveId(next[0].id);
  };

  const reader = (
    <div className="rd rd-mica" data-theme={theme} data-focused={focused ? '1' : '0'}>
      <Titlebar
        theme={theme}
        onTheme={() => setTheme(theme === 'light' ? 'dark' : 'light')}
        title={note?.title ?? 'mdreader'}
        accent={accent}
        focused={focused}
        onFocus={() => setFocused((f) => !f)}
        onOpenFile={handleOpenFile}
      />
      <div className="rd-body">
        {!focused && (
          <Sidebar
            notes={notes}
            activeId={activeId}
            onSelect={handleSelect}
            query={query}
            onQuery={setQuery}
            folder={folder}
            onFolder={setFolder}
            onNew={inElectron ? handleOpenFolder : handleOpenFile}
          />
        )}
        <div className="rd-content">
          {!focused && (
            <Tabs
              tabs={tabs}
              activeId={activeId}
              onSelect={setActiveId}
              onClose={handleClose}
              onNew={handleOpenFile}
            />
          )}
          {note ? (
            <Reader note={note} focused={focused} />
          ) : (
            <div className="rd-empty">
              <div className="rd-empty-title">No note open</div>
              <div className="rd-empty-hint">
                Press ⌘O / Ctrl+O to open a markdown file, or pick one from the sidebar.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Electron: the OS window IS the chrome — no faux desktop, no rounded
  // window-wrap. Just fill the whole viewport.
  if (inElectron) return reader;

  return (
    <div className="desktop">
      <div className="window-wrap">{reader}</div>
    </div>
  );
}

export default App;
