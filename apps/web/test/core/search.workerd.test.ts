import { beforeEach, describe, expect, it } from "vitest";
import { seedOrganization, seedProduct, seedUser } from "../helpers/seed";

let orgId: string;

beforeEach(async () => {
  const user = await seedUser();
  const org = await seedOrganization(user.id);
  orgId = org.id;
});

describe("searchCatalog", () => {
  it("returns empty results for unmatched query", async () => {
    await seedProduct(orgId, { name: "Widget" });
    const { searchCatalog } = await import("@workspace/core/catalog");
    const results = await searchCatalog(orgId, "xyznonexistent");
    expect(results).toHaveLength(0);
  });

  it("finds products by name", async () => {
    await seedProduct(orgId, { name: "Blue Widget" });
    await seedProduct(orgId, { name: "Red Gadget" });

    const { searchCatalog } = await import("@workspace/core/catalog");
    const results = await searchCatalog(orgId, "Widget");
    expect(results).toHaveLength(1);
    expect(results[0].metadata.title).toBe("Blue Widget");
    expect(results[0].metadata.type).toBe("product");
  });

  it("finds products by description", async () => {
    await seedProduct(orgId, {
      name: "Some Product",
      description: "UNIQUE-DESC phrase",
    });

    const { searchCatalog } = await import("@workspace/core/catalog");
    const results = await searchCatalog(orgId, "UNIQUE-DESC");
    expect(results).toHaveLength(1);
    expect(results[0].metadata.description).toBe("UNIQUE-DESC phrase");
  });

  it("does not return products from other orgs", async () => {
    const otherUser = await seedUser();
    const otherOrg = await seedOrganization(otherUser.id);
    await seedProduct(otherOrg.id, { name: "Secret Widget" });

    const { searchCatalog } = await import("@workspace/core/catalog");
    const results = await searchCatalog(orgId, "Secret");
    expect(results).toHaveLength(0);
  });

  it("limits results to 10", async () => {
    for (let i = 0; i < 12; i++) {
      await seedProduct(orgId, {
        name: `Bulk Product ${i}`,
      });
    }

    const { searchCatalog } = await import("@workspace/core/catalog");
    const results = await searchCatalog(orgId, "Bulk");
    expect(results).toHaveLength(10);
  });

  it("performs case-insensitive search", async () => {
    await seedProduct(orgId, { name: "UPPERCASE WIDGET" });

    const { searchCatalog } = await import("@workspace/core/catalog");
    const results = await searchCatalog(orgId, "uppercase");
    expect(results).toHaveLength(1);
  });
});
