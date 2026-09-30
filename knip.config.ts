import type { KnipConfig } from "knip";

// Dead-code detection for this monorepo. Refreshed for knip 6
// after TypeScript 7 broke knip 5 (`typescript` peer `<7`).
//
// Conventions:
// - `entry` lists only what Knip CAN'T auto-derive from package.json
//   exports / scripts. Prefer deleting redundant entries over listing everything.
// - `!` suffix = follow imports but don't check that file's own exports.
// - `ignoreDependencies` documents deps used through channels static analysis
//   can't see (CSS @import/@plugin, tsconfig ambient include, peer-resolution).
//   Each entry needs a one-line reason.
const config: KnipConfig = {
  workspaces: {
    "apps/web": {
      entry: [
        // Test-only worker main, bound via wrangler.test.jsonc (not package.json).
        "test/agent/worker-entry.ts!",
        "test/**/*.{ts,tsx}",
      ],
      project: ["src/**/*.{ts,tsx}", "test/**/*.{ts,tsx}"],
      ignoreDependencies: [
        // Tailwind v4 via `@import` in CSS (imported as `?url` / side-effect).
        "tailwindcss",
        // Pulled in by vite/tanstack plugin tooling; not always a direct import.
        "@tanstack/router-plugin",
        "@tanstack/react-router-ssr-query",
        // Opt-in vitest UI assertions.
        "@testing-library/dom",
        "@testing-library/react",
        // Agent model + sandbox shell — wired via config / dynamic provider paths.
        "@ai-sdk/google",
        "@cloudflare/shell",
      ],
    },
    "packages/agent": {
      project: ["src/**/*.ts"],
      ignoreDependencies: [
        // Ambient `Env` via tsconfig include of packages/env.
        "@workspace/env",
      ],
    },
    "packages/auth": {
      project: ["src/**/*.ts"],
      ignoreDependencies: ["@workspace/env"],
    },
    "packages/contract": {
      project: ["src/**/*.ts"],
    },
    "packages/core": {
      project: ["src/**/*.ts"],
      ignoreDependencies: ["@workspace/env"],
    },
    "packages/db": {
      entry: ["drizzle.config*.ts!"],
      project: ["src/**/*.ts", "drizzle.config*.ts"],
      ignoreDependencies: ["@workspace/env"],
    },
    "packages/email": {
      project: ["src/**/*.{ts,tsx}"],
      ignoreDependencies: ["@workspace/env"],
    },
    "packages/env": {
      project: ["src/**/*.ts"],
    },
    "packages/ui": {
      entry: ["src/**/*.tsx", "src/**/*.ts"],
      project: ["src/**/*.{ts,tsx}"],
      ignoreDependencies: [
        // peerDependencies.next mirror for local peer/typecheck resolution.
        "next",
        // Scaffolding / form / tippy paths not always statically reached.
        "@turbo/gen",
        "@hookform/resolvers",
        "nanoid",
        "tippy.js",
      ],
    },
  },
  ignore: [
    // Agent skills / procedural docs — not part of the app graph.
    ".agents/**",
  ],
  // `cloudflare:workers` is Cloudflare's built-in module; Knip normalizes the
  // `:` specifier to `cloudflare`.
  ignoreDependencies: ["cloudflare", "postcss-load-config"],
  // CI deploy workflow invokes the wrangler CLI; not always a root package bin.
  ignoreBinaries: ["wrangler"],
  ignoreExportsUsedInFile: true,
};

export default config;
