/**
 * Serving scaler for recipe ingredients (pure, unit-tested).
 *
 * Recipe measures are free text — "1 cup", "200 g", "1 1/2 tbsp", "a pinch".
 * We scale only a leading amount and leave the rest of the string alone, so
 * anything we don't understand ("to taste") survives untouched rather than
 * turning into a wrong number.
 */

const VULGAR: Record<string, number> = {
  "½": 0.5, "⅓": 1 / 3, "⅔": 2 / 3, "¼": 0.25, "¾": 0.75, "⅛": 0.125, "⅜": 0.375, "⅝": 0.625, "⅞": 0.875
};

/** Common cooking fractions, so 0.5 prints as ½ rather than 0.5. */
const PRETTY: [number, string][] = [
  [0.125, "⅛"], [0.25, "¼"], [1 / 3, "⅓"], [0.375, "⅜"], [0.5, "½"],
  [0.625, "⅝"], [2 / 3, "⅔"], [0.75, "¾"], [0.875, "⅞"]
];

/** Reads a leading amount: "2", "1.5", "1/2", "1 1/2", "½", "1½". Returns null when there isn't one. */
export function parseAmount(text: string): { value: number; rest: string } | null {
  const s = text.trim();
  if (!s) return null;

  // mixed number with a vulgar fraction: "1½"
  const mixedVulgar = s.match(/^(\d+)\s*([½⅓⅔¼¾⅛⅜⅝⅞])\s*(.*)$/u);
  if (mixedVulgar) {
    return { value: Number(mixedVulgar[1]) + VULGAR[mixedVulgar[2]], rest: mixedVulgar[3] };
  }

  // lone vulgar fraction: "½ cup"
  const vulgar = s.match(/^([½⅓⅔¼¾⅛⅜⅝⅞])\s*(.*)$/u);
  if (vulgar) return { value: VULGAR[vulgar[1]], rest: vulgar[2] };

  // mixed number: "1 1/2 cups"
  const mixed = s.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)\s*(.*)$/);
  if (mixed) {
    const den = Number(mixed[3]);
    if (den === 0) return null;
    return { value: Number(mixed[1]) + Number(mixed[2]) / den, rest: mixed[4] };
  }

  // plain fraction: "1/2 tsp"
  const frac = s.match(/^(\d+)\s*\/\s*(\d+)\s*(.*)$/);
  if (frac) {
    const den = Number(frac[2]);
    if (den === 0) return null;
    return { value: Number(frac[1]) / den, rest: frac[3] };
  }

  // decimal or integer, optionally glued to a unit: "200g", "1.5 cups"
  const num = s.match(/^(\d+(?:[.,]\d+)?)\s*(.*)$/);
  if (num) return { value: Number(num[1].replace(",", ".")), rest: num[2] };

  return null;
}

/** 0.5 → "½", 1.5 → "1½", 2 → "2", 0.33 → "⅓", 1.27 → "1.27". */
export function formatAmount(value: number): string {
  if (!Number.isFinite(value) || value < 0) return "";
  if (value === 0) return "0";

  const whole = Math.floor(value + 1e-9);
  const frac = value - whole;

  if (frac < 1e-6) return String(whole);

  for (const [v, glyph] of PRETTY) {
    if (Math.abs(frac - v) < 0.02) return whole ? `${whole}${glyph}` : glyph;
  }

  const rounded = Math.round(value * 100) / 100;
  return String(rounded);
}

/** Scales one measure string. Unparseable measures come back unchanged. */
export function scaleMeasure(measure: string, factor: number): string {
  if (!measure) return measure;
  if (!Number.isFinite(factor) || factor <= 0) return measure;
  if (factor === 1) return measure;
  const parsed = parseAmount(measure);
  if (!parsed) return measure;
  const amount = formatAmount(parsed.value * factor);
  return parsed.rest ? `${amount} ${parsed.rest}`.trim() : amount;
}

/** Scales a whole ingredient list. */
export function scaleIngredients<T extends { name: string; measure: string }>(items: T[], factor: number): T[] {
  return items.map((i) => ({ ...i, measure: scaleMeasure(i.measure, factor) }));
}

/** Per-serving numbers stay per serving; totals scale. Returns null when there is nothing to scale. */
export function scaleTotal(perServing: number | null | undefined, servings: number): number | null {
  if (perServing == null || !Number.isFinite(perServing)) return null;
  return Math.round(perServing * servings);
}
