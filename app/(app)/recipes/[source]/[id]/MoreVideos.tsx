"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";

type Video = { id: string; title: string; channel: string; thumb: string; url: string };

/** Extra YouTube videos (needs YOUTUBE_API_KEY). Plays inline; falls back to a YouTube search link. */
export function MoreVideos({ query }: { query: string }) {
  const [videos, setVideos] = useState<Video[]>([]);
  const [searchUrl, setSearchUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/videos?q=${encodeURIComponent(query)}`)
      .then((r) => r.json())
      .then((d: { videos: Video[]; searchUrl: string | null }) => {
        setVideos(d.videos);
        setSearchUrl(d.searchUrl);
      })
      .catch(() => undefined);
  }, [query]);

  return (
    <section className="card" aria-label="More videos" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="head">
        <h2 className="h2" style={{ flex: 1 }}>More videos</h2>
        {searchUrl && <a className="btn sm" href={searchUrl} target="_blank" rel="noreferrer">Search on YouTube ↗</a>}
      </div>
      {playing && (
        <div className="video">
          <iframe src={`https://www.youtube-nocookie.com/embed/${playing}?autoplay=1`} title="Recipe video" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
        </div>
      )}
      {videos.length ? (
        <div className="grid">
          {videos.map((v) => (
            <button key={v.id} onClick={() => setPlaying(v.id)} style={{ all: "unset", cursor: "pointer", display: "flex", flexDirection: "column", gap: 6 }} aria-label={`Play ${v.title}`}>
              <img src={v.thumb} alt="" style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover", borderRadius: 12 }} />
              <span style={{ fontWeight: 600, fontSize: 14 }}>{v.title}</span>
              <span className="muted">{v.channel}</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="muted">Add a YouTube API key to show more videos here, or use the search link.</p>
      )}
    </section>
  );
}
