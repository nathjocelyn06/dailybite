/**
 * The day's calories as a thin ring, from the Figma: a pale track with one coral
 * arc sweeping clockwise from the top. Drawn rather than a conic-gradient so the
 * arc keeps its rounded cap and the ring stays hairline-thin at any size.
 */
export function CalorieRing({ eaten, goal }: { eaten: number; goal: number }) {
  const R = 56;
  const C = 2 * Math.PI * R;
  const pct = Math.max(0, Math.min(1, eaten / Math.max(1, goal)));
  return (
    <svg className="cal-ring" viewBox="0 0 140 140" role="img" aria-label={`${eaten} of ${goal} kcal eaten`}>
      <circle cx="70" cy="70" r={R} fill="none" stroke="var(--ring-rest)" strokeWidth="11" />
      {pct > 0 && (
        <circle
          cx="70"
          cy="70"
          r={R}
          fill="none"
          stroke="var(--accent-strong)"
          strokeWidth="11"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - pct)}
          transform="rotate(-90 70 70)"
        />
      )}
    </svg>
  );
}
