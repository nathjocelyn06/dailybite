import { NextResponse } from "next/server";
import { lookupBarcode, searchFoods } from "@/lib/nutrition/openfoodfacts";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Packaged-food lookup for the barcode scanner and the food search in /snap.
 *   GET /api/food?barcode=5000112637922
 *   GET /api/food?q=greek yogurt
 * Read-only and anonymous: it writes nothing and sends nothing about the user
 * to Open Food Facts beyond the search text itself.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const barcode = url.searchParams.get("barcode");
  const q = url.searchParams.get("q");

  if (barcode) {
    const hit = await lookupBarcode(barcode);
    return NextResponse.json(
      hit
        ? { hits: [hit] }
        : { hits: [], note: "That barcode isn't in Open Food Facts. Search by name, or type the numbers in by hand." }
    );
  }

  if (q) {
    const hits = await searchFoods(q);
    return NextResponse.json({ hits, note: hits.length ? undefined : `Nothing found for "${q}".` });
  }

  return NextResponse.json({ hits: [], note: "Pass ?barcode= or ?q=" }, { status: 400 });
}
