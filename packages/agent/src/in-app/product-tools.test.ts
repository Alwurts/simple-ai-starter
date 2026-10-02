import { DomainError } from "@workspace/core/errors";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PERMISSION_DENIED_MESSAGE } from "../constants";
import {
  getProductPart,
  updateProductPart,
} from "../tool-parts/catalog/products";
import { inAppTool } from "./in-app-tool";

vi.mock("@workspace/core/catalog", () => ({
  getProduct: vi.fn(),
  getProducts: vi.fn(),
  createProduct: vi.fn(),
  updateProduct: vi.fn(),
  deleteProduct: vi.fn(),
  resolveProductRef: vi.fn(),
}));

vi.mock("../tools/guard", () => ({
  assertCan: vi.fn(),
}));

import {
  getProduct,
  resolveProductRef,
  updateProduct,
} from "@workspace/core/catalog";
import { assertCan } from "../tools/guard";

const ctx = {
  organizationId: "org_test",
  userId: "user_test",
};

const readOnlyCtx = {
  organizationId: "org_test",
  userId: "",
};

interface ExecutableTool {
  execute: (input: Record<string, unknown>) => Promise<unknown>;
}

function runTool(
  tool: unknown,
  input: Record<string, unknown>
): Promise<unknown> {
  const executable = tool as ExecutableTool;
  if (!executable.execute) {
    throw new Error("tool has no execute");
  }
  return executable.execute(input);
}

describe("product tools — thrown errors, no result envelope", () => {
  beforeEach(() => {
    vi.mocked(assertCan).mockResolvedValue(undefined);
  });

  it("get_product returns the product on a hit", async () => {
    const product = { id: "prod_1", name: "Widget" };
    vi.mocked(getProduct).mockResolvedValue(product as never);

    const getProductTool = inAppTool(readOnlyCtx)(getProductPart);
    const result = await runTool(getProductTool, { id: "prod_1" });

    expect(result).toEqual(product);
  });

  it("get_product throws DomainError not_found on a miss", async () => {
    vi.mocked(getProduct).mockResolvedValue(undefined as never);

    const getProductTool = inAppTool(readOnlyCtx)(getProductPart);
    await expect(
      runTool(getProductTool, { id: "prod_missing" })
    ).rejects.toThrow(
      new DomainError("Product not found: prod_missing", "not_found")
    );
  });

  it("update_product returns the updated row and is approval-gated", async () => {
    const product = { id: "prod_1", name: "Widget" };
    const updated = { ...product, name: "Widget Pro" };
    vi.mocked(resolveProductRef).mockResolvedValue(product as never);
    vi.mocked(updateProduct).mockResolvedValue(updated as never);

    expect(updateProductPart.needsApproval).toBe(true);
    const updateProductTool = inAppTool(ctx)(updateProductPart);
    const result = await runTool(updateProductTool, {
      id: "Widget",
      data: { name: "Widget Pro" },
    });

    expect(result).toEqual(updated);
  });

  it("update_product throws DomainError when the ref misses", async () => {
    vi.mocked(resolveProductRef).mockRejectedValue(
      new DomainError(
        'Product not found: no match for id or name "missing"',
        "not_found"
      )
    );

    const updateProductTool = inAppTool(ctx)(updateProductPart);
    await expect(
      runTool(updateProductTool, {
        id: "missing",
        data: { name: "Nope" },
      })
    ).rejects.toThrow(
      new DomainError(
        'Product not found: no match for id or name "missing"',
        "not_found"
      )
    );
  });

  it("update_product throws the permission message on RBAC deny", async () => {
    vi.mocked(assertCan).mockRejectedValue(
      new Error(PERMISSION_DENIED_MESSAGE)
    );

    const updateProductTool = inAppTool(ctx)(updateProductPart);
    await expect(
      runTool(updateProductTool, {
        id: "prod_1",
        data: { name: "Nope" },
      })
    ).rejects.toThrow(PERMISSION_DENIED_MESSAGE);
  });
});
