import { SELF } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { createTestSessionWithOrg } from "../helpers/auth";

let cookie: string;

beforeEach(async () => {
  const session = await createTestSessionWithOrg();
  cookie = session.cookie;
});

const API = "http://localhost/api/catalog/products";

async function createProduct(body: object): Promise<{
  id: string;
  status: number;
}> {
  const res = await SELF.fetch(API, {
    method: "POST",
    headers: { Cookie: cookie, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { id: ((await res.json()) as { id: string }).id, status: res.status };
}

describe("GET /api/catalog/products", () => {
  it("returns empty paginated product list", async () => {
    const res = await SELF.fetch(API, {
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      data: unknown[];
      total: number;
      page: number;
      pageSize: number;
    };
    expect(data.data).toEqual([]);
    expect(data.total).toBe(0);
    expect(data.page).toBe(1);
    expect(data.pageSize).toBe(20);
  });

  it("returns created products in paginated response", async () => {
    await createProduct({ name: "Test Product" });

    const res = await SELF.fetch(API, {
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      data: { name: string }[];
      total: number;
    };
    expect(data.data).toHaveLength(1);
    expect(data.data[0].name).toBe("Test Product");
    expect(data.total).toBe(1);
  });

  it("supports pagination query params", async () => {
    for (const i of [1, 2, 3]) {
      await createProduct({ name: `Product ${i}` });
    }

    const res = await SELF.fetch(`${API}?page=1&pageSize=2`, {
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      data: unknown[];
      total: number;
      page: number;
      pageSize: number;
    };
    expect(data.data).toHaveLength(2);
    expect(data.total).toBe(3);
    expect(data.page).toBe(1);
    expect(data.pageSize).toBe(2);
  });

  it("filters by name and description via ?search=", async () => {
    await createProduct({ name: "Alpha Widget" });
    await createProduct({
      name: "Beta Gadget",
      description: "UNIQUE-DESC phrase",
    });

    const byName = await SELF.fetch(`${API}?search=Alpha`, {
      headers: { Cookie: cookie },
    });
    const nameData = (await byName.json()) as {
      data: { name: string }[];
      total: number;
    };
    expect(nameData.data).toHaveLength(1);
    expect(nameData.data[0].name).toBe("Alpha Widget");
    expect(nameData.total).toBe(1);

    const byDescription = await SELF.fetch(`${API}?search=UNIQUE-DESC`, {
      headers: { Cookie: cookie },
    });
    const descData = (await byDescription.json()) as {
      data: { name: string }[];
    };
    expect(descData.data).toHaveLength(1);
    expect(descData.data[0].name).toBe("Beta Gadget");
  });

  it("rejects an invalid query with 400", async () => {
    const res = await SELF.fetch(`${API}?pageSize=0`, {
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/catalog/products", () => {
  it("creates a product and returns 201 with the created row", async () => {
    const res = await SELF.fetch(API, {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "New Product",
        price: 2999,
      }),
    });
    expect(res.status).toBe(201);
    const data = (await res.json()) as {
      id: string;
      name: string;
      price: number;
    };
    expect(data.name).toBe("New Product");
    expect(data.price).toBe(2999);
    expect(data.id).toBeTruthy();
  });

  it("rejects invalid payload with 400", async () => {
    const res = await SELF.fetch(API, {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ name: "X" }), // Name too short
    });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/catalog/products/:id", () => {
  it("returns a specific product", async () => {
    const created = await createProduct({ name: "Find Me" });

    const res = await SELF.fetch(`${API}/${created.id}`, {
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { name: string };
    expect(data.name).toBe("Find Me");
  });

  it("returns 404 for a non-existent product", async () => {
    const res = await SELF.fetch(`${API}/non-existent`, {
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/catalog/products/:id", () => {
  it("partially updates a product, leaving absent fields intact", async () => {
    const created = await createProduct({
      name: "Original",
      description: "Keep me",
    });

    const res = await SELF.fetch(`${API}/${created.id}`, {
      method: "PATCH",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Updated" }),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      name: string;
      description: string | null;
    };
    expect(data.name).toBe("Updated");
    expect(data.description).toBe("Keep me");
  });

  it("returns 404 when updating a non-existent product", async () => {
    const res = await SELF.fetch(`${API}/non-existent`, {
      method: "PATCH",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Nope" }),
    });
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/catalog/products/:id", () => {
  it("deletes a product and returns 204 with no body", async () => {
    const created = await createProduct({ name: "Delete Me" });

    const deleteRes = await SELF.fetch(`${API}/${created.id}`, {
      method: "DELETE",
      headers: { Cookie: cookie },
    });
    expect(deleteRes.status).toBe(204);
    expect(await deleteRes.text()).toBe("");

    const getRes = await SELF.fetch(`${API}/${created.id}`, {
      headers: { Cookie: cookie },
    });
    expect(getRes.status).toBe(404);
  });

  it("returns 404 when deleting a non-existent product", async () => {
    const res = await SELF.fetch(`${API}/non-existent`, {
      method: "DELETE",
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(404);
  });
});
