import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import {
  createTestSession,
  createTestSessionWithOrg,
  ORIGIN,
} from "../helpers/auth";

/**
 * Invitation lookup goes through better-auth's built-in
 * `/organization/get-invitation`, which checks recipient + pending + expiry
 * before returning anything. The custom REST route it replaces returned any
 * invitation (including the inviter's user row) to any signed-in user.
 */

function authPost(url: string, body: object, cookie?: string) {
  return SELF.fetch(url, {
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

function getInvitation(id: string, cookie: string) {
  return SELF.fetch(`${ORIGIN}/api/auth/organization/get-invitation?id=${id}`, {
    headers: { Cookie: cookie },
  });
}

async function invite(email: string, ownerCookie: string): Promise<string> {
  const res = await authPost(
    `${ORIGIN}/api/auth/organization/invite-member`,
    { email, role: "member" },
    ownerCookie
  );
  expect(res.ok).toBe(true);
  return ((await res.json()) as { id: string }).id;
}

describe("invitation lookup (better-auth get-invitation)", () => {
  it("lets the invitee read their pending invitation", async () => {
    const owner = await createTestSessionWithOrg({ orgName: "Invite Org" });
    const invitee = await createTestSession();

    const id = await invite(invitee.email, owner.cookie);
    const res = await getInvitation(id, invitee.cookie);
    expect(res.ok).toBe(true);
    const data = (await res.json()) as {
      email: string;
      status: string;
      organizationName: string;
      inviterEmail: string;
    };
    expect(data.email).toBe(invitee.email);
    expect(data.status).toBe("pending");
    expect(data.organizationName).toBe("Invite Org");
    expect(data.inviterEmail).toBe(owner.email);
  });

  it("errors for another signed-in user who is not the recipient", async () => {
    const owner = await createTestSessionWithOrg({ orgName: "Invite Org 2" });
    const invitee = await createTestSession();
    const outsider = await createTestSession();

    const id = await invite(invitee.email, owner.cookie);
    const res = await getInvitation(id, outsider.cookie);
    expect(res.ok).toBe(false);
  });

  it("errors once the invitation is no longer pending", async () => {
    const owner = await createTestSessionWithOrg({ orgName: "Invite Org 3" });
    const invitee = await createTestSession();

    const id = await invite(invitee.email, owner.cookie);
    const acceptRes = await authPost(
      `${ORIGIN}/api/auth/organization/accept-invitation`,
      { invitationId: id },
      invitee.cookie
    );
    expect(acceptRes.ok).toBe(true);

    const res = await getInvitation(id, invitee.cookie);
    expect(res.ok).toBe(false);
  });
});
