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
  // These are kept as separate files instead of being bundled,
  // so their native binaries (like onnxruntime-node's .so file)
  // get copied correctly when deployed.
  serverExternalPackages: [
    "@xenova/transformers",
    "onnxruntime-node",
    "imghash",
    "jimp",
    "@cwasm/nsbmp",
  ],

  // 4. Make sure the native onnxruntime-node binary is traced and
  // included in the deployed function for your report-submit route.
  // Update the path below if your actual route differs.
  outputFileTracingIncludes: {
    "/api/report/submit": ["./node_modules/onnxruntime-node/**/*"],
  },
};

export default nextConfig;