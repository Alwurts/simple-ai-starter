import { exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { createTestSession } from "../helpers/auth";

describe("auth enforcement", () => {
  it("returns 401 on protected routes without session", async () => {
    const res = await exports.default.fetch(
      "http://localhost/api/chat/capabilities"
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 on org-protected routes without active org", async () => {
    // Create session without org
    const { cookie } = await createTestSession();
    const res = await exports.default.fetch(
      "http://localhost/api/catalog/products",
      {
        headers: { Cookie: cookie },
      }
    );
    expect(res.status).toBe(403);
  });

  it("returns capabilities on /api/chat/capabilities with valid session", async () => {
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
