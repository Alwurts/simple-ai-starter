import handler from "@tanstack/react-start/server-entry";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { routeGatedAgentRequest } from "./agent-gate";
import { app as honoApp } from "./api";

// The codemode runtime behind OrgChat's `execute` tool is a DO facet of
// OrgChat, so its class must be reachable via ctx.exports — the manual export
// the @cloudflare/codemode docs prescribe (the @cloudflare/codemode/vite
// plugin exists to add exactly this line).
export { CodemodeRuntime } from "@cloudflare/codemode";
export { OrgAgent } from "@workspace/agent/org";
// OrgChat and OrgSubAgent are facets (sub-agents) of OrgAgent, resolved by the
// framework via these named worker exports — they need no wrangler binding or
// migration (they share OrgAgent's storage). OrgSubAgent is a facet under
// OrgChat, spawned by the `delegate` agent tool.
export { OrgChat, OrgSubAgent } from "@workspace/agent/org/chat";

const app = new Hono()
  .use("*", logger())
  .use("*", cors())
  .route("/api", honoApp)
  .all("*", (c) => handler.fetch(c.req.raw));

async function handleRequest(
  request: Request,
  env: Cloudflare.Env,
  ctx: ExecutionContext
): Promise<Response> {
  const url = new URL(request.url);

  if (url.pathname.startsWith("/agents/")) {
    const agentResponse = await routeGatedAgentRequest(request, env);
    if (agentResponse) {
      return agentResponse;
    }
  }

  return app.fetch(request, env, ctx);
}

export default {
  fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext) {
    return handleRequest(request, env, ctx);
  },
};
