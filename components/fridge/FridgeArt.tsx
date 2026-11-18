"use client";

/**
 * The fridge, drawn as vector art rather than photographed.
 *
 * Each door is its own SVG so it can swing on its own, and the finish is a real
 * fill rather than a tint laid over a bitmap — so any colour stays clean and the
 * chrome keeps its own metallic ramp. All the shading sits *above* the body
 * colour as light and shadow, which is why a pale cream and a deep coral both
 * read correctly from one drawing.
 *
 * Proportions follow the retro reference: rounded shoulders, freezer across the
 * top third, chrome bar handles mounted left and meeting at the seam, and a
 * kickplate at the foot.
 */

type Props = { color: string; idPrefix: string };

/** Shared gradients: chrome for the handles, light and shade for the enamel. */
function Defs({ id }: { id: string }) {
  return (
    <>
      {/* polished bar: bright top, dark belly, bright underside bounce */}
      <linearGradient id={`${id}-chrome`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#FBFCFC" />
        <stop offset="26%" stopColor="#DCE1E4" />
        <stop offset="52%" stopColor="#9BA4AA" />
        <stop offset="68%" stopColor="#C3CACE" />
        <stop offset="88%" stopColor="#EDF0F1" />
        <stop offset="100%" stopColor="#8D969C" />
      </linearGradient>
      <linearGradient id={`${id}-post`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#EFF2F3" />
        <stop offset="55%" stopColor="#AEB6BB" />
        <stop offset="100%" stopColor="#848D93" />
      </linearGradient>
      <filter id={`${id}-soft`} x="-30%" y="-40%" width="160%" height="180%">
        <feDropShadow dx="0" dy="3" stdDeviation="2.6" floodColor="#241F1A" floodOpacity="0.3" />
      </filter>

      {/* across the door: lit free edge, a second soft reflection, hinge side falling away */}
      <linearGradient id={`${id}-sheen`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.1" />
        <stop offset="5%" stopColor="#FFFFFF" stopOpacity="0.5" />
        <stop offset="12%" stopColor="#FFFFFF" stopOpacity="0.1" />
        <stop offset="20%" stopColor="#FFFFFF" stopOpacity="0.3" />
        <stop offset="31%" stopColor="#FFFFFF" stopOpacity="0" />
        <stop offset="80%" stopColor="#241F1A" stopOpacity="0" />
        <stop offset="93%" stopColor="#241F1A" stopOpacity="0.09" />
        <stop offset="100%" stopColor="#241F1A" stopOpacity="0.2" />
      </linearGradient>
      {/* down the door: light spills over the top, the foot sits in shade */}
      <linearGradient id={`${id}-vert`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.4" />
        <stop offset="10%" stopColor="#FFFFFF" stopOpacity="0.06" />
        <stop offset="62%" stopColor="#241F1A" stopOpacity="0" />
        <stop offset="100%" stopColor="#241F1A" stopOpacity="0.13" />
      </linearGradient>
      {/* the gap between the two doors throws a shadow on both sides of itself */}
      <linearGradient id={`${id}-seam-down`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#241F1A" stopOpacity="0" />
        <stop offset="100%" stopColor="#241F1A" stopOpacity="0.26" />
      </linearGradient>
      <linearGradient id={`${id}-seam-up`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#241F1A" stopOpacity="0.3" />
        <stop offset="100%" stopColor="#241F1A" stopOpacity="0" />
      </linearGradient>
    </>
  );
}

/** A chrome bar on two stand-offs, the way these retro doors are opened. */
function Handle({ id, x, y, w }: { id: string; x: number; y: number; w: number }) {
  const h = 15;
  return (
    <g filter={`url(#${id}-soft)`}>
      <rect x={x} y={y - 9} width={22} height={h + 18} rx={9} fill={`url(#${id}-post)`} />
      <rect x={x + w - 22} y={y - 9} width={22} height={h + 18} rx={9} fill={`url(#${id}-post)`} />
      <rect x={x} y={y} width={w} height={h} rx={h / 2} fill={`url(#${id}-chrome)`} />
      <rect x={x + 7} y={y + 2.5} width={w - 14} height={3} rx={1.5} fill="#FFFFFF" opacity="0.8" />
    </g>
  );
}

/** Body colour, then the light passes, then a hairline enamel rim. */
function Enamel({ id, d, color }: { id: string; d: string; color: string }) {
  return (
    <>
      <path d={d} fill={color} />
      <path d={d} fill={`url(#${id}-vert)`} />
      <path d={d} fill={`url(#${id}-sheen)`} />
      <path d={d} fill="none" stroke="#FFFFFF" strokeOpacity="0.4" strokeWidth="1.6" />
    </>
  );
}

const FREEZER_DOOR =
  "M0 54 C0 24 24 0 54 0 L332 0 C362 0 386 24 386 54 L386 288 C386 294 381 298 375 298 L11 298 C5 298 0 294 0 288 Z";

const MAIN_DOOR =
  "M0 11 C0 5 5 0 11 0 L375 0 C381 0 386 5 386 11 L386 534 C386 540 381 545 375 545 L11 545 C5 545 0 540 0 534 Z";

export function FreezerDoorArt({ color, idPrefix }: Props) {
  const id = `${idPrefix}-fz`;
  return (
    <svg viewBox="0 0 386 298" preserveAspectRatio="none" className="fridge-svg" aria-hidden="true">
      <defs>
        <Defs id={id} />
      </defs>
      <Enamel id={id} d={FREEZER_DOOR} color={color} />
      {/* shadow cast up out of the door gap */}
      <rect x="0" y="276" width="386" height="22" fill={`url(#${id}-seam-down)`} />
      <Handle id={id} x={40} y={236} w={168} />
    </svg>
  );
}

export function MainDoorArt({ color, idPrefix }: Props) {
  const id = `${idPrefix}-mn`;
  return (
    <svg viewBox="0 0 386 579" preserveAspectRatio="none" className="fridge-svg" aria-hidden="true">
      <defs>
        <Defs id={id} />
      </defs>

      {/* kickplate: the cabinet's own foot, set back and in shade */}
      <path
        d="M8 540 L378 540 L378 556 C378 570 366 579 350 579 L36 579 C20 579 8 570 8 556 Z"
        fill="#3A332C"
        opacity="0.55"
      />
      <rect x="22" y="556" width="342" height="3" rx="1.5" fill="#FFFFFF" opacity="0.14" />

      <Enamel id={id} d={MAIN_DOOR} color={color} />
      {/* shadow falling down out of the door gap */}
      <rect x="0" y="0" width="386" height="20" fill={`url(#${id}-seam-up)`} />

      <Handle id={id} x={40} y={30} w={168} />
    </svg>
  );
}
