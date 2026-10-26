import { runInDurableObject } from "cloudflare:test";
import { getWorkspace } from "@cloudflare/computer";
import { WORKSPACE_CHANGE_FRAME } from "@workspace/agent/constants";
import { OrgAgent } from "@workspace/agent/org";
import { OrgChat } from "@workspace/agent/org/chat";
import { db, organization } from "@workspace/db";
import { describe, expect, it } from "vitest";
import { env } from "./test-env";

const CHAT_ENV = {
  ORG_CHAT_PROVIDER: "openai-compatible",
  OPENAI_COMPATIBLE_BASE_URL: "http://localhost:9/v1",
  OPENAI_COMPATIBLE_API_KEY: "test-key",
  ORG_CHAT_MODEL: "test-model",
} as unknown as Cloudflare.Env;

/**
 * The multi-session backend, aligned to the examples/assistant
 * reference. Drives the real OrgAgent DO over RPC via `runInDurableObject`:
 * - `chat_meta` is the only chat record. `listChats` reads that table;
 *   a registry row with no meta row is not a chat.
 * - `startChat` / `listChats` / `deleteChat` behave and persist.
 * - the first user message is stored on the facet before the meta row.
 * - deleting the last chat leaves zero chats — there is no `"default"` re-seed.
 * - `onBeforeSubAgent` gates unknown children with a 404 and admits known ones.
 *
 * Platform note: vitest-pool-workers cannot spawn real dynamic-agent *facets*
 * (`ctx.exports` is unavailable in the test harness, so
 * `dynamicAgents.get()` throws). We therefore fake only the registry
 * primitive — a synchronous, `state.storage.sql`-backed table standing in for
 * the `dynamicAgents` registry the SDK would otherwise own. Everything
 * exercised below is the real OrgAgent logic; the live turn/transcript path
 * (which needs a model) is verified manually in `pnpm dev`. See the AC-6
 * findings note.
 */

/**
 * Replace OrgAgent's `dynamicAgents` registry with a durable, synchronous
 * SQL-backed fake on the given live instance. Durable (DO SQLite) so a fresh
 * stub for the same id still sees prior chats — this is what makes the
 * persistence assertion real.
 *
 * `dynamicAgents` is a prototype getter without a setter, so the fake is
 * installed as a shadowing own property via `Object.defineProperty`.
 */
interface StoredChatMessage {
  id: string;
  parts: unknown[];
  role: string;
}

interface FakeRegistry {
  addCount: number;
  storedMessages: Map<string, StoredChatMessage[]>;
}

function startChatInput(title?: string, id?: string) {
  const chatId =
    id ??
    Array.from(crypto.getRandomValues(new Uint8Array(8)), (byte) =>
      byte.toString(16).padStart(2, "0")
    ).join("");
  return {
    id: chatId,
    ...(title ? { title } : {}),
    message: {
      id: `msg-${chatId}`,
      role: "user" as const,
      parts: [{ type: "text" as const, text: title ?? "Hello" }],
    },
  };
}

function fakeRegistry(o: OrgAgent): FakeRegistry {
  return o.dynamicAgents as unknown as FakeRegistry;
}

function installFakeRegistry(o: OrgAgent, sql: SqlStorage): void {
  // runInDurableObject constructs the DO. agents 0.28 runs onStart on the
  // first async RPC, not during construction. `this.sql` is backed by
  // `ctx.storage.sql` (the same store as `state.storage.sql`), so we create
  // the real chat_meta table here, matching OrgAgent.onStart's schema,
  // plus the fake registry table.
  sql.exec(
    "CREATE TABLE IF NOT EXISTS chat_meta (id TEXT PRIMARY KEY, title TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)"
  );
  sql.exec(
    "CREATE TABLE IF NOT EXISTS _test_registry (name TEXT PRIMARY KEY, created_at INTEGER NOT NULL)"
  );

  const storedMessages = new Map<string, StoredChatMessage[]>();
  const fake = {
    addCount: 0,
    storedMessages,
    get: (_cls: unknown, name: string) => {
      sql.exec(
        "INSERT OR IGNORE INTO _test_registry (name, created_at) VALUES (?, ?)",
        name,
        Date.now()
      );
      return Promise.resolve({
        addMessages: (messages: StoredChatMessage[]) => {
          fake.addCount += 1;
          const existing = storedMessages.get(name) ?? [];
          for (const message of messages) {
            if (!existing.some((row) => row.id === message.id)) {
              existing.push({
                id: message.id,
                role: message.role,
                parts: message.parts,
              });
            }
          }
          storedMessages.set(name, existing);
          return Promise.resolve();
        },
      });
    },
    delete: (_cls: unknown, name: string) => {
      sql.exec("DELETE FROM _test_registry WHERE name = ?", name);
      return Promise.resolve();
    },
    has: (_clsOrName: unknown, name: string) =>
      [...sql.exec("SELECT 1 FROM _test_registry WHERE name = ?", name)]
        .length > 0,
    list: () =>
      [
        ...sql.exec(
          "SELECT name, created_at FROM _test_registry ORDER BY created_at"
        ),
      ].map((row) => ({
        className: "OrgChat",
        name: row.name as string,
        createdAt: row.created_at as number,
      })),
  };

  Object.defineProperty(o, "dynamicAgents", {
    value: fake,
    configurable: true,
    writable: true,
  });
}

describe("OrgAgent multi-session backend (in workerd)", () => {
  it("404s an unknown child when chat_meta has no row", async () => {
    // No fake: the gate reads chat_meta (created on demand) and does not spawn.
    const stub = env.OrgAgent.get(env.OrgAgent.idFromName("org-real-gate"));
    const res = await runInDurableObject(stub, (o: OrgAgent) =>
      o.onBeforeSubAgent(new Request("http://do/"), {
        className: "OrgChat",
        name: "does-not-exist",
      })
    );
    expect(res).toBeInstanceOf(Response);
    expect((res as Response).status).toBe(404);
  });

  it("creates and lists chats from chat_meta, isolating per-chat metadata", async () => {
    const stub = env.OrgAgent.get(env.OrgAgent.idFromName("org-lifecycle"));

    const { list, alphaId, betaId } = await runInDurableObject(
      stub,
      async (o: OrgAgent, state) => {
        installFakeRegistry(o, state.storage.sql);
        const alpha = await o.startChat(startChatInput("Alpha"));
        const beta = await o.startChat(startChatInput("Beta"));
        return { list: o.listChats(), alphaId: alpha.id, betaId: beta.id };
      }
    );

    expect(alphaId).not.toBe(betaId);
    expect(list.map((c) => c.id).sort((a, b) => a.localeCompare(b))).toEqual(
      [alphaId, betaId].sort((a, b) => a.localeCompare(b))
    );
    // Titles come from each chat's own chat_meta row.
    expect(list.find((c) => c.id === alphaId)?.title).toBe("Alpha");
    expect(list.find((c) => c.id === betaId)?.title).toBe("Beta");
  });

  it("deletes chats without re-seeding a default; zero chats is valid", async () => {
    const stub = env.OrgAgent.get(env.OrgAgent.idFromName("org-delete"));

    const { afterOne, afterAll } = await runInDurableObject(
      stub,
      async (o: OrgAgent, state) => {
        installFakeRegistry(o, state.storage.sql);
        const a = await o.startChat(startChatInput());
        const b = await o.startChat(startChatInput());

        await o.deleteChat(a.id);
        const afterOne = o.listChats().map((c) => c.id);

        await o.deleteChat(b.id);
        const afterAll = o.listChats().map((c) => c.id);
        return { afterOne, afterAll, bId: b.id };
      }
    );

    expect(afterOne).toHaveLength(1);
    // No "default" chat is re-created — zero chats is a valid list.
    expect(afterAll).toEqual([]);
  });

  it("keeps a deleted chat deleted when its registry row is re-inserted", async () => {
    const stub = env.OrgAgent.get(env.OrgAgent.idFromName("org-ghost"));

    const result = await runInDurableObject(
      stub,
      async (o: OrgAgent, state) => {
        installFakeRegistry(o, state.storage.sql);
        const chat = await o.startChat(startChatInput("Doomed"));
        await o.deleteChat(chat.id);

        // The upstream forward-on-close does INSERT OR IGNORE back into the
        // registry after dynamicAgents.delete. The fake stands in for that.
        state.storage.sql.exec(
          "INSERT INTO _test_registry (name, created_at) VALUES (?, ?)",
          chat.id,
          Date.now()
        );

        const listed = o.listChats().map((entry) => entry.id);
        const gated = await o.onBeforeSubAgent(new Request("http://do/"), {
          className: "OrgChat",
          name: chat.id,
        });
        await o.renameChat(chat.id, "Revived");
        const afterRename = o.listChats().map((entry) => entry.id);
        const metaAfterRename = [
          ...state.storage.sql.exec(
            "SELECT id FROM chat_meta WHERE id = ?",
            chat.id
          ),
        ];

        // The constructor wraps onStart with facet startup this pool can't run.
        // The class method is what that wrapper awaits.
        await OrgAgent.prototype.onStart.call(o);
        const registryAfterSweep = [
          ...state.storage.sql.exec(
            "SELECT name FROM _test_registry WHERE name = ?",
            chat.id
          ),
        ];

        return {
          listed,
          gatedStatus: (gated as Response).status,
          afterRename,
          metaAfterRename: metaAfterRename.length,
          registryAfterSweep: registryAfterSweep.length,
          listedAfterSweep: o.listChats().map((entry) => entry.id),
        };
      }
    );

    expect(result.listed).toEqual([]);
    expect(result.gatedStatus).toBe(404);
    expect(result.afterRename).toEqual([]);
    expect(result.metaAfterRename).toBe(0);
    expect(result.registryAfterSweep).toBe(0);
    expect(result.listedAfterSweep).toEqual([]);
  });

  it("leaves no chat when facet spawn throws", async () => {
    const stub = env.OrgAgent.get(env.OrgAgent.idFromName("org-create-throw"));

    const { listed, metaCount, rejected } = await runInDurableObject(
      stub,
      async (o: OrgAgent, state) => {
        installFakeRegistry(o, state.storage.sql);
        (o.dynamicAgents as unknown as { get: () => Promise<never> }).get =
          () => Promise.reject(new Error("facet unavailable"));
        let rejected: string | null = null;
        try {
          await o.startChat(startChatInput("Never"));
        } catch (error) {
          rejected = error instanceof Error ? error.message : String(error);
        }
        const metaCount = [
          ...state.storage.sql.exec("SELECT id FROM chat_meta"),
        ].length;
        return { listed: o.listChats(), metaCount, rejected };
      }
    );

    expect(rejected).toBe("facet unavailable");
    expect(metaCount).toBe(0);
    expect(listed).toEqual([]);
  });

  it("caps a rename and does not recreate a chat from a long title", async () => {
    const stub = env.OrgAgent.get(env.OrgAgent.idFromName("org-rename-cap"));

    const { renamed, cappedLength, afterDelete } = await runInDurableObject(
      stub,
      async (o: OrgAgent, state) => {
        installFakeRegistry(o, state.storage.sql);
        const chat = await o.startChat(startChatInput("Short"));
        await o.renameChat(chat.id, "Renamed");
        const renamed = o
          .listChats()
          .find((entry) => entry.id === chat.id)?.title;
        await o.renameChat(chat.id, "y".repeat(240));
        const cappedLength = o.listChats().find((entry) => entry.id === chat.id)
          ?.title.length;
        await o.deleteChat(chat.id);
        await o.renameChat(chat.id, "Nope");
        return {
          renamed,
          cappedLength,
          afterDelete: o.listChats().map((entry) => entry.id),
        };
      }
    );

    expect(renamed).toBe("Renamed");
    expect(cappedLength).toBe(200);
    expect(afterDelete).toEqual([]);
  });

  it("gates an unknown facet (incl. 'default') and admits a created chat", async () => {
    const stub = env.OrgAgent.get(env.OrgAgent.idFromName("org-gate"));

    const { unknownStatus, legacyDefaultStatus, admitted, wrongClassStatus } =
      await runInDurableObject(stub, async (o: OrgAgent, state) => {
        installFakeRegistry(o, state.storage.sql);

        const unknown = await o.onBeforeSubAgent(new Request("http://do/"), {
          className: "OrgChat",
          name: "nope",
        });
        // The legacy hardcoded name is no longer special-cased — it 404s too.
        const legacyDefault = await o.onBeforeSubAgent(
          new Request("http://do/"),
          { className: "OrgChat", name: "default" }
        );

        const chat = await o.startChat(startChatInput());
        const known = await o.onBeforeSubAgent(new Request("http://do/"), {
          className: "OrgChat",
          name: chat.id,
        });
        const wrongClass = await o.onBeforeSubAgent(new Request("http://do/"), {
          className: "OrgSubAgent",
          name: chat.id,
        });

        return {
          unknownStatus: (unknown as Response).status,
          legacyDefaultStatus: (legacyDefault as Response).status,
          admitted: known,
          wrongClassStatus: (wrongClass as Response).status,
        };
      });

    expect(unknownStatus).toBe(404);
    expect(legacyDefaultStatus).toBe(404);
    expect(wrongClassStatus).toBe(404);
    // A chat_meta row falls through (undefined) so the framework forwards it.
    expect(admitted).toBeUndefined();
  });

  it("persists chats across a fresh stub (DO wake)", async () => {
    const id = env.OrgAgent.idFromName("org-persist");

    const created = await runInDurableObject(
      env.OrgAgent.get(id),
      (o: OrgAgent, state) => {
        installFakeRegistry(o, state.storage.sql);
        return o.startChat(startChatInput("Persisted"));
      }
    );

    // A new stub for the same DO id models a later client connection / wake.
    // chat_meta survives; the list is that table.
    const list = await runInDurableObject(
      env.OrgAgent.get(id),
      (o: OrgAgent, state) => {
        installFakeRegistry(o, state.storage.sql);
        return o.listChats();
      }
    );

    expect(list.map((c) => c.id)).toContain(created.id);
    expect(list.find((c) => c.id === created.id)?.title).toBe("Persisted");
  });

  it("stores the user message on the facet and lists the chat", async () => {
    const stub = env.OrgAgent.get(env.OrgAgent.idFromName("org-first-message"));
    const input = startChatInput("List my products");
    const stored = await runInDurableObject(
      stub,
      async (o: OrgAgent, state) => {
        installFakeRegistry(o, state.storage.sql);
        const chat = await o.startChat(input);
        return {
          listed: o.listChats().map((entry) => entry.id),
          title: chat.title,
          messages: fakeRegistry(o).storedMessages.get(input.id) ?? [],
        };
      }
    );
    expect(stored.listed).toEqual([input.id]);
    expect(stored.title).toBe("List my products");
    expect(stored.messages).toEqual([input.message]);
  });

  it("does not append again when the same id is started twice", async () => {
    const stub = env.OrgAgent.get(env.OrgAgent.idFromName("org-start-retry"));
    const input = startChatInput("Once");
    const result = await runInDurableObject(
      stub,
      async (o: OrgAgent, state) => {
        installFakeRegistry(o, state.storage.sql);
        await o.startChat(input);
        const second = await o.startChat(input);
        return {
          secondId: second.id,
          addCount: fakeRegistry(o).addCount,
          messages: fakeRegistry(o).storedMessages.get(input.id) ?? [],
          listed: o.listChats().map((entry) => entry.id),
        };
      }
    );
    expect(result.secondId).toBe(input.id);
    expect(result.addCount).toBe(1);
    expect(result.messages).toHaveLength(1);
    expect(result.listed).toEqual([input.id]);
  });

  it("refuses a registered facet that has no chat_meta row", async () => {
    const stub = env.OrgAgent.get(env.OrgAgent.idFromName("org-orphan-start"));
    const input = startChatInput("Orphan", "abcdef0123456789");
    const result = await runInDurableObject(
      stub,
      async (o: OrgAgent, state) => {
        installFakeRegistry(o, state.storage.sql);
        await o.lifecycle.start();
        state.storage.sql.exec(
          "INSERT INTO _test_registry (name, created_at) VALUES (?, ?)",
          input.id,
          Date.now()
        );
        let rejected: string | null = null;
        try {
          await o.startChat(input);
        } catch (error) {
          rejected = error instanceof Error ? error.message : String(error);
        }
        const metaCount = [
          ...state.storage.sql.exec("SELECT id FROM chat_meta"),
        ].length;
        return {
          rejected,
          metaCount,
          addCount: fakeRegistry(o).addCount,
          listed: o.listChats(),
        };
      }
    );
    expect(result.rejected).toBe("Chat is not available");
    expect(result.metaCount).toBe(0);
    expect(result.addCount).toBe(0);
    expect(result.listed).toEqual([]);
  });

  it("does not recreate a deleted chat whose registry row came back", async () => {
    const stub = env.OrgAgent.get(env.OrgAgent.idFromName("org-deleted-start"));
    const input = startChatInput("Doomed again");
    const result = await runInDurableObject(
      stub,
      async (o: OrgAgent, state) => {
        installFakeRegistry(o, state.storage.sql);
        await o.startChat(input);
        await o.deleteChat(input.id);
        state.storage.sql.exec(
          "INSERT INTO _test_registry (name, created_at) VALUES (?, ?)",
          input.id,
          Date.now()
        );
        let rejected: string | null = null;
        try {
          await o.startChat(input);
        } catch (error) {
          rejected = error instanceof Error ? error.message : String(error);
        }
        const gated = await o.onBeforeSubAgent(new Request("http://do/"), {
          className: "OrgChat",
          name: input.id,
        });
        const metaCount = [
          ...state.storage.sql.exec(
            "SELECT id FROM chat_meta WHERE id = ?",
            input.id
          ),
        ].length;
        return {
          rejected,
          gatedStatus: (gated as Response).status,
          metaCount,
          listed: o.listChats().map((entry) => entry.id),
        };
      }
    );
    expect(result.rejected).toBe("Chat is not available");
    expect(result.gatedStatus).toBe(404);
    expect(result.metaCount).toBe(0);
    expect(result.listed).toEqual([]);
  });

  it("rejects an id that is not 16 hex characters and writes nothing", async () => {
    const stub = env.OrgAgent.get(env.OrgAgent.idFromName("org-bad-id"));
    const result = await runInDurableObject(
      stub,
      async (o: OrgAgent, state) => {
        installFakeRegistry(o, state.storage.sql);
        let rejected: string | null = null;
        try {
          await o.startChat({
            id: "not-a-chat-id",
            message: {
              id: "m",
              role: "user",
              parts: [{ type: "text", text: "hi" }],
            },
          });
        } catch (error) {
          rejected = error instanceof Error ? error.message : String(error);
        }
        return {
          rejected,
          metaCount: [...state.storage.sql.exec("SELECT id FROM chat_meta")]
            .length,
        };
      }
    );
    expect(result.rejected).toBe("Invalid chat id");
    expect(result.metaCount).toBe(0);
  });
});

/**
 * The org's single Computer workspace. OrgAgent owns it. Chats reach the same
 * files through `getWorkspace(stub)`. The browser reaches only `listWorkspace`
 * and `readWorkspaceFile`, both confined to `/workspace`.
 */
describe("OrgAgent workspace (in workerd)", () => {
  it("round-trips a text file under /workspace", async () => {
    const stub = env.OrgAgent.get(env.OrgAgent.idFromName("ws-text"));
    const read = await runInDurableObject(stub, async (o: OrgAgent) => {
      await o.workspace.fs.mkdir("/workspace/shared", { recursive: true });
      await o.workspace.fs.writeFile(
        "/workspace/shared/note.txt",
        "hello from chat A"
      );
      return o.workspace.fs.readFile("/workspace/shared/note.txt", "utf8");
    });
    expect(read).toBe("hello from chat A");
  });

  it("round-trips binary content", async () => {
    const stub = env.OrgAgent.get(env.OrgAgent.idFromName("ws-bytes"));
    const bytes = new Uint8Array([0, 1, 2, 3, 250, 255]);
    const read = await runInDurableObject(stub, async (o: OrgAgent) => {
      await o.workspace.fs.mkdir("/workspace/shared", { recursive: true });
      await o.workspace.fs.writeFile("/workspace/shared/blob.bin", bytes);
      const stream = await o.workspace.fs.readFile(
        "/workspace/shared/blob.bin"
      );
      return new Uint8Array(await new Response(stream).arrayBuffer());
    });
    expect(Array.from(read)).toEqual(Array.from(bytes));
  });

  it("lists a top-level file and a directory for the panel", async () => {
    const stub = env.OrgAgent.get(env.OrgAgent.idFromName("ws-rpc"));
    const { root, docContent, dirRead, fileList } = await runInDurableObject(
      stub,
      async (o: OrgAgent) => {
        await o.workspace.fs.mkdir("/workspace/docs", { recursive: true });
        await o.workspace.fs.writeFile(
          "/workspace/report.md",
          "# Quarter\n\nrevenue up"
        );
        await o.workspace.fs.writeFile("/workspace/docs/spec.txt", "spec body");
        return {
          root: await o.listWorkspace(),
          docContent: await o.readWorkspaceFile("/workspace/report.md"),
          dirRead: await o.readWorkspaceFile("/workspace/docs"),
          fileList: await o.listWorkspace("/workspace/report.md"),
        };
      }
    );

    expect(root).toEqual(
      expect.arrayContaining([
        { path: "/workspace/report.md", name: "report.md", type: "file" },
        { path: "/workspace/docs", name: "docs", type: "directory" },
      ])
    );
    expect(docContent).toBe("# Quarter\n\nrevenue up");
    expect(dirRead).toBeNull();
    expect(fileList).toEqual([]);
  });

  it("lists a fresh workspace as []", async () => {
    const stub = env.OrgAgent.get(env.OrgAgent.idFromName("ws-fresh"));
    const listing = await runInDurableObject(stub, (o: OrgAgent) =>
      o.listWorkspace()
    );
    expect(listing).toEqual([]);
  });

  it("confines reads and listings to /workspace", async () => {
    const stub = env.OrgAgent.get(env.OrgAgent.idFromName("ws-confine"));
    const result = await runInDurableObject(stub, async (o: OrgAgent) => {
      await o.workspace.fs.mkdir("/workspace", { recursive: true });
      await o.workspace.fs.writeFile("/workspace/note.txt", "inside");
      return {
        inside: await o.readWorkspaceFile("/workspace/note.txt"),
        missing: await o.readWorkspaceFile("/workspace/missing.txt"),
        etc: await o.readWorkspaceFile("/etc/passwd"),
        escape: await o.readWorkspaceFile("/workspace/../x"),
        etcList: await o.listWorkspace("/etc"),
        escapeList: await o.listWorkspace("/workspace/../x"),
        sibling: await o.listWorkspace("/workspace-other"),
      };
    });
    expect(result.inside).toBe("inside");
    expect(result.missing).toBeNull();
    expect(result.etc).toBeNull();
    expect(result.escape).toBeNull();
    expect(result.etcList).toEqual([]);
    expect(result.escapeList).toEqual([]);
    expect(result.sibling).toEqual([]);
  });

  it("broadcasts a payload-free workspace-change frame", async () => {
    const stub = env.OrgAgent.get(env.OrgAgent.idFromName("ws-announce"));
    const captured = await runInDurableObject(stub, (o: OrgAgent) => {
      const messages: string[] = [];
      o.broadcast = ((msg: string) => {
        messages.push(msg);
      }) as OrgAgent["broadcast"];
      o.announceWorkspaceChange();
      return messages;
    });
    expect(captured).toEqual([
      JSON.stringify({ type: WORKSPACE_CHANGE_FRAME }),
    ]);
    const frame = JSON.parse(captured[0] ?? "{}") as Record<string, unknown>;
    expect(frame).toEqual({ type: "workspace-change" });
    expect(Object.keys(frame)).toEqual(["type"]);
  });

  it("shares files through getWorkspace on the OrgAgent stub", async () => {
    const id = env.OrgAgent.idFromName("ws-client");
    const client = await getWorkspace(
      env.OrgAgent.get(id) as Parameters<typeof getWorkspace>[0]
    );
    await client.fs.mkdir("/workspace", { recursive: true });
    await client.fs.writeFile("/workspace/from-chat.md", "from chat");
    const listing = await runInDurableObject(
      env.OrgAgent.get(id),
      (o: OrgAgent) => o.listWorkspace()
    );
    expect(listing).toEqual(
      expect.arrayContaining([
        {
          path: "/workspace/from-chat.md",
          name: "from-chat.md",
          type: "file",
        },
      ])
    );
  });

  it("loads the org workspace on chat startup and confines writes to /workspace", async () => {
    await db.insert(organization).values({
      id: "ws-chat-tools",
      name: "Workspace Org",
      slug: "ws-chat-tools",
    });
    // A parent stub opened outside this object cannot be called from another
    // DO in the workers pool (OutgoingFactory). Build the chat on the org
    // DO and point parentAgent at the live instance.
    const result = await runInDurableObject(
      env.OrgAgent.get(env.OrgAgent.idFromName("ws-chat-tools")),
      async (o: OrgAgent, state) => {
        const chat = new OrgChat(
          state as unknown as DurableObjectState,
          CHAT_ENV
        );
        Object.defineProperty(chat, "parentPath", {
          value: [{ className: "OrgAgent", name: "ws-chat-tools" }],
        });
        Object.defineProperty(chat, "parentAgent", {
          value: () => Promise.resolve(o),
        });
        // OrgAgent.onStart creates this table on the first RPC. This
        // callback is still construction, and chat startup reads it.
        state.storage.sql.exec(
          "CREATE TABLE IF NOT EXISTS org_memory (label TEXT PRIMARY KEY, content TEXT NOT NULL, updated_at INTEGER NOT NULL)"
        );
        await chat.onStart();
        await chat.workspace.fs.mkdir("/workspace", { recursive: true });
        const tools = chat.getTools();
        const write = tools.write as unknown as {
          execute: (input: {
            path: string;
            content: string;
          }) => Promise<{ error?: string; path?: string }>;
        };
        const escaped = await write.execute({
          path: "/workspace/../hidden.txt",
          content: "no",
        });
        const written = await write.execute({
          path: "/workspace/note.txt",
          content: "yes",
        });
        const runtime = (
          chat.workspace as {
            runtime?: { backends: () => Array<{ id: string }> };
          }
        ).runtime;
        let hidden = "absent";
        try {
          await o.workspace.fs.readFile("/hidden.txt", "utf8");
          hidden = "present";
        } catch {
          hidden = "absent";
        }
        return {
          hasExec: "exec" in tools,
          escaped,
          written,
          backends: runtime?.backends() ?? [],
          hidden,
          listing: await o.listWorkspace(),
        };
      }
    );
    expect(result.hasExec).toBe(true);
    expect(result.escaped.error).toContain("outside /workspace");
    expect(result.written).toMatchObject({ path: "/workspace/note.txt" });
    expect(result.backends).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "js" })])
    );
    expect(result.hidden).toBe("absent");
    expect(result.listing).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "/workspace/note.txt",
          type: "file",
        }),
      ])
    );
  });

  it("registers the js module backend", async () => {
    const stub = env.OrgAgent.get(env.OrgAgent.idFromName("ws-backends"));
    const backends = await runInDurableObject(stub, (o: OrgAgent) =>
      o.workspace.runtime.backends()
    );
    expect(backends).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "js", protocol: "module" }),
      ])
    );
  });
});
