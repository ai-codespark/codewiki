import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Optimize build for Docker
  experimental: {
    optimizePackageImports: ['react-syntax-highlighter'],
  },
  // Reduce memory usage during build
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
      };
    }
    return config;
  },
};

export default nextConfig;
