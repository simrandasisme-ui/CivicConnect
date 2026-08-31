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

  // 3. Enable server-side local embeddings (Transformers.js / ONNX):
  serverExternalPackages: [
    "@xenova/transformers",
    "onnxruntime-node",
    "imghash",
    "jimp",
    "@cwasm/nsbmp", 
  ],

  experimental: {
    // Tells Webpack not to bundle these native AI/Image modules, 
    // allowing Vercel to copy the .so and .wasm files correctly.
    // (Kept in sync with serverExternalPackages for Next 14 compatibility)
    serverComponentsExternalPackages: [
      "@xenova/transformers",
      "onnxruntime-node",
      "imghash",
      "jimp",
      "@cwasm/nsbmp", 
    ],
  },
};

export default nextConfig;