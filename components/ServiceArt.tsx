import type { IconKey } from "@/lib/nav";
import { NavIcon } from "./NavIcon";

/**
 * Illustrated service icons for the Home grid, from the Figma: solid shapes with a
 * gradient fill, no tile behind them. Each one gets its own gradient ids so two
 * icons on the same page never collide.
 *
 * NavIcon stays the single slot for navigation and for the "all services" sheet —
 * these are deliberately heavier, and only for the Home shortcuts. Anything not
 * drawn here falls back to the stroke icon on a soft disc.
 */

type Props = { name: IconKey };

const RAMPS: Partial<Record<IconKey, [string, string]>> = {
  fridge: ["#BFE3FA", "#4E9BD4"],
  grocery: ["#FFE07A", "#F2A920"],
  recipes: ["#FFA193", "#E8533F"],
  cook: ["#FFA193", "#E8533F"],
  progress: ["#D7BDF7", "#7B4FC9"],
  journal: ["#FFC9D6", "#E8708F"],
  budget: ["#BDEFD5", "#3FA97B"],
  calendar: ["#CFE4FF", "#6E8FD8"],
  saved: ["#FFD9B0", "#E29342"],
  receipt: ["#CFE9E2", "#5AA396"],
  more: ["#E6DCCF", "#9B8B79"]
};

export function ServiceArt({ name }: Props) {
  const id = `art-${name.replace(/[^a-z]/gi, "")}`;
  const ramp = RAMPS[name] ?? ["#E6DCCF", "#9B8B79"];
  return (
    <svg className="svc-art" viewBox="0 0 64 64" role="img" aria-hidden="true" focusable="false">
      <defs>
        {/* userSpaceOnUse so two stacked shapes share one ramp instead of each
            restarting it — that is what makes the fridge read as one object */}
        <linearGradient id={id} gradientUnits="userSpaceOnUse" x1="10" y1="2" x2="44" y2="62">
          <stop offset="0%" stopColor={ramp[0]} />
          <stop offset="100%" stopColor={ramp[1]} />
        </linearGradient>
      </defs>
      <Shape name={name} id={id} />
    </svg>
  );
}

function Shape({ name, id }: { name: IconKey; id: string }) {
  const fill = `url(#${id})`;
  switch (name) {
    // freezer and fridge as two separate boxes with a gap, each with its own handle
    case "fridge":
      return (
        <>
          <rect x="11" y="2" width="42" height="23" rx="6" fill={fill} />
          <rect x="38" y="10" width="5" height="9" rx="2.5" fill="#FFFFFF" />
          <rect x="11" y="29" width="42" height="33" rx="6" fill={fill} />
          <rect x="38" y="39" width="5" height="12" rx="2.5" fill="#FFFFFF" />
        </>
      );
    // a shopping basket: tapered body with slots, handle arcing over the top
    case "grocery":
      return (
        <>
          <path d="M22 16a10 10 0 0 1 20 0" fill="none" stroke={fill} strokeWidth="5" strokeLinecap="round" />
          <path d="M10 22h44l-4.5 26a7 7 0 0 1-6.9 6H21.4a7 7 0 0 1-6.9-6z" fill={fill} />
          <g fill="#FFFFFF" opacity="0.75">
            <rect x="21" y="30" width="3" height="16" rx="1.5" />
            <rect x="30.5" y="30" width="3" height="16" rx="1.5" />
            <rect x="40" y="30" width="3" height="16" rx="1.5" />
          </g>
        </>
      );
    // a bowl of something hot: a half disc with three strokes of steam leaning off it
    case "recipes":
    case "cook":
      return (
        <>
          <g stroke={fill} strokeWidth="6" strokeLinecap="round">
            <path d="M22 22 L26 10" />
            <path d="M32 22 L36 10" />
            <path d="M42 22 L46 10" />
          </g>
          <path d="M5 31 L59 31 A27 27 0 0 1 5 31 Z" fill={fill} />
        </>
      );
    // bars climbing to the right, with the trend line over them
    case "progress":
      return (
        <>
          <g fill={fill}>
            <rect x="12" y="38" width="9" height="16" rx="3" />
            <rect x="27.5" y="28" width="9" height="26" rx="3" />
            <rect x="43" y="16" width="9" height="38" rx="3" />
          </g>
          <path d="M14 34l12-10 10 7 12-14" fill="none" stroke={fill} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.55" />
        </>
      );
    // a notebook, spine on the left
    case "journal":
      return (
        <>
          <rect x="14" y="8" width="36" height="48" rx="6" fill={fill} />
          <rect x="14" y="8" width="8" height="48" rx="4" fill="#FFFFFF" opacity="0.4" />
          <g fill="#FFFFFF" opacity="0.8">
            <rect x="27" y="20" width="17" height="3" rx="1.5" />
            <rect x="27" y="29" width="17" height="3" rx="1.5" />
            <rect x="27" y="38" width="11" height="3" rx="1.5" />
          </g>
        </>
      );
    case "budget":
      return (
        <>
          <rect x="8" y="16" width="48" height="32" rx="7" fill={fill} />
          <rect x="8" y="25" width="48" height="5" fill="#FFFFFF" opacity="0.7" />
          <circle cx="45" cy="39" r="4" fill="#FFFFFF" opacity="0.85" />
        </>
      );
    case "calendar":
      return (
        <>
          <rect x="10" y="14" width="44" height="40" rx="7" fill={fill} />
          <rect x="10" y="24" width="44" height="3.5" fill="#FFFFFF" opacity="0.8" />
          <g fill={fill}>
            <rect x="19" y="6" width="5" height="12" rx="2.5" />
            <rect x="40" y="6" width="5" height="12" rx="2.5" />
          </g>
          <g fill="#FFFFFF" opacity="0.8">
            <rect x="18" y="34" width="7" height="6" rx="2" />
            <rect x="29" y="34" width="7" height="6" rx="2" />
            <rect x="40" y="34" width="7" height="6" rx="2" />
          </g>
        </>
      );
    case "saved":
      return <path d="M16 12a6 6 0 0 1 6-6h20a6 6 0 0 1 6 6v44L32 45 16 56z" fill={fill} />;
    case "receipt":
      return (
        <>
          <path d="M14 8h36v48l-6-4-6 4-6-4-6 4-6-4-6 4z" fill={fill} />
          <g fill="#FFFFFF" opacity="0.8">
            <rect x="22" y="20" width="20" height="3" rx="1.5" />
            <rect x="22" y="29" width="20" height="3" rx="1.5" />
            <rect x="22" y="38" width="13" height="3" rx="1.5" />
          </g>
        </>
      );
    case "more":
      return (
        <g fill={fill}>
          <circle cx="23" cy="23" r="6" />
          <circle cx="41" cy="23" r="6" />
          <circle cx="23" cy="41" r="6" />
          <circle cx="41" cy="41" r="6" />
        </g>
      );
    default:
      return (
        <>
          <circle cx="32" cy="32" r="26" fill={fill} opacity="0.35" />
          <g transform="translate(20 20) scale(1)" color="#2E2A26">
            <NavIcon name={name} size={24} />
          </g>
        </>
      );
  }
}
