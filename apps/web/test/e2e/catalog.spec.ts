import { expect, test } from "@playwright/test";
import { fillValue, waitHydrated } from "./helpers";

const CATALOG_DETAIL_URL_PATTERN = /\/catalog\/.+/;

test.describe("catalog products", () => {
  const productName = `E2E Product ${Date.now()}`;

  test("can create a product", async ({ page }) => {
    await page.goto("/catalog");
    await waitHydrated(page);

    // Open the create product dialog
    await page.getByRole("button", { name: "Add Product" }).click();
    await expect(
      page.getByRole("heading", { name: "Add New Product" })
    ).toBeVisible({ timeout: 10_000 });

    // Fill the product form
    await fillValue(page.locator("input#name"), productName);
    await fillValue(page.locator("input#price"), "29.99");
    await fillValue(page.locator("textarea#description"), "An e2e product");

    // Submit — the dialog's submit shares the toolbar button's name
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Add Product" })
      .click();

    // Verify the product appears in the table
    await expect(page.getByText(productName)).toBeVisible({
      timeout: 10_000,
    });
  });

  test("can view product details", async ({ page }) => {
    // First create a product to ensure one exists
    const detailProductName = `Detail Product ${Date.now()}`;

    await page.goto("/catalog");
    await waitHydrated(page);

    await page.getByRole("button", { name: "Add Product" }).click();
    await expect(
      page.getByRole("heading", { name: "Add New Product" })
    ).toBeVisible({ timeout: 10_000 });

    await fillValue(page.locator("input#name"), detailProductName);
    await fillValue(page.locator("input#price"), "15.00");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Add Product" })
      .click();

    // Wait for the product to appear, then click its name
    await expect(page.getByText(detailProductName)).toBeVisible({
      timeout: 10_000,
    });
    await page.getByRole("link", { name: detailProductName }).click();

    // Verify we're on the product detail page
    await expect(page).toHaveURL(CATALOG_DETAIL_URL_PATTERN);
    await expect(page.getByText(detailProductName)).toBeVisible();
  });
});
