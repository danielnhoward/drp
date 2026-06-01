import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit .next/standalone with a minimal server.js so the Docker runner stage
  // can run the app without installing node_modules. See the Dockerfile.
  output: "standalone",
  experimental: {
    serverActions: {
      // Profile picture uploads are capped at 5 MB in lib/avatars.ts; the
      // default 1 MB Server Action body limit would reject them at the edge
      // with an opaque error before our validation runs.
      bodySizeLimit: "5mb",
    },
  },
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
    // User-uploaded avatars are served by app/avatars/[userId]/route.ts and
    // carry a `?v=<timestamp>` cache-buster. next/image rejects query strings
    // on local URLs unless a pattern allows them. We omit `search` so any
    // timestamp matches — the route handler ignores the query anyway.
    localPatterns: [
      {
        pathname: "/avatars/**",
      },
    ],
  },
};

export default nextConfig;
