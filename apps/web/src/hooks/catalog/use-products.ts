"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type {
  createProductSchema,
  updateProductSchema,
} from "@workspace/contract/catalog";
import type { PaginationQuery } from "@workspace/contract/pagination";
import { toast } from "@workspace/ui/components/shadcn/sonner";
import type { InferResponseType } from "hono/client";
import type { z } from "zod";
import { client } from "@/lib/client";
import { retryUnlessNotFound } from "@/lib/query";

/**
 * The outbound product row, inferred from the list endpoint's typed response
 * (ADR-004: reads are inferred from the implementation, never hand-mirrored).
 */
export type Product = InferResponseType<
  (typeof client.catalog.products)["$get"],
  200
>["data"][number];

export const getProductsKey = () => ["products"];
export const getProductsListKey = (params: PaginationQuery) => [
  "products",
  "list",
  params,
];
export const getProductKey = (id: string) => ["products", id];

export const useProducts = (params: PaginationQuery) =>
  useQuery({
    queryKey: getProductsListKey(params),
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
        throw new Error("Failed to load products");
      }
      return res.json();
    },
    placeholderData: keepPreviousData,
  });

export const useProduct = (id: string) =>
  useQuery({
    queryKey: getProductKey(id),
    queryFn: async () => {
      const res = await client.catalog.products[":id"].$get({
        param: { id },
      });
      if (!res.ok) {
        throw new Error("Product not found");
      }
      return res.json();
    },
    enabled: !!id,
    retry: retryUnlessNotFound,
  });

export const useCreateProduct = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: z.infer<typeof createProductSchema>) => {
      const res = await client.catalog.products.$post({
        json: data,
      });
      if (!res.ok) {
        throw new Error("Failed to create product");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getProductsKey() });
      toast.success("Product created");
    },
    onError: () => {
      toast.error("Failed to create product");
    },
  });
};

export const useUpdateProduct = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      id: string;
      data: z.infer<typeof updateProductSchema>;
    }) => {
      const res = await client.catalog.products[":id"].$patch({
        param: { id: params.id },
        json: params.data,
      });
      if (!res.ok) {
        throw new Error("Failed to update product");
      }
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: getProductsKey() });
      queryClient.invalidateQueries({ queryKey: getProductKey(variables.id) });
      toast.success("Product updated");
    },
    onError: () => {
      toast.error("Failed to update product");
    },
  });
};

interface PaginatedProducts {
  data: Product[];
  total: number;
  page: number;
  pageSize: number;
}

export const useDeleteProduct = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await client.catalog.products[":id"].$delete({
        param: { id },
      });
      if (!res.ok) {
        throw new Error("Failed to delete product");
      }
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: getProductsKey() });

      const previousLists = queryClient.getQueriesData<PaginatedProducts>({
        queryKey: ["products", "list"],
      });

      queryClient.setQueriesData<PaginatedProducts>(
        { queryKey: ["products", "list"] },
        (old) => {
          if (!old) {
            return old;
          }
          return {
            ...old,
            data: old.data.filter((p) => p.id !== id),
            total: old.total - 1,
          };
        }
      );

      return { previousLists };
    },
    onError: (_err, _id, context) => {
      if (context?.previousLists) {
        for (const [queryKey, data] of context.previousLists) {
          queryClient.setQueryData(queryKey, data);
        }
      }
      toast.error("Failed to delete product");
    },
    onSuccess: () => {
      toast.success("Product deleted");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: getProductsKey() });
    },
  });
};
