import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit .next/standalone with a minimal server.js so the Docker runner stage
  // can run the app without installing node_modules. See the Dockerfile.
  output: "standalone",
  images: {
    // Allow the dummy profile photos served from randomuser.me. Replace with
    // your real avatar host (or local /public images) once wired to the DB.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "randomuser.me",
        pathname: "/api/portraits/**",
      },
    ],
  },
};

export default nextConfig;
