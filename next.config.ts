import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "localhost", 
    "192.168.1.15", 
    "192.168.*" 
  ],
};

export default nextConfig;
