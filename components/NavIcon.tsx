import type { IconKey } from "@/lib/nav";

/**
 * The single icon slot for navigation and service tiles: simple stroke icons that inherit
 * `currentColor`. To swap in a different icon set later, change only this file.
 */
const PATHS: Record<IconKey, React.ReactNode> = {
  home: (<><path d="M4 11l8-6.5 8 6.5" /><path d="M6 9.5V20h12V9.5" /><path d="M10 20v-5h4v5" /></>),
  kitchen: (<><path d="M4 11h16v5a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z" /><path d="M2 11h20" /><path d="M9 7.5c0-1.4 1.3-2.5 3-2.5s3 1.1 3 2.5" /></>),
  journal: (<><path d="M6 4h11a2 2 0 0 1 2 2v14H8a2 2 0 0 1-2-2z" /><path d="M6 17a2 2 0 0 1 2-2h11" /><path d="M10 8h5" /></>),
  archive: (<><rect x="3" y="4" width="18" height="5" rx="1.5" /><path d="M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9" /><path d="M10 13h4" /></>),
  calendar: (<><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16" /><path d="M9 3v4" /><path d="M15 3v4" /></>),
  recipes: (<><path d="M4 12h16a8 8 0 0 1-16 0z" /><path d="M9 4c-1 1.5 1 2.5 0 4" /><path d="M13 4c-1 1.5 1 2.5 0 4" /></>),
  cook: (<><path d="M5 11h14v6a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3z" /><path d="M3 11h18" /><path d="M9 4v4M12 3v5M15 4v4" /></>),
  fridge: (<><rect x="6" y="3" width="12" height="18" rx="2" /><path d="M6 10h12" /><path d="M9 6v2" /><path d="M9 13v3" /></>),
  grocery: (<><path d="M3 4h2l2 11h11l2-8H6.5" /><circle cx="9" cy="19" r="1.3" /><circle cx="17" cy="19" r="1.3" /></>),
  receipt: (<><path d="M7 3h10v18l-2.5-1.5L12 21l-2.5-1.5L7 21z" /><path d="M10 8h4" /><path d="M10 12h4" /></>),
  saved: <path d="M7 4h10v17l-5-3.5L7 21z" />,
  search: (<><circle cx="11" cy="11" r="6" /><path d="M20 20l-4.5-4.5" /></>),
  budget: (<><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18" /><circle cx="16" cy="14.5" r="1.2" /></>),
  progress: (<><path d="M4 19h16" /><path d="M5 15l4-4 3 3 6-6" /><path d="M15 8h3v3" /></>),
  notifications: (<><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" /><path d="M10 20a2 2 0 0 0 4 0" /></>),
  settings: (<><circle cx="12" cy="12" r="3" /><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8" /></>),
  more: (<><circle cx="8" cy="8" r="2" /><circle cx="16" cy="8" r="2" /><circle cx="8" cy="16" r="2" /><circle cx="16" cy="16" r="2" /></>),
  camera: (<><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></>)
};

export function NavIcon({ name, size = 20 }: { name: IconKey; size?: number }) {
  return (
    <svg
      className="navicon"
      data-icon={name}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}
