export type ScanMode = "calorie" | "barcode" | "receipt" | "ingredient" | "recipe_finder" | "journal" | "grocery";

export type ScanRow = {
  name: string;
  portion?: string;
  grams?: number;
  ingredients?: string[];
  qty?: number;
  unit?: string;
  kcal?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
  price?: number;
  fridge_category?: "veg_fruit" | "protein" | "dairy_eggs" | "frozen" | "pantry" | "other";
  expires_in_days?: number;
  unsure?: boolean;
  /** Where the nutrition numbers came from: a food database, or the model estimating. */
  source?: "db" | "ai";
};

export type ScanDraft = {
  mode: ScanMode;
  title?: string;
  /** Which meal the photo looks like; the user can override it. */
  slot?: "breakfast" | "lunch" | "dinner" | "snack";
  merchant?: string;
  date?: string;
  total?: number;
  category?: "daily_food" | "groceries" | "snacks_drinks" | "other";
  rows: ScanRow[];
  note?: string;
  ai: boolean;
};
