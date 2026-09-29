"use client";

import { Link } from "@tanstack/react-router";
import { Skeleton } from "@workspace/ui/components/shadcn/skeleton";
import { memo } from "react";
import { useProduct } from "@/hooks/use-products";

interface DisplayProductListOutput {
  productIds?: string[];
}

/** Card renderer for the `display_product_list` UI-echo tool. */
function ProductRow({ productId }: { productId: string }) {
  const { data: product, isLoading, isError } = useProduct(productId);

  if (isLoading) {
    return (
      <div className="flex min-w-0 items-center gap-2 px-3 py-2">
        <Skeleton className="h-4 min-w-0 flex-1" />
        <Skeleton className="h-4 w-16 shrink-0" />
      </div>
    );
  }

  if (isError || !product) {
    return (
      <div className="px-3 py-2 text-muted-foreground text-sm">
        Product not found ({productId})
      </div>
    );
  }

  return (
    <Link
      className="flex min-w-0 items-center gap-2 px-3 py-2 hover:bg-muted/50"
      params={{ id: product.id }}
      to="/catalog/$id"
    >
      <span className="min-w-0 flex-1 truncate font-medium">
        {product.name}
      </span>
    </Link>
  );
}

export const ProductListCard = memo(({ output }: { output?: unknown }) => {
  const productIds =
    (output as DisplayProductListOutput | undefined)?.productIds ?? [];

  if (productIds.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">No products to display.</p>
    );
  }

  return (
    <div className="divide-y rounded-md border bg-card text-sm">
      {productIds.map((productId) => (
        <ProductRow key={productId} productId={productId} />
      ))}
    </div>
  );
});

ProductListCard.displayName = "ProductListCard";
