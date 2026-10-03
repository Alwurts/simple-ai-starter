import { expect, type Page, test } from "@playwright/test";
import { waitHydrated } from "./helpers";

const CHAT_ID_URL_PATTERN = /\/chat\/[0-9a-f]{16}$/;
const CHAT_ID_IN_URL = /\/chat\/([0-9a-f]{16})$/;
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
    // Deleting the open chat closes the window and leaves the page.
    await expect(page).toHaveURL("/", { timeout: 15_000 });
  });

  test("a deleted open chat stays deleted in a new page", async ({ page }) => {
    const title = `Stay Deleted ${Date.now()}`;
    await createChatWithTitle(page, title);
    // The outgoing bubble is on screen only after the chat socket connects.
    await expect(
      page
        .locator('[data-slot="bubble-content"]')
        .getByText(title, { exact: true })
        .first()
    ).toBeVisible({ timeout: 15_000 });
    const chatId = CHAT_ID_IN_URL.exec(page.url())?.[1];
    expect(chatId).toBeTruthy();

    await chatRowMenu(page, title).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Delete" })
      .click();
    await expect(
      page.getByRole("link", { name: title, exact: true })
    ).toBeHidden({ timeout: 15_000 });
    await expect(page).toHaveURL("/", { timeout: 15_000 });

    const fresh = await page.context().newPage();
    await fresh.goto("/chat/new");
    await waitHydrated(fresh);
    await expect(fresh.getByText("Loading…")).toHaveCount(0, {
      timeout: 15_000,
    });

    // The next send mints a new id. A forwarded close re-registers the facet
    // after delete; the old id stays gone because chat_meta is the record.
    const followUp = `After delete ${Date.now()}`;
    const composer = fresh.locator(COMPOSER);
    await expect(composer).toBeVisible({ timeout: 15_000 });
    await composer.click();
    await fresh.keyboard.type(followUp);
    await fresh.getByRole("button", { name: "Send" }).click();
    await expect(fresh).toHaveURL(CHAT_ID_URL_PATTERN, { timeout: 15_000 });
    await expect(
      fresh.getByRole("link", { name: followUp, exact: true })
    ).toBeVisible({ timeout: 15_000 });

    const hrefs = await fresh
      .locator("a")
      .evaluateAll((els) => els.map((el) => el.getAttribute("href") ?? ""));
    expect(hrefs.some((href) => href.includes(`/chat/${chatId}`))).toBe(false);
    await fresh.close();
  });

  test("header delete asks to confirm; cancel keeps the chat", async ({
    page,
  }) => {
    const title = `Header Delete ${Date.now()}`;
    await createChatWithTitle(page, title);
    const chatId = CHAT_ID_IN_URL.exec(page.url())?.[1];
    expect(chatId).toBeTruthy();

    await page.getByRole("button", { name: "More actions" }).click();
    await page.getByRole("menuitem", { name: "Delete conversation" }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
    await expect(
      page.getByRole("link", { name: title, exact: true })
    ).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/chat/${chatId}$`));

    await page.getByRole("button", { name: "More actions" }).click();
    await page.getByRole("menuitem", { name: "Delete conversation" }).click();
    await dialog.getByRole("button", { name: "Delete" }).click();
    await expect(
      page.getByRole("link", { name: title, exact: true })
    ).toBeHidden({ timeout: 15_000 });
    await expect(page).not.toHaveURL(new RegExp(`/chat/${chatId}$`), {
      timeout: 15_000,
    });
  });

  test("org switcher marks the active organization", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "E2E Test Org" }).click();

    const activeItem = page.getByRole("menuitem", { name: "E2E Test Org" });
    await expect(activeItem).toBeVisible();
    await expect(activeItem.locator("svg.lucide-check")).toBeVisible();
  });
});
