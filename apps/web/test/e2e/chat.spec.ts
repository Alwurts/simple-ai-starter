import { expect, test } from "@playwright/test";
import { waitHydrated } from "./helpers";

// The reply is streamed by the local fake model server
// (test/e2e/fake-model-server.mjs) the e2e env points the openai-compatible
// provider at — never a real model.
const USER_MESSAGE = "Hello";
const ASSISTANT_REPLY = "Hello from the e2e model.";
const CHAT_ID_URL_PATTERN = /\/chat\/[0-9a-f]{16}$/;

test.describe("chat turn", () => {
  test("sends a message on the new-chat draft and streams the reply", async ({
    page,
  }) => {
    await page.goto("/chat/new");
    await waitHydrated(page);

    // The composer is a TipTap contenteditable that mounts after hydration.
    const composer = page.locator(
      '[data-slot="chat-input"] [contenteditable="true"]'
    );
    await expect(composer).toBeVisible({ timeout: 15_000 });
    await composer.click();
    await page.keyboard.type(USER_MESSAGE);
    await page.getByRole("button", { name: "Send" }).click();

    // The draft is replaced by a persisted chat on send.
    await expect(page).toHaveURL(CHAT_ID_URL_PATTERN, { timeout: 15_000 });

    // The user bubble and the streamed assistant reply. Messages are ordered,
    // so the first exact match is the user bubble — the assistant text can
    // briefly equal the user message mid-stream.
    await expect(
      page
        .locator('[data-slot="bubble-content"]')
        .getByText(USER_MESSAGE, { exact: true })
        .first()
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.locator('[data-slot="bubble-content"]').getByText(ASSISTANT_REPLY)
    ).toBeVisible({ timeout: 30_000 });

    // The chat shows up in the sidebar Chats list, titled from the message.
    await expect(
      page.getByRole("link", { name: USER_MESSAGE, exact: true })
    ).toBeVisible({ timeout: 15_000 });
  });
});
