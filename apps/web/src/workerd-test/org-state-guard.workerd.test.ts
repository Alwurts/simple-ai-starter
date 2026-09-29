import { runInDurableObject } from "cloudflare:test";
import type { OrgAgent } from "@workspace/agent/org";
import type { ChatSummary } from "@workspace/agent/types";
import type { Connection } from "agents";
import { describe, expect, it } from "vitest";
import { env } from "./test-env";

/**
 * Round-2 security fix: `OrgAgent` broadcasts `{ chats }` as agent state, and
 * agents lets clients push state over the socket by default — any org
 * member's browser could broadcast a fake chat list to the others. The fix is
 * the built-in `validateStateChange(nextState, source)` hook: throw unless the
 * update came from the server.
 *
 * The hook is synchronous and runs before persistence/broadcast, so the real
 * seam is the hook body itself, driven here on a live OrgAgent: a
 * connection-sourced update must throw and a server-sourced one must pass.
 * NOT covered (framework's documented job, agents docs/state.md): the socket
 * routing of client pushes into this hook.
 */

function fakeConnection(): Connection {
  return { id: "conn-test" } as unknown as Connection;
}

describe("OrgAgent.validateStateChange (in workerd)", () => {
  it("rejects a connection-sourced state push", async () => {
    const stub = env.OrgAgent.get(env.OrgAgent.idFromName("state-guard"));
    const result = await runInDurableObject(stub, (o: OrgAgent, state) => {
      state.storage.sql.exec(
        "CREATE TABLE IF NOT EXISTS chat_meta (id TEXT PRIMARY KEY, title TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)"
      );
      try {
        o.validateStateChange(
          {
            chats: [
              {
                id: "fake",
                title: "Fake",
                createdAt: 1,
                updatedAt: 1,
              } as ChatSummary,
            ],
          },
          fakeConnection()
        );
        return "passed";
      } catch {
        return "rejected";
      }
    });
    expect(result).toBe("rejected");
  });

  it("lets a server-sourced update through", async () => {
    const stub = env.OrgAgent.get(env.OrgAgent.idFromName("state-guard"));
    const result = await runInDurableObject(stub, (o: OrgAgent) => {
      try {
        o.validateStateChange({ chats: [] }, "server");
        return "passed";
      } catch {
        return "rejected";
      }
    });
    expect(result).toBe("passed");
  });
});
