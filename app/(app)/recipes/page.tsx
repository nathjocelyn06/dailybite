import { webDb } from "@/lib/services/db";
import { listSaved } from "@/lib/services/recipes";
import { RecipesClient } from "./RecipesClient";

export default async function RecipesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const db = await webDb();
  const saved = await listSaved(db);
  return (
    <RecipesClient
      initialTab={(sp.tab as "discover" | "collection" | "scanner") ?? "discover"}
      initialQuery={{ query: sp.query ?? "", category: sp.category ?? "", area: sp.area ?? "", ingredient: sp.ingredient ?? "" }}
      initialIngredients={sp.ingredients ?? ""}
      saved={saved.map((r) => ({ id: r.id, title: r.title, thumb_url: r.thumb_url, folder: r.folder ?? "Saved", source: r.source, external_id: r.external_id, video: !!r.video_url, minutes: r.minutes }))}
    />
  );
}
