import { SELF } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import { createTestSession, createTestSessionWithOrg } from "../helpers/auth";

/**
 * The `/agents/` gate (src/agent-gate.ts) runs inside `routeAgentRequest`'s
 * onBeforeConnect / onBeforeRequest hooks on the router's own URL parse, so
 * the parsed route — not a hand-rolled prefix match — decides. Covered here
 * through SELF (the test worker entry imports the same gate module as
 * src/server.ts): no session → 401; live membership in the target org →
 * through; any other org → 403 (including the `/agents//org-agent/<id>`
 * double-slash shape that bypassed the old startsWith gate); any other
 * namespace → 404. Both the WebSocket-upgrade and plain-HTTP hook paths.
 */

const member = {
  cookie: "",
  orgId: "",
};
const other = { cookie: "", orgId: "" };

beforeAll(async () => {
  const mine = await createTestSessionWithOrg({ orgName: "Gate Org" });
  member.cookie = mine.cookie;
  member.orgId = mine.orgId;
  const theirs = await createTestSessionWithOrg({ orgName: "Other Org" });
  other.cookie = theirs.cookie;
  other.orgId = theirs.orgId;
});

function get(url: string, cookie?: string) {
  return SELF.fetch(url, {
    headers: cookie ? { Cookie: cookie } : {},
    redirect: "manual",
  });
}

function wsUpgrade(url: string, cookie?: string) {
  return SELF.fetch(url, {
    headers: {
      Upgrade: "websocket",
      ...(cookie ? { Cookie: cookie } : {}),
    },
  });
}

describe("agent gate (plain HTTP path)", () => {
  it("401s without a session", async () => {
    const res = await get(`http://localhost/agents/org-agent/${member.orgId}`);
    expect(res.status).toBe(401);
  });

  it("admits a member of the target org (reaches the DO's default handler)", async () => {
    const res = await get(
      `http://localhost/agents/org-agent/${member.orgId}`,
      member.cookie
    );
    // Past the gate, the OrgAgent DO's default onRequest answers.
    expect(res.status).toBe(404);
    expect(await res.text()).toBe("Not implemented");
  });

  it("403s a member of another org", async () => {
    const res = await get(
      `http://localhost/agents/org-agent/${other.orgId}`,
      member.cookie
    );
    expect(res.status).toBe(403);
  });

  it("403s the double-slash path that bypassed the prefix gate", async () => {
    const res = await get(
      `http://localhost/agents//org-agent/${other.orgId}`,
      member.cookie
    );
    expect(res.status).toBe(403);
  });

  it("404s any non-OrgAgent namespace", async () => {
    const res = await get(
      "http://localhost/agents/test-counter/whatever",
      member.cookie
    );
    expect(res.status).toBe(404);
  });
});

describe("agent gate (WebSocket upgrade path)", () => {
  it("401s an upgrade without a session", async () => {
    const res = await wsUpgrade(
      `http://localhost/agents/org-agent/${member.orgId}`
    );
    expect(res.status).toBe(401);
  });

  it("403s an upgrade from a non-member", async () => {
    const res = await wsUpgrade(
      `http://localhost/agents/org-agent/${other.orgId}`,
      member.cookie
    );
    expect(res.status).toBe(403);
  });

  it("upgrades a member of the target org", async () => {
    const res = await wsUpgrade(
      `http://localhost/agents/org-agent/${member.orgId}`,
      member.cookie
    );
    try {
      expect(res.status).toBe(101);
      expect(res.webSocket).not.toBeNull();
    } finally {
      res.webSocket?.accept();
      res.webSocket?.close();
    }
  });
});

describe("agent gate (no active org)", () => {
  it("403s a signed-in user without membership in the target org", async () => {
    const { cookie } = await createTestSession();
    const res = await get(
      `http://localhost/agents/org-agent/${member.orgId}`,
      cookie
    );
    // Session ok, no membership in this org → 403 from the membership check.
    expect(res.status).toBe(403);
  });
});
