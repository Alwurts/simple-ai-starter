import { expect, type Page, test } from "@playwright/test";
import { waitHydrated } from "./helpers";

const CHAT_ID_URL_PATTERN = /\/chat\/[0-9a-f]{16}$/;
const NEW_CHAT_URL_PATTERN = /\/chat\/new/;
const COMPOSER = '[data-slot="chat-input"] [contenteditable="true"]';

/**
 * Create a chat whose title is the given text: send it as the first message
 * on the draft (the starter titles chats from the first outgoing message).
 */
async function createChatWithTitle(page: Page, title: string): Promise<void> {
  await page.goto("/chat/new");
  await waitHydrated(page);
  const composer = page.locator(COMPOSER);
  await expect(composer).toBeVisible({ timeout: 15_000 });
  await composer.click();
  await page.keyboard.type(title);
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page).toHaveURL(CHAT_ID_URL_PATTERN, { timeout: 15_000 });
}

/** The row-menu trigger of the sidebar chat whose title matches. */
function chatRowMenu(page: Page, title: string) {
  return page
    .getByRole("listitem")
    .filter({ hasText: title })
    .getByRole("button", { name: "Chat options" });
}

test.describe("sidebar", () => {
  test("⌘K palette finds a chat by title and navigates to it", async ({
    page,
  }) => {
    const title = `Palette Probe ${Date.now()}`;
    await createChatWithTitle(page, title);

    await page.keyboard.press("ControlOrMeta+k");
    const paletteInput = page
      .getByRole("dialog")
      .getByPlaceholder("Search everything…");
    await expect(paletteInput).toBeVisible();
    await paletteInput.fill(title);
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL(CHAT_ID_URL_PATTERN, { timeout: 15_000 });
    await expect(paletteInput).toBeHidden();
  });

  test("renaming a chat updates the sidebar title", async ({ page }) => {
    const title = `Rename Probe ${Date.now()}`;
    const renamed = `Renamed Probe ${Date.now()}`;
    await createChatWithTitle(page, title);

    await chatRowMenu(page, title).click();
    await page.getByRole("menuitem", { name: "Rename" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.locator("input").fill(renamed);
    await dialog.getByRole("button", { name: "Save" }).click();

    await expect(
      page.getByRole("link", { name: renamed, exact: true })
    ).toBeVisible({ timeout: 15_000 });
  });

  test("delete cancel keeps the chat; delete with confirm removes it", async ({
    page,
  }) => {
    const title = `Delete Probe ${Date.now()}`;
    await createChatWithTitle(page, title);

    const rowMenu = chatRowMenu(page, title);

    await rowMenu.click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(
      page.getByRole("link", { name: title, exact: true })
    ).toBeVisible();

    await rowMenu.click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await dialog.getByRole("button", { name: "Delete" }).click();

    await expect(
      page.getByRole("link", { name: title, exact: true })
    ).toBeHidden({ timeout: 15_000 });
    // The deleted chat was the open one — land on the draft.
    await expect(page).toHaveURL(NEW_CHAT_URL_PATTERN, { timeout: 15_000 });
  });

  test("org switcher marks the active organization", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "E2E Test Org" }).click();

    const activeItem = page.getByRole("menuitem", { name: "E2E Test Org" });
    await expect(activeItem).toBeVisible();
    await expect(activeItem.locator("svg.lucide-check")).toBeVisible();
  });
});
