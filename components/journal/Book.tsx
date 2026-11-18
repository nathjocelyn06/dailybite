/**
 * The journal: a white ring binder standing on a dark brown ground.
 *
 * One page, full width. The spine is a brushed tube with a cap at each end and three
 * chrome rings clamped over the paper — each ring draws its back half behind the sheet
 * and its front half over it, which is what makes the page look threaded on rather than
 * pasted underneath. The metal uses the same ramp as the fridge handles and the magnets.
 */

function Ring({ id }: { id: string }) {
  return (
    <svg viewBox="0 0 56 44" className="binder-ring-art" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}-chrome`} x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="22%" stopColor="#D2D8DC" />
          <stop offset="50%" stopColor="#7C848A" />
          <stop offset="68%" stopColor="#E6EAED" />
          <stop offset="100%" stopColor="#6B7379" />
        </linearGradient>
      </defs>
      {/* the half that passes behind the sheet */}
      <path d="M20 4a18 18 0 0 0 0 36" fill="none" stroke={`url(#${id}-chrome)`} strokeWidth="5.5" strokeLinecap="round" />
      {/* the half that comes over the front, and the shadow it casts on the paper */}
      <path d="M20 4a18 18 0 0 1 0 36" fill="none" stroke="#2A1109" strokeOpacity="0.26" strokeWidth="8" strokeLinecap="round" transform="translate(2 3)" />
      <path d="M20 4a18 18 0 0 1 0 36" fill="none" stroke={`url(#${id}-chrome)`} strokeWidth="5.5" strokeLinecap="round" />
      <path d="M28 7a18 18 0 0 1 9 11" fill="none" stroke="#FFFFFF" strokeOpacity="0.9" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function Book({ children }: { children: React.ReactNode }) {
  return (
    <div className="binder-stage">
      <div className="binder">
        <span className="binder-spine" aria-hidden="true">
          <span className="binder-cap top" />
          <span className="binder-cap bottom" />
        </span>
        <div className="binder-page">{children}</div>
        {/* after the page, so each ring's front half lands on top of the paper */}
        <span className="binder-ring r1"><Ring id="jr1" /></span>
        <span className="binder-ring r2"><Ring id="jr2" /></span>
        <span className="binder-ring r3"><Ring id="jr3" /></span>
      </div>
    </div>
  );
}
