"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useActiveOrganizationId } from "@/hooks/organization/use-organization";
import { catalogSearchQueryOptions } from "@/lib/catalog/product-queries";

/** Below this the ⌘K query is noise. */
export const CATALOG_SEARCH_MIN_QUERY = 2;

export function useCatalogSearch(query: string, enabled: boolean) {
  const organizationId = useActiveOrganizationId();
  const trimmed = query.trim();

  return useQuery({
    ...catalogSearchQueryOptions(organizationId ?? "", trimmed),
    enabled:
      enabled && !!organizationId && trimmed.length >= CATALOG_SEARCH_MIN_QUERY,
    placeholderData: keepPreviousData,
  });
}
