import { runInDurableObject } from "cloudflare:test";
import { getOrgAgentTools } from "@workspace/agent";
import { PERMISSION_DENIED_MESSAGE } from "@workspace/agent/constants";
import { OrgChat } from "@workspace/agent/org/chat";
import { db, eq, member, organization, products, user } from "@workspace/db";
import {
  __DO_NOT_USE_WILL_BREAK__agentContext as agentContext,
  type Connection,
  getCurrentAgent,
} from "agents";
import { describe, expect, it } from "vitest";
import { env } from "./test-env";

/**
 * Tool identity (S3). Think builds the ToolSet at turn start inside the
 * turn's ALS (think.js builds tools before beforeTurn), so OrgChat.getTools()
 * binds the initiating connection's user into that invocation's tool
 * closures; sandbox tool callbacks have no ALS of their own and read the
 * bound user; a live ALS at execute time wins; neither fails closed.
 *
 * The tests drive the production seams: `chat.getTools()` on a real OrgChat
 * DO (fake LOADER object — enough for createExecuteTool to construct the
 * codemode runtime; sandbox execution itself is never run), with the ALS
 * store planted via the same AsyncLocalStorage the framework wraps methods
 * in. A fake owner connection stays attached throughout — nothing consults
 * it, which is the point: no "any live connection" fallback exists.
 */

interface ToolResultLike {
  name?: string;
}

const STUB_ENV = {
  ORG_CHAT_PROVIDER: "openai-compatible",
  OPENAI_COMPATIBLE_BASE_URL: "http://localhost:9/v1",
  OPENAI_COMPATIBLE_API_KEY: "test-key",
  ORG_CHAT_MODEL: "test-model",
  LOADER: {},
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
    // The codemode runtime resolves a facet through ctx.exports/ctx.facets;
    // facet I/O on a borrowed DO state is impossible in this pool, so shadow
    // ctx with the same shape the runtime needs at BUILD time. The stub
    // runtime refuses execution (a real one settles bogus ids as status
    // errors — not under test here); what this test pins is that the
    // override rebuilt the tool set — and with it `this.codemode` — under the
    // approver's connection BEFORE super took the runtime. Storage stays
    // real for the product-tool writes.
    Object.defineProperty(chat, "ctx", {
      value: {
        storage: state.storage,
        exports: { CodemodeRuntime: class {} },
        facets: {
          get: () => ({
            getExecution: () => {
              throw new Error("no runtime I/O in test");
            },
          }),
        },
      },
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

    // Build under the owner's ALS, then execute with no ALS at all — the
    // codemode sandbox's situation: the user bound at build time applies.
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

  it("approveExecution rebuilds the tools under the approver's connection (rebinds this.codemode)", async () => {
    const { ownerId, viewerId, orgId } = await seedOrgWithRoles();
    const chat = await orgChatInFreshDo(orgId);

    // Pre-bind a runtime under the OWNER (a previous turn's build), the way
    // the fail-closed test does. Without the override, super would take this
    // stale runtime as-is and never call getTools — so both the spy below and
    // the runtime-swap assertion actually pin the override's rebuild.
    await runAs(chat, connectionFor(ownerId), () => chat.getTools());
    const ownerRuntime = (chat as unknown as { codemode?: unknown }).codemode;
    expect(ownerRuntime).toBeDefined();

    // Spy on the instance's getTools: the override must call it (Think's
    // approveExecution then takes this.codemode synchronously for the
    // replay), and it must run with the approver's ALS connection.
    const realGetTools = OrgChat.prototype.getTools;
    let builtUnderUserId: string | undefined;
    let builtUnderConnectionless = false;
    Object.defineProperty(chat, "getTools", {
      value() {
        const { connection } = getCurrentAgent();
        builtUnderUserId = connection?.state
          ? (connection.state as { userId?: string }).userId
          : undefined;
        builtUnderConnectionless = !connection;
        return realGetTools.call(this);
      },
      configurable: true,
    });

    // The stub runtime refuses I/O, so super rejects; the assertions below
    // are about what happened before that — the rebuild under the approver.
    await runAs(chat, connectionFor(viewerId), () =>
      chat.approveExecution("no-such-execution")
    ).catch(() => undefined);
    expect(builtUnderConnectionless).toBe(false);
    expect(builtUnderUserId).toBe(viewerId);
    const approverRuntime = (chat as unknown as { codemode?: unknown })
      .codemode;
    expect(approverRuntime).toBeDefined();
    expect(approverRuntime).not.toBe(ownerRuntime);
  });

  it("fails closed when the override's getTools throws — the stale runtime is cleared, not replayed", async () => {
    const { ownerId, viewerId, orgId } = await seedOrgWithRoles();
    const chat = await orgChatInFreshDo(orgId);

    // Bind the runtime to the OWNER first (a previous turn's build).
    await runAs(chat, connectionFor(ownerId), () => chat.getTools());
    expect((chat as unknown as { codemode?: unknown }).codemode).toBeDefined();

    // Now getTools throws during the viewer's approval (spy).
    Object.defineProperty(chat, "getTools", {
      value: () => {
        throw new Error("build exploded");
      },
      configurable: true,
    });
    const outcome = await runAs(chat, connectionFor(viewerId), () =>
      chat.approveExecution("no-such-execution")
    );

    // Think's own status error — the stale (owner-bound) runtime was
    // cleared, so the approval settled without replaying anything.
    expect(outcome).toMatchObject({
      status: "error",
      executionId: "no-such-execution",
      error: expect.stringContaining("No codemode runtime"),
    });
    expect(
      (chat as unknown as { codemode?: unknown }).codemode
    ).toBeUndefined();
    // And no write ran under the previously bound (owner) identity.
    const rows = await db
      .select({ name: products.name })
      .from(products)
      .where(eq(products.organizationId, orgId));
    expect(rows).toEqual([]);
  });
});

/**
 * Composition-level sanity: the five product tools the sandbox sees are the
 * ones whose identity closure these tests exercise.
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
