import { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Note, TocEntry } from '../types';
import { buildToc, readingMinutes, wordCount } from '../notes';
import { Outline } from './Outline';

type Props = {
  note: Note;
  focused: boolean;
};

export function Reader({ note, focused }: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const [activeIdx, setActiveIdx] = useState(0);

  const toc: TocEntry[] = useMemo(() => buildToc(note.body), [note.body]);
  const minutes = readingMinutes(note.body);
  const words = wordCount(note.body);

  // Reset scroll + progress when the open note changes.
  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = 0;
    setProgress(0);
    setActiveIdx(0);
  }, [note.id]);

  // Track scroll to drive the progress bar and the active outline entry.
  useEffect(() => {
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
  }, [note.id]);

  const handleJump = (id: string) => {
    const el = scrollerRef.current?.querySelector<HTMLElement>(`#${CSS.escape(id)}`);
    if (el && scrollerRef.current) {
      const top = el.getBoundingClientRect().top - scrollerRef.current.getBoundingClientRect().top + scrollerRef.current.scrollTop - 12;
      scrollerRef.current.scrollTo({ top, behavior: 'smooth' });
    }
  };

  // Heading renderers tag each heading with a stable id + index so the outline
  // can scroll-jump and highlight the current section. Counter resets each
  // render via the closure below.
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

  return (
    <main className="rd-main">
      <div className="rd-progress">
        <div className="rd-progress-bar" style={{ width: `${progress}%` }} />
      </div>
      <div className="rd-main-inner" ref={scrollerRef}>
        <article className="rd-article">
          <header className="rd-article-head">
            <div className="rd-article-meta">
              <span>{note.folder}</span>
              <span className="rd-article-meta-dot">·</span>
              <span>{note.date}</span>
              <span className="rd-article-meta-dot">·</span>
              <span>{minutes} min read</span>
              <span className="rd-article-meta-dot">·</span>
              <span>{words} words</span>
            </div>
          </header>
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
        </article>

        {!focused && <Outline toc={toc} activeIdx={activeIdx} onJump={handleJump} />}
      </div>
    </main>
  );
}
