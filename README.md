# mdreader

A fast, modern markdown reader and lightweight note-taker for **Windows**. File-system-based, workspace-oriented, with wikilinks, tags, syntax highlighting, and a distraction-free reading experience.

Built with Electron and the Windows 11 Mica backdrop — translucent panels over your real desktop wallpaper.

## Quick start

```bash
npm install
npm run dev:electron    # Electron + hot-reload
```

Or as a plain web app (no native features):

```bash
npm run dev             # → http://localhost:5173
```

## Features

### Reading

- **GitHub-flavoured markdown** — tables, task lists, strikethrough, autolinks via remark-gfm.
- **Syntax highlighting** — fenced code blocks auto-detect language and render with a theme-aware token palette (light + dark).
- **Table of contents** — right-rail outline with scroll-spy; click any heading to jump.
- **Reading progress** bar across the top.
- **Focus mode** — `F11` or `Ctrl+.` hides everything except the note. `Esc` to exit.
- **Find in note** — `Ctrl+F` opens a search bar with match highlighting and navigation.

### Writing

- **Edit mode** — `Ctrl+E` toggles a plain-text markdown editor with 600ms autosave.
- **Formatting shortcuts** — Bold (`Ctrl+B`), italic (`Ctrl+I`), inline code (`` Ctrl+` ``), heading levels (`Ctrl+1/2/3`).
- **List continuation** — `Enter` on a bullet/numbered/task-list item continues the list; `Enter` on an empty marker exits it.
- **Conflict detection** — if a file changes on disk while you're editing (git pull, sync, another editor), you're prompted to Overwrite or Reload rather than silently clobbering.

### Organisation

- **Workspace folders** — `Ctrl+Shift+O` opens a folder; its subdirectories become sidebar sections.
- **Quick switcher** — `Ctrl+P` opens a fuzzy-match palette over all note titles.
- **Full-text search** — `Ctrl+K` searches titles, previews, and note bodies with context snippets.
- **Tags** — `#tag` tokens in note bodies are parsed and displayed as clickable filter pills in the sidebar.
- **Sort** — sidebar dropdown sorts by modified date, alphabetical, oldest first, or word count. Persisted.
- **Stars** — mark notes as favourites; filter to starred-only in the sidebar.

### Linking

- **Wikilinks** — `[[Note Title]]` or `[[filename|display text]]` links between notes. Resolved links render in purple; click to navigate.
- **Backlinks** — at the bottom of each note, see which other notes link to it (with a context snippet). Click to navigate.
- **Unresolved links** — render red/dashed so you know what's missing.

### Export

- **PDF** — export the current note as a styled PDF (via the titlebar export menu).
- **HTML** — export as a self-contained HTML file with inline styles.

### System integration

- **File association** — `.md` and `.markdown` files open in mdreader from Explorer (after install).
- **Single instance** — opening a second `.md` file passes it to the running instance.
- **Auto-update** — checks GitHub Releases on boot and every 4 hours. Download and restart from the in-app banner.
- **Trash delete** — deleted notes go to the Recycle Bin, not permanent deletion.
- **External change detection** — the workspace watches for file changes and auto-refreshes the sidebar.

### Privacy

- **Remote images gated** — images from `https://` URLs show a "Show image" placeholder until you click; prevents tracking pixels in shared notes.
- **CSP** — Content Security Policy locks down script/style sources.
- **No telemetry** — the app phones home only to GitHub for update checks.

## Build & package

```bash
npm run build              # web bundle → dist/
npm run pack               # unpacked Electron app → release/win-unpacked/
npm run dist:win           # all three Windows artifacts at once
npm run dist:win:nsis      # → release/mdreader-x.y.z-setup.exe
npm run dist:win:msi       # → release/mdreader-x.y.z.msi
npm run dist:win:portable  # → release/mdreader-x.y.z-portable.exe
```

| Artifact | Use case |
|---|---|
| `setup.exe` (NSIS) | Normal installer: Start Menu, desktop shortcut, uninstaller, file associations. Per-user, no admin. **Supports auto-update.** |
| `.msi` | Enterprise deployment via Group Policy / Intune / SCCM. |
| `portable.exe` | Single executable, no install. Self-extracts to temp. Good for USB sticks. |

All register `.md` / `.markdown` file associations.

## Publishing a release (auto-update)

1. Bump `version` in `package.json`.
2. `npm run dist:win:nsis` — generates the installer and a `latest.yml` manifest.
3. Create a GitHub Release tagged `vX.Y.Z`, upload the `.exe` and `latest.yml`.
4. Installed copies detect the update within seconds of their next launch.

Code signing (`CSC_LINK` + `CSC_KEY_PASSWORD` env vars) suppresses SmartScreen warnings.

## Testing

```bash
npm test              # run all tests once
npm run test:watch    # watch mode
```

56 tests cover pure logic: editor operations (bold/italic/heading toggles, list continuation), notes helpers (frontmatter stripping, slugify, TOC, word count), tag extraction, and wikilink resolution.

## Project layout

```
electron/
  main.cjs              main process: window, IPC, file ops, updater, watcher, export
  preload.cjs           contextBridge → window.electron typed API
src/
  App.tsx               app shell, state management, keyboard shortcuts
  components/
    Backlinks.tsx       backlinks panel (which notes link here?)
    Cheatsheet.tsx      keyboard shortcut overlay (Ctrl+/)
    Editor.tsx          textarea with formatting shortcuts + list continuation
    EmptyState.tsx      placeholder when no note is open
    ExportMenu.tsx      PDF/HTML export dropdown
    FindBar.tsx         in-note search with match navigation
    Outline.tsx         right-rail table of contents
    Prompt.tsx          modal dialog (input / confirm)
    QuickSwitcher.tsx   Ctrl+P fuzzy note palette
    Reader.tsx          markdown renderer with wikilinks + backlinks
    Sidebar.tsx         folders, tags, sort, note list, search
    Tabs.tsx            open-note tabs
    Titlebar.tsx        custom titlebar with window controls + export
    UpdateBanner.tsx    auto-update notification bar
  editorOps.ts          pure editor helpers (toggleWrap, toggleHeading, continueList)
  electron.ts           typed window.electron wrapper (null in browser)
  icons.tsx             SVG icon components
  main.tsx              React entry point
  notes.ts              frontmatter, TOC, slugify, word count, fileToNote
  openFile.ts           file-open abstraction (Electron → File System Access → input)
  tags.ts               #tag extraction + index builder
  types.ts              Note, Tab, TocEntry, Workspace, SortMode
  wikilinks.ts          [[wikilink]] parsing, resolution, replacement
  styles/
    app.css             page shell + faux desktop (web mode)
    reader.css          full component styles + theme tokens
```

## Design notes

- **Custom titlebar** — `titleBarStyle: 'hidden'` on Windows keeps native resize borders and Aero Snap; `frame: false` on macOS/Linux hides the traffic lights.
- **Mica** — `backgroundMaterial: 'mica'` on Windows 11 build 22000+. Falls back to an opaque fill on Windows 10.
- **Theming** — all colours are CSS custom properties (`--rd-*`), switched by `[data-theme='dark']` on the root element.
- **No database** — state lives in the filesystem (workspace folder) and localStorage (theme, sort, stars). Portable and sync-friendly.

## License

ISC
