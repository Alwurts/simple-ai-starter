import { runInDurableObject } from "cloudflare:test";
import type { OrgAgent } from "@workspace/agent/org";
import { SEARCH_MAX_CHATS } from "@workspace/agent/org/chat";
import type { ChatMessageHit } from "@workspace/agent/types";
import { describe, expect, it } from "vitest";
import { env } from "./test-env";

/**
 * D-010 — org-scoped conversation search. `OrgAgent.searchChats` fans a query
 * out to each registered chat's own Sessions FTS index through
 * `OrgChat.searchMessages` (a dynamic-agent stub method) and merges the hits.
 *
 * As in org-agent.workerd.test.ts, vitest-pool-workers cannot spawn real
 * dynamic-agent facets, so the `dynamicAgents` registry is faked — here with
 * chat stubs that record the fan-out and serve canned hits. The real seam
 * under test is OrgAgent's bounding (N most recent), per-chat failure
 * isolation, merging, and the blank-query guard. The FTS behavior of a real
 * chat's index is covered by the compaction/Sessions machinery and the live
 * smoke.
 */

interface ChatStub {
  searchMessages: (query: string, limit?: number) => Promise<ChatMessageHit[]>;
}

function hit(messageId: string): ChatMessageHit {
  return {
    messageId,
    role: "user",
    snippet: `snippet ${messageId}`,
  };
}

/**
 * Durable SQL-backed fake registry whose `get` returns the given stubs (and
 * records each fan-out). Same shape trick as org-agent.workerd.test.ts.
 */
function installSearchRegistry(
  o: OrgAgent,
  sql: SqlStorage,
  stubs: Map<string, ChatStub>,
  searched: string[]
): void {
  sql.exec(
    "CREATE TABLE IF NOT EXISTS chat_meta (id TEXT PRIMARY KEY, title TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)"
  );
  sql.exec(
    "CREATE TABLE IF NOT EXISTS _test_registry (name TEXT PRIMARY KEY, created_at INTEGER NOT NULL)"
  );

  const fake = {
    get: (_cls: unknown, name: string) => {
      searched.push(name);
      const stub = stubs.get(name);
      if (!stub) {
        return Promise.reject(new Error(`no stub for ${name}`));
      }
      return Promise.resolve(stub);
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

/** Insert a chat row with a distinct, controllable `updated_at`. */
function seedChat(sql: SqlStorage, id: string, updatedAt: number): void {
  sql.exec(
    "INSERT OR IGNORE INTO _test_registry (name, created_at) VALUES (?, ?)",
    id,
    updatedAt
  );
  sql.exec(
    "INSERT OR REPLACE INTO chat_meta (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)",
    id,
    `Chat ${id}`,
    updatedAt,
    updatedAt
  );
}

describe("OrgAgent.searchChats (in workerd)", () => {
  it("returns [] for a blank query without touching any chat", async () => {
    const stub = env.OrgAgent.get(env.OrgAgent.idFromName("search-blank"));
    const { result, searched } = await runInDurableObject(
      stub,
      async (o: OrgAgent, state) => {
        const searched: string[] = [];
        installSearchRegistry(o, state.storage.sql, new Map(), searched);
        seedChat(state.storage.sql, "a", 1);
        const result = await o.searchChats("   ");
        return { result, searched };
      }
    );
    expect(result).toEqual([]);
    expect(searched).toEqual([]);
  });

  it("merges hits across chats in most-recently-active chat order", async () => {
    const stub = env.OrgAgent.get(env.OrgAgent.idFromName("search-merge"));
    const { result } = await runInDurableObject(stub, async (o, state) => {
      const searched: string[] = [];
      installSearchRegistry(
        o,
        state.storage.sql,
        new Map<string, ChatStub>([
          [
            "older",
            {
              searchMessages: async () => [hit("old-1")],
            },
          ],
          [
            "newer",
            {
              searchMessages: async () => [hit("new-1"), hit("new-2")],
            },
          ],
        ]),
        searched
      );
      seedChat(state.storage.sql, "older", 100);
      seedChat(state.storage.sql, "newer", 200);
      return { result: await o.searchChats("needle") };
    });

    expect(result.map((h) => h.messageId)).toEqual(["new-1", "new-2", "old-1"]);
    expect(result[0]).toMatchObject({
      chatId: "newer",
      chatTitle: "Chat newer",
    });
    expect(result[2]).toMatchObject({
      chatId: "older",
      chatTitle: "Chat older",
    });
  });

  it("is bounded: only the most recent SEARCH_MAX_CHATS chats are searched", async () => {
    const stub = env.OrgAgent.get(env.OrgAgent.idFromName("search-bound"));
    const extra = 3;
    const { searched } = await runInDurableObject(stub, async (o, state) => {
      const searched: string[] = [];
      installSearchRegistry(o, state.storage.sql, new Map(), searched);
      const sql = state.storage.sql;
      for (let i = 0; i < SEARCH_MAX_CHATS + extra; i++) {
        seedChat(sql, `chat-${String(i).padStart(2, "0")}`, i);
      }
      await o.searchChats("needle");
      return { searched };
    });

    expect(searched).toHaveLength(SEARCH_MAX_CHATS);
    // The oldest chats (lowest updated_at) are beyond the bound.
    expect(searched).not.toContain("chat-00");
    expect(searched).toContain(
      `chat-${String(SEARCH_MAX_CHATS + extra - 1).padStart(2, "0")}`
    );
  });

  it("skips a chat whose search fails and still returns the rest", async () => {
    const stub = env.OrgAgent.get(env.OrgAgent.idFromName("search-fail"));
    const { result } = await runInDurableObject(stub, async (o, state) => {
      const searched: string[] = [];
      installSearchRegistry(
        o,
        state.storage.sql,
        new Map<string, ChatStub>([
          [
            "broken",
            {
              searchMessages: () => Promise.reject(new Error("fts exploded")),
            },
          ],
          [
            "healthy",
            {
              searchMessages: async () => [hit("ok-1")],
            },
          ],
        ]),
        searched
      );
      seedChat(state.storage.sql, "broken", 100);
      seedChat(state.storage.sql, "healthy", 200);
      return { result: await o.searchChats("needle") };
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ chatId: "healthy", messageId: "ok-1" });
  });
});
