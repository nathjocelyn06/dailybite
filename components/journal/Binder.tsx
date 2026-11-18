/**
 * The journal's ring binder: a cover, a brushed-metal spine and three chrome rings
 * clamped over the page's left edge.
 *
 * The rings are drawn rather than photographed so they stay crisp at any size and keep
 * the same metallic ramp as the fridge's handles — it is the same set of objects.
 * Only the open front half of each ring is in front of the paper; the back half sits
 * behind it, which is what makes the page look threaded on rather than pasted under.
 */

function Ring({ id }: { id: string }) {
  return (
    <svg viewBox="0 0 48 48" className="binder-ring-art" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}-chrome`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FDFDFD" />
          <stop offset="26%" stopColor="#CBD1D5" />
          <stop offset="54%" stopColor="#7E868D" />
          <stop offset="72%" stopColor="#E3E7EA" />
          <stop offset="100%" stopColor="#6E767C" />
        </linearGradient>
      </defs>
      {/* the half that goes behind the paper */}
      <path d="M24 5a19 19 0 0 0 0 38" fill="none" stroke={`url(#${id}-chrome)`} strokeWidth="6" strokeLinecap="round" />
      {/* the half that comes over the front, with its own cast shadow */}
      <path d="M24 5a19 19 0 0 1 0 38" fill="none" stroke="#241F1A" strokeOpacity="0.22" strokeWidth="8" strokeLinecap="round" transform="translate(1.5 2)" />
      <path d="M24 5a19 19 0 0 1 0 38" fill="none" stroke={`url(#${id}-chrome)`} strokeWidth="6" strokeLinecap="round" />
      <path d="M31 9a19 19 0 0 1 7 11" fill="none" stroke="#FFFFFF" strokeOpacity="0.85" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function Binder({ children }: { children: React.ReactNode }) {
  return (
    <section className="binder grow" aria-label="Journal page">
      <span className="binder-spine" aria-hidden="true" />
      <span className="binder-page">{children}</span>
      {/* after the page in the DOM so the front half of each ring lands on top of it */}
      <span className="binder-ring r1"><Ring id="ring1" /></span>
      <span className="binder-ring r2"><Ring id="ring2" /></span>
      <span className="binder-ring r3"><Ring id="ring3" /></span>
    </section>
  );
}
