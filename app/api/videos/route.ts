import { NextResponse } from "next/server";
import { searchVideos, youtubeSearchUrl } from "@/lib/youtube";

export const runtime = "nodejs";

/** GET /api/videos?q=bibimbap -> { videos: Video[], searchUrl } */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (!q) return NextResponse.json({ videos: [], searchUrl: null });
  const query = /recipe|how to/i.test(q) ? q : `${q} recipe`;
  const videos = await searchVideos(query).catch(() => []);
  return NextResponse.json({ videos, searchUrl: youtubeSearchUrl(query) });
}
