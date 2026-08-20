# Inkwell User Guide

Welcome to Inkwell — a fast, clean markdown reader and note-taker for Windows. This guide covers everything you need to get started and make the most of the app.

---

## Getting started

### Installing

Download the latest release from [GitHub Releases](https://github.com/mrelph/mdreader/releases):

- **Setup installer** (`Inkwell-x.y.z-setup.exe`) — recommended. Adds Start Menu shortcut, desktop icon, file associations, and auto-updates.
- **Portable** (`Inkwell-x.y.z-portable.exe`) — single file, no install. Run from anywhere (USB stick, downloads folder).
- **MSI** (`Inkwell-x.y.z.msi`) — for enterprise/IT deployment.

### Opening your first note

- **Drag a `.md` file** onto the window.
- **Ctrl+O** to open a single markdown file.
- **Double-click** any `.md` file in Explorer (after install, Inkwell is registered as the handler).

### Opening a workspace (folder of notes)

Press **Ctrl+Shift+O** and pick a folder. Inkwell reads every `.md` file in it (and one level of subfolders) into the sidebar. The folder structure becomes your organisation:

```
My Notes/
├── inbox/
│   ├── quick-thought.md
│   └── meeting-notes.md
├── projects/
│   └── Inkwell-plan.md
└── daily-log.md          ← appears under "Inbox" (workspace root)
```

Your last workspace is remembered and re-opened on next launch.

---

## The interface

```
┌─────────────────────────────────────────────────────────────┐
│  [Update banner - only when an update is available]         │
├─────────────────────────────────────────────────────────────┤
│  Titlebar: app name · note title  |  buttons  | ─ □ ✕      │
├──────────┬──────────────────────────────────────┬───────────┤
│ Sidebar  │        Note content                  │  Outline  │
│          │                                      │           │
│ Search   │  (rendered markdown or editor)       │  Headings │
│ New      │                                      │           │
│ Folders  │                                      │           │
│ Tags     │                                      │           │
│ Sort     │                                      │           │
│ Notes    │        Backlinks panel                │           │
├──────────┴──────────────────────────────────────┴───────────┤
│  [Tabs - when multiple notes are open]                      │
└─────────────────────────────────────────────────────────────┘
```

### Sidebar

- **Search** (`Ctrl+K`) — full-text search across titles, previews, and note bodies. Matching notes show a context snippet.
- **New Note / New Folder** — create files and folders inside your workspace.
- **Folder list** — filter notes by folder. Special entries: "All", "Inbox" (workspace root), "Starred", "Opened" (files opened individually outside the workspace).
- **Tags** — clickable pills showing `#tags` found across your notes. Click to filter; click again to clear.
- **Sort** — choose between Modified (newest first), A→Z, Oldest first, or Word count. Your choice is remembered.
- **Note list** — shows title, preview, date, and reading time. Hover for action buttons (star, rename, close, delete).

### Reader

- Renders your markdown with full GFM support (tables, checklists, strikethrough).
- **Syntax highlighting** in fenced code blocks (auto-detected language).
- **Headings** become links in the right-rail outline; click to jump.
- **Progress bar** at the top shows how far you've scrolled.
- **Wikilinks** (`[[Target]]`) render as purple links you can click to navigate.
- **Backlinks** at the bottom list notes that link to this one.

### Titlebar buttons

From left to right:
- **Edit/Read toggle** — switch between reading and editing the note.
- **Help** (Ctrl+/) — keyboard shortcut cheatsheet.
- **Export** — dropdown with PDF and HTML options.
- **Open file** — open a single `.md` from disk.
- **Focus mode** — hides everything except the note content.
- **Theme** — toggle light/dark mode.

---

## Reading notes

Just open a file or click a note in the sidebar. The reader renders your markdown with:

- Tables, task lists, strikethrough, autolinks (GitHub-flavoured Markdown)
- Syntax-highlighted code blocks
- Images (local images load immediately; remote images show a "Show image" button for privacy — click to load)
- A reading time estimate and word count in the header

### Focus mode

Press `F11` or `Ctrl+.` to hide the sidebar, tabs, and outline — just you and the text. Press `Esc` to exit.

### Find in note

`Ctrl+F` opens a search bar at the top. Type to highlight matches; use `Enter`/`Shift+Enter` (or the arrows) to cycle through them.

---

## Editing notes

Use the view switcher above the document to choose:

- **Read** — a finished, distraction-free page.
- **Split** — a live rendered preview beside the markdown source.
- **Write** — a dedicated source editor.

Press `Ctrl+E` to switch quickly between Read and Write. Split and Write use the same markdown-aware editor and guarded autosave path.

### Formatting shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+B` | **Bold** — wraps selection in `**` |
| `Ctrl+I` | *Italic* — wraps selection in `*` |
| `` Ctrl+` `` | `Inline code` — wraps selection in backticks |
| `Ctrl+1` | Toggle H1 on current line |
| `Ctrl+2` | Toggle H2 on current line |
| `Ctrl+3` | Toggle H3 on current line |
| `Tab` | Indent (2 spaces) |
| `Enter` | Continue bullet/numbered/task list (on empty marker: exit list) |
| `Ctrl+S` | Save immediately |

All toggles are idempotent — press the same shortcut again to unwrap.

### Autosave

Your changes save automatically after 600ms of inactivity. The header shows "Saving…" → "Saved" briefly. If you switch notes mid-edit, any pending changes are flushed to disk so nothing is lost.

### Conflict detection

If the file changes on disk while you're editing (e.g. a git pull or cloud sync), Inkwell detects the mismatch and asks:

- **Overwrite** — save your version, discarding the external change.
- **Reload** — discard your edits and load the newer on-disk version.

---

## Organising notes

### Folders

Your workspace's subdirectories are reflected as folders in the sidebar. Click a folder name to filter the note list. You can:

- **Create a folder** — `Ctrl+Shift+N` or the "Folder" button.
- **Delete a folder** — hover the folder row and click the trash icon. Notes inside are moved to the Recycle Bin (recoverable).

### Stars

Click the star icon on any note (in the sidebar or the note header) to favourite it. A "Starred" folder appears in the sidebar to collect them.

### Tags

Write `#tag-name` anywhere in your notes (must start with a letter, can contain letters/digits/hyphens/underscores). Inkwell parses these automatically and shows the top 20 by frequency in the sidebar tag bar.

- Click a tag pill to filter notes to only those containing that tag.
- Click the ✕ pill or click the active tag again to clear.
- Tags inside code blocks are ignored.

### Sorting

The sort dropdown below the tag bar offers:

| Mode | Behaviour |
|------|-----------|
| Modified | Newest modification first (default) |
| A → Z | Alphabetical by title |
| Oldest first | Oldest modification first |
| Word count | Longest notes first |

Your choice persists across sessions.

---

## Linking notes (Wikilinks)

### Creating links

In any note, write a wikilink using double brackets:

```markdown
See [[My Other Note]] for details.
Or with a custom label: [[filename|click here]].
```

### How resolution works

Inkwell tries to match your target against:
1. The **title** of every note (the first `# Heading` line, or the filename if there's no heading).
2. The **filename** (without extension) of every note.

Matching is case-insensitive and whitespace-tolerant. For example, `[[my note]]` resolves to a file titled "My Note" or named `my-note.md`.

### Visual feedback

- **Resolved links** — render in purple with a dotted underline. Click to jump to the target note.
- **Unresolved links** — render in red with a dashed underline so you can see what's missing (maybe a typo, or a note you haven't created yet).

### Backlinks

At the bottom of every note, Inkwell shows a "Backlinks" section listing every other note that links to it. Each backlink shows the source note's title and a context snippet around the `[[link]]`. Click to navigate.

---

## Quick switcher

Press **Ctrl+P** to open the quick switcher — a floating palette for instant note access.

- Start typing to fuzzy-match against note titles.
- When the field is empty, it shows your 20 most recently modified notes.
- **Arrow keys** to navigate, **Enter** to open, **Esc** to dismiss.

---

## Exporting notes

Click the **export icon** (upload arrow) in the titlebar to open the export menu:

- **Export as PDF** — renders the note with clean styling into a PDF via a save dialog. The file is revealed in Explorer after export.
- **Export as HTML** — writes a self-contained HTML file with inline styles that looks good in any browser.

---

## Auto-update

If you installed via the setup installer (NSIS), Inkwell checks for updates:
- 8 seconds after launch
- Every 4 hours while running

When an update is found, a banner appears at the top:
1. "Version X.Y.Z available" — click **Download**.
2. Progress bar shows download status.
3. "Update ready" — click **Restart now** to apply, or dismiss and it installs on next quit.

The portable build does not support auto-update (re-download manually).

---

## Keyboard shortcuts

### App-wide

| Shortcut | Action |
|----------|--------|
| `Ctrl+P` | Quick switcher |
| `Ctrl+K` | Focus sidebar search |
| `Ctrl+O` | Open a markdown file |
| `Ctrl+Shift+O` | Open a workspace folder |
| `Ctrl+N` | New note (in workspace) |
| `Ctrl+Shift+N` | New folder |
| `Ctrl+E` | Toggle Read/Write view |
| `Ctrl+F` | Find in note |
| `Ctrl+.` / `F11` | Toggle focus mode |
| `Ctrl+/` | Show/hide keyboard shortcuts |
| `Esc` | Close overlay / exit focus mode |

### Split and Write views

| Shortcut | Action |
|----------|--------|
| `Ctrl+B` | Bold |
| `Ctrl+I` | Italic |
| `` Ctrl+` `` | Inline code |
| `Ctrl+1/2/3` | Heading level 1/2/3 |
| `Tab` | Indent |
| `Enter` | Continue list / exit on empty |
| `Ctrl+S` | Save now |

---

## YAML frontmatter

Inkwell recognises YAML frontmatter blocks at the top of files:

```markdown
---
title: My Note
tags: [idea, draft]
date: 2026-07-13
---

# Actual content starts here
```

Frontmatter is:
- **Hidden** from the rendered view (you see only the content below it).
- **Excluded** from word counts, previews, and title derivation.
- **Visible** in Split and Write views so you can modify it.

Note: the `tags` field in frontmatter is not currently parsed for the sidebar tag bar — only inline `#tags` in the body are. This may change in a future release.

---

## Privacy and security

- **Remote images blocked by default** — images from `https://` URLs show a placeholder until you explicitly click "Show image". This prevents tracking pixels in shared notes from phoning home.
- **Content Security Policy** — scripts can only load from the app itself; no remote code execution.
- **No telemetry** — the only network request is checking GitHub Releases for updates.
- **Trash, not delete** — file deletion sends items to the Recycle Bin so you can recover them.

---

## Tips and tricks

- **Drag and drop** a `.md` file onto the window to open it.
- **Middle-click** or **Ctrl+click** a wikilink to open it in a new tab (coming soon).
- Use `#status/draft` or `#status/done` as tags for a lightweight workflow system.
- Keep a `_templates/` folder in your workspace for note templates — Inkwell won't render folders starting with `_` differently, but you can copy-paste from them.
- The portable build works great on a USB stick alongside your notes folder for a fully portable setup.

---

## Troubleshooting

### "This file changed on disk" keeps appearing
Another program (git, Dropbox, OneDrive) is modifying the file while you edit. Choose "Reload" to accept their version, or "Overwrite" if yours is correct. Consider pausing sync while doing heavy editing.

### Wikilinks aren't resolving
- Check that the target matches the note's title (first `# Heading`) or filename (without `.md`).
- Resolution is case-insensitive but whitespace matters: `[[my note]]` matches "My Note" but not "MyNote".

### Auto-update not working
- Only the NSIS installer build supports auto-update. The portable and MSI builds don't.
- The update check needs internet access to reach `github.com`.
- If you see a SmartScreen warning on update, the release isn't code-signed. This is cosmetic — click "More info" → "Run anyway".

### High memory usage with large workspaces
Inkwell loads all note bodies into memory for full-text search and wikilink resolution. For very large vaults (1000+ notes), this can consume 200–400MB. If this is a problem, consider splitting into smaller workspace folders.
