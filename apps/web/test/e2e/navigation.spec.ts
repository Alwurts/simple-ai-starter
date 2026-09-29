import { expect, test } from "@playwright/test";

const CHAT_URL_PATTERN = /\/chat\/(new|[0-9a-f]+)/;

test.describe("navigation", () => {
  test("home opens the chat page", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(CHAT_URL_PATTERN);
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

  test("sidebar navigates back to Chat", async ({ page }) => {
    await page.goto("/settings");
    await page.getByRole("link", { name: "Chat" }).first().click();
    await expect(page).toHaveURL(CHAT_URL_PATTERN);
  });

  test("new chat opens the draft route", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "New chat" }).click();
    await expect(page).toHaveURL("/chat/new");
  });
});
