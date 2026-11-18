/**
 * The journal as a book lying open and flat: two facing pages, a soft curve into the
 * gutter, a long silver spine down the fold, and half-circle rings standing on it.
 *
 * The two pages are a background, not two containers — everything on the spread (meals,
 * post-its, stickers, text) is positioned in one coordinate space across the whole
 * sheet, so a polaroid can be dragged from one page to the other without special cases.
 */

function HalfRing() {
  return (
    <svg viewBox="0 0 44 24" className="ring-art" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="halfring" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FDFDFE" />
          <stop offset="32%" stopColor="#C9D0D5" />
          <stop offset="60%" stopColor="#868E94" />
          <stop offset="100%" stopColor="#DFE4E8" />
        </linearGradient>
      </defs>
      {/* a ring opened flat against the spine is a half circle standing on it */}
      <path d="M5 21a17 17 0 0 1 34 0" fill="none" stroke="url(#halfring)" strokeWidth="3.6" strokeLinecap="round" />
      <path d="M11 13a13 13 0 0 1 10 -6" fill="none" stroke="#FFFFFF" strokeOpacity="0.85" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

export function Book({ children }: { children: React.ReactNode }) {
  return (
    <div className="book-stage">
      <div className="book">
        <div className="book-spread">
          {children}
          <span className="book-gutter" aria-hidden="true" />
          {/* the long silver spine stays; the rings standing on it are half circles */}
          <span className="book-spine" aria-hidden="true" />
          <span className="book-rings" aria-hidden="true">
            <HalfRing />
            <HalfRing />
            <HalfRing />
          </span>
        </div>
      </div>
    </div>
  );
}
