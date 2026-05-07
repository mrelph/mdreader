import { DocIcon, PlusIcon, TabCloseIcon } from '../icons';
import type { Tab } from '../types';

type Props = {
  tabs: Tab[];
  activeId: string;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onNew: () => void;
};

export function Tabs({ tabs, activeId, onSelect, onClose, onNew }: Props) {
  return (
    <div className="rd-tabs">
      {tabs.map((t) => (
        <div
          key={t.id}
          className="rd-tab"
          data-active={activeId === t.id ? '1' : '0'}
          onClick={() => onSelect(t.id)}
        >
          <span className="rd-tab-icon">
            <DocIcon />
          </span>
          <span className="rd-tab-title">{t.title}</span>
          <button
            className="rd-tab-close"
            onClick={(e) => {
              e.stopPropagation();
              onClose(t.id);
            }}
            title="Close tab"
          >
            <TabCloseIcon />
          </button>
        </div>
      ))}
      <button className="rd-tab-new" title="Open .md file" onClick={onNew}>
        <PlusIcon />
      </button>
    </div>
  );
}
