import { SELF } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import { createTestSession, createTestSessionWithOrg } from "../helpers/auth";

/**
 * Pins the scope mount order in api/index.ts (public -> protected ->
 * org-protected) with one route per scope. If a scope's guard stops running —
 * or starts running over another scope's routes — these statuses break.
 * The 401/403 bodies also pin the one error shape.
 */

let memberCookie: string;

beforeAll(async () => {
  const session = await createTestSessionWithOrg({ orgName: "Scope Org" });
  memberCookie = session.cookie;
});

describe("scope order: public", () => {
  it("GET /api/health serves anonymously", async () => {
    const res = await SELF.fetch("http://localhost/api/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});

describe("scope order: protected", () => {
  it("GET /api/chat/capabilities 401s without a session", async () => {
    const res = await SELF.fetch("http://localhost/api/chat/capabilities");
    expect(res.status).toBe(401);
    const body = (await res.json()) as {
      error: { code: string; message: string };
    };
    expect(body.error.code).toBe("unauthorized");
    expect(body.error.message).toBeTruthy();
  });

  it("GET /api/chat/capabilities serves a signed-in user", async () => {
    const { cookie } = await createTestSession();
    const res = await SELF.fetch("http://localhost/api/chat/capabilities", {
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(200);
  });
});

describe("scope order: org-protected", () => {
  it("GET /api/catalog/products 403s a signed-in user with no membership", async () => {
    const { cookie } = await createTestSession();
    const res = await SELF.fetch("http://localhost/api/catalog/products", {
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as {
      error: { code: string; message: string };
    };
    expect(body.error.code).toBe("forbidden");
    expect(body.error.message).toBeTruthy();
  });

  it("GET /api/catalog/products serves a member", async () => {
    const res = await SELF.fetch("http://localhost/api/catalog/products", {
      headers: { Cookie: memberCookie },
    });
    expect(res.status).toBe(200);
  });

  it("GET /api/catalog/products 401s an anonymous caller (auth runs before the org check)", async () => {
    const res = await SELF.fetch("http://localhost/api/catalog/products");
    expect(res.status).toBe(401);
  });
});
