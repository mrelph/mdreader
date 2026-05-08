import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Note, TocEntry } from '../types';
import { buildToc, readingMinutes, wordCount } from '../notes';
import { Outline } from './Outline';
import { Editor } from './Editor';
import { FindBar } from './FindBar';

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
}: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const [activeIdx, setActiveIdx] = useState(0);

  const sourceText = editing ? draft : note.body;
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

  const headingState = { idx: 0 };
  const headingRenderer =
    (Tag: 'h1' | 'h2' | 'h3') =>
    ({ children }: { children?: React.ReactNode }) => {
      const idx = headingState.idx;
      headingState.idx += 1;
      return (
        <Tag id={`h${idx}`} data-heading-idx={idx}>
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
            </div>
          </header>

          {editing ? (
            <Editor value={draft} onChange={onDraftChange} onSave={onSave} resetKey={note.id} />
          ) : (
            <>
              <div className="rd-prose">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h1: headingRenderer('h1'),
                    h2: headingRenderer('h2'),
                    h3: headingRenderer('h3'),
                  }}
                >
                  {note.body}
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
