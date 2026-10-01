import { db } from "@workspace/db";
// biome-ignore lint/performance/noNamespaceImport: Schema barrel export
import * as schema from "@workspace/db/schema";

/**
 * Seed helpers for the workerd tests: real inserts through the `db` singleton
 * against the per-test D1, returning the inserted row. A missing return row
 * is a broken seed, so each helper throws rather than handing back undefined.
 */

export async function seedUser(
  overrides?: Partial<typeof schema.user.$inferInsert>
) {
  const id = overrides?.id ?? crypto.randomUUID();
  const rows = await db
    .insert(schema.user)
    .values({
      id,
      name: "Test User",
      email: `${id}@test.com`,
      emailVerified: true,
      ...overrides,
    })
    .returning();
  const user = rows[0];
  if (!user) {
    throw new Error("seedUser: insert returned no row");
  }
  return user;
}

export async function seedOrganization(
  userId: string,
  overrides?: Partial<typeof schema.organization.$inferInsert>
) {
  const orgId = overrides?.id ?? crypto.randomUUID();
  const rows = await db
    .insert(schema.organization)
    .values({
      id: orgId,
      name: "Test Org",
      slug: `test-org-${orgId.slice(0, 8)}`,
      ...overrides,
    })
    .returning();
  const org = rows[0];
  if (!org) {
    throw new Error("seedOrganization: insert returned no row");
  }

  await db.insert(schema.member).values({
    id: crypto.randomUUID(),
    organizationId: orgId,
    userId,
    role: "owner",
  });

  return org;
}

export async function seedProduct(
  orgId: string,
  overrides?: Partial<typeof schema.products.$inferInsert>
) {
  const rows = await db
    .insert(schema.products)
    .values({
      organizationId: orgId,
      name: "Test Product",
      price: 1999,
      ...overrides,
    })
    .returning();
  const product = rows[0];
  if (!product) {
    throw new Error("seedProduct: insert returned no row");
  }
  return product;
}
