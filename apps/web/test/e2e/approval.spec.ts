import { expect, test } from "@playwright/test";
import { waitHydrated } from "./helpers";

// The fake model (fake-model-server.mjs) turns
// `e2e-update-product:<exact product name>` into an update_product call at
// this price (minor units) and replies APPROVAL_REPLY after the tool result.
const APPROVAL_MARKER = "e2e-update-product:";
const APPROVAL_REPLY = "Updated the product.";
const UPDATED_PRICE = 4242;
const CHAT_ID_URL_PATTERN = /\/chat\/[0-9a-f]{16}$/;

test.describe("tool approval", () => {
  test("approves update_product and keeps the tool result", async ({
    page,
  }) => {
    // Expected failure until resumeStream keeps the assistant message: https://github.com/vercel/ai/issues/21916
    test.fail();

    const productName = `E2E Approval ${Date.now()}`;
    const created = await page.request.post("/api/catalog/products", {
      data: { name: productName, price: 1000 },
    });
    expect(created.status()).toBe(201);
    const product = (await created.json()) as { id: string; price: number };
    expect(product.price).toBe(1000);

    await page.goto("/chat/new");
    await waitHydrated(page);

    const composer = page.locator(
      '[data-slot="chat-input"] [contenteditable="true"]'
    );
    await expect(composer).toBeVisible({ timeout: 15_000 });
    await composer.click();
    await page.keyboard.type(`${APPROVAL_MARKER}${productName}`);
    await page.getByRole("button", { name: "Send" }).click();

    await expect(page).toHaveURL(CHAT_ID_URL_PATTERN, { timeout: 15_000 });

    const approve = page.getByRole("button", { name: "Approve", exact: true });
    await expect(page.getByText("Needs approval")).toBeVisible({
      timeout: 30_000,
    });
    if (!(await approve.isVisible())) {
      await page.locator('[data-slot="tool-header"]').click();
    }
    await approve.click();

    const banner = page.locator('[data-slot="chat-turn-error"]');
    const reply = page
      .locator('[data-slot="bubble-content"]')
      .getByText(APPROVAL_REPLY);
    // Both can show together: the continuation text lands, then the resume
    // error banner does too. `.or().toBeVisible()` throws in that case.
    await expect
      .poll(
        async () => (await banner.isVisible()) || (await reply.isVisible()),
        { timeout: 45_000 }
      )
      .toBe(true);

    await expect(banner).toHaveCount(0);

    const output = page.locator('[data-slot="tool-output"]');
    if (!(await output.isVisible())) {
      const worked = page.locator('[data-slot="worked-trigger"]');
      if ((await worked.count()) > 0) {
        await worked.first().click();
      }
    }
    await expect(page.locator('[data-slot="tool"]')).toBeVisible();
    await expect(output).toContainText(String(UPDATED_PRICE));

    const updated = await page.request.get(
      `/api/catalog/products/${product.id}`
    );
    expect(updated.ok()).toBe(true);
    expect(((await updated.json()) as { price: number }).price).toBe(
      UPDATED_PRICE
    );
  });
});
