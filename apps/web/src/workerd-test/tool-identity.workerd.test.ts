import { getOrgAgentTools } from "@workspace/agent";
import { PERMISSION_DENIED_MESSAGE } from "@workspace/agent/constants";
import { OrgChat } from "@workspace/agent/org/chat";
import { db } from "@workspace/db";
import { member, organization, user } from "@workspace/db/schema";
import { describe, expect, it } from "vitest";

/**
 * Turn/approval identity (S3): a tool run executes as the user of the
 * connection that started the turn or sent the approval — not "some live
 * connection". The old implementation kept one `turnUserId` overwritten by
 * every onConnect and fell back to scanning all connections, so a viewer's
 * turn could run write tools with the last-connected admin's identity.
 *
 * Driven on a bare OrgChat prototype instance (the established seam — see
 * compaction/org-chat-context tests): `turnUserId` plays the per-turn stamp,
 * and a fake owner connection stays attached the whole time — the removed
 * fallback would have picked it and made these writes succeed.
 */

interface ToolResultLike {
  ok: boolean;
  code?: string;
  error?: string;
  data?: unknown;
}

function chatOverDb(organizationId: string): OrgChat {
  const chat = Object.create(OrgChat.prototype) as OrgChat;
  Object.defineProperty(chat, "parentPath", {
    value: [{ className: "OrgAgent", name: organizationId }],
    configurable: true,
  });
  return chat;
}

function toolsFor(chat: OrgChat, organizationId: string) {
  const inner = chat as unknown as { requireTurnUserId: () => string };
  return getOrgAgentTools({
    organizationId,
    get userId() {
      return inner.requireTurnUserId();
    },
    waitUntil: () => undefined,
  });
}

function execute(
  tools: ReturnType<typeof getOrgAgentTools>,
  name: string,
  input: unknown
): Promise<ToolResultLike> {
  const tool = tools[name] as unknown as {
    execute: (input: unknown) => Promise<ToolResultLike>;
  };
  return tool.execute(input);
}

async function seedOrgWithRoles() {
  const ownerId = crypto.randomUUID();
  const viewerId = crypto.randomUUID();
  const orgId = crypto.randomUUID();
  for (const [id, email] of [
    [ownerId, `${ownerId}@test.com`],
    [viewerId, `${viewerId}@test.com`],
  ] as const) {
    await db.insert(user).values({
      id,
      name: "Test User",
      email,
      emailVerified: true,
    });
  }
  await db.insert(organization).values({
    id: orgId,
    name: "Identity Org",
    slug: `identity-${orgId.slice(0, 8)}`,
  });
  await db.insert(member).values([
    {
      id: crypto.randomUUID(),
      organizationId: orgId,
      userId: ownerId,
      role: "owner",
    },
    {
      // Not one of the shipped roles → `can("catalog:write")` is false.
      id: crypto.randomUUID(),
      organizationId: orgId,
      userId: viewerId,
      role: "viewer",
    },
  ]);
  return { ownerId, viewerId, orgId };
}

describe("OrgChat tool identity (in workerd)", () => {
  it("runs a write as the turn's user — a viewer's turn is denied even with an owner connection live", async () => {
    const { ownerId, viewerId, orgId } = await seedOrgWithRoles();
    const chat = chatOverDb(orgId);

    // Regression guard: the owner's connection IS attached. The removed
    // "any live connection" fallback would have used it for this turn.
    Object.defineProperty(chat, "getConnections", {
      value: () => [{ id: "owner-conn", state: { userId: ownerId } }],
      configurable: true,
    });

    (chat as unknown as { turnUserId: string | undefined }).turnUserId =
      viewerId;
    const denied = await execute(toolsFor(chat, orgId), "create_product", {
      name: "Viewer Write",
    });
    expect(denied.ok).toBe(false);
    expect(denied.code).toBe("forbidden");
    expect(denied.error).toBe(PERMISSION_DENIED_MESSAGE);

    // Same chat, turn stamped from the owner's connection → allowed.
    (chat as unknown as { turnUserId: string | undefined }).turnUserId =
      ownerId;
    const allowed = await execute(toolsFor(chat, orgId), "create_product", {
      name: "Owner Write",
    });
    expect(allowed.ok).toBe(true);
  });

  it("fails closed when no user can be resolved", async () => {
    const { ownerId, orgId } = await seedOrgWithRoles();
    const chat = chatOverDb(orgId);
    Object.defineProperty(chat, "getConnections", {
      value: () => [{ id: "owner-conn", state: { userId: ownerId } }],
      configurable: true,
    });

    (chat as unknown as { turnUserId: string | undefined }).turnUserId =
      undefined;
    // Outside a wrapped method there is no ALS connection either.
    const result = await execute(toolsFor(chat, orgId), "create_product", {
      name: "Ghost Write",
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("forbidden");
  });
});
