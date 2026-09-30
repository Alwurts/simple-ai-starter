import { runInDurableObject } from "cloudflare:test";
import { OrgChat } from "@workspace/agent/org/chat";
import { describe, expect, it } from "vitest";
import { env } from "./test-env";

/**
 * S5: `OrgChat.onBeforeSubAgent` gates sub-agent URLs on the agent-tool run
 * registry (agents agent-tools.md › Drill in and gate access) — a guessed
 * `/agents/org-agent/<org>/<chat>/sub/org-sub-agent/<id>` must 404 instead
 * of spawning a fresh facet. Driven on a real OrgChat DO (fresh storage, so
 * the run registry is genuinely empty) with the real `hasAgentToolRun`.
 */
describe("OrgChat.onBeforeSubAgent (in workerd)", () => {
  it("404s an unknown org-sub-agent run", async () => {
    const stub = env.SESSION_HOST.get(
      env.SESSION_HOST.idFromName("sub-agent-gate")
    );
    const res = await runInDurableObject(stub, (_host, state) => {
      const chat = new OrgChat(
        state as unknown as DurableObjectState,
        { AI_GATEWAY_API_KEY: "test-key" } as unknown as Cloudflare.Env
      );
      return chat.onBeforeSubAgent(new Request("http://do/"), {
        className: "org-sub-agent",
        name: "guessed-run-id",
      });
    });
    expect(res).toBeInstanceOf(Response);
    expect((res as Response).status).toBe(404);
  });
});
