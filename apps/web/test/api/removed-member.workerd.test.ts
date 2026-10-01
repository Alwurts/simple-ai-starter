import { exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import {
  createTestSession,
  createTestSessionWithOrg,
  ORIGIN,
} from "../helpers/auth";

/**
 * A member removed by an admin keeps their session's
 * `activeOrganizationId` (better-auth only clears it on self-removal), so
 * org access must come from the live `member` row — not the session stamp.
 * After `remove-member`, every org-scoped surface (REST + agent gate) 403s.
 */

const PRODUCTS_API = "http://localhost/api/catalog/products";

function authPost(url: string, body: object, cookie?: string) {
  return exports.default.fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: ORIGIN,
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify(body),
    redirect: "manual",
  });
}

describe("removed members lose org access", () => {
  it("403s the products list, product by id, after remove-member", async () => {
    const owner = await createTestSessionWithOrg({ orgName: "Removal Org" });
    const invitee = await createTestSession();

    const inviteRes = await authPost(
      `${ORIGIN}/api/auth/organization/invite-member`,
      { email: invitee.email, role: "member" },
      owner.cookie
    );
    expect(inviteRes.ok).toBe(true);
    const invitation = (await inviteRes.json()) as { id: string };

    const acceptRes = await authPost(
      `${ORIGIN}/api/auth/organization/accept-invitation`,
      { invitationId: invitation.id },
      invitee.cookie
    );
    expect(acceptRes.ok).toBe(true);

    const createRes = await exports.default.fetch(PRODUCTS_API, {
      method: "POST",
      headers: {
        Cookie: owner.cookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "Still there" }),
    });
    const created = (await createRes.json()) as { id: string };

    // Membership is live here, so reads work before removal.
    const before = await exports.default.fetch(
      `${PRODUCTS_API}/${created.id}`,
      {
        headers: { Cookie: invitee.cookie },
      }
    );
    expect(before.status).toBe(200);

    const removeRes = await authPost(
      `${ORIGIN}/api/auth/organization/remove-member`,
      { memberIdOrEmail: invitee.email },
      owner.cookie
    );
    expect(removeRes.ok).toBe(true);

    const list = await exports.default.fetch(PRODUCTS_API, {
      headers: { Cookie: invitee.cookie },
    });
    expect(list.status).toBe(403);

    const byId = await exports.default.fetch(`${PRODUCTS_API}/${created.id}`, {
      headers: { Cookie: invitee.cookie },
    });
    expect(byId.status).toBe(403);

    // The org agent's DO is org-scoped by the same membership check.
    const orgRes = await exports.default.fetch(
      `http://localhost/agents/org-agent/${owner.orgId}`,
      { headers: { Cookie: invitee.cookie } }
    );
    expect(orgRes.status).toBe(403);
  });
});
