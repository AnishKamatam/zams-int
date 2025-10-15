import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  turbopack: {
    root: __dirname,
  },
  // Disable PWA features that might cause service worker issues
  experimental: {
    // Disable any experimental features that might use service workers
  },
};

export default nextConfig;
