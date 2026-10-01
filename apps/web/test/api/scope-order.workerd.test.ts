import { exports } from "cloudflare:workers";
import { Hono } from "hono";
import { beforeAll, describe, expect, it } from "vitest";
import { extractAuth } from "../../src/api/middleware/session";
import { withAuth } from "../../src/api/protected";
import type { HonoContext, HonoContextWithAuth } from "../../src/api/types";
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
    const res = await exports.default.fetch("http://localhost/api/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});

describe("scope order: protected", () => {
  it("GET /api/chat/capabilities 401s without a session", async () => {
    const res = await exports.default.fetch(
      "http://localhost/api/chat/capabilities"
    );
    expect(res.status).toBe(401);
    const body = (await res.json()) as {
      error: { code: string; message: string };
    };
    expect(body.error.code).toBe("unauthorized");
    expect(body.error.message).toBeTruthy();
  });

  it("GET /api/chat/capabilities serves a signed-in user", async () => {
    const { cookie } = await createTestSession();
    const res = await exports.default.fetch(
      "http://localhost/api/chat/capabilities",
      {
        headers: { Cookie: cookie },
      }
    );
    expect(res.status).toBe(200);
  });
});

describe("scope order: org-protected", () => {
  it("GET /api/catalog/products 403s a signed-in user with no membership", async () => {
    const { cookie } = await createTestSession();
    const res = await exports.default.fetch(
      "http://localhost/api/catalog/products",
      {
        headers: { Cookie: cookie },
      }
    );
    expect(res.status).toBe(403);
    const body = (await res.json()) as {
      error: { code: string; message: string };
    };
    expect(body.error.code).toBe("forbidden");
    expect(body.error.message).toBeTruthy();
  });

  it("GET /api/catalog/products serves a member", async () => {
    const res = await exports.default.fetch(
      "http://localhost/api/catalog/products",
      {
        headers: { Cookie: memberCookie },
      }
    );
    expect(res.status).toBe(200);
  });

  it("GET /api/catalog/products 401s an anonymous caller (auth runs before the org check)", async () => {
    const res = await exports.default.fetch(
      "http://localhost/api/catalog/products"
    );
    expect(res.status).toBe(401);
  });
});

describe("scope guard pattern (guard without a path string)", () => {
  // A resource mounted through the scope helper — no `use("/x/*", …)` path
  // anywhere — must be fully guarded, and the guard must not leak onto a
  // sibling mounted next to it.
  const probeApp = new Hono<HonoContext>()
    .use("*", extractAuth)
    .route(
      "/probe",
      withAuth(
        new Hono<HonoContextWithAuth>().get("/", (c) => c.json({ ok: true }))
      )
    )
    .route(
      "/sibling",
      new Hono<HonoContext>().get("/", (c) => c.json({ ok: true }))
    );

  it("401s an anonymous caller on the helper-mounted resource", async () => {
    const res = await probeApp.request("/probe");
    expect(res.status).toBe(401);
  });

  it("200s a signed-in caller on the same mount", async () => {
    const { cookie } = await createTestSession();
    const res = await probeApp.request("/probe", {
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(200);
  });

  it("does not leak the guard onto a sibling mounted next to it", async () => {
    const res = await probeApp.request("/sibling");
    expect(res.status).toBe(200);
  });
});
