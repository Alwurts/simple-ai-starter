/**
 * Test-worker entry for @cloudflare/vitest-pool-workers.
 *
 * This is the `main` for wrangler.test.jsonc and is NEVER deployed — production
 * still boots `src/server.ts` via wrangler.jsonc. Keeping a dedicated test entry
 * means the test-only fixtures (the TestCounter DO) and their DO migration never
 * touch the production wrangler config or migration ledger, and workerd never has
 * to bundle TanStack Start for tests.
 *
 * It serves both kinds of in-workerd test:
 *  - SELF-based API/integration tests hit the mounted Hono app (same shape the
 *    old `test/worker.ts` provided) and the gated `/agents/` routes through
 *    the same shared gate module production uses.
 *  - DO tests reach `TestCounter` through the TEST_COUNTER binding.
 */
import { Hono } from "hono";
import { cors } from "hono/cors";
import { routeGatedAgentRequest } from "../agent-gate";
import { app as honoApp } from "../hono";

// Mirrors src/server.ts: OrgChat.getTools() builds the codemode `execute`
// tool, whose runtime resolves through ctx.exports.CodemodeRuntime.
export { CodemodeRuntime } from "@cloudflare/codemode";
// OrgAgent (+ its OrgChat facet) are exported so the workers vitest
// project can drive the multi-session backend over RPC. Mirrors production:
// only OrgAgent is bound (wrangler.test.jsonc); OrgChat is resolved as a facet
// via `ctx.exports.OrgChat`, so it needs the export but no binding/migration.
export { OrgAgent } from "@workspace/agent/org";
export { OrgChat } from "@workspace/agent/org/chat";
export { SessionHost } from "./session-host-do";
export { TestCounter } from "./test-counter-do";

const app = new Hono()
  .use("*", cors())
  .route("/api", honoApp)
  .all("*", (c) => c.text("Not found", 404));

export default {
  async fetch(
    request: Request,
    env: Cloudflare.Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    // Same production gate + agents router as src/server.ts (shared module),
    // so SELF-based tests hit `/agents/...` through the real code path.
    const url = new URL(request.url);
    if (url.pathname.startsWith("/agents/")) {
      const agentResponse = await routeGatedAgentRequest(request, env);
      if (agentResponse) {
        return agentResponse;
      }
    }
    return await app.fetch(request, env, ctx);
  },
};
