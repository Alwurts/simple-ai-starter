import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";

const __dirname = dirname(fileURLToPath(import.meta.url));

// The app under test runs on its own port (4012, not the dev 4011) with its own
// local state (D1 + Durable Objects under test/e2e/.wrangler, via
// CLOUDFLARE_ENV=e2e → .dev.vars.e2e + the plugin's persistState path) so an
// e2e run can never touch a developer's dev server or data, and points the
// openai-compatible provider at the local fake model server.
const E2E_APP_ENV = { CLOUDFLARE_ENV: "e2e" };

export default defineConfig({
  testDir: "./test/e2e",
  globalSetup: "./test/e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["html"], ["list"]],
  use: {
    baseURL: "http://localhost:4012",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "setup",
      testMatch: "*.setup.ts",
    },
    {
      name: "authenticated",
      testMatch: "*.spec.ts",
      testIgnore: "auth.spec.ts",
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: join(__dirname, "test/.auth/user.json"),
      },
    },
    {
      name: "unauthenticated",
      testMatch: "auth.spec.ts",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
  webServer: [
    {
      command: "node test/e2e/fake-model-server.mjs",
      port: 8799,
      reuseExistingServer: false,
    },
    {
      command: "pnpm db:reset:e2e && pnpm dev:e2e",
      port: 4012,
      timeout: 120_000,
      reuseExistingServer: false,
      env: E2E_APP_ENV,
    },
  ],
});
