import {
  createProductSchema,
  updateProductSchema,
} from "@workspace/contract/catalog";
import {
  createProduct,
  deleteProduct,
  getProduct,
  getProducts,
  resolveProductRef,
  updateProduct,
} from "@workspace/core/catalog";
import { z } from "zod";
import type { ToolPart } from "../../in-app/in-app-tool";
import { assertCan } from "../../tools/guard";
import { requireFound } from "../../tools/tool-result";
import type { ToolContext } from "../context";

const productRefSchema = z
  .string()
  .describe("Product id (ULID), or exact product name");

const listProductsInputSchema = z.object({});

export const listProducts: ToolPart<typeof listProductsInputSchema> = {
  name: "list_products",
  description: "List all of this organization's products.",
  inputSchema: listProductsInputSchema,
  execute: async (ctx: ToolContext) => getProducts(ctx.organizationId),
};

const getProductInputSchema = z.object({ id: z.string() });

export const getProductPart: ToolPart<typeof getProductInputSchema> = {
  name: "get_product",
  description: "Get details of a specific product by ID.",
  inputSchema: getProductInputSchema,
  execute: async (ctx, input) =>
    requireFound(
      await getProduct(input.id, ctx.organizationId),
      `Product not found: ${input.id}`
    ),
};

export const createProductPart: ToolPart<typeof createProductSchema> = {
  name: "create_product",
  description: "Create a new catalog product.",
  inputSchema: createProductSchema,
  execute: async (ctx, input) => {
    await assertCan("catalog:write", ctx);
    const result = await createProduct({
      ...input,
      orgId: ctx.organizationId,
    });
    return result[0];
  },
};

const updateProductInputSchema = z.object({
  id: productRefSchema,
  data: updateProductSchema,
});

export const updateProductPart: ToolPart<typeof updateProductInputSchema> = {
  name: "update_product",
  description: "Update an existing product. Requires explicit user approval.",
  inputSchema: updateProductInputSchema,
  needsApproval: true,
  execute: async (ctx, input) => {
    await assertCan("catalog:write", ctx);
    const product = await resolveProductRef(ctx.organizationId, input.id);
    return updateProduct(product.id, ctx.organizationId, input.data);
  },
};

const deleteProductInputSchema = z.object({ id: productRefSchema });

export const deleteProductPart: ToolPart<typeof deleteProductInputSchema> = {
  name: "delete_product",
  description: "Delete a product. Requires explicit user approval.",
  inputSchema: deleteProductInputSchema,
  needsApproval: true,
  execute: async (ctx, input) => {
    await assertCan("catalog:write", ctx);
    const product = await resolveProductRef(ctx.organizationId, input.id);
    return deleteProduct(product.id, ctx.organizationId);
  },
};

/** Every product tool, in chat order. Read-only surfaces slice this. */
export const productToolParts = [
  listProducts,
  getProductPart,
  createProductPart,
  updateProductPart,
  deleteProductPart,
] as const;

export const productReadToolParts = [listProducts, getProductPart] as const;
