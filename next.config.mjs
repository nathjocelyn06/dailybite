/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "www.themealdb.com" },
      { protocol: "https", hostname: "i.ytimg.com" },
      { protocol: "https", hostname: "*.supabase.co" }
    ]
  },
  experimental: {
    serverActions: { bodySizeLimit: "8mb" }
  }
};

export default nextConfig;
