import { getOrgAgentReadOnlyTools, getOrgAgentTools } from "@workspace/agent";
import { db } from "@workspace/db";
import { member, organization, products, user } from "@workspace/db/schema";
import { describe, expect, it } from "vitest";

const MUTATING_TOOL_NAME = /create|update|delete|write|void|reverse/;

async function seedOrgWithProduct(name: string, productName: string) {
  const userId = crypto.randomUUID();
  const orgId = crypto.randomUUID();
  await db.insert(user).values({
    id: userId,
    name: "Test User",
    email: `${userId}@test.com`,
    emailVerified: true,
  });
  await db
    .insert(organization)
    .values({ id: orgId, name, slug: `test-org-${orgId.slice(0, 8)}` });
  await db.insert(member).values({
    id: crypto.randomUUID(),
    organizationId: orgId,
    userId,
    role: "owner",
  });
  const [product] = await db
    .insert(products)
    .values({ organizationId: orgId, name: productName })
    .returning();
  return { orgId, product };
}

/**
 * The delegation sub-agent (`OrgSubAgent`) is deliberately read-only.
 * It runs without an acting user, so it must never receive a tool that mutates
 * data. These tests lock that invariant on the composition it is built from, so
 * a future write tool added to the read-only reach fails here (not in prod).
 *
 * The live sub-agent turn itself needs a real facet + model and is verified in
 * `pnpm dev` (the harness can't spawn facets — see org-agent.workerd.test.ts).
 */
describe("OrgSubAgent read-only tool composition", () => {
  const ctx = { organizationId: "org_test" };

  it("exposes exactly the read-only product tools", () => {
    const tools = getOrgAgentReadOnlyTools(ctx);
    const names = Object.keys(tools).sort();
    expect(names).toEqual(["get_product", "list_products"]);
  });

  it("never includes a mutating tool", () => {
    const names = Object.keys(getOrgAgentReadOnlyTools(ctx));
    for (const name of names) {
      expect(name).not.toMatch(MUTATING_TOOL_NAME);
    }
  });

  it("is a strict subset of the full org tool reach", () => {
    // The full (parent OrgChat) reach needs an acting user for its write tools.
    const full = getOrgAgentTools({
      organizationId: "org_test",
      userId: "user_test",
    });
    const readOnly = getOrgAgentReadOnlyTools(ctx);
    for (const name of Object.keys(readOnly)) {
      expect(full).toHaveProperty(name);
    }
    // And the full reach really does carry writes the read-only set drops.
    expect(Object.keys(full)).toContain("create_product");
    expect(Object.keys(full)).toContain("update_product");
    expect(Object.keys(full)).toContain("delete_product");
    expect(getOrgAgentReadOnlyTools(ctx)).not.toHaveProperty("create_product");
    expect(getOrgAgentReadOnlyTools(ctx)).not.toHaveProperty("update_product");
    expect(getOrgAgentReadOnlyTools(ctx)).not.toHaveProperty("delete_product");
  });

  it("read executions only see the given org's products", async () => {
    const mine = await seedOrgWithProduct("Org Mine", "My Product");
    const other = await seedOrgWithProduct("Org Other", "Other Product");
    if (!other.product) {
      throw new Error("seed failed");
    }

    const tools = getOrgAgentReadOnlyTools({ organizationId: mine.orgId });
    const exec = (name: string) => {
      const tool = tools[name] as unknown as {
        execute?: (input: unknown) => Promise<unknown>;
      };
      if (!tool.execute) {
        throw new Error(`tool "${name}" has no execute`);
      }
      return tool.execute;
    };

    const list = (await exec("list_products")({})) as {
      ok: boolean;
      data?: Array<{ name: string }>;
    };
    expect(list.ok).toBe(true);
    expect((list.data ?? []).map((p) => p.name)).toEqual(["My Product"]);

    const getResult = (await exec("get_product")({
      id: other.product.id,
    })) as { ok: boolean };
    expect(getResult.ok).toBe(false);
  });
});
