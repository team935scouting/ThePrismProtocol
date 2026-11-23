import type { NextConfig } from "next";

// Static export so the site can be served from GitHub Pages (see public/CNAME).
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
};

export default nextConfig;
