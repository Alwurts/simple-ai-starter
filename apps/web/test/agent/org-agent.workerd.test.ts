import { runInDurableObject } from "cloudflare:test";
import { OrgAgent } from "@workspace/agent/org";
import { describe, expect, it } from "vitest";
import { env } from "./test-env";

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
  // runInDurableObject constructs the DO but does not drive the agents async
  // lifecycle (onStart is wrapped and awaited internally). `this.sql` is backed
  // by `ctx.storage.sql` (the same store as `state.storage.sql`), so we create
  // the real chat_meta table here directly — matching OrgAgent.onStart's schema
  // — plus the fake registry table.
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
 * The org's single shared workspace at the backend. The parent
 * OrgAgent owns the real `Workspace`; every child chat proxies to it via
 * `SharedWorkspace` RPC, so a file written from one chat is visible to all.
 *
 * In-pool we exercise the parent-owned workspace directly (the child proxy is a
 * thin one-hop forwarder to exactly these methods; the dynamic-agent hop itself
 * can't be spawned under vitest-pool-workers). This proves the shared-storage semantics
 * that make cross-chat visibility work, that text and binary content round-trip,
 * and that a write fires the `onChange` → `broadcast` signal.
 */
describe("OrgAgent shared workspace (in workerd)", () => {
  it("round-trips a text file through the parent-owned workspace", async () => {
    const stub = env.OrgAgent.get(env.OrgAgent.idFromName("ws-text"));
    const read = await runInDurableObject(stub, async (o: OrgAgent) => {
      // A write from "chat A" and a read from "chat B" both land on the parent
      // workspace — modelled here as two calls on the shared owner.
      await o.writeFile("/shared/note.txt", "hello from chat A");
      return o.readFile("/shared/note.txt");
    });
    expect(read).toBe("hello from chat A");
  });

  it("round-trips binary content (attachment bytes)", async () => {
    const stub = env.OrgAgent.get(env.OrgAgent.idFromName("ws-bytes"));
    const bytes = new Uint8Array([0, 1, 2, 3, 250, 255]);
    const read = await runInDurableObject(stub, async (o: OrgAgent) => {
      await o.writeFileBytes(
        "/shared/blob.bin",
        bytes,
        "application/octet-stream"
      );
      return o.readFileBytes("/shared/blob.bin");
    });
    expect(read).not.toBeNull();
    expect(Array.from(read as Uint8Array)).toEqual(Array.from(bytes));
  });

  it("exposes a read-only listing + file read for the client viewer", async () => {
    const stub = env.OrgAgent.get(env.OrgAgent.idFromName("ws-rpc"));
    const { rootNames, docContent } = await runInDurableObject(
      stub,
      async (o: OrgAgent) => {
        await o.writeFile("/report.md", "# Quarter\n\nrevenue up");
        await o.writeFile("/docs/spec.txt", "spec body");
        // These are the two `@callable()` methods the browser reaches.
        const root = await o.listWorkspace("/");
        const docContent = await o.readWorkspaceFile("/report.md");
        return { rootNames: root.map((f) => f.name), docContent };
      }
    );

    // Root listing surfaces the top-level file and the nested dir.
    expect(rootNames).toContain("report.md");
    expect(rootNames).toContain("docs");
    expect(docContent).toBe("# Quarter\n\nrevenue up");
  });

  it("returns null from the read RPC for a missing file", async () => {
    const stub = env.OrgAgent.get(env.OrgAgent.idFromName("ws-rpc-missing"));
    const read = await runInDurableObject(stub, (o: OrgAgent) =>
      o.readWorkspaceFile("/nope.txt")
    );
    expect(read).toBeNull();
  });

  it("broadcasts a workspace-change signal on write (onChange → broadcast)", async () => {
    const stub = env.OrgAgent.get(env.OrgAgent.idFromName("ws-onchange"));
    const captured = await runInDurableObject(stub, async (o: OrgAgent) => {
      const messages: string[] = [];
      // Capture what the workspace onChange hook fans out to connected clients.
      o.broadcast = ((msg: string) => {
        messages.push(msg);
      }) as OrgAgent["broadcast"];
      await o.writeFile("/watched.txt", "x");
      return messages;
    });

    const events = captured
      .map((m) => JSON.parse(m) as { type: string; event?: { path: string } })
      .filter((m) => m.type === "workspace-change");
    expect(events.length).toBeGreaterThan(0);
    expect(events.some((e) => e.event?.path === "/watched.txt")).toBe(true);
  });
});
