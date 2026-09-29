import { expect, test } from "@playwright/test";

test.describe("navigation", () => {
  test("home loads after login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL("/");
  });

  test("sidebar navigates to Catalog", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Catalog" }).click();
    await expect(page).toHaveURL("/catalog");
  });

  test("sidebar navigates to Settings", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Settings" }).click();
    await expect(page).toHaveURL("/settings");
  });

  test("sidebar navigates back to Home", async ({ page }) => {
    await page.goto("/settings");
    await page.getByRole("link", { name: "Home" }).first().click();
    await expect(page).toHaveURL("/");
  });
});
