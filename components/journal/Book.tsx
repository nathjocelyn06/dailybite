/**
 * The journal as an open book: two cream pages in a soft yellow cover, joined by three
 * little metal fittings down the gutter.
 *
 * The fittings are drawn rather than photographed so they keep the same metallic ramp
 * as the fridge handles and the old binder rings. On a phone the spread folds into one
 * page and the gutter disappears — a two-page spread at 390px would be unreadable.
 */

function Hinge() {
  return (
    <svg viewBox="0 0 28 16" className="book-hinge-art" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="book-hinge" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F2F4F5" />
          <stop offset="40%" stopColor="#BDC4C8" />
          <stop offset="62%" stopColor="#8E969C" />
          <stop offset="100%" stopColor="#CDD3D7" />
        </linearGradient>
      </defs>
      <rect x="1" y="4" width="26" height="8" rx="4" fill="url(#book-hinge)" />
      <circle cx="6" cy="8" r="4.5" fill="url(#book-hinge)" />
      <circle cx="22" cy="8" r="4.5" fill="url(#book-hinge)" />
      <rect x="4" y="5.5" width="20" height="1.6" rx="0.8" fill="#FFFFFF" opacity="0.7" />
    </svg>
  );
}

export function Book({ left, right }: { left: React.ReactNode; right: React.ReactNode }) {
  return (
    <div className="book">
      <div className="book-page book-left">{left}</div>
      <div className="book-gutter" aria-hidden="true">
        <span className="book-hinge"><Hinge /></span>
        <span className="book-hinge"><Hinge /></span>
        <span className="book-hinge"><Hinge /></span>
      </div>
      <div className="book-page book-right">{right}</div>
    </div>
  );
}
