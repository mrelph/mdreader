import type { TocEntry } from '../types';

type Props = {
  toc: TocEntry[];
  activeIdx: number;
  onJump: (id: string) => void;
};

export function Outline({ toc, activeIdx, onJump }: Props) {
  if (!toc.length) return null;
  return (
    <div className="rd-outline">
      <div className="rd-outline-head">On this page</div>
      <ul className="rd-outline-list">
        {toc.map((t, i) => (
          <li key={t.id}>
            <button
              type="button"
              className="rd-outline-item"
              data-level={t.level}
              data-active={i === activeIdx ? '1' : '0'}
              onClick={() => onJump(t.id)}
            >
              <span className="rd-outline-tick" />
              <span className="rd-outline-text">{t.text}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
