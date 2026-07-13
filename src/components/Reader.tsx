import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import type { Note, TocEntry } from '../types';
import { buildToc, makeSlugger, readingMinutes, stripFrontmatter, wordCount } from '../notes';
import { Outline } from './Outline';
import { Editor } from './Editor';
import { FindBar } from './FindBar';
import { StarIcon } from '../icons';

// Remote images are gated behind a click so a shared note can't phone home
// (tracking pixels / read receipts) the moment it's opened. Local and data:
// images render inline as normal.
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

// Flatten a heading's rendered children back to plain text so we can derive
// the same slug the TOC uses. react-markdown hands headings React nodes, not
// the raw source, so we walk them.
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
  focused: boolean;
  editing: boolean;
  draft: string;
  onDraftChange: (value: string) => void;
  onSave: () => void;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  findOpen: boolean;
  onCloseFind: () => void;
  onToggleStar: () => void;
};

export function Reader({
  note,
  focused,
  editing,
  draft,
  onDraftChange,
  onSave,
  saveStatus,
  findOpen,
  onCloseFind,
  onToggleStar,
}: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const [activeIdx, setActiveIdx] = useState(0);

  // The rendered/read view drops any YAML frontmatter block; the editor keeps
  // the raw text so the user can see and edit it.
  const renderText = useMemo(() => stripFrontmatter(note.body), [note.body]);
  // Text the find-bar and outline reason about: the draft while editing, the
  // rendered (frontmatter-stripped) text while reading, so match offsets line
  // up with what's on screen.
  const sourceText = editing ? draft : renderText;
  const toc: TocEntry[] = useMemo(() => buildToc(sourceText), [sourceText]);
  const minutes = readingMinutes(sourceText);
  const words = wordCount(sourceText);

  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = 0;
    setProgress(0);
    setActiveIdx(0);
  }, [note.id, editing]);

  useEffect(() => {
    if (editing) return;
    const el = scrollerRef.current;
    if (!el) return;
    const onScroll = () => {
      const max = el.scrollHeight - el.clientHeight;
      const pct = max > 0 ? Math.min(100, Math.max(0, (el.scrollTop / max) * 100)) : 0;
      setProgress(pct);

      const headings = el.querySelectorAll<HTMLElement>('[data-heading-idx]');
      let current = 0;
      headings.forEach((h) => {
        if (h.getBoundingClientRect().top - el.getBoundingClientRect().top < 60) {
          current = Number(h.dataset.headingIdx);
        }
      });
      setActiveIdx(current);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener('scroll', onScroll);
  }, [note.id, editing]);

  const handleJump = (id: string) => {
    const el = scrollerRef.current?.querySelector<HTMLElement>(`#${CSS.escape(id)}`);
    if (el && scrollerRef.current) {
      const top =
        el.getBoundingClientRect().top -
        scrollerRef.current.getBoundingClientRect().top +
        scrollerRef.current.scrollTop -
        12;
      scrollerRef.current.scrollTo({ top, behavior: 'smooth' });
    }
  };

  // Build one slugger per render pass. Because react-markdown renders headings
  // in document order, this produces exactly the ids buildToc computed, so the
  // outline's jump targets always resolve. The idx counter feeds scroll-spy.
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

  // Find-bar callbacks. The textarea lives inside scrollerRef in edit mode,
  // so we reach in by class name; in read mode we estimate the DOM scroll
  // position from a source offset by scrolling proportionally — not perfect
  // but fine for a notes app where matches are usually within one screen
  // of the reader's perspective.
  const handleFocusRange = useCallback((start: number, end: number) => {
    const ta = scrollerRef.current?.querySelector<HTMLTextAreaElement>('.rd-editor');
    if (!ta) return;
    ta.focus();
    ta.setSelectionRange(start, end);
    // Force the textarea to scroll the selection into view by toggling it.
    const lineHeight = parseFloat(getComputedStyle(ta).lineHeight) || 22;
    const before = ta.value.slice(0, start);
    const lineNumber = before.split('\n').length - 1;
    ta.scrollTop = Math.max(0, lineNumber * lineHeight - ta.clientHeight / 3);
  }, []);

  const handleScrollToOffset = useCallback(
    (offset: number) => {
      const el = scrollerRef.current;
      if (!el) return;
      const ratio = offset / Math.max(1, sourceText.length);
      const target = ratio * (el.scrollHeight - el.clientHeight);
      el.scrollTo({ top: target, behavior: 'smooth' });
    },
    [sourceText.length]
  );

  const folderLabel = note.folder || 'Inbox';
  const saveText =
    saveStatus === 'saving' ? 'Saving…' :
    saveStatus === 'saved' ? 'Saved' :
    saveStatus === 'error' ? 'Save failed' : '';

  return (
    <main className="rd-main">
      {!editing && (
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
      <div className="rd-main-inner" ref={scrollerRef} data-mode={editing ? 'edit' : 'read'}>
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
              {editing && saveText && (
                <>
                  <span className="rd-article-meta-dot">·</span>
                  <span data-status={saveStatus}>{saveText}</span>
                </>
              )}
              <button
                type="button"
                className="rd-article-star"
                data-starred={note.starred ? '1' : '0'}
                title={note.starred ? 'Unstar' : 'Star this note'}
                onClick={onToggleStar}
              >
                <StarIcon filled={note.starred} />
              </button>
            </div>
          </header>

          {editing ? (
            <Editor value={draft} onChange={onDraftChange} onSave={onSave} resetKey={note.id} />
          ) : (
            <>
              <div className="rd-prose">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[[rehypeHighlight, { detect: true, ignoreMissing: true }]]}
                  components={{
                    h1: headingRenderer('h1'),
                    h2: headingRenderer('h2'),
                    h3: headingRenderer('h3'),
                    a: ({ href, children, ...rest }) => {
                      const isExternal = !!href && /^(https?:|mailto:)/i.test(href);
                      return (
                        <a
                          {...rest}
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
              <footer className="rd-article-foot">
                <span className="rd-article-foot-rule" />
                <span className="rd-article-foot-text">end of note</span>
                <span className="rd-article-foot-rule" />
              </footer>
            </>
          )}
        </article>

        {!focused && !editing && <Outline toc={toc} activeIdx={activeIdx} onJump={handleJump} />}
      </div>
    </main>
  );
}
