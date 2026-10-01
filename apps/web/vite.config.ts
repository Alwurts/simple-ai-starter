import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import agents from "agents/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

// CLOUDFLARE_ENV=e2e (set by Playwright) selects .dev.vars.e2e for the Worker
// and keeps the e2e run's local state (D1 + Durable Objects) — and the devtools
// event bus — off the `pnpm dev` defaults, so the two can run side by side. The
// e2e run also disables the devtools console pipe: it holds an SSE request open
// forever, so Playwright's `networkidle` waits never settle.
const isE2E = process.env.CLOUDFLARE_ENV === "e2e";

const config = defineConfig({
  environments: {
    // @cloudflare/vite-plugin 1.53 SSR-optimizes the worker graph with Rolldown.
    // TanStack Devtools pulls solid-js/web `use`, which the Solid server build
    // does not export — vite dev crashes at optimizer start without this exclude.
    ssr: {
      optimizeDeps: {
        exclude: [
          "@tanstack/devtools-ui",
          "@tanstack/react-devtools",
          "solid-js",
          "solid-js/web",
        ],
      },
    },
  },
  plugins: [
    // agents() also lowers the stage-3 decorators (`@callable` on OrgAgent)
    // that Vite 8/Oxc doesn't handle, and builds the `agents:skills` virtual
    // module from packages/agent/src/org/chat/skills/.
    agents(),
    devtools({
      eventBusConfig: { port: isE2E ? 42_086 : 42_085 },
      consolePiping: { enabled: !isE2E },
    }),
    cloudflare({
      viteEnvironment: { name: "ssr" },
      persistState: isE2E ? { path: "test/e2e/.wrangler/state" } : undefined,
    }),
    tsconfigPaths({ projects: ["./tsconfig.json"] }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
});

export default config;
