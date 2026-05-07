# mdreader

A clean, modern markdown reader for **Windows**, built around the Mica / soft-tinted direction (C) of the original design. Translucent panels float over the real Windows 11 desktop wallpaper, with a folder-organised sidebar, tabbed notes, an in-page outline, and a distraction-free focus mode.

Runs as a native-feeling Electron app on Windows, and also works as a plain web app.

## Run it

### As a Windows app (Electron)

```bash
npm install
npm run dev:electron
```

This starts Vite and launches Electron pointing at it. The app opens in a frameless Windows 11 window with Mica enabled; min/max/close are wired to the OS and the titlebar is draggable.

### As a web app

```bash
npm install
npm run dev
```

Then open <http://localhost:5173>. The Electron-only features (folder open, real OS dialogs, native window controls) gracefully fall back to File System Access API + a hidden file input. The web build also paints a faux desktop wallpaper behind a rounded "window" so the design still reads.

## Build & package

```bash
npm run build              # web bundle → dist/
npm run pack               # unpacked Electron app → release/win-unpacked/
npm run dist:win           # all three Windows artifacts at once
npm run dist:win:nsis      # → release/mdreader-x.y.z-setup.exe
npm run dist:win:msi       # → release/mdreader-x.y.z.msi
npm run dist:win:portable  # → release/mdreader-x.y.z-portable.exe
```

| Artifact | Size | Use it when… |
|---|---|---|
| `mdreader-x.y.z-portable.exe` | ~72 MB | You want a **single .exe**. No installation, no admin, no registry entries. Double-click and run. Self-extracts to `%LOCALAPPDATA%\Temp\mdreader-x.y.z` on first launch. Drop it on a USB stick if you like. |
| `mdreader-x.y.z-setup.exe` (NSIS) | ~79 MB | You want a normal installer experience: Start Menu entry, desktop shortcut, uninstaller in Apps & Features, file associations for `.md` / `.markdown`. Per-user install, no admin needed. |
| `mdreader-x.y.z.msi` | ~89 MB | You're deploying via **Group Policy / Intune / SCCM**, or your IT department wants an MSI. Same install experience as the NSIS but in MSI form. |

All three artifacts register `.md` / `.markdown` file associations so double-clicking a markdown file opens it in mdreader (the portable .exe needs to be run at least once first).

**WiX requirement:** the MSI target uses WiX Toolset 4.x. `electron-builder` auto-downloads it the first time, so you don't need to install it manually.

**Code signing:** none of these are signed by default — Windows SmartScreen will warn the first time. Provide a code-signing certificate via `CSC_LINK` + `CSC_KEY_PASSWORD` env vars to sign before distributing.

## Features

- **Open any `.md`** — `Ctrl+O`, the open button in the titlebar / sidebar / tabs, or right-click a `.md` file → Open with → mdreader (after install).
- **Open a folder of notes** — `Ctrl+Shift+O` (Electron only). Replaces the seeded sample notes with the directory's contents, sorted newest first.
- **GitHub-flavoured markdown** via `react-markdown` + `remark-gfm` (tables, task lists, strikethrough, autolinks).
- **Focus mode** — `F11` or `Ctrl+.` hides the sidebar, tabs, and outline. `Esc` exits.
- **Reading progress** bar and **scroll-spy outline** on the right rail; clicking an outline entry jumps to that heading.
- **Theme** — light / dark, toggled from the titlebar. Persisted to `localStorage` and follows OS preference on first launch.
- **Search** — `Ctrl+K` to focus, filters by title or preview.
- **File-association launches** — opening a `.md` with mdreader from File Explorer adds it to the open tabs even if mdreader is already running (single-instance).

## Project layout

```
electron/
  main.cjs              main process: BrowserWindow (frameless + Mica), IPC, file dialogs
  preload.cjs           contextBridge → window.electron API
src/
  App.tsx               app shell, state, keyboard shortcuts, electron/web branching
  components/
    Titlebar.tsx        custom Windows-style titlebar; window controls when in Electron
    Sidebar.tsx         folders + note list + search
    Tabs.tsx            open notes
    Reader.tsx          markdown view, progress, scroll-spy outline
    Outline.tsx         right-rail TOC
  styles/
    app.css             page shell + faux desktop wallpaper (web only)
    reader.css          Direction C (Mica) tokens + reader chrome
  electron.ts           typed window.electron wrapper (returns null in browser)
  icons.tsx             SVG icon set
  notes.ts              sample journal seed + TOC/word-count helpers
  openFile.ts           Electron IPC dialog → File System Access API → input fallback
  types.ts              Note, Tab, TocEntry types
```

## Notes on the design

The window chrome is custom (`frame: false`) because the Mica look needs control of the titlebar. Drag is provided by `-webkit-app-region: drag` on the titlebar; the buttons opt out via `no-drag`. On Windows 11 the OS draws the rounded corners and the Mica backdrop; older Windows falls back to a flat fill.

`backgroundMaterial: 'mica'` requires Windows 11 build 22000+. On Windows 10 the window will look slightly more opaque but still works correctly.
