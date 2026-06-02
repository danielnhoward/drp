import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

// Test config for the backend harness in backend_test/. The lib/*.ts data layer
// is server-only and uses extensionless + "@/*" imports, so we lean on Vite to
// resolve them and on the "react-server" condition to neutralize `server-only`.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
      // The lib/*.ts data-layer modules start with `import "server-only"`, whose
      // real module throws when imported outside a React Server Component graph.
      // Swap it for an empty module so they import cleanly under Node/Vitest.
      // (The package's own `react-server` export condition isn't reliably applied
      // to externalized node_modules here, so we alias it outright.)
      "server-only": fileURLToPath(new URL("./backend_test/empty-module.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["backend_test/**/*.test.ts"],
    setupFiles: ["backend_test/setup.ts"],
    // Each test file runs in its own isolated module registry (Vitest default),
    // so lib/db.ts's cached connection — and thus the temp DB — is per-file.
  },
});
