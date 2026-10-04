import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import type { PaginationQuery } from "@workspace/contract/pagination";
import type { InferResponseType } from "hono/client";
import { apiErrorMessage, client } from "@/lib/client";
import { retryUnlessNotFound } from "@/lib/query";

/**
 * The outbound product row, inferred from the list endpoint's typed response
 * (ADR-004: reads are inferred from the implementation, never hand-mirrored).
 */
export type Product = InferResponseType<
  (typeof client.catalog.products)["$get"],
  200
>["data"][number];

/**
 * Root of every product key: `[orgId, "products", …]`. Org-scoped so a key can
 * never serve another org's catalog (an org switch drops the whole prefix).
 */
export const productsQueryKey = (organizationId: string) =>
  [organizationId, "products"] as const;

export const productQueryKey = (organizationId: string, id: string) =>
  [...productsQueryKey(organizationId), "detail", id] as const;

/** One page of the org's catalog (`?search=&page=&sortBy=…`). */
export function productsQueryOptions(
  organizationId: string,
  params: PaginationQuery
) {
  return queryOptions({
    queryKey: [...productsQueryKey(organizationId), "list", params] as const,
    queryFn: async () => {
      const res = await client.catalog.products.$get({
        query: {
          page: params.page.toString(),
          pageSize: params.pageSize.toString(),
          ...(params.sortBy && { sortBy: params.sortBy }),
          sortOrder: params.sortOrder,
          ...(params.search && { search: params.search }),
        },
      });
      if (!res.ok) {
        throw new Error(await apiErrorMessage(res, "Failed to load products"));
      }
      return res.json();
    },
    placeholderData: keepPreviousData,
  });
}

/** One product of the org; 404 stays terminal (no retry). */
export function productQueryOptions(organizationId: string, id: string) {
  return queryOptions({
    queryKey: productQueryKey(organizationId, id),
    queryFn: async () => {
      const res = await client.catalog.products[":id"].$get({
        param: { id },
      });
      if (res.status === 404) {
        throw new Error("Product not found");
      }
      if (!res.ok) {
        throw new Error(await apiErrorMessage(res, "Failed to load product"));
      }
      return res.json();
    },
    enabled: !!id,
    retry: retryUnlessNotFound,
  });
}

/** ⌘K catalog search over the org's products. */
export function catalogSearchQueryOptions(
  organizationId: string,
  query: string
) {
  return queryOptions({
    queryKey: [...productsQueryKey(organizationId), "search", query] as const,
    queryFn: async () => {
      const res = await client.catalog.products.$get({
        query: { search: query },
      });
      if (!res.ok) {
        throw new Error(await apiErrorMessage(res, "Catalog search failed"));
      }
      return res.json();
    },
  });
}
