import { runInDurableObject } from "cloudflare:test";
import { OrgChat } from "@workspace/agent/org/chat";
import { describe, expect, it } from "vitest";
import { env } from "./test-env";

// A resolvable model config — the gate tests never call the model.
const STUB_ENV = {
  ORG_CHAT_PROVIDER: "openai-compatible",
  OPENAI_COMPATIBLE_BASE_URL: "http://localhost:9/v1",
  OPENAI_COMPATIBLE_API_KEY: "test-key",
  ORG_CHAT_MODEL: "test-model",
} as unknown as Cloudflare.Env;

/**
 * S5: `OrgChat.onBeforeSubAgent` gates sub-agent URLs on the agent-tool run
 * registry (agents agent-tools.md › Drill in and gate access) — a guessed
 * `/agents/org-agent/<org>/<chat>/sub/org-sub-agent/<id>` must 404 instead
 * of spawning a fresh facet. Driven on a real OrgChat DO (fresh storage, so
 * the run registry is genuinely empty) with the real `hasAgentToolRun`.
 *
 * `className` is the export name the router resolves the URL segment to
 * (`org-sub-agent` → `OrgSubAgent`, agents sub-routing resolveClassName).
 */
describe("OrgChat.onBeforeSubAgent (in workerd)", () => {
  it("404s an unknown OrgSubAgent run", async () => {
    const stub = env.SESSION_HOST.get(
      env.SESSION_HOST.idFromName("sub-agent-gate")
    );
    const res = await runInDurableObject(stub, (_host, state) => {
      const chat = new OrgChat(
        state as unknown as DurableObjectState,
        STUB_ENV
      );
      return chat.onBeforeSubAgent(new Request("http://do/"), {
        className: "OrgSubAgent",
        name: "guessed-run-id",
      });
    });
    expect(res).toBeInstanceOf(Response);
    expect((res as Response).status).toBe(404);
  });

  it("resolves a registered run", async () => {
    const stub = env.SESSION_HOST.get(
      env.SESSION_HOST.idFromName("sub-agent-gate-known")
    );
    const res = await runInDurableObject(stub, (_host, state) => {
      const chat = new OrgChat(
        state as unknown as DurableObjectState,
        STUB_ENV
      );
      // Seed the real run registry with one launched run, as a delegate
      // tool call would leave behind.
      chat.sql`
        INSERT INTO cf_agent_tool_runs (run_id, agent_type, status, started_at)
        VALUES (${"run-abc"}, ${"OrgSubAgent"}, ${"completed"}, ${Date.now()})
      `;
      return chat.onBeforeSubAgent(new Request("http://do/"), {
        className: "OrgSubAgent",
        name: "run-abc",
      });
    });
    expect(res).toBeUndefined();
  });
});
