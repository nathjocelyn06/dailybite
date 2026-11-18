/**
 * A rough calorie estimate for a recipe, worked out from its own ingredient list.
 *
 * TheMealDB carries no nutrition, and the page used to shrug and say "ask Claude".
 * A number with a tilde in front of it is more useful than no number: you can see at
 * a glance whether a dish is a 300 or a 900, and correct it later if you care.
 *
 * It is deliberately a local calculation — no API call, no key, no latency — so every
 * recipe shows something. Two lookups do the work: a measure converted to grams, and
 * a calorie density matched on words in the ingredient's name. Both are approximate
 * and the result is rounded hard, because pretending otherwise would be the real lie.
 */
import { parseAmount } from "../scale";

/** Grams for one of a given unit. Volume units assume a mid-weight ingredient. */
const UNIT_GRAMS: [RegExp, number][] = [
  [/^(kg|kilograms?|kilos?)\b/, 1000],
  [/^(g|gr|grams?)\b/, 1],
  [/^(mg)\b/, 0.001],
  [/^(lbs?|pounds?)\b/, 453.6],
  [/^(oz|ounces?)\b/, 28.35],
  [/^(l|litres?|liters?)\b/, 1000],
  [/^(ml|millilitres?|milliliters?)\b/, 1],
  [/^(cups?)\b/, 200],
  [/^(tbsp|tbs|tablespoons?)\b/, 15],
  [/^(tsp|teaspoons?)\b/, 5],
  [/^(cloves?)\b/, 5],
  [/^(slices?)\b/, 25],
  [/^(cans?|tins?)\b/, 400],
  [/^(sprigs?|leaves|leaf|pinch|dash|handful)\b/, 2]
];

/** Weight of one piece when a measure is just a count ("2 chicken breasts"). */
const PIECE_GRAMS: [RegExp, number][] = [
  [/egg/, 55],
  [/chicken breast|breast|thigh|fillet/, 170],
  [/onion|potato|aubergine|eggplant|pepper/, 130],
  [/tomato|apple|orange|pear|peach|lemon|lime/, 110],
  [/carrot|banana|courgette|zucchini/, 90],
  [/clove|shallot|chilli|chili/, 8],
  [/garlic/, 30]
];

/** Calories per 100 g. First match wins, so the specific lines come first. */
const KCAL_PER_100G: [RegExp, number][] = [
  [/\b(water|ice)\b/, 0],
  [/salt|pepper(corn)?s?\b|spice|powder|herb|parsley|coriander|cilantro|cumin|paprika|cinnamon|nutmeg|turmeric|bay lea|thyme|oregano|basil|rosemary|mint|vanilla|saffron|yeast|baking/, 0],
  [/oil|ghee|lard|dripping|butter|margarine/, 850],
  [/nut\b|nuts|almond|cashew|peanut|walnut|pecan|pistachio|hazelnut|sesame|tahini/, 600],
  [/chocolate|cocoa|cacao/, 500],
  [/flour|rice|pasta|noodle|spaghetti|macaroni|oat|couscous|semolina|breadcrumb|cornmeal|polenta|lentil|quinoa/, 355],
  [/sugar|honey|syrup|jam|marmalade|treacle|molasses/, 350],
  [/bacon|sausage|chorizo|salami|pancetta|pepperoni|prosciutto/, 330],
  [/cheese|parmesan|cheddar|mozzarella|feta|halloumi|gruyere|paneer/, 380],
  [/bread|bun|roll|tortilla|pastry|puff|filo|pita|naan|biscuit|cracker/, 280],
  [/cream|mascarpone|creme|custard/, 290],
  [/beef|lamb|pork|mince|steak|duck|veal|gammon|ham\b/, 250],
  [/chicken|turkey|poultry/, 170],
  [/fish|salmon|tuna|cod|haddock|prawn|shrimp|seafood|mussel|squid|anchov|mackerel|sardine/, 150],
  [/egg/, 140],
  [/bean|chickpea|pulse|tofu|tempeh|hummus/, 130],
  [/potato|yam|plantain|parsnip/, 85],
  [/milk|yoghurt|yogurt|buttermilk|creme fraiche/, 60],
  [/wine|beer|cider|stock|broth|bouillon|juice|vinegar/, 15],
  [/sauce|ketchup|mustard|mayonnaise|paste|puree|passata|soy|chutney|pickle|relish/, 60],
  [/raisin|sultana|date\b|prune|apricot|fig\b/, 290],
  [/apple|banana|berry|berries|orange|lemon|lime|mango|pineapple|grape|peach|pear|plum|melon|cherry|fruit/, 55],
  [/onion|tomato|carrot|spinach|cabbage|broccoli|cauliflower|mushroom|courgette|zucchini|aubergine|eggplant|celery|leek|pea\b|peas\b|corn|lettuce|cucumber|pepper|vegetable|greens|kale|squash|pumpkin|beet/, 35]
];

/** Anything we cannot place at all. Between a vegetable and a grain. */
const FALLBACK_KCAL_PER_100G = 110;
const FALLBACK_PIECE_GRAMS = 80;

function gramsFor(measure: string, name: string): number | null {
  const parsed = parseAmount(measure);
  if (!parsed) return null;

  const rest = parsed.rest.trim().toLowerCase();
  for (const [unit, grams] of UNIT_GRAMS) {
    if (unit.test(rest)) return parsed.value * grams;
  }
  // no unit at all: the amount is a count of whole things
  const hay = `${rest} ${name}`.toLowerCase();
  for (const [piece, grams] of PIECE_GRAMS) {
    if (piece.test(hay)) return parsed.value * grams;
  }
  return parsed.value * FALLBACK_PIECE_GRAMS;
}

function kcalPer100g(name: string): number {
  const n = name.toLowerCase();
  for (const [word, kcal] of KCAL_PER_100G) {
    if (word.test(n)) return kcal;
  }
  return FALLBACK_KCAL_PER_100G;
}

/**
 * Calories for the whole recipe, rounded to the nearest 25.
 * Null when too little of the list could be read for the number to mean anything.
 */
export function estimateRecipeKcal(ingredients: { name: string; measure: string }[]): number | null {
  let total = 0;
  let read = 0;
  for (const i of ingredients) {
    const grams = gramsFor(i.measure ?? "", i.name);
    if (grams === null || grams <= 0) continue;
    read += 1;
    total += (grams / 100) * kcalPer100g(i.name);
  }
  // one readable line out of a dozen is a guess, not an estimate
  if (read < 2 || read < ingredients.length / 3) return null;
  const rounded = Math.round(total / 25) * 25;
  return rounded > 0 ? rounded : null;
}

/** Per serving, same caveats. */
export function estimateKcalPerServing(
  ingredients: { name: string; measure: string }[],
  servings: number
): number | null {
  const total = estimateRecipeKcal(ingredients);
  if (total === null || servings <= 0) return null;
  return Math.round(total / servings / 5) * 5;
}
