import { expect, test } from "@playwright/test";
import { fillValue, waitForRouteSettled, waitHydrated } from "./helpers";

const LOGIN_URL_PATTERN = /login/;
const ONBOARDING_URL_PATTERN = /onboarding/;
// The chat is the signed-in home; a fresh org lands on the new-chat draft.
const HOME_URL_PATTERN = /\/chat\/(new|[0-9a-f]+)/;

test.describe("auth guards", () => {
  test("unauthenticated user is redirected to login", async ({ page }) => {
    await page.goto("/catalog");
    await expect(page).toHaveURL(LOGIN_URL_PATTERN, { timeout: 10_000 });
  });

  test("unauthenticated user cannot access dashboard", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(LOGIN_URL_PATTERN, { timeout: 10_000 });
  });
});

test.describe("signup flow", () => {
  test("can sign up a new account", async ({ page }) => {
    const uniqueEmail = `signup-${Date.now()}@test.com`;

    await page.goto("/signup");
    await waitHydrated(page);
    await fillValue(page.locator("input#name"), "Signup Test User");
    await fillValue(page.locator("input#email"), uniqueEmail);
    await fillValue(page.locator("input#password"), "TestPassword123!");
    await page.getByRole("button", { name: "Sign up" }).click();

    await expect(page).toHaveURL(ONBOARDING_URL_PATTERN, { timeout: 15_000 });
  });
});

test.describe("login flow", () => {
  const loginEmail = `login-${Date.now()}@test.com`;
  const loginPassword = "TestPassword123!";

  test("can log in with existing credentials", async ({ page }) => {
    // First, create a user via signup + onboarding
    await page.goto("/signup");
    await waitHydrated(page);
    await fillValue(page.locator("input#name"), "Login Test User");
    await fillValue(page.locator("input#email"), loginEmail);
    await fillValue(page.locator("input#password"), loginPassword);
    await page.getByRole("button", { name: "Sign up" }).click();
    await expect(page).toHaveURL(ONBOARDING_URL_PATTERN, { timeout: 15_000 });

    // Complete onboarding (org route chunks settle after the URL changes)
    await waitForRouteSettled(page);
    await fillValue(page.locator("input#name"), "Login Test Org");
    await page.getByRole("button", { name: "Create Organization" }).click();
    await expect(page).toHaveURL(HOME_URL_PATTERN, { timeout: 15_000 });

    // Now navigate to login page directly (fresh context without cookies)
    await page.context().clearCookies();
    await page.goto("/login");
    await waitHydrated(page);

    // Log in with the credentials
    await fillValue(page.locator("input#email"), loginEmail);
    await fillValue(page.locator("input#password"), loginPassword);
    await page.getByRole("button", { name: "Log in" }).click();

    await expect(page).toHaveURL(HOME_URL_PATTERN, { timeout: 15_000 });
  });
});
