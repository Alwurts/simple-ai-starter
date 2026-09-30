import { zValidator } from "@hono/zod-validator";
import {
  createProductSchema,
  updateProductSchema,
} from "@workspace/contract/catalog";
import { paginationQuerySchema } from "@workspace/contract/pagination";
import {
  createProduct,
  deleteProduct,
  getPaginatedProducts,
  getProduct,
  updateProduct,
} from "@workspace/core/catalog";
import { DomainError } from "@workspace/core/errors";
import { Hono } from "hono";
import { z } from "zod";
import { validationErrorHook } from "../../middleware/error-handler";
import { requirePermission } from "../../middleware/organization";
import type { HonoContextWithAuthAndOrg } from "../../types";

const productIdSchema = z.object({
  id: z.string(),
});

export const productsRoutes = new Hono<HonoContextWithAuthAndOrg>()
  .get(
    "/",
    zValidator("query", paginationQuerySchema, validationErrorHook),
    async (c) => {
      const orgId = c.get("session").activeOrganizationId;
      const params = c.req.valid("query");
      const data = await getPaginatedProducts(orgId, params);
      return c.json(data);
    }
  )
  .get(
    "/:id",
    zValidator("param", productIdSchema, validationErrorHook),
    async (c) => {
      const orgId = c.get("session").activeOrganizationId;
      const { id } = c.req.valid("param");
      const data = await getProduct(id, orgId);
      if (!data) {
        throw new DomainError(`Product not found: ${id}`, "not_found");
      }
      return c.json(data);
    }
  )
  .post(
    "/",
    requirePermission("catalog:write"),
    zValidator("json", createProductSchema, validationErrorHook),
    async (c) => {
      const orgId = c.get("session").activeOrganizationId;
      const body = c.req.valid("json");
      const result = await createProduct({ ...body, orgId });
      return c.json(result[0], 201);
    }
  )
  .patch(
    "/:id",
    requirePermission("catalog:write"),
    zValidator("param", productIdSchema, validationErrorHook),
    zValidator("json", updateProductSchema, validationErrorHook),
    async (c) => {
      const orgId = c.get("session").activeOrganizationId;
      const { id } = c.req.valid("param");
      const body = c.req.valid("json");
      const result = await updateProduct(id, orgId, body);
      return c.json(result);
    }
  )
  .delete(
    "/:id",
    requirePermission("catalog:write"),
    zValidator("param", productIdSchema, validationErrorHook),
    async (c) => {
      const orgId = c.get("session").activeOrganizationId;
      const { id } = c.req.valid("param");
      await deleteProduct(id, orgId);
      return c.body(null, 204);
    }
  );
