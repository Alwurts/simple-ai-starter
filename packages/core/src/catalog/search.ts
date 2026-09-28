import type { SearchResult } from "@workspace/contract/catalog";
import { db } from "@workspace/db";
import { products } from "@workspace/db/schema";
import { and, eq, like, or } from "drizzle-orm";

export const searchCatalog = async (
  orgId: string,
  query: string
): Promise<SearchResult[]> => {
  const searchPattern = `%${query}%`;

  const productResults = await db
    .select({
      id: products.id,
      name: products.name,
      description: products.description,
    })
    .from(products)
    .where(
      and(
        eq(products.organizationId, orgId),
        or(
          like(products.name, searchPattern),
          like(products.description, searchPattern)
        )
      )
    )
    .limit(10);

  return productResults.map((p) => ({
    path: `/catalog/${p.id}`,
    snippet: p.description || p.name,
    score: 1.0,
    metadata: {
      type: "product" as const,
      id: p.id,
      title: p.name,
      description: p.description,
    },
  }));
};
