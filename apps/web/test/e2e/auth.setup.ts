import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test as setup } from "@playwright/test";
import { fillValue, waitForRouteSettled, waitHydrated } from "./helpers";

const __dirname = dirname(fileURLToPath(import.meta.url));
const authFile = join(__dirname, "../.auth/user.json");
const ONBOARDING_URL_PATTERN = /onboarding/;
// Signed-in home is `/`. Chat opens in the dock and does not replace this URL.
const HOME_URL_PATTERN = /^https?:\/\/[^/]+\/?$/;

setup("create authenticated user", async ({ page }) => {
  // Unique per attempt: a retry after a failed attempt must not collide with
  // the user the failed attempt already created.
  const email = `e2e-${Date.now()}@example.com`;

  await page.goto("/signup");
  await waitHydrated(page);
  await fillValue(page.locator("input#name"), "E2E Test User");
  await fillValue(page.locator("input#email"), email);
  await fillValue(page.locator("input#password"), "TestPassword123!");
  await page.getByRole("button", { name: "Sign up" }).click();

  // Should redirect to onboarding
  await expect(page).toHaveURL(ONBOARDING_URL_PATTERN, { timeout: 15_000 });

  // The org route mounts lazily after the URL changes: let its chunk cascade
  // settle, then fill — otherwise the lazy swap remounts the form and wipes
  // the value between fill and submit.
  await waitForRouteSettled(page);
  await fillValue(page.locator("input#name"), "E2E Test Org");
  await page.getByRole("button", { name: "Create Organization" }).click();

  // Should redirect to the dashboard
  await expect(page).toHaveURL(HOME_URL_PATTERN, { timeout: 15_000 });

  // Save the authenticated state
  await page.context().storageState({ path: authFile });
});
