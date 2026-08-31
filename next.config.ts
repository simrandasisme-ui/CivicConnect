import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 1. Allow mobile/LAN testing on your local network:
  allowedDevOrigins: [
    "localhost",
    "192.168.1.15",
    "192.168.1.*",
    "192.168.1.10",
  ],

  // 2. Allow external image hosting/previews:
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },

  // 3. External packages for server execution (Next.js 15+):
  serverExternalPackages: [
    "@xenova/transformers",
    "imghash",
    "jimp",
    "@cwasm/nsbmp",
  ],

  // 4. Backward compatibility for Next.js 13/14:
  experimental: {
    serverComponentsExternalPackages: [
      "@xenova/transformers",
      "imghash",
      "jimp",
      "@cwasm/nsbmp",
    ],
  },

  // 5. Webpack override to bypass native C++ binary crashes:
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "sharp$": false,
      "onnxruntime-node$": false,
    };
    return config;
  },
};

export default nextConfig;