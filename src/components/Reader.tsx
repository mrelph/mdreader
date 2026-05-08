import { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Note, TocEntry } from '../types';
import { buildToc, readingMinutes, wordCount } from '../notes';
import { Outline } from './Outline';
import { Editor } from './Editor';

type Props = {
  note: Note;
  focused: boolean;
  editing: boolean;
  draft: string;
  onDraftChange: (value: string) => void;
  onSave: () => void;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
};

export function Reader({ note, focused, editing, draft, onDraftChange, onSave, saveStatus }: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const [activeIdx, setActiveIdx] = useState(0);

  // The rendered body — either the saved on-disk text (read mode) or the
  // unsaved draft (edit mode). Outline and word-count track whichever we're
  // showing so the right rail stays in sync while typing.
  const sourceText = editing ? draft : note.body;
  const toc: TocEntry[] = useMemo(() => buildToc(sourceText), [sourceText]);
  const minutes = readingMinutes(sourceText);
  const words = wordCount(sourceText);

  // Reset scroll + progress when the open note or mode changes.
  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = 0;
    setProgress(0);
    setActiveIdx(0);
  }, [note.id, editing]);

  useEffect(() => {
    if (editing) return; // scroll-spy only applies to the rendered view
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
