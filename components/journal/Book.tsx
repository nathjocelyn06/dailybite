/**
 * The journal as a book lying open and flat: two facing pages, a soft curve into the
 * gutter, and flat chrome rings running down the fold.
 *
 * The two pages are a background, not two containers — everything on the spread (meals,
 * post-its, stickers, text) is positioned in one coordinate space across the whole
 * sheet, so a polaroid can be dragged from one page to the other without special cases.
 */

function FlatRing() {
  return (
    <svg viewBox="0 0 40 18" className="ring-art" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="flatring" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FCFDFD" />
          <stop offset="34%" stopColor="#C8CFD4" />
          <stop offset="58%" stopColor="#8A9298" />
          <stop offset="100%" stopColor="#E2E7EA" />
        </linearGradient>
      </defs>
      {/* seen from above, a ring lying on the fold is a flat oval */}
      <ellipse cx="20" cy="9" rx="17.5" ry="6.5" fill="none" stroke="url(#flatring)" strokeWidth="3.4" />
      <path d="M8 5.5a16 16 0 0 1 24 0" fill="none" stroke="#FFFFFF" strokeOpacity="0.8" strokeWidth="1.2" strokeLinecap="round" />
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
          <span className="book-rings" aria-hidden="true">
            <FlatRing />
            <FlatRing />
            <FlatRing />
          </span>
        </div>
      </div>
    </div>
  );
}
