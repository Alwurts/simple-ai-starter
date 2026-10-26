import { runInDurableObject } from "cloudflare:test";
import { getWorkspace } from "@cloudflare/computer";
import { createAITools } from "@cloudflare/computer/tools/ai-sdk";
import { getOrgAgentTools } from "@workspace/agent";
import { PERMISSION_DENIED_MESSAGE } from "@workspace/agent/constants";
import { OrgChat } from "@workspace/agent/org/chat";
import { db, member, organization, user } from "@workspace/db";
import {
  __DO_NOT_USE_WILL_BREAK__agentContext as agentContext,
  type Connection,
} from "agents";
import { describe, expect, it } from "vitest";
import { env } from "./test-env";

interface ToolResultLike {
  name?: string;
}

const STUB_ENV = {
  ORG_CHAT_PROVIDER: "openai-compatible",
  OPENAI_COMPATIBLE_BASE_URL: "http://localhost:9/v1",
  OPENAI_COMPATIBLE_API_KEY: "test-key",
  ORG_CHAT_MODEL: "test-model",
} as unknown as Cloudflare.Env;

function connectionFor(userId: string): Connection {
  return { id: `conn-${userId}`, state: { userId } } as unknown as Connection;
}

function runAs<T>(
  chat: OrgChat,
  connection: Connection | undefined,
  operation: () => T
): T {
  // The store shape mirrors a live invocation: withAgentContext passes
  // through unchanged only when the store's agent is this object (which is
  // how Think's turn body and the WS callable dispatch run), so the planted
  // connection survives into getTools — production behaviour.
  return agentContext.run(
    {
      agent: chat,
      connection,
      request: undefined,
      email: undefined,
    },
    operation
  );
}

function createProduct(
  tools: ReturnType<OrgChat["getTools"]>,
  name: string
): Promise<ToolResultLike> {
  const tool = tools.create_product as unknown as {
    execute: (input: unknown) => Promise<ToolResultLike>;
  };
  return tool.execute({ name });
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

function orgChatInFreshDo(organizationId: string) {
  const stub = env.SESSION_HOST.get(
    env.SESSION_HOST.idFromName(`tool-identity-${crypto.randomUUID()}`)
  );
  return runInDurableObject(stub, (_host, state) => {
    const chat = new OrgChat(state as unknown as DurableObjectState, STUB_ENV);
    // Facet wiring (parentPath) is framework-applied; shadow it with the org
    // the tools are scoped to (same technique as the compaction test).
    Object.defineProperty(chat, "parentPath", {
      value: [{ className: "OrgAgent", name: organizationId }],
      configurable: true,
    });
    // Regression guard: an owner connection IS attached. Nothing in the
    // identity path may consult it — a "some live connection" fallback would
    // make the refused writes below succeed.
    Object.defineProperty(chat, "getConnections", {
      value: () => [{ id: "owner-conn", state: { userId: "user-owner" } }],
      configurable: true,
    });
    return chat;
  });
}

describe("OrgChat tool identity via getTools (in workerd)", () => {
  it("refuses writes for tools built under a viewer's connection, even with an owner connection attached", async () => {
    const { viewerId, orgId } = await seedOrgWithRoles();
    const chat = await orgChatInFreshDo(orgId);

    const tools = await runAs(chat, connectionFor(viewerId), () =>
      chat.getTools()
    );
    await expect(createProduct(tools, "Viewer Write")).rejects.toThrow(
      PERMISSION_DENIED_MESSAGE
    );
    expect(orgId).toBeTruthy();
  });

  it("allows writes for tools built under the owner's connection — the bound user, for connectionless executes", async () => {
    const { ownerId, orgId } = await seedOrgWithRoles();
    const chat = await orgChatInFreshDo(orgId);

    const tools = await runAs(chat, connectionFor(ownerId), () =>
      chat.getTools()
    );
    const result = await createProduct(tools, "Owner Write");
    expect(result).toMatchObject({ name: "Owner Write" });

    const rows = await db.query.products.findMany({
      where: (product, { eq }) => eq(product.organizationId, orgId),
    });
    expect(rows.map((row) => row.name)).toEqual(["Owner Write"]);
  });

  it("fails closed when the tools are built with no connection", async () => {
    const { orgId } = await seedOrgWithRoles();
    const chat = await orgChatInFreshDo(orgId);

    // Built outside any ALS: nothing to bind.
    const tools = chat.getTools();
    await expect(createProduct(tools, "Ghost Write")).rejects.toThrow(
      PERMISSION_DENIED_MESSAGE
    );
    expect(orgId).toBeTruthy();
  });

  it("a live ALS connection at execute time wins over the bound user", async () => {
    const { ownerId, viewerId, orgId } = await seedOrgWithRoles();
    const chat = await orgChatInFreshDo(orgId);

    const tools = await runAs(chat, connectionFor(ownerId), () =>
      chat.getTools()
    );
    await expect(
      runAs(chat, connectionFor(viewerId), () =>
        createProduct(tools, "Should Not Exist")
      )
    ).rejects.toThrow(PERMISSION_DENIED_MESSAGE);
  });

  it("publishes rooted file tools, and product names stay off that set", async () => {
    const { orgId } = await seedOrgWithRoles();
    const chat = await orgChatInFreshDo(orgId);
    const tools = chat.getTools();
    expect(tools).not.toHaveProperty("execute");
    expect(tools).toHaveProperty("write");
    expect(tools).not.toHaveProperty("exec");

    const workspace = await getWorkspace(
      env.OrgAgent.get(env.OrgAgent.idFromName(`tools-${orgId}`)) as Parameters<
        typeof getWorkspace
      >[0]
    );
    const workspaceNames = Object.keys(
      createAITools({ workspace, root: "/workspace" })
    );
    expect(workspaceNames).toContain("write");
    for (const name of [
      "create_product",
      "delete_product",
      "get_product",
      "list_products",
      "update_product",
    ]) {
      expect(workspaceNames).not.toContain(name);
    }
  });
});

/**
 * Composition-level sanity: the five product tools whose identity closure
 * these tests exercise.
 */
describe("getOrgAgentTools composition", () => {
  it("exposes exactly the five product tools", () => {
    expect(
      Object.keys(
        getOrgAgentTools({
          organizationId: "org_test",
          userId: "user_test",
        })
      ).sort()
    ).toEqual([
      "create_product",
      "delete_product",
      "get_product",
      "list_products",
      "update_product",
    ]);
  });
});
