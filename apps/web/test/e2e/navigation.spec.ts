import { expect, test } from "@playwright/test";

const CHAT_URL_PATTERN = /\/chat\/(new|[0-9a-f]+)/;
// The catalog page appends table search params (?page=…&pageSize=…).
const CATALOG_URL_PATTERN = /\/catalog/;

test.describe("navigation", () => {
  test("home opens the chat page", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(CHAT_URL_PATTERN);
  });

  test("sidebar navigates to Catalog", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Catalog" }).click();
    await expect(page).toHaveURL(CATALOG_URL_PATTERN);
  });

  test("sidebar opens General and Members settings", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "General" }).click();
    await expect(page).toHaveURL("/settings/general");
    await page.getByRole("link", { name: "Members" }).click();
    await expect(page).toHaveURL("/settings/members");
  });

  test("new chat opens the draft route", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "New chat" }).click();
    await expect(page).toHaveURL("/chat/new");
  });
});
