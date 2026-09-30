import fs from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default function globalSetup() {
  const appDir = resolve(__dirname, "../..");

  // Wrangler falls back to `.dev.vars` when `.dev.vars.e2e` is missing, which
  // would point the e2e run at a developer's real provider key.
  if (!fs.existsSync(join(appDir, ".dev.vars.e2e"))) {
    throw new Error(
      "apps/web/.dev.vars.e2e is missing — restore it (git checkout -- apps/web/.dev.vars.e2e) before running e2e."
    );
  }

  // Ensure the .auth directory exists for storageState
  fs.mkdirSync(join(appDir, "test/.auth"), { recursive: true });
}
