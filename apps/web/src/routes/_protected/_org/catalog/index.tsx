import { createFileRoute } from "@tanstack/react-router";
import { paginationQuerySchema } from "@workspace/contract/pagination";
import { CatalogPage } from "@/components/catalog/catalog-page";

export const Route = createFileRoute("/_protected/_org/catalog/")({
  component: CatalogPage,
  validateSearch: paginationQuerySchema,
});
