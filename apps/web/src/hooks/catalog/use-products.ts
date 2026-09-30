"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  createProductSchema,
  updateProductSchema,
} from "@workspace/contract/catalog";
import type { PaginationQuery } from "@workspace/contract/pagination";
import { toast } from "@workspace/ui/components/shadcn/sonner";
import type { z } from "zod";
import { useActiveOrganizationId } from "@/hooks/organization/use-organization";
import {
  type Product,
  productQueryKey,
  productQueryOptions,
  productsQueryKey,
  productsQueryOptions,
} from "@/lib/catalog/product-queries";
import { apiErrorMessage, client } from "@/lib/client";

export type { Product } from "@/lib/catalog/product-queries";

export const useProducts = (params: PaginationQuery) => {
  const organizationId = useActiveOrganizationId();
  return useQuery({
    ...productsQueryOptions(organizationId ?? "", params),
    enabled: !!organizationId,
  });
};

export const useProduct = (id: string) => {
  const organizationId = useActiveOrganizationId();
  return useQuery({
    ...productQueryOptions(organizationId ?? "", id),
    enabled: !!id && !!organizationId,
  });
};

export const useCreateProduct = () => {
  const queryClient = useQueryClient();
  const organizationId = useActiveOrganizationId();
  return useMutation({
    mutationFn: async (data: z.infer<typeof createProductSchema>) => {
      const res = await client.catalog.products.$post({
        json: data,
      });
      if (!res.ok) {
        throw new Error(await apiErrorMessage(res, "Failed to create product"));
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: productsQueryKey(organizationId ?? ""),
      });
      toast.success("Product created");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
};

export const useUpdateProduct = () => {
  const queryClient = useQueryClient();
  const organizationId = useActiveOrganizationId();
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
        throw new Error(await apiErrorMessage(res, "Failed to update product"));
      }
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: productsQueryKey(organizationId ?? ""),
      });
      queryClient.invalidateQueries({
        queryKey: productQueryKey(organizationId ?? "", variables.id),
      });
      toast.success("Product updated");
    },
    onError: (error) => {
      toast.error(error.message);
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
  const organizationId = useActiveOrganizationId();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await client.catalog.products[":id"].$delete({
        param: { id },
      });
      if (!res.ok) {
        throw new Error(await apiErrorMessage(res, "Failed to delete product"));
      }
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({
        queryKey: productsQueryKey(organizationId ?? ""),
      });

      const previousLists = queryClient.getQueriesData<PaginatedProducts>({
        queryKey: [...productsQueryKey(organizationId ?? ""), "list"],
      });

      queryClient.setQueriesData<PaginatedProducts>(
        { queryKey: [...productsQueryKey(organizationId ?? ""), "list"] },
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
    onError: (error, _id, context) => {
      if (context?.previousLists) {
        for (const [queryKey, data] of context.previousLists) {
          queryClient.setQueryData(queryKey, data);
        }
      }
      toast.error(error.message);
    },
    onSuccess: () => {
      toast.success("Product deleted");
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: productsQueryKey(organizationId ?? ""),
      });
    },
  });
};
