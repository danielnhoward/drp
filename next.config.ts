import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit .next/standalone with a minimal server.js so the Docker runner stage
  // can run the app without installing node_modules. See the Dockerfile.
  output: "standalone",
};

export default nextConfig;
