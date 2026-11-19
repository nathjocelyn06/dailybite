/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "www.themealdb.com" },
      { protocol: "https", hostname: "i.ytimg.com" },
      { protocol: "https", hostname: "*.supabase.co" }
    ]
  },
  // The MCP Apps views inline the vendored browser bridge, which the route reads
  // from disk at module load. Without this the file is not traced into the
  // serverless function and /api/mcp throws ENOENT in production.
  outputFileTracingIncludes: { "/api/[transport]": ["./lib/mcp/ui/bridge.js"] },
  experimental: {
    serverActions: { bodySizeLimit: "8mb" }
  }
};

export default nextConfig;
