import { expect, test } from "@playwright/test";

// The catalog page appends table search params (?page=…&pageSize=…).
const CATALOG_URL_PATTERN = /\/catalog/;

test.describe("navigation", () => {
  test("home stays on the page and shows the dock", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("heading", { name: "Home" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "New chat", exact: true })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Search", exact: true })
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Search" })).toHaveCount(0);
    await expect(page.locator("[data-slot=chat-tab-strip]")).toHaveCount(0);
  });

  test("sidebar navigates to Catalog", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Catalog" }).click();
    await expect(page).toHaveURL(CATALOG_URL_PATTERN);
  });

  test("settings opens from the account menu", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "General" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Members" })).toHaveCount(0);
    await page.getByRole("button", { name: "E2E Test User" }).click();
    await page.getByRole("menuitem", { name: "Settings" }).click();
    await expect(page).toHaveURL("/settings/general");
    await page
      .getByRole("navigation", { name: "Settings" })
      .getByRole("link", { name: "Members" })
      .click();
    await expect(page).toHaveURL("/settings/members");
  });

  test("new chat opens the dock on the current page", async ({ page }) => {
    await page.goto("/catalog");
    await page.getByRole("button", { name: "New chat", exact: true }).click();
    await expect(page).toHaveURL(CATALOG_URL_PATTERN);
    await expect(
      page.locator('[data-slot="chat-input"] [contenteditable="true"]')
    ).toBeVisible();
  });
});
