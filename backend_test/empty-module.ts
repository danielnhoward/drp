// Stand-in for `server-only` under test. The real package throws on import
// outside a React Server Component graph; aliasing it here lets the lib/*.ts
// data-layer modules import cleanly in the Node test environment. See
// vitest.config.ts.
export {};
