import { optionalEnv } from "./env";

export type Video = { id: string; title: string; channel: string; thumb: string; url: string };

export function youtubeSearchUrl(q: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
}

/**
 * Recipe videos via YouTube Data API v3 (search.list costs 100 quota units per call).
 * Without YOUTUBE_API_KEY this returns [] and the UI shows a "Search on YouTube" link instead.
 */
export async function searchVideos(q: string, max = 6): Promise<Video[]> {
  const key = optionalEnv("YOUTUBE_API_KEY");
  if (!key || !q.trim()) return [];
  const url =
    "https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoEmbeddable=true&safeSearch=strict" +
    `&maxResults=${max}&q=${encodeURIComponent(q)}&key=${key}`;
  const res = await fetch(url, { next: { revalidate: 86400 } } as RequestInit);
  if (!res.ok) return [];
  const data = (await res.json()) as {
    items?: { id: { videoId?: string }; snippet: { title: string; channelTitle: string; thumbnails: { medium?: { url: string } } } }[];
  };
  return (data.items ?? [])
    .filter((i) => i.id.videoId)
    .map((i) => ({
      id: i.id.videoId!,
      title: decodeEntities(i.snippet.title),
      channel: i.snippet.channelTitle,
      thumb: i.snippet.thumbnails.medium?.url ?? `https://i.ytimg.com/vi/${i.id.videoId}/mqdefault.jpg`,
      url: `https://www.youtube.com/watch?v=${i.id.videoId}`
    }));
}

function decodeEntities(s: string) {
  return s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
}
