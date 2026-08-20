import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import type { Note, TocEntry, ViewMode } from '../types';
import { buildToc, makeSlugger, readingMinutes, stripFrontmatter, wordCount } from '../notes';
import { buildResolver, replaceWikilinks } from '../wikilinks';
import {
  BookOpenIcon,
  DocIcon,
  OutlineIcon,
  PencilIcon,
  SaveIcon,
  SplitViewIcon,
  StarIcon,
} from '../icons';
import { Outline } from './Outline';
import { Editor } from './Editor';
import { FindBar } from './FindBar';
import { Backlinks } from './Backlinks';

function GatedImage({
  src,
  alt,
  title,
}: {
  src?: string;
  alt?: string;
  title?: string;
}) {
  const isRemote = typeof src === 'string' && /^https?:/i.test(src);
  const [show, setShow] = useState(!isRemote);
  if (isRemote && !show) {
    return (
      <button type="button" className="rd-img-gate" onClick={() => setShow(true)} title={src}>
        <span className="rd-img-gate-label">Show image</span>
        <span className="rd-img-gate-src">{alt || src}</span>
      </button>
    );
  }
  return <img src={src} alt={alt} title={title} />;
}

function nodeText(node: React.ReactNode): string {
  if (node == null || node === false) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join('');
  if (typeof node === 'object' && 'props' in node) {
    return nodeText((node as { props: { children?: React.ReactNode } }).props.children);
  }
  return '';
}

type Props = {
  note: Note;
  allNotes: Note[];
  focused: boolean;
  viewMode: ViewMode;
  onViewMode: (mode: ViewMode) => void;
  draft: string;
  onDraftChange: (value: string) => void;
  onSave: () => void;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  findOpen: boolean;
  onCloseFind: () => void;
  onToggleStar: () => void;
  onNavigate: (id: string) => void;
};

export function Reader({
  note,
  allNotes,
  focused,
  viewMode,
  onViewMode,
  draft,
  onDraftChange,
  onSave,
  saveStatus,
  findOpen,
  onCloseFind,
  onToggleStar,
  onNavigate,
}: Props) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const readerRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const [activeIdx, setActiveIdx] = useState(0);
  const [outlineOpen, setOutlineOpen] = useState(() => window.innerWidth > 1120);
  const editing = viewMode !== 'read';
  const hasReader = viewMode !== 'write';

  const wikilinkResolver = useMemo(() => buildResolver(allNotes), [allNotes]);
  const previewSource = editing ? draft : note.body;
  const renderText = useMemo(
    () => replaceWikilinks(stripFrontmatter(previewSource), wikilinkResolver),
    [previewSource, wikilinkResolver]
  );
  const sourceText = editing ? draft : renderText;
  const toc: TocEntry[] = useMemo(() => buildToc(sourceText), [sourceText]);
  const minutes = readingMinutes(sourceText);
  const words = wordCount(sourceText);

  useEffect(() => {
    const compact = window.matchMedia('(max-width: 1120px)');
    const sync = (event: MediaQueryListEvent | MediaQueryList) => setOutlineOpen(!event.matches);
    sync(compact);
    compact.addEventListener('change', sync);
    return () => compact.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    const el = readerRef.current;
    if (el) el.scrollTop = 0;
    setProgress(0);
    setActiveIdx(0);
  }, [note.id, viewMode]);

  useEffect(() => {
    if (!hasReader) return;
    const el = readerRef.current;
    if (!el) return;
    const onScroll = () => {
      const max = el.scrollHeight - el.clientHeight;
      const pct = max > 0 ? Math.min(100, Math.max(0, (el.scrollTop / max) * 100)) : 0;
      setProgress(pct);

      const headings = el.querySelectorAll<HTMLElement>('[data-heading-idx]');
      let current = 0;
      headings.forEach((heading) => {
        if (heading.getBoundingClientRect().top - el.getBoundingClientRect().top < 60) {
          current = Number(heading.dataset.headingIdx);
        }
      });
      setActiveIdx(current);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener('scroll', onScroll);
  }, [note.id, hasReader, renderText]);

  const handleJump = (id: string) => {
    const heading = readerRef.current?.querySelector<HTMLElement>(`#${CSS.escape(id)}`);
    if (!heading || !readerRef.current) return;
    const top =
      heading.getBoundingClientRect().top -
      readerRef.current.getBoundingClientRect().top +
      readerRef.current.scrollTop -
      12;
    readerRef.current.scrollTo({ top, behavior: 'smooth' });
  };

  const slug = makeSlugger();
  let headingIdx = 0;
  const headingRenderer =
    (Tag: 'h1' | 'h2' | 'h3') =>
    ({ children }: { children?: React.ReactNode }) => {
      const idx = headingIdx++;
      return (
        <Tag id={slug(nodeText(children))} data-heading-idx={idx}>
          {children}
        </Tag>
      );
    };

  const handleFocusRange = useCallback((start: number, end: number) => {
    const textarea = canvasRef.current?.querySelector<HTMLTextAreaElement>('.rd-editor');
    if (!textarea) return;
    textarea.focus();
    textarea.setSelectionRange(start, end);
    const lineHeight = parseFloat(getComputedStyle(textarea).lineHeight) || 22;
    const lineNumber = textarea.value.slice(0, start).split('\n').length - 1;
    textarea.scrollTop = Math.max(0, lineNumber * lineHeight - textarea.clientHeight / 3);
  }, []);

  const handleScrollToOffset = useCallback(
    (offset: number) => {
      const el = readerRef.current;
      if (!el) return;
      const ratio = offset / Math.max(1, sourceText.length);
      el.scrollTo({ top: ratio * (el.scrollHeight - el.clientHeight), behavior: 'smooth' });
    },
    [sourceText.length]
  );

  const folderLabel = note.folder || 'Inbox';
  const saveText =
    saveStatus === 'saving' ? 'Saving...' :
    saveStatus === 'saved' ? 'Saved' :
    saveStatus === 'error' ? 'Save failed' : '';

  const markdown = (
    <div className="rd-prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeHighlight, { detect: true, ignoreMissing: true }]]}
        components={{
          h1: headingRenderer('h1'),
          h2: headingRenderer('h2'),
          h3: headingRenderer('h3'),
          a: ({ href, children }) => {
            if (href?.startsWith('#wikilink=')) {
              const target = decodeURIComponent(href.slice('#wikilink='.length));
              const id = wikilinkResolver.get(target.trim().toLowerCase().replace(/\s+/g, ' '));
              return (
                <a
                  href="#"
                  className="rd-wikilink"
                  onClick={(event) => {
                    event.preventDefault();
                    if (id) onNavigate(id);
                  }}
                >
                  {children}
                </a>
              );
            }
            if (href?.startsWith('#wikilink-missing=')) {
              return (
                <a href="#" className="rd-wikilink-missing" onClick={(event) => event.preventDefault()}>
                  {children}
                </a>
              );
            }
            const isExternal = !!href && /^(https?:|mailto:)/i.test(href);
            return (
              <a
                href={href}
                target={isExternal ? '_blank' : undefined}
                rel={isExternal ? 'noopener noreferrer' : undefined}
              >
                {children}
              </a>
            );
          },
          img: GatedImage,
        }}
      >
        {renderText}
      </ReactMarkdown>
    </div>
  );

  return (
    <main className="rd-main">
      {hasReader && (
        <div className="rd-progress">
          <div className="rd-progress-bar" style={{ width: `${progress}%` }} />
        </div>
      )}
      <FindBar
        open={findOpen}
        onClose={onCloseFind}
        source={sourceText}
        editing={editing}
        onFocusRange={handleFocusRange}
        onScrollToOffset={handleScrollToOffset}
      />

      <header className="rd-document-header">
        <div className="rd-document-identity">
          <span className="rd-document-icon"><DocIcon /></span>
          <div>
            <h1>{note.title}</h1>
            <p>{folderLabel} · {saveText || `${words} words`}</p>
          </div>
        </div>
        <div className="rd-document-tools">
          <div className="rd-view-switcher" role="group" aria-label="Document view">
            <button
              className={viewMode === 'read' ? 'selected' : ''}
              aria-pressed={viewMode === 'read'}
              title="Reading view"
              onClick={() => onViewMode('read')}
            >
              <BookOpenIcon /><span>Read</span>
            </button>
            <button
              className={viewMode === 'split' ? 'selected' : ''}
              aria-pressed={viewMode === 'split'}
              title="Split view"
              onClick={() => onViewMode('split')}
            >
              <SplitViewIcon /><span>Split</span>
            </button>
            <button
              className={viewMode === 'write' ? 'selected' : ''}
              aria-pressed={viewMode === 'write'}
              title="Writing view"
              onClick={() => onViewMode('write')}
            >
              <PencilIcon /><span>Write</span>
            </button>
          </div>
          <button
            type="button"
            className="rd-save-button"
            onClick={onSave}
            disabled={!editing}
            title="Save note (Ctrl+S)"
          >
            <SaveIcon /><span>{saveStatus === 'saving' ? 'Saving' : 'Save'}</span>
          </button>
          <button
            type="button"
            className="rd-article-star"
            data-starred={note.starred ? '1' : '0'}
            title={note.starred ? 'Unstar' : 'Star this note'}
            onClick={onToggleStar}
          >
            <StarIcon filled={note.starred} />
          </button>
          {!focused && (
            <button
              type="button"
              className="rd-outline-toggle"
              data-active={outlineOpen ? '1' : '0'}
              aria-pressed={outlineOpen}
              title={outlineOpen ? 'Hide outline' : 'Show outline'}
              onClick={() => setOutlineOpen((open) => !open)}
            >
              <OutlineIcon />
            </button>
          )}
        </div>
      </header>

      <div className="rd-workbench">
        <div className={`rd-document-canvas rd-view-${viewMode}`} ref={canvasRef}>
          {hasReader && (
            <div className="rd-reader-panel" ref={readerRef}>
              <article className="rd-article">
                <header className="rd-article-head">
                  <div className="rd-article-meta">
                    <span>{folderLabel}</span>
                    <span className="rd-article-meta-dot">·</span>
                    <span>{note.date}</span>
                    <span className="rd-article-meta-dot">·</span>
                    <span>{minutes} min read</span>
                    <span className="rd-article-meta-dot">·</span>
                    <span>{words} words</span>
                  </div>
                </header>
                {markdown}
                <footer className="rd-article-foot">
                  <span className="rd-article-foot-rule" />
                  <span className="rd-article-foot-text">end of note</span>
                  <span className="rd-article-foot-rule" />
                </footer>
                <Backlinks note={note} allNotes={allNotes} onSelect={onNavigate} />
              </article>
            </div>
          )}

          {editing && (
            <div className="rd-editor-panel">
              <div className="rd-editor-bar">
                <span><SplitViewIcon /> Markdown source</span>
                <span>{draft.length.toLocaleString()} characters</span>
              </div>
              <Editor value={draft} onChange={onDraftChange} onSave={onSave} resetKey={note.id} />
            </div>
          )}
        </div>

        {!focused && outlineOpen && (
          <Outline
            toc={toc}
            activeIdx={activeIdx}
            onJump={handleJump}
            onClose={() => setOutlineOpen(false)}
          />
        )}
      </div>

      <footer className="rd-statusbar">
        <span>{words.toLocaleString()} words</span>
        <span>{toc.length} sections</span>
        <span className="rd-statusbar-end">Markdown · UTF-8</span>
      </footer>
    </main>
  );
}
