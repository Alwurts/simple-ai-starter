import { createFileRoute } from "@tanstack/react-router";
import { ProductPage } from "@/components/catalog/product-page";

export const Route = createFileRoute("/_protected/_org/catalog/$id")({
  component: ProductPage,
});
