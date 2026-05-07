// Icon set ported from the design prototype.

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export const SearchIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" {...stroke} strokeWidth={2}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);

export const StarIcon = ({ filled = false }: { filled?: boolean }) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill={filled ? 'currentColor' : 'none'}
    stroke="currentColor"
    strokeWidth={1.7}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polygon points="12 2 15 8.5 22 9.3 17 14 18.2 21 12 17.8 5.8 21 7 14 2 9.3 9 8.5 12 2" />
  </svg>
);

export const FolderIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" {...stroke} strokeWidth={1.7}>
    <path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4l2 2.5h9A1.5 1.5 0 0 1 21 9v9.5A1.5 1.5 0 0 1 19.5 20h-15A1.5 1.5 0 0 1 3 18.5z" />
  </svg>
);

export const DocIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" {...stroke} strokeWidth={1.6}>
    <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
    <path d="M14 3v6h6" />
    <path d="M8 13h7M8 17h5" />
  </svg>
);

export const PlusIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" {...stroke} strokeWidth={2.2}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const SunIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" {...stroke} strokeWidth={1.8}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
  </svg>
);

export const MoonIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" {...stroke} strokeWidth={1.8}>
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
  </svg>
);

export const FocusIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" {...stroke} strokeWidth={1.8}>
    <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" />
  </svg>
);

export const OutlineIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" {...stroke} strokeWidth={1.8}>
    <path d="M4 6h16M7 12h13M10 18h10" />
  </svg>
);

export const OpenIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" {...stroke} strokeWidth={1.8}>
    <path d="M3 7.5A1.5 1.5 0 0 1 4.5 6H9l2 2h8.5A1.5 1.5 0 0 1 21 9.5V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
  </svg>
);

export const CloseIcon = ({ size = 10 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 10 10" stroke="currentColor" strokeWidth={1.1} strokeLinecap="round">
    <path d="M1 1l8 8M9 1l-8 8" />
  </svg>
);

export const TabCloseIcon = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round">
    <path d="M1.5 1.5l7 7M8.5 1.5l-7 7" />
  </svg>
);
