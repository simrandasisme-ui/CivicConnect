import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 1. Allow mobile/LAN testing on your local network:
  allowedDevOrigins: [
    "localhost",
    "192.168.1.15",
    "192.168.*"
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

  // 3. Enable server-side local embeddings (Transformers.js / ONNX):
  serverExternalPackages: ["@xenova/transformers", "onnxruntime-node"],
};

export default nextConfig;