/* eslint-disable @next/next/no-img-element */

/**
 * Fridge magnets, cut from the supplied sheet (`Magnet Vector Asset.png`).
 *
 * One transparent PNG per magnet in `public/magnets/`, each trimmed to its own artwork
 * and scaled so the longest edge is 256px — so a magnet's width on the door is all the
 * app has to store, and nothing is letterboxed inside a square it doesn't fill.
 */

export const MAGNETS = ["lemon", "orange", "strawberry", "apple", "kiwi", "blueberry", "toast", "bread", "cheese"] as const;

export type MagnetKey = (typeof MAGNETS)[number];

export const MAGNET_LABEL: Record<MagnetKey, string> = {
  lemon: "Lemon",
  orange: "Orange slice",
  strawberry: "Strawberry",
  apple: "Apple",
  kiwi: "Kiwi",
  blueberry: "Blueberries",
  toast: "Egg on toast",
  bread: "Baguette",
  cheese: "Cheese"
};

export function isMagnet(k: string | null | undefined): k is MagnetKey {
  return !!k && (MAGNETS as readonly string[]).includes(k);
}

export function MagnetArt({ name }: { name: MagnetKey }) {
  return <img className="magnet-art" src={`/magnets/${name}.png`} alt="" draggable={false} />;
}
