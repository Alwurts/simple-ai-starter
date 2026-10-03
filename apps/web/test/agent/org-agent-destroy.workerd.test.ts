import { runInDurableObject } from "cloudflare:test";
import { destroyOrgAgent } from "@workspace/auth";
import { describe, expect, it } from "vitest";
import { env } from "./test-env";

describe("organization delete wipes the org agent", () => {
  it("destroyOrgAgent drops the durable object store", async () => {
    const name = "org-destroy-wipe";
    const stub = env.OrgAgent.get(env.OrgAgent.idFromName(name));

    await runInDurableObject(stub, (_agent, state) => {
      state.storage.sql.exec("CREATE TABLE marker (id TEXT)");
      state.storage.sql.exec("INSERT INTO marker (id) VALUES ('keep')");
    });

    await destroyOrgAgent(name);
    // destroy() aborts the isolate after deleteAll. Wait out that abort,
    // then enter on a new stub so the read is a fresh isolate.
    await new Promise((resolve) => {
      setTimeout(resolve, 50);
    });

    const again = env.OrgAgent.get(env.OrgAgent.idFromName(name));
    const tables = await runInDurableObject(again, (_agent, state) => [
      ...state.storage.sql.exec(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'marker'"
      ),
    ]);
    expect(tables).toEqual([]);
  });
});
