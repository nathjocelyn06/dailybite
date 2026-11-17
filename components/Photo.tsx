/* eslint-disable @next/next/no-img-element */
/** Private photo via signed URL (or a placeholder when missing). */
export function Photo({ src, alt, style }: { src?: string | null; alt: string; style?: React.CSSProperties }) {
  if (!src) return <div className="thumb" role="img" aria-label={`${alt} (no photo)`} style={style} />;
  return <img className="thumb" src={src} alt={alt} style={style} loading="lazy" />;
}
